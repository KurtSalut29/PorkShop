import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { eachDayKey } from "@/lib/dates";
import { db } from "../db";
import { listInventory } from "./inventory";

type Range = { fromKey: string; toKey: string; start: Date; end: Date };

/** Completed orders = recognised sales. Revenue uses the final (actual-weight) totals. */
export async function salesReport(range: Range) {
  const daily = await db.$queryRaw<{ day: string; orders: number; revenue: Prisma.Decimal }[]>`
    SELECT to_char(("completedAt" AT TIME ZONE 'Asia/Manila')::date, 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS orders,
           COALESCE(SUM(COALESCE("finalTotal", "estimatedTotal")), 0) AS revenue
    FROM "Order"
    WHERE status = 'COMPLETED' AND "completedAt" >= ${range.start} AND "completedAt" < ${range.end}
    GROUP BY 1 ORDER BY 1`;
  const dayMap = new Map(daily.map((d) => [d.day, d]));
  const series = eachDayKey(range.fromKey, range.toKey).map((day) => ({
    day,
    orders: dayMap.get(day)?.orders ?? 0,
    revenue: dayMap.get(day)?.revenue.toNumber() ?? 0,
  }));

  const byProduct = await db.$queryRaw<
    { productId: string; name: string; unit: "KG" | "PIECE"; qty: Prisma.Decimal; revenue: Prisma.Decimal; orders: number }[]
  >`
    SELECT i."productId", MAX(i."productName") AS name, MAX(i.unit::text) AS unit,
           SUM(COALESCE(i."actualQty", i."orderedQty")) AS qty,
           SUM(COALESCE(i."finalTotal", i."estimatedTotal")) AS revenue,
           COUNT(DISTINCT o.id)::int AS orders
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE o.status = 'COMPLETED' AND o."completedAt" >= ${range.start} AND o."completedAt" < ${range.end}
    GROUP BY i."productId" ORDER BY revenue DESC`;

  const byMethod = await db.order.groupBy({
    by: ["paymentMethod"],
    where: { status: "COMPLETED", completedAt: { gte: range.start, lt: range.end } },
    _count: { _all: true },
    _sum: { finalTotal: true },
  });

  const cancelled = await db.order.count({
    where: { status: "CANCELLED", cancelledAt: { gte: range.start, lt: range.end } },
  });

  const totalRevenue = series.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = series.reduce((s, d) => s + d.orders, 0);

  // How actual weights compare to what customers ordered (positive = customers paid more).
  const [variance] = await db.$queryRaw<{ estimated: Prisma.Decimal | null; final: Prisma.Decimal | null }[]>`
    SELECT SUM("estimatedTotal") AS estimated, SUM("finalTotal") AS final FROM "Order"
    WHERE status = 'COMPLETED' AND "completedAt" >= ${range.start} AND "completedAt" < ${range.end}`;

  return {
    series,
    totalRevenue,
    totalOrders,
    averageOrder: totalOrders ? totalRevenue / totalOrders : 0,
    cancelled,
    weightVariance: (variance?.final?.toNumber() ?? 0) - (variance?.estimated?.toNumber() ?? 0),
    byProduct: byProduct.map((p) => ({
      productId: p.productId,
      name: p.name,
      unit: p.unit,
      qty: p.qty.toNumber(),
      revenue: p.revenue.toNumber(),
      orders: p.orders,
    })),
    byMethod: byMethod.map((m) => ({
      method: m.paymentMethod ?? "CASH",
      orders: m._count._all,
      revenue: m._sum.finalTotal?.toNumber() ?? 0,
    })),
  };
}

export type SalesReport = Awaited<ReturnType<typeof salesReport>>;

/** Stock movement totals per product and type for a period. */
export async function movementReport(range: Range) {
  const rows = await db.$queryRaw<
    { productId: string; name: string; unit: "KG" | "PIECE"; type: string; qty: Prisma.Decimal; count: number }[]
  >`
    SELECT t."productId", p.name, p.unit::text AS unit, t.type::text AS type,
           SUM(t.quantity) AS qty, COUNT(*)::int AS count
    FROM "StockTransaction" t JOIN "Product" p ON p.id = t."productId"
    WHERE t."createdAt" >= ${range.start} AND t."createdAt" < ${range.end}
    GROUP BY t."productId", p.name, p.unit, t.type`;

  const products = await listInventory();
  const table = products.map((p) => {
    const mine = rows.filter((r) => r.productId === p.id);
    const sum = (type: string) => mine.filter((r) => r.type === type).reduce((s, r) => s + r.qty.toNumber(), 0);
    return {
      productId: p.id,
      name: p.name,
      unit: p.unit,
      stockIn: sum("STOCK_IN"),
      withdrawn: -sum("WITHDRAWAL"),
      returned: sum("RETURN"),
      spoiled: -sum("SPOILAGE"),
      corrected: sum("CORRECTION"),
      onHand: p.stockQty,
      spoilageValue: -sum("SPOILAGE") * p.price,
    };
  });

  return {
    table,
    totals: {
      spoilageValue: table.reduce((s, r) => s + r.spoilageValue, 0),
      transactions: rows.reduce((s, r) => s + r.count, 0),
    },
  };
}

export type MovementReport = Awaited<ReturnType<typeof movementReport>>;

export async function inventoryReport() {
  const products = await listInventory();
  return {
    products,
    totalValue: products.reduce((s, p) => s + p.stockQty * p.price, 0),
    lowCount: products.filter((p) => p.level === "low").length,
    outCount: products.filter((p) => p.level === "out").length,
  };
}
