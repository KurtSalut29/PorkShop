import "server-only";
import { generatePickupDays, slotWindow } from "@/lib/slots";
import { db } from "../db";
import { getSettings } from "../settings";

export async function listNotifications(userId: string, take = 50) {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
  }));
}

export type NotificationView = Awaited<ReturnType<typeof listNotifications>>[number];

export function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function listAuditLog(opts: { entityType?: string; q?: string; take?: number } = {}) {
  const rows = await db.auditLog.findMany({
    where: {
      ...(opts.entityType ? { entityType: opts.entityType } : {}),
      ...(opts.q ? { summary: { contains: opts.q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 200,
    include: { actor: { select: { name: true, role: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    summary: r.summary,
    details: r.details,
    actor: r.actor,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Pickup slots with live remaining capacity. */
export async function pickupDays() {
  const settings = await getSettings();
  const now = new Date();
  const { from, to } = slotWindow(now, settings);
  const booked = await db.order.groupBy({
    by: ["pickupAt"],
    where: { pickupAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
    _count: { _all: true },
  });
  const bookedMap = Object.fromEntries(booked.map((b) => [b.pickupAt.toISOString(), b._count._all]));
  return { days: generatePickupDays(now, settings, bookedMap), slotMinutes: settings.slotMinutes };
}

export async function listWorkers() {
  const rows = await db.user.findMany({
    where: { role: "WORKER" },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      active: true,
      dutyStatus: true,
      maxActiveOrders: true,
      createdAt: true,
      _count: {
        select: {
          assignedOrders: { where: { status: { in: ["ASSIGNED", "PROCESSING", "READY"] } } },
        },
      },
    },
  });
  const completed = await db.order.groupBy({
    by: ["workerId"],
    where: { status: "COMPLETED", workerId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const doneMap = new Map(completed.map((c) => [c.workerId, c._count._all]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    active: r.active,
    dutyStatus: r.dutyStatus,
    maxActiveOrders: r.maxActiveOrders,
    createdAt: r.createdAt.toISOString(),
    openOrders: r._count.assignedOrders,
    completed: doneMap.get(r.id) ?? 0,
  }));
}

export type WorkerRow = Awaited<ReturnType<typeof listWorkers>>[number];
