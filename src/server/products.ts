import "server-only";
import type { ProductCategory, SaleUnit } from "@/generated/prisma/client";
import { formatPeso } from "@/lib/format";
import { audit } from "./audit";
import { db } from "./db";
import { DomainError } from "./errors";
import { dec } from "./inventory";
import { publish } from "./realtime";

export type ProductInput = {
  name: string;
  localName?: string;
  sku: string;
  description: string;
  category: ProductCategory;
  unit: SaleUnit;
  price: number;
  lowStockThreshold: number;
  minOrderQty: number;
  qtyStep: number;
  imageUrl?: string;
};

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function checkRules(input: ProductInput) {
  if (input.unit === "PIECE" && (!Number.isInteger(input.minOrderQty) || !Number.isInteger(input.qtyStep))) {
    throw new DomainError("Per-piece products need whole-number minimum order and step.");
  }
  const steps = input.minOrderQty / input.qtyStep;
  if (Math.abs(steps - Math.round(steps)) > 1e-6) {
    throw new DomainError("Minimum order must be a multiple of the quantity step.");
  }
}

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = base || "product";
  for (let i = 2; ; i++) {
    const clash = await db.product.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
}

export async function createProduct(actorId: string, input: ProductInput) {
  checkRules(input);
  const skuTaken = await db.product.findUnique({ where: { sku: input.sku }, select: { id: true } });
  if (skuTaken) throw new DomainError("That SKU is already used by another product.");
  const slug = await uniqueSlug(slugify(input.name));
  return db.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        ...input,
        localName: input.localName || null,
        imageUrl: input.imageUrl || null,
        slug,
        price: dec(input.price),
        lowStockThreshold: dec(input.lowStockThreshold),
        minOrderQty: dec(input.minOrderQty),
        qtyStep: dec(input.qtyStep),
      },
    });
    await audit(tx, {
      actorId,
      action: "product.create",
      entityType: "Product",
      entityId: p.id,
      summary: `Created product ${p.name} at ${formatPeso(input.price)}`,
    });
    await publish({ kind: "catalog", topics: ["all"] }, tx);
    return p;
  });
}

export async function updateProduct(actorId: string, productId: string, input: ProductInput) {
  checkRules(input);
  const existing = await db.product.findUnique({ where: { id: productId } });
  if (!existing) throw new DomainError("Product not found.");
  const skuTaken = await db.product.findFirst({
    where: { sku: input.sku, NOT: { id: productId } },
    select: { id: true },
  });
  if (skuTaken) throw new DomainError("That SKU is already used by another product.");
  if (existing.unit !== input.unit && existing.stockQty.gt(0)) {
    throw new DomainError("Change the selling unit only when the product has no stock.");
  }
  const slug = existing.name === input.name ? existing.slug : await uniqueSlug(slugify(input.name), productId);

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        ...input,
        localName: input.localName || null,
        imageUrl: input.imageUrl || null,
        slug,
        price: dec(input.price),
        lowStockThreshold: dec(input.lowStockThreshold),
        minOrderQty: dec(input.minOrderQty),
        qtyStep: dec(input.qtyStep),
      },
    });
    const priceChanged = !existing.price.eq(input.price);
    await audit(tx, {
      actorId,
      action: priceChanged ? "product.price_change" : "product.update",
      entityType: "Product",
      entityId: productId,
      summary: priceChanged
        ? `Changed price of ${input.name}: ${formatPeso(existing.price.toNumber())} → ${formatPeso(input.price)}`
        : `Updated product ${input.name}`,
      details: {
        before: {
          name: existing.name,
          price: existing.price.toNumber(),
          lowStockThreshold: existing.lowStockThreshold.toNumber(),
          category: existing.category,
        },
        after: { name: input.name, price: input.price, lowStockThreshold: input.lowStockThreshold, category: input.category },
      },
    });
    await publish({ kind: "catalog", topics: ["all"] }, tx);
  });
}

export async function setProductArchived(actorId: string, productId: string, archived: boolean) {
  await db.$transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { id: productId } });
    if (!p) throw new DomainError("Product not found.");
    if (archived && p.reservedQty.gt(0)) {
      throw new DomainError("This product has stock reserved for open orders. Finish those orders before archiving.");
    }
    await tx.product.update({ where: { id: productId }, data: { archived } });
    await audit(tx, {
      actorId,
      action: archived ? "product.archive" : "product.restore",
      entityType: "Product",
      entityId: productId,
      summary: `${archived ? "Archived" : "Restored"} product ${p.name}`,
    });
    await publish({ kind: "catalog", topics: ["all"] }, tx);
  });
}
