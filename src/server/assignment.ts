import "server-only";
import { planAssignments } from "@/lib/assignment";
import { orderCode } from "@/lib/format";
import { db } from "./db";
import { notifyUsers } from "./notifications";
import { publish } from "./realtime";
import { getSettings } from "./settings";

/** Arbitrary constant key for the cluster-wide assignment lock. */
const ASSIGNMENT_LOCK_KEY = 72_001;

/**
 * Assigns queued (PENDING) orders to on-duty workers.
 *
 * Safe to call from any number of server instances at the same time: a transaction-scoped
 * PostgreSQL advisory lock makes the dispatcher a single critical section cluster-wide, and
 * `FOR UPDATE SKIP LOCKED` lets it skip orders that another transaction is currently changing
 * (e.g. a customer cancelling) instead of blocking on them.
 */
export async function runAssignment(): Promise<number> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ASSIGNMENT_LOCK_KEY})`;
      const settings = await getSettings(tx);

      const queued = await tx.$queryRaw<{ id: string; number: number; customerId: string }[]>`
        SELECT id, number, "customerId" FROM "Order"
        WHERE status = 'PENDING' AND "workerId" IS NULL
        ORDER BY "pickupAt" ASC, "createdAt" ASC
        LIMIT 200
        FOR UPDATE SKIP LOCKED`;
      if (queued.length === 0) return 0;

      const workers = await tx.$queryRaw<
        { id: string; name: string; activeCount: number; capacity: number; lastAssignedAt: Date | null }[]
      >`
        SELECT u.id, u.name, u."lastAssignedAt",
               COALESCE(u."maxActiveOrders", ${settings.maxActiveOrdersPerWorker})::int AS capacity,
               (SELECT COUNT(*)::int FROM "Order" o
                 WHERE o."workerId" = u.id AND o.status IN ('ASSIGNED', 'PROCESSING')) AS "activeCount"
        FROM "user" u
        WHERE u.role = 'WORKER' AND u.active = true AND u."dutyStatus" = 'ON_DUTY'
        FOR UPDATE OF u`;
      if (workers.length === 0) return 0;

      const now = new Date();
      const plan = planAssignments(
        queued.map((o) => o.id),
        workers,
        now,
      );
      const byId = new Map(queued.map((o) => [o.id, o]));

      for (const { orderId, worker, loadAfter } of plan) {
        const order = byId.get(orderId)!;
        await tx.order.update({
          where: { id: orderId },
          data: { workerId: worker.id, status: "ASSIGNED", assignedAt: now },
        });
        await tx.orderEvent.create({
          data: {
            orderId,
            type: "ASSIGNED",
            fromStatus: "PENDING",
            toStatus: "ASSIGNED",
            workerId: worker.id,
            message: `Automatically assigned to ${worker.name} (workload ${loadAfter}/${worker.capacity})`,
          },
        });
        await notifyUsers(tx, [worker.id], {
          type: "ORDER",
          title: `New order ${orderCode(order.number)}`,
          body: "A new order was assigned to you.",
          href: `/worker/orders/${orderId}`,
        });
        await notifyUsers(tx, [order.customerId], {
          type: "ORDER",
          title: `Order ${orderCode(order.number)} assigned`,
          body: `${worker.name.split(" ")[0]} will prepare your order.`,
          href: `/orders/${orderId}`,
        });
      }

      for (const w of workers) {
        const assigned = plan.filter((p) => p.worker.id === w.id);
        if (assigned.length) {
          await tx.user.update({
            where: { id: w.id },
            data: { lastAssignedAt: assigned[assigned.length - 1]!.worker.lastAssignedAt },
          });
        }
      }

      if (plan.length) {
        await publish({ kind: "orders", topics: ["role:OWNER", "role:WORKER"] }, tx);
      }
      return plan.length;
    },
    { timeout: 15_000 },
  );
}

/** Fire-and-forget wrapper used after commits; failures are logged and retried by the sweeper. */
export function triggerAssignment() {
  runAssignment().catch((err) => console.error("[assignment] run failed", err));
}

const globalForSweeper = globalThis as unknown as { assignmentSweeper?: NodeJS.Timeout };

/** Background safety net: re-runs the dispatcher periodically in case a trigger was missed. */
export function startAssignmentSweeper(intervalMs = 30_000) {
  if (globalForSweeper.assignmentSweeper) return;
  globalForSweeper.assignmentSweeper = setInterval(() => {
    runAssignment().catch((err) => console.error("[assignment] sweep failed", err));
  }, intervalMs);
  globalForSweeper.assignmentSweeper.unref?.();
}
