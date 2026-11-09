import "server-only";
import { addDaysKey, manilaDateKey, manilaDayStart, resolveRange } from "@/lib/dates";
import { db } from "../db";
import { listInventory } from "./inventory";
import { listOrders } from "./orders";
import { salesReport } from "./reports";

export async function ownerDashboard() {
  const now = new Date();
  const todayKey = manilaDateKey(now);
  const todayStart = manilaDayStart(todayKey);
  const yesterdayStart = manilaDayStart(addDaysKey(todayKey, -1));

  const [today, yesterday, openOrders, queue, products, workers, recentOrders, sales] = await Promise.all([
    db.order.aggregate({
      where: { status: "COMPLETED", completedAt: { gte: todayStart } },
      _sum: { finalTotal: true },
      _count: { _all: true },
    }),
    db.order.aggregate({
      where: { status: "COMPLETED", completedAt: { gte: yesterdayStart, lt: todayStart } },
      _sum: { finalTotal: true },
    }),
    db.order.count({ where: { status: { in: ["ASSIGNED", "PROCESSING", "READY"] } } }),
    db.order.count({ where: { status: "PENDING" } }),
    listInventory(),
    db.user.findMany({
      where: { role: "WORKER", active: true },
      select: {
        id: true,
        name: true,
        dutyStatus: true,
        _count: { select: { assignedOrders: { where: { status: { in: ["ASSIGNED", "PROCESSING"] } } } } },
      },
      orderBy: { name: "asc" },
    }),
    listOrders({ take: 6 }),
    salesReport(resolveRange(undefined, undefined, now, 14)),
  ]);

  const attention = await db.order.count({ where: { cancelRequest: "PENDING" } });

  return {
    todayRevenue: today._sum.finalTotal?.toNumber() ?? 0,
    yesterdayRevenue: yesterday._sum.finalTotal?.toNumber() ?? 0,
    todayCompleted: today._count._all,
    openOrders,
    queue,
    attention,
    productCount: products.length,
    stockValue: products.reduce((s, p) => s + p.stockQty * p.price, 0),
    lowStock: products.filter((p) => p.level !== "ok"),
    workers: workers.map((w) => ({ id: w.id, name: w.name, dutyStatus: w.dutyStatus, load: w._count.assignedOrders })),
    recentOrders,
    sales,
  };
}

export async function workerDashboardStats(workerId: string) {
  const todayStart = manilaDayStart(manilaDateKey(new Date()));
  const [completedToday, handledTotal] = await Promise.all([
    db.order.count({ where: { workerId, status: "COMPLETED", completedAt: { gte: todayStart } } }),
    db.order.count({ where: { workerId, status: "COMPLETED" } }),
  ]);
  return { completedToday, handledTotal };
}
