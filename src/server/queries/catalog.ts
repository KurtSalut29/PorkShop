import "server-only";
import type { Prisma, Product, ProductCategory } from "@/generated/prisma/client";
import { stockLevel } from "@/lib/pricing";
import { db } from "../db";

export type ProductView = ReturnType<typeof toProductView>;

export function toProductView(p: Product) {
  const stockQty = p.stockQty.toNumber();
  const reservedQty = p.reservedQty.toNumber();
  const available = Math.max(0, Math.round((stockQty - reservedQty) * 1000) / 1000);
  const lowStockThreshold = p.lowStockThreshold.toNumber();
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    localName: p.localName,
    description: p.description,
    category: p.category,
    unit: p.unit,
    price: p.price.toNumber(),
    stockQty,
    reservedQty,
    available,
    lowStockThreshold,
    minOrderQty: p.minOrderQty.toNumber(),
    qtyStep: p.qtyStep.toNumber(),
    imageUrl: p.imageUrl,
    archived: p.archived,
    level: stockLevel(available, lowStockThreshold),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const CATEGORY_ORDER: ProductCategory[] = ["PRIME_CUTS", "RIBS_AND_BONES", "GROUND", "SPECIALTY", "FAT"];

export async function listCatalog(opts: { q?: string; category?: string; includeArchived?: boolean } = {}) {
  const where: Prisma.ProductWhereInput = {};
  if (!opts.includeArchived) where.archived = false;
  if (opts.category && (CATEGORY_ORDER as string[]).includes(opts.category)) {
    where.category = opts.category as ProductCategory;
  }
  if (opts.q) {
    where.OR = [
      { name: { contains: opts.q, mode: "insensitive" } },
      { localName: { contains: opts.q, mode: "insensitive" } },
      { sku: { contains: opts.q, mode: "insensitive" } },
    ];
  }
  const products = await db.product.findMany({ where, orderBy: [{ name: "asc" }] });
  return products
    .map(toProductView)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name));
}

export async function getProductBySlug(slug: string) {
  const p = await db.product.findUnique({ where: { slug } });
  return p && !p.archived ? toProductView(p) : null;
}

export async function getProductById(id: string) {
  const p = await db.product.findUnique({ where: { id } });
  return p ? toProductView(p) : null;
}

export async function getProductsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const products = await db.product.findMany({ where: { id: { in: ids } } });
  return products.map(toProductView);
}

export async function listRelated(product: ProductView, take = 4) {
  const products = await db.product.findMany({
    where: { archived: false, id: { not: product.id } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return products
    .map(toProductView)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category))
    .slice(0, take);
}
