import "server-only";
import { Prisma, type OrderStatus, type PaymentMethod } from "@/generated/prisma/client";
import { formatPeso, formatQty, orderCode } from "@/lib/format";
import { validateQty } from "@/lib/pricing";
import { isOfferedSlot } from "@/lib/slots";
import { ORDER_STATUS } from "@/lib/constants";
import { triggerAssignment } from "./assignment";
import { audit } from "./audit";
import { db, type Tx } from "./db";
import { DomainError } from "./errors";
import { alertOnLowStock, availabilityOf, dec } from "./inventory";
import { notifyOwners, notifyUsers } from "./notifications";
import { publish } from "./realtime";
import { getSettings } from "./settings";

type Actor = { id: string; role: "OWNER" | "WORKER" | "CUSTOMER"; name: string };

const ORDER_TOPICS = ["role:OWNER", "role:WORKER"];

async function announce(tx: Tx, customerId: string) {
  await publish({ kind: "orders", topics: [...ORDER_TOPICS, `user:${customerId}`] }, tx);
}

/** Locks the order row for the rest of the transaction so concurrent updates serialise. */
async function lockOrder(tx: Tx, orderId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  if (rows.length === 0) throw new DomainError("Order not found.");
  return tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, worker: { select: { id: true, name: true } } },
  });
}

type LockedOrder = Awaited<ReturnType<typeof lockOrder>>;

// ───────────────────────────── Placing an order ─────────────────────────────

export async function placeOrder(
  customerId: string,
  input: { items: { productId: string; qty: number }[]; pickupAt: string; notes?: string },
) {
  // Merge duplicate lines and sort by product id: every transaction then locks product rows in
  // the same order, which rules out deadlocks between concurrent checkouts.
  const merged = new Map<string, number>();
  for (const it of input.items) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.qty);
  const lines = [...merged.entries()]
    .map(([productId, qty]) => ({ productId, qty: Math.round(qty * 1000) / 1000 }))
    .sort((a, b) => (a.productId < b.productId ? -1 : 1));

  const pickupAt = new Date(input.pickupAt);

  const order = await db.$transaction(
    async (tx) => {
      const settings = await getSettings(tx);
      if (!isOfferedSlot(pickupAt, new Date(), settings)) {
        throw new DomainError("That pickup time is no longer available. Please choose another slot.");
      }

      // Serialise bookings for this slot across all instances, then enforce slot capacity.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"slot:" + pickupAt.toISOString()}))`;
      const booked = await tx.order.count({ where: { pickupAt, status: { not: "CANCELLED" } } });
      if (booked >= settings.slotCapacity) {
        throw new DomainError("That pickup slot just filled up. Please choose another time.");
      }

      const products = await tx.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const before = await availabilityOf(tx, lines.map((l) => l.productId));

      let estimatedTotal = dec(0);
      const itemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];

      for (const line of lines) {
        const p = byId.get(line.productId);
        if (!p || p.archived) throw new DomainError("A product in your cart is no longer available.");
        const qtyError = validateQty(line.qty, {
          unit: p.unit,
          minOrderQty: p.minOrderQty.toNumber(),
          qtyStep: p.qtyStep.toNumber(),
        });
        if (qtyError) throw new DomainError(`${p.name}: ${qtyError}`);

        // Atomic conditional reservation — the heart of oversell protection. Two parallel
        // checkouts for the last kilo cannot both succeed: the row lock taken by UPDATE makes the
        // second one re-check the condition after the first commits.
        const reserved = await tx.$executeRaw`
          UPDATE "Product"
          SET "reservedQty" = "reservedQty" + ${line.qty}::numeric, "updatedAt" = now()
          WHERE id = ${p.id} AND archived = false
            AND "stockQty" - "reservedQty" >= ${line.qty}::numeric`;
        if (reserved === 0) {
          const latest = await tx.product.findUniqueOrThrow({ where: { id: p.id } });
          const avail = Math.max(0, latest.stockQty.minus(latest.reservedQty).toNumber());
          throw new DomainError(
            avail > 0
              ? `Only ${formatQty(avail, p.unit)} of ${p.name} is left. Please lower the quantity.`
              : `${p.name} just sold out. Please remove it from your cart.`,
          );
        }

        const lineTotal = p.price.mul(line.qty).toDecimalPlaces(2);
        estimatedTotal = estimatedTotal.plus(lineTotal);
        itemsData.push({
          product: { connect: { id: p.id } },
          productName: p.name,
          unit: p.unit,
          unitPrice: p.price,
          orderedQty: dec(line.qty),
          estimatedTotal: lineTotal,
        });
      }

      const created = await tx.order.create({
        data: {
          customerId,
          pickupAt,
          notes: input.notes || null,
          estimatedTotal,
          items: { create: itemsData },
          events: {
            create: {
              type: "CREATED",
              toStatus: "PENDING",
              actorId: customerId,
              message: "Order placed and added to the assignment queue",
            },
          },
        },
        select: { id: true, number: true, estimatedTotal: true },
      });

      await notifyUsers(tx, [customerId], {
        type: "ORDER",
        title: `Order ${orderCode(created.number)} received`,
        body: `Estimated total ${formatPeso(created.estimatedTotal.toNumber())}. We'll notify you as it progresses.`,
        href: `/orders/${created.id}`,
      });
      await alertOnLowStock(tx, before);
      await publish({ kind: "inventory", topics: ["all"] }, tx);
      await announce(tx, customerId);
      return created;
    },
    { timeout: 15_000 },
  );

  triggerAssignment();
  return order;
}

