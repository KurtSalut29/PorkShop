import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { DutyStatus } from "@/generated/prisma/client";
import { DUTY_STATUS } from "@/lib/constants";
import { triggerAssignment } from "./assignment";
import { audit } from "./audit";
import { db } from "./db";
import { DomainError } from "./errors";
import { notifyOwners } from "./notifications";
import { requeueOrdersOf } from "./orders";
import { publish } from "./realtime";

/**
 * Owner creates worker accounts directly (workers never self-register).
 * The password is hashed with Better Auth's own hasher so the normal sign-in flow accepts it.
 */
export async function createWorker(
  actorId: string,
  input: { name: string; email: string; phone: string; password: string },
) {
  const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw new DomainError("An account with this email already exists.");
  const hash = await hashPassword(input.password);
  const id = randomUUID();
  await db.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: "WORKER",
        emailVerified: true,
        accounts: {
          create: { id: randomUUID(), accountId: id, providerId: "credential", password: hash },
        },
      },
    });
    await audit(tx, {
      actorId,
      action: "worker.create",
      entityType: "User",
      entityId: id,
      summary: `Created worker account for ${input.name}`,
      details: { email: input.email },
    });
    await publish({ kind: "workers", topics: ["role:OWNER"] }, tx);
  });
  return id;
}

export async function updateWorker(
  actorId: string,
  workerId: string,
  input: { name: string; phone: string; maxActiveOrders?: number },
) {
  await db.$transaction(async (tx) => {
    const w = await tx.user.findFirst({ where: { id: workerId, role: "WORKER" } });
    if (!w) throw new DomainError("Worker not found.");
    await tx.user.update({
      where: { id: workerId },
      data: { name: input.name, phone: input.phone, maxActiveOrders: input.maxActiveOrders ?? null },
    });
    await audit(tx, {
      actorId,
      action: "worker.update",
      entityType: "User",
      entityId: workerId,
      summary: `Updated worker ${input.name}`,
      details: {
        before: { name: w.name, phone: w.phone, maxActiveOrders: w.maxActiveOrders },
        after: { ...input, maxActiveOrders: input.maxActiveOrders ?? null },
      },
    });
    await publish({ kind: "workers", topics: ["role:OWNER"] }, tx);
  });
  triggerAssignment();
}

/**
 * Deactivation: blocks sign-in, ends sessions, takes the worker off duty and returns their
 * unfinished (assigned or processing) orders to the queue for automatic re-assignment.
 * Packed (READY) orders stay visible to the owner as "needs reassignment".
 */
export async function setWorkerActive(actorId: string, workerId: string, active: boolean) {
  const requeued = await db.$transaction(async (tx) => {
    const w = await tx.user.findFirst({ where: { id: workerId, role: "WORKER" } });
    if (!w) throw new DomainError("Worker not found.");
    if (w.active === active) return 0;
    await tx.user.update({
      where: { id: workerId },
      data: { active, dutyStatus: "OFF_DUTY", dutyChangedAt: new Date() },
    });
    let count = 0;
    if (!active) {
      await tx.session.deleteMany({ where: { userId: workerId } });
      count = await requeueOrdersOf(
        tx,
        workerId,
        ["ASSIGNED", "PROCESSING"],
        `Returned to the queue — ${w.name} was deactivated`,
      );
    }
    await audit(tx, {
      actorId,
      action: active ? "worker.reactivate" : "worker.deactivate",
      entityType: "User",
      entityId: workerId,
      summary: `${active ? "Reactivated" : "Deactivated"} worker ${w.name}`,
      details: { requeuedOrders: count },
    });
    await publish({ kind: "workers", topics: ["role:OWNER", "role:WORKER"] }, tx);
    await publish({ kind: "orders", topics: ["role:OWNER", "role:WORKER"] }, tx);
    return count;
  });
  triggerAssignment();
  return requeued;
}

export async function resetWorkerPassword(actorId: string, workerId: string, password: string) {
  const hash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { userId: workerId, providerId: "credential", user: { role: "WORKER" } },
      include: { user: { select: { name: true } } },
    });
    if (!account) throw new DomainError("Worker not found.");
    await tx.account.update({ where: { id: account.id }, data: { password: hash } });
    await tx.session.deleteMany({ where: { userId: workerId } });
    await audit(tx, {
      actorId,
      action: "worker.reset_password",
      entityType: "User",
      entityId: workerId,
      summary: `Reset password for ${account.user.name}`,
    });
  });
}

/**
 * Worker availability. Going ON_DUTY triggers assignment of queued orders; going OFF_DUTY
 * returns not-yet-started orders to the queue so customers aren't left waiting.
 */
export async function setDutyStatus(workerId: string, status: DutyStatus) {
  const requeued = await db.$transaction(async (tx) => {
    const w = await tx.user.findUniqueOrThrow({ where: { id: workerId } });
    if (w.dutyStatus === status) return 0;
    await tx.user.update({ where: { id: workerId }, data: { dutyStatus: status, dutyChangedAt: new Date() } });
    let count = 0;
    if (status === "OFF_DUTY") {
      count = await requeueOrdersOf(tx, workerId, ["ASSIGNED"], `Returned to the queue — ${w.name} went off duty`);
      const stillHolding = await tx.order.count({
        where: { workerId, status: { in: ["PROCESSING", "READY"] } },
      });
      if (stillHolding > 0) {
        await notifyOwners(tx, {
          type: "SYSTEM",
          title: `${w.name} went off duty with ${stillHolding} open order${stillHolding > 1 ? "s" : ""}`,
          body: "Orders already being prepared or packed may need reassignment.",
          href: "/owner/assignments",
        });
      }
    }
    await publish(
      {
        kind: "workers",
        topics: ["role:OWNER", `user:${workerId}`],
      },
      tx,
    );
    if (count) await publish({ kind: "orders", topics: ["role:OWNER", "role:WORKER"] }, tx);
    return count;
  });
  triggerAssignment();
  return { requeued, label: DUTY_STATUS[status].label };
}
