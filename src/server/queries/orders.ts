import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { db } from "../db";
import { getSettings } from "../settings";

const orderInclude = {
  items: { orderBy: { productName: "asc" } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  worker: { select: { id: true, name: true, dutyStatus: true, active: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderView(o: OrderRow) {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    workerId: o.workerId,
    pickupAt: o.pickupAt.toISOString(),
    notes: o.notes,
    estimatedTotal: o.estimatedTotal.toNumber(),
    finalTotal: o.finalTotal?.toNumber() ?? null,
    total: (o.finalTotal ?? o.estimatedTotal).toNumber(),
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    cancelRequest: o.cancelRequest,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt.toISOString(),
    assignedAt: o.assignedAt?.toISOString() ?? null,
    processingAt: o.processingAt?.toISOString() ?? null,
    readyAt: o.readyAt?.toISOString() ?? null,
    completedAt: o.completedAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    customer: o.customer,
    worker: o.worker,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      unit: i.unit,
      unitPrice: i.unitPrice.toNumber(),
      orderedQty: i.orderedQty.toNumber(),
      actualQty: i.actualQty?.toNumber() ?? null,
      estimatedTotal: i.estimatedTotal.toNumber(),
      finalTotal: i.finalTotal?.toNumber() ?? null,
    })),
  };
}

export type OrderView = ReturnType<typeof toOrderView>;