// ───────────────────────────── Worker workflow ─────────────────────────────

function assertAssignedTo(order: LockedOrder, actor: Actor) {
  if (actor.role === "OWNER") return;
  if (order.workerId !== actor.id) throw new DomainError("This order is not assigned to you.");
}

function assertStatus(order: LockedOrder, ...allowed: OrderStatus[]) {
  if (!allowed.includes(order.status)) {
    throw new DomainError(
      `This order is ${ORDER_STATUS[order.status].label.toLowerCase()} and can't be updated that way.`,
    );
  }
}

export async function startProcessing(actor: Actor, orderId: string) {
  await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    assertAssignedTo(order, actor);
    assertStatus(order, "ASSIGNED");
    if (order.cancelRequest === "PENDING") throw new DomainError("The customer asked to cancel this order.");
    await tx.order.update({
      where: { id: orderId },
      data: { status: "PROCESSING", processingAt: new Date() },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "STATUS",
        fromStatus: "ASSIGNED",
        toStatus: "PROCESSING",
        actorId: actor.id,
        workerId: order.workerId,
        message: `${actor.name} started preparing the order`,
      },
    });
    await notifyUsers(tx, [order.customerId], {
      type: "ORDER",
      title: `Order ${orderCode(order.number)} is being prepared`,
      body: "Your cuts are being prepared and weighed.",
      href: `/orders/${orderId}`,
    });
    await announce(tx, order.customerId);
  });
}

/**
 * Marks an order ready for pickup. The worker enters the actual weighed quantity of each line;
 * stock is withdrawn automatically (one WITHDRAWAL transaction per line) and the final price is
 * recalculated from the actual weights.
 */
