import "server-only";
import { Prisma, type StockTxnType } from "@/generated/prisma/client";
import { formatQty, orderCode } from "@/lib/format";
import { audit } from "./audit";
import { db, type Tx } from "./db";
import { DomainError } from "./errors";
import { notifyOwners } from "./notifications";
import { publish } from "./realtime";

export const dec = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

type Availability = Map<string, Prisma.Decimal>;

export async function availabilityOf(tx: Tx, productIds: string[]): Promise<Availability> {
  const rows = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, stockQty: true, reservedQty: true },
  });
  return new Map(rows.map((r) => [r.id, r.stockQty.minus(r.reservedQty)]));
}

/**
 * Sends a low-stock alert to the owner(s) only when a product *crosses* its threshold,
 * so a busy day doesn't flood the owner with repeated alerts.
 */
export async function alertOnLowStock(tx: Tx, before: Availability) {
  if (before.size === 0) return;
  const products = await tx.product.findMany({
    where: { id: { in: [...before.keys()] } },
    select: { id: true, name: true, unit: true, stockQty: true, reservedQty: true, lowStockThreshold: true },
  });
  for (const p of products) {
    const prev = before.get(p.id)!;
    const now = p.stockQty.minus(p.reservedQty);
    const threshold = p.lowStockThreshold;
    if (prev.gt(threshold) && now.lte(threshold)) {
      const out = now.lte(0);
      await notifyOwners(tx, {
        type: "STOCK",
        title: out ? `${p.name} is out of stock` : `Low stock: ${p.name}`,
        body: `${formatQty(Math.max(0, now.toNumber()), p.unit)} available (alert level ${formatQty(threshold.toNumber(), p.unit)}).`,
        href: `/owner/inventory?product=${p.id}`,
      });
    }
  }
}

async function logTxn(
  tx: Tx,
  data: {
    productId: string;
    type: StockTxnType;
    quantity: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    reason?: string | null;
    orderId?: string | null;
    actorId: string | null;
  },
) {
  await tx.stockTransaction.create({ data });
}

async function announceInventoryChange(tx: Tx) {
  await publish({ kind: "inventory", topics: ["all"] }, tx);
}

async function getProductOrThrow(tx: Tx, productId: string) {
  const p = await tx.product.findUnique({ where: { id: productId } });
  if (!p) throw new DomainError("Product not found.");
  return p;
}

function assertUnitQty(unit: "KG" | "PIECE", qty: number) {
  if (unit === "PIECE" && !Number.isInteger(qty)) throw new DomainError("Pieces must be whole numbers.");
}

/** Owner: receive a delivery / restock. */
export async function addStock(actorId: string, productId: string, qty: number, reason?: string) {
  return db.$transaction(async (tx) => {
    const p = await getProductOrThrow(tx, productId);
    assertUnitQty(p.unit, qty);
    const [row] = await tx.$queryRaw<{ stockQty: Prisma.Decimal }[]>`
      UPDATE "Product" SET "stockQty" = "stockQty" + ${qty}::numeric, "updatedAt" = now()
      WHERE id = ${productId} RETURNING "stockQty"`;
    await logTxn(tx, {
      productId,
      type: "STOCK_IN",
      quantity: dec(qty),
      balanceAfter: dec(row!.stockQty),
      reason: reason || "Stock delivery",
      actorId,
    });
    await audit(tx, {
      actorId,
      action: "stock.in",
      entityType: "Product",
      entityId: productId,
      summary: `Added ${formatQty(qty, p.unit)} of ${p.name}`,
      details: { qty, reason: reason ?? null, balanceAfter: dec(row!.stockQty).toNumber() },
    });
    await announceInventoryChange(tx);
  });
}

/**
 * Removes stock that is not tied to an order (spoilage write-off or a manual withdrawal).
 * Only *unreserved* stock can be removed, so customers' confirmed orders are never undercut.
 */