async function withEvents(where: Prisma.OrderWhereInput) {
  const o = await db.order.findFirst({
    where,
    include: {
      ...orderInclude,
      events: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true, role: true } } },
      },
    },
  });
  if (!o) return null;
  return {
    ...toOrderView(o),
    events: o.events.map((e) => ({
      id: e.id,
      type: e.type,
      toStatus: e.toStatus,
      message: e.message,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof withEvents>>>;

// ── Customer ──
export async function listCustomerOrders(customerId: string, scope: "active" | "past" | "all" = "all") {
  const where: Prisma.OrderWhereInput = { customerId };
  if (scope === "active") where.status = { in: ACTIVE_STATUSES as OrderStatus[] };
  if (scope === "past") where.status = { in: ["COMPLETED", "CANCELLED"] };
  const rows = await db.order.findMany({ where, include: orderInclude, orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map(toOrderView);
}

export const getCustomerOrder = (customerId: string, orderId: string) => withEvents({ id: orderId, customerId });

// ── Worker ──
export async function listWorkerQueue(workerId: string) {
  const rows = await db.order.findMany({
    where: { workerId, status: { in: ["ASSIGNED", "PROCESSING", "READY"] } },
    include: orderInclude,
    orderBy: [{ pickupAt: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toOrderView);
}

export async function listWorkerHistory(workerId: string, take = 100) {
  const rows = await db.order.findMany({
    where: {
      OR: [
        { workerId, status: { in: ["COMPLETED", "CANCELLED"] } },
        // orders this worker handled before they were reassigned
        { events: { some: { workerId } }, NOT: { workerId } },
      ],
    },
    include: orderInclude,
    orderBy: { updatedAt: "desc" },
    take,
  });
  return rows.map(toOrderView);
}

export const getWorkerOrder = (workerId: string, orderId: string) => withEvents({ id: orderId, workerId });

// ── Owner ──
export async function listOrders(filters: {
  status?: string;
  q?: string;
  workerId?: string;
  attention?: boolean;
  take?: number;
}) {
  const where: Prisma.OrderWhereInput = {};
  if (filters.status === "ACTIVE") where.status = { in: ACTIVE_STATUSES as OrderStatus[] };
  else if (filters.status && filters.status !== "ALL") where.status = filters.status as OrderStatus;
  if (filters.workerId) where.workerId = filters.workerId === "none" ? null : filters.workerId;
  if (filters.attention) where.cancelRequest = "PENDING";
  if (filters.q) {
    const n = Number(filters.q.replace(/[^0-9]/g, ""));
    where.OR = [
      { customer: { name: { contains: filters.q, mode: "insensitive" } } },
      { customer: { email: { contains: filters.q, mode: "insensitive" } } },
      ...(Number.isFinite(n) && n > 0 ? [{ number: n }] : []),
    ];
  }
  const rows = await db.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: filters.take ?? 100,
  });
  return rows.map(toOrderView);
}

export const getOrderForOwner = (orderId: string) => withEvents({ id: orderId });

export async function orderStatusCounts() {
  const rows = await db.order.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<OrderStatus, number>>;
  const attention = await db.order.count({ where: { cancelRequest: "PENDING" } });
  return { counts, attention };
}

/** Assignment monitor: each worker's live load plus the queue and recent assignment decisions. */
export async function assignmentOverview() {
  const settings = await getSettings();
  const workers = await db.user.findMany({
    where: { role: "WORKER" },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      dutyStatus: true,
      dutyChangedAt: true,
      lastAssignedAt: true,
      maxActiveOrders: true,
      assignedOrders: {
        where: { status: { in: ["ASSIGNED", "PROCESSING", "READY"] } },
        select: { id: true, number: true, status: true, pickupAt: true },
        orderBy: { pickupAt: "asc" },
      },
    },
  });

  const startOfDay = new Date(Date.now() - ((Date.now() + 8 * 3600_000) % 86_400_000));
  const completedToday = await db.order.groupBy({
    by: ["workerId"],
    where: { status: "COMPLETED", completedAt: { gte: startOfDay } },
    _count: { _all: true },
  });
  const doneMap = new Map(completedToday.map((r) => [r.workerId, r._count._all]));

  const queue = await db.order.findMany({
    where: { status: "PENDING" },
    include: orderInclude,
    orderBy: [{ pickupAt: "asc" }, { createdAt: "asc" }],
  });

  const needsAttention = await db.order.findMany({
    where: {
      status: { in: ["ASSIGNED", "PROCESSING", "READY"] },
      worker: { OR: [{ active: false }, { dutyStatus: "OFF_DUTY" }] },
    },
    include: orderInclude,
    orderBy: { pickupAt: "asc" },
  });

  const log = await db.orderEvent.findMany({
    where: { type: { in: ["ASSIGNED", "REASSIGNED", "REQUEUED"] } },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { order: { select: { number: true, id: true } }, actor: { select: { name: true } } },
  });

  return {
    defaultCapacity: settings.maxActiveOrdersPerWorker,
    workers: workers.map((w) => {
      const capacity = w.maxActiveOrders ?? settings.maxActiveOrdersPerWorker;
      const load = w.assignedOrders.filter((o) => o.status === "ASSIGNED" || o.status === "PROCESSING").length;
      return {
        id: w.id,
        name: w.name,
        active: w.active,
        dutyStatus: w.dutyStatus,
        dutyChangedAt: w.dutyChangedAt?.toISOString() ?? null,
        lastAssignedAt: w.lastAssignedAt?.toISOString() ?? null,
        capacity,
        load,
        ready: w.assignedOrders.filter((o) => o.status === "READY").length,
        completedToday: doneMap.get(w.id) ?? 0,
        orders: w.assignedOrders.map((o) => ({ ...o, pickupAt: o.pickupAt.toISOString() })),
      };
    }),
    queue: queue.map(toOrderView),
    needsAttention: needsAttention.map(toOrderView),
    log: log.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
      orderId: e.order.id,
      orderNumber: e.order.number,
      actor: e.actor?.name ?? "System",
    })),
  };
}

export async function listAssignableWorkers() {
  const settings = await getSettings();
  const workers = await db.user.findMany({
    where: { role: "WORKER", active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      dutyStatus: true,
      maxActiveOrders: true,
      _count: { select: { assignedOrders: { where: { status: { in: ["ASSIGNED", "PROCESSING"] } } } } },
    },
  });
  return workers.map((w) => ({
    id: w.id,
    name: w.name,
    dutyStatus: w.dutyStatus,
    load: w._count.assignedOrders,
    capacity: w.maxActiveOrders ?? settings.maxActiveOrdersPerWorker,
  }));
}