export async function markReady(actor: Actor, orderId: string, actuals: Record<string, number>) {
  await db.$transaction(
    async (tx) => {
      const order = await lockOrder(tx, orderId);
      assertAssignedTo(order, actor);
      assertStatus(order, "PROCESSING");
      if (order.cancelRequest === "PENDING") {
        throw new DomainError("A cancellation request is pending. Wait for the owner's decision.");
      }

      const items = [...order.items].sort((a, b) => (a.productId < b.productId ? -1 : 1));
      const before = await availabilityOf(tx, items.map((i) => i.productId));
      let finalTotal = dec(0);

      for (const item of items) {
        const actual = actuals[item.id];
        if (actual === undefined || !Number.isFinite(actual) || actual <= 0) {
          throw new DomainError(`Enter the actual quantity for ${item.productName}.`);
        }
        if (item.unit === "PIECE" && !Number.isInteger(actual)) {
          throw new DomainError(`${item.productName} is sold per piece — use a whole number.`);
        }
        const ordered = item.orderedQty;
        if (dec(actual).gt(ordered.mul(1.5))) {
          throw new DomainError(
            `${item.productName}: ${formatQty(actual, item.unit)} is far above the ${formatQty(ordered.toNumber(), item.unit)} ordered. Please re-weigh.`,
          );
        }

        // Release this order's reservation and withdraw the actual weight in one atomic step.
        const rows = await tx.$queryRaw<{ stockQty: Prisma.Decimal }[]>`
          UPDATE "Product"
          SET "stockQty" = "stockQty" - ${actual}::numeric,
              "reservedQty" = "reservedQty" - ${ordered.toString()}::numeric,
              "updatedAt" = now()
          WHERE id = ${item.productId}
            AND "stockQty" - ("reservedQty" - ${ordered.toString()}::numeric) >= ${actual}::numeric
          RETURNING "stockQty"`;
        if (rows.length === 0) {
          throw new DomainError(
            `Not enough ${item.productName} in stock to cover ${formatQty(actual, item.unit)}. Record the delivery first or adjust the weight.`,
          );
        }

        const lineFinal = item.unitPrice.mul(actual).toDecimalPlaces(2);
        finalTotal = finalTotal.plus(lineFinal);
        await tx.orderItem.update({
          where: { id: item.id },
          data: { actualQty: dec(actual), finalTotal: lineFinal },
        });
        await tx.stockTransaction.create({
          data: {
            productId: item.productId,
            type: "WITHDRAWAL",
            quantity: dec(-actual),
            balanceAfter: dec(rows[0]!.stockQty),
            reason: `Order ${orderCode(order.number)}`,
            orderId,
            actorId: actor.id,
          },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: "READY", readyAt: new Date(), finalTotal },
      });
      await tx.orderEvent.create({
        data: {
          orderId,
          type: "STATUS",
          fromStatus: "PROCESSING",
          toStatus: "READY",
          actorId: actor.id,
          workerId: order.workerId,
          message: `Weighed and packed by ${actor.name}. Final total ${formatPeso(finalTotal.toNumber())}`,
        },
      });
      await notifyUsers(tx, [order.customerId], {
        type: "ORDER",
        title: `Order ${orderCode(order.number)} is ready for pickup`,
        body: `Final total based on actual weight: ${formatPeso(finalTotal.toNumber())}.`,
        href: `/orders/${orderId}`,
      });
      await alertOnLowStock(tx, before);
      await publish({ kind: "inventory", topics: ["all"] }, tx);
      await announce(tx, order.customerId);
    },
    { timeout: 15_000 },
  );
  // A PROCESSING order no longer counts toward the worker's load — they can take another one.
  triggerAssignment();
}

export async function completeOrder(actor: Actor, orderId: string, method: PaymentMethod) {
  await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    assertAssignedTo(order, actor);
    assertStatus(order, "READY");
    const now = new Date();
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        completedAt: now,
        paymentStatus: "PAID",
        paymentMethod: method,
        paidAt: order.paidAt ?? now,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "STATUS",
        fromStatus: "READY",
        toStatus: "COMPLETED",
        actorId: actor.id,
        workerId: order.workerId,
        message: `Picked up — ${formatPeso(order.finalTotal?.toNumber() ?? 0)} paid via ${method.toLowerCase()}`,
      },
    });
    await notifyUsers(tx, [order.customerId], {
      type: "ORDER",
      title: `Order ${orderCode(order.number)} completed`,
      body: "Thank you for buying from us!",
      href: `/orders/${orderId}`,
    });
    await announce(tx, order.customerId);
  });
}

/** Owner: mark payment received ahead of pickup (e.g. GCash transfer) or correct a payment. */
export async function setPaymentStatus(actor: Actor, orderId: string, paid: boolean, method?: PaymentMethod) {
  await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "CANCELLED") throw new DomainError("Cancelled orders can't take payments.");
    if (order.status === "COMPLETED" && !paid) {
      throw new DomainError("Completed orders must stay paid.");
    }
    await tx.order.update({
      where: { id: orderId },
      data: paid
        ? { paymentStatus: "PAID", paymentMethod: method ?? order.paymentMethod ?? "CASH", paidAt: new Date() }
        : { paymentStatus: "UNPAID", paymentMethod: null, paidAt: null },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "PAYMENT",
        actorId: actor.id,
        message: paid ? `Payment recorded (${(method ?? "CASH").toLowerCase()})` : "Payment status reset to unpaid",
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "order.payment",
      entityType: "Order",
      entityId: orderId,
      summary: `${paid ? "Marked paid" : "Marked unpaid"}: order ${orderCode(order.number)}`,
      details: { paid, method: method ?? null },
    });
    await announce(tx, order.customerId);
  });
}

// ───────────────────────────── Cancellation ─────────────────────────────