async function removeUnreservedStock(
  type: "SPOILAGE" | "WITHDRAWAL",
  actorId: string,
  productId: string,
  qty: number,
  reason: string | undefined,
) {
  return db.$transaction(async (tx) => {
    const p = await getProductOrThrow(tx, productId);
    assertUnitQty(p.unit, qty);
    const before = await availabilityOf(tx, [productId]);
    const rows = await tx.$queryRaw<{ stockQty: Prisma.Decimal }[]>`
      UPDATE "Product" SET "stockQty" = "stockQty" - ${qty}::numeric, "updatedAt" = now()
      WHERE id = ${productId} AND "stockQty" - "reservedQty" >= ${qty}::numeric
      RETURNING "stockQty"`;
    if (rows.length === 0) {
      const avail = before.get(productId)!;
      throw new DomainError(
        `Only ${formatQty(Math.max(0, avail.toNumber()), p.unit)} of ${p.name} is unreserved. Reserved stock belongs to customer orders.`,
      );
    }
    await logTxn(tx, {
      productId,
      type,
      quantity: dec(-qty),
      balanceAfter: dec(rows[0]!.stockQty),
      reason: reason || (type === "SPOILAGE" ? "Spoilage" : "Manual withdrawal"),
      actorId,
    });
    await audit(tx, {
      actorId,
      action: type === "SPOILAGE" ? "stock.spoilage" : "stock.withdrawal",
      entityType: "Product",
      entityId: productId,
      summary: `${type === "SPOILAGE" ? "Wrote off" : "Withdrew"} ${formatQty(qty, p.unit)} of ${p.name}`,
      details: { qty, reason: reason ?? null },
    });
    await alertOnLowStock(tx, before);
    await announceInventoryChange(tx);
  });
}

export const recordSpoilage = (actorId: string, productId: string, qty: number, reason?: string) =>
  removeUnreservedStock("SPOILAGE", actorId, productId, qty, reason);

export const recordManualWithdrawal = (actorId: string, productId: string, qty: number, reason?: string) =>
  removeUnreservedStock("WITHDRAWAL", actorId, productId, qty, reason);

/** Worker/Owner: product returned to inventory (e.g. a customer return or an unused cut). */
export async function recordReturn(
  actorId: string,
  productId: string,
  qty: number,
  reason?: string,
  orderNumber?: number,
) {
  return db.$transaction(async (tx) => {
    const p = await getProductOrThrow(tx, productId);
    assertUnitQty(p.unit, qty);
    let orderId: string | null = null;
    if (orderNumber) {
      const order = await tx.order.findUnique({ where: { number: orderNumber }, select: { id: true } });
      if (!order) throw new DomainError(`Order ${orderCode(orderNumber)} was not found.`);
      orderId = order.id;
    }
    const [row] = await tx.$queryRaw<{ stockQty: Prisma.Decimal }[]>`
      UPDATE "Product" SET "stockQty" = "stockQty" + ${qty}::numeric, "updatedAt" = now()
      WHERE id = ${productId} RETURNING "stockQty"`;
    await logTxn(tx, {
      productId,
      type: "RETURN",
      quantity: dec(qty),
      balanceAfter: dec(row!.stockQty),
      reason: reason || "Returned to inventory",
      orderId,
      actorId,
    });
    await audit(tx, {
      actorId,
      action: "stock.return",
      entityType: "Product",
      entityId: productId,
      summary: `Returned ${formatQty(qty, p.unit)} of ${p.name}${orderNumber ? ` (order ${orderCode(orderNumber)})` : ""}`,
      details: { qty, reason: reason ?? null, orderNumber: orderNumber ?? null },
    });
    await announceInventoryChange(tx);
  });
}

/** Owner: physical count correction — sets on-hand stock to the counted quantity. */
export async function correctCount(actorId: string, productId: string, countedQty: number, reason: string) {
  return db.$transaction(async (tx) => {
    const [p] = await tx.$queryRaw<
      { id: string; name: string; unit: "KG" | "PIECE"; stockQty: Prisma.Decimal; reservedQty: Prisma.Decimal }[]
    >`SELECT id, name, unit, "stockQty", "reservedQty" FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    if (!p) throw new DomainError("Product not found.");
    assertUnitQty(p.unit, countedQty);
    const counted = dec(countedQty);
    if (counted.lt(p.reservedQty)) {
      throw new DomainError(
        `${formatQty(dec(p.reservedQty).toNumber(), p.unit)} is reserved for open orders. Cancel or reassign those orders before counting lower.`,
      );
    }
    const delta = counted.minus(p.stockQty);
    if (delta.isZero()) throw new DomainError("The counted quantity matches the current stock.");
    const before = await availabilityOf(tx, [productId]);
    await tx.product.update({ where: { id: productId }, data: { stockQty: counted } });
    await logTxn(tx, {
      productId,
      type: "CORRECTION",
      quantity: delta,
      balanceAfter: counted,
      reason,
      actorId,
    });
    await audit(tx, {
      actorId,
      action: "stock.correction",
      entityType: "Product",
      entityId: productId,
      summary: `Count correction for ${p.name}: ${formatQty(dec(p.stockQty).toNumber(), p.unit)} → ${formatQty(countedQty, p.unit)}`,
      details: { from: dec(p.stockQty).toNumber(), to: countedQty, reason },
    });
    await alertOnLowStock(tx, before);
    await announceInventoryChange(tx);
  });
}
