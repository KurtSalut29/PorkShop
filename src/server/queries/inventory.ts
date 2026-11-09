import "server-only";
import type { Prisma, StockTxnType } from "@/generated/prisma/client";
import { db } from "../db";
import { toProductView } from "./catalog";

export async function listInventory() {
  const products = await db.product.findMany({ where: { archived: false }, orderBy: { name: "asc" } });
  return products.map(toProductView);
}

const TXN_TYPES: StockTxnType[] = ["STOCK_IN", "WITHDRAWAL", "RETURN", "SPOILAGE", "CORRECTION"];

export async function listStockTransactions(filters: {
  productId?: string;
  type?: string;
  start?: Date;
  end?: Date;
  actorId?: string;
  take?: number;
}) {
  const where: Prisma.StockTransactionWhereInput = {};
  if (filters.productId) where.productId = filters.productId;
  if (filters.type && (TXN_TYPES as string[]).includes(filters.type)) where.type = filters.type as StockTxnType;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.start || filters.end) where.createdAt = { gte: filters.start, lt: filters.end };
  const rows = await db.stockTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters.take ?? 200,
    include: {
      product: { select: { name: true, unit: true } },
      actor: { select: { name: true, role: true } },
      order: { select: { id: true, number: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    type: t.type,
    quantity: t.quantity.toNumber(),
    balanceAfter: t.balanceAfter.toNumber(),
    reason: t.reason,
    createdAt: t.createdAt.toISOString(),
    product: t.product,
    productId: t.productId,
    actor: t.actor,
    order: t.order,
  }));
}

export type StockTxnView = Awaited<ReturnType<typeof listStockTransactions>>[number];

export async function productOptions() {
  const rows = await db.product.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, stockQty: true, reservedQty: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    available: Math.max(0, r.stockQty.minus(r.reservedQty).toNumber()),
    stockQty: r.stockQty.toNumber(),
  }));
}

export type ProductOption = Awaited<ReturnType<typeof productOptions>>[number];