/** Releases reservations (or returns withdrawn stock) and marks the order cancelled. */
async function cancelInternal(tx: Tx, order: LockedOrder, actor: Actor, reason: string) {
  const items = [...order.items].sort((a, b) => (a.productId < b.productId ? -1 : 1));
  if (order.status === "READY") {
    // Stock was already withdrawn with actual weights — put it back.
    for (const item of items) {
      const qty = item.actualQty ?? item.orderedQty;
      const [row] = await tx.$queryRaw<{ stockQty: Prisma.Decimal }[]>`
        UPDATE "Product" SET "stockQty" = "stockQty" + ${qty.toString()}::numeric, "updatedAt" = now()
        WHERE id = ${item.productId} RETURNING "stockQty"`;
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          type: "RETURN",
          quantity: qty,
          balanceAfter: dec(row!.stockQty),
          reason: `Cancelled order ${orderCode(order.number)}`,
          orderId: order.id,
          actorId: actor.id,
        },
      });
    }
  } else {
    for (const item of items) {
      await tx.$executeRaw`
        UPDATE "Product" SET "reservedQty" = "reservedQty" - ${item.orderedQty.toString()}::numeric, "updatedAt" = now()
        WHERE id = ${item.productId}`;
    }
  }

  await tx.order.update({
    where: { id: order.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason, cancelRequest: "NONE" },
  });
  await tx.orderEvent.create({
    data: {
      orderId: order.id,
      type: "STATUS",
      fromStatus: order.status,
      toStatus: "CANCELLED",
      actorId: actor.id,
      message: `Cancelled by ${actor.role === "CUSTOMER" ? "the customer" : actor.name}${reason ? ` — ${reason}` : ""}`,
    },
  });
  await notifyUsers(tx, [order.workerId, actor.role === "CUSTOMER" ? null : order.customerId], {
    type: "ORDER",
    title: `Order ${orderCode(order.number)} cancelled`,
    body: reason || "The order was cancelled.",
    href: actor.role === "CUSTOMER" ? `/worker/orders/${order.id}` : `/orders/${order.id}`,
  });
  await publish({ kind: "inventory", topics: ["all"] }, tx);
  await announce(tx, order.customerId);
}

/**
 * Customer cancellation rules:
 *  - PENDING / ASSIGNED → cancelled immediately (nothing has been cut yet).
 *  - PROCESSING → becomes a cancellation *request* the owner approves or rejects.
 *  - READY / COMPLETED → not cancellable online.
 */
export async function customerCancel(actor: Actor, orderId: string, reason: string) {
  const outcome = await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.customerId !== actor.id) throw new DomainError("Order not found.");
    if (order.status === "PENDING" || order.status === "ASSIGNED") {
      await cancelInternal(tx, order, actor, reason);
      return "cancelled" as const;
    }
    if (order.status === "PROCESSING") {
      if (order.cancelRequest === "PENDING") throw new DomainError("You already requested a cancellation.");
      await tx.order.update({
        where: { id: orderId },
        data: { cancelRequest: "PENDING", cancelReason: reason },
      });
      await tx.orderEvent.create({
        data: {
          orderId,
          type: "CANCEL_REQUESTED",
          actorId: actor.id,
          message: `Customer requested cancellation${reason ? ` — ${reason}` : ""}`,
        },
      });
      await notifyOwners(tx, {
        type: "ORDER",
        title: `Cancellation request for ${orderCode(order.number)}`,
        body: reason || "The customer asked to cancel an order that is already being prepared.",
        href: `/owner/orders/${orderId}`,
      });
      await notifyUsers(tx, [order.workerId], {
        type: "ORDER",
        title: `Hold ${orderCode(order.number)}`,
        body: "The customer requested a cancellation. Wait for the owner's decision.",
        href: `/worker/orders/${orderId}`,
      });
      await announce(tx, order.customerId);
      return "requested" as const;
    }
    throw new DomainError(
      order.status === "READY"
        ? "This order is already packed. Please contact the shop to cancel."
        : "This order can no longer be cancelled.",
    );
  });
  if (outcome === "cancelled") triggerAssignment();
  return outcome;
}

export async function resolveCancelRequest(actor: Actor, orderId: string, approve: boolean) {
  await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.cancelRequest !== "PENDING") throw new DomainError("There is no pending cancellation request.");
    if (approve) {
      await cancelInternal(tx, order, actor, order.cancelReason || "Cancellation request approved");
    } else {
      await tx.order.update({ where: { id: orderId }, data: { cancelRequest: "REJECTED" } });
      await tx.orderEvent.create({
        data: {
          orderId,
          type: "CANCEL_REJECTED",
          actorId: actor.id,
          message: `Cancellation request declined by ${actor.name}`,
        },
      });
      await notifyUsers(tx, [order.customerId, order.workerId], {
        type: "ORDER",
        title: `Order ${orderCode(order.number)} will continue`,
        body: "The cancellation request was declined because the order is already being prepared.",
        href: `/orders/${orderId}`,
      });
      await announce(tx, order.customerId);
    }
    await audit(tx, {
      actorId: actor.id,
      action: approve ? "order.cancel_approved" : "order.cancel_rejected",
      entityType: "Order",
      entityId: orderId,
      summary: `${approve ? "Approved" : "Declined"} cancellation of ${orderCode(order.number)}`,
    });
  });
  if (approve) triggerAssignment();
}

export async function ownerCancel(actor: Actor, orderId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    assertStatus(order, "PENDING", "ASSIGNED", "PROCESSING", "READY");
    await cancelInternal(tx, order, actor, reason);
    await audit(tx, {
      actorId: actor.id,
      action: "order.cancel",
      entityType: "Order",
      entityId: orderId,
      summary: `Cancelled order ${orderCode(order.number)}`,
      details: { reason, previousStatus: order.status },
    });
  });
  triggerAssignment();
}

// ───────────────────────────── Reassignment ─────────────────────────────

/** Owner: move an order to another worker, or back to the queue (workerId = null). */
export async function reassignOrder(actor: Actor, orderId: string, workerId: string | null) {
  await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    assertStatus(order, "PENDING", "ASSIGNED", "PROCESSING", "READY");
    if (workerId === order.workerId) throw new DomainError("The order is already assigned to that worker.");

    let newStatus: OrderStatus = order.status;
    let workerName = "the queue";
    if (workerId) {
      const worker = await tx.user.findFirst({
        where: { id: workerId, role: "WORKER", active: true },
        select: { id: true, name: true },
      });
      if (!worker) throw new DomainError("Choose an active worker.");
      workerName = worker.name;
      if (order.status === "PENDING") newStatus = "ASSIGNED";
    } else {
      if (order.status === "READY") {
        throw new DomainError("Packed orders must be handed to a specific worker, not the queue.");
      }
      newStatus = "PENDING";
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        workerId,
        status: newStatus,
        assignedAt: workerId ? new Date() : null,
        // A processing order sent back to the queue restarts from the beginning.
        processingAt: newStatus === "PENDING" ? null : order.processingAt,
      },
    });
    if (workerId) await tx.user.update({ where: { id: workerId }, data: { lastAssignedAt: new Date() } });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: workerId ? "REASSIGNED" : "REQUEUED",
        fromStatus: order.status,
        toStatus: newStatus,
        actorId: actor.id,
        workerId,
        message: workerId
          ? `Manually reassigned from ${order.worker?.name ?? "the queue"} to ${workerName}`
          : `Returned to the queue by ${actor.name} (was with ${order.worker?.name ?? "nobody"})`,
      },
    });
    await notifyUsers(tx, [order.workerId], {
      type: "ORDER",
      title: `${orderCode(order.number)} reassigned`,
      body: "This order was moved off your queue by the owner.",
      href: `/worker/orders`,
    });
    if (workerId) {
      await notifyUsers(tx, [workerId], {
        type: "ORDER",
        title: `Order ${orderCode(order.number)} assigned to you`,
        body: "The owner assigned this order to you.",
        href: `/worker/orders/${orderId}`,
      });
    }
    await audit(tx, {
      actorId: actor.id,
      action: "order.reassign",
      entityType: "Order",
      entityId: orderId,
      summary: `Reassigned ${orderCode(order.number)} to ${workerName}`,
      details: { from: order.workerId, to: workerId },
    });
    await announce(tx, order.customerId);
  });
  triggerAssignment();
}

/** Returns a worker's not-yet-started orders to the queue (used when they go off duty). */
export async function requeueOrdersOf(tx: Tx, workerId: string, statuses: OrderStatus[], reason: string) {
  const orders = await tx.$queryRaw<{ id: string; status: OrderStatus; customerId: string }[]>`
    SELECT id, status, "customerId" FROM "Order"
    WHERE "workerId" = ${workerId} AND status::text = ANY(${statuses})
    FOR UPDATE`;
  for (const o of orders) {
    await tx.order.update({
      where: { id: o.id },
      data: { workerId: null, status: "PENDING", assignedAt: null, processingAt: null },
    });
    await tx.orderEvent.create({
      data: {
        orderId: o.id,
        type: "REQUEUED",
        fromStatus: o.status,
        toStatus: "PENDING",
        workerId,
        message: reason,
      },
    });
  }
  return orders.length;
}
