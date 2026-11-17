import "server-only";
import { Prisma, type OrderStatus, type PaymentMethod } from "@/generated/prisma/client";
import { formatDate, formatPeso, formatQty, formatShortDate, formatTime, orderCode } from "@/lib/format";
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
import { prepareImage } from "./product-images";
import { getSettings } from "./settings";

type Actor = { id: string; role: "OWNER" | "WORKER" | "CUSTOMER"; name: string };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "3:15 PM" today, otherwise "Nov 18, 3:15 PM" — for deadlines in notifications. */
function deadlineLabel(d: Date) {
  return formatDate(d) === formatDate(new Date()) ? formatTime(d) : `${formatShortDate(d)}, ${formatTime(d)}`;
}

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


//Parallel for placing an order. Sabay-sabay na naglalagay ng order ang mga customer. Ang bawat order ay nagre-reserve ng stock sa iisang hakbang, kaya kapag dalawang customer ang sabay na bumili ng huling 1 kilo, isa lang ang magtatagumpay. Nilo-lock ng database ang row, kaya mauulit ang pagsuri ng pangalawa pagkatapos matapos ng una
export async function placeOrder(
  customerId: string,
  input: {
    items: { productId: string; qty: number }[];
    pickupAt: string;
    notes?: string;
    /** CASH = pay at pickup (queued right away); GCASH = pay online first (queued once proof arrives). */
    paymentMethod: "CASH" | "GCASH";
  },
) {
  const gcash = input.paymentMethod === "GCASH";
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
      if (gcash && !settings.gcashEnabled) {
        throw new DomainError("GCash payments aren’t available right now. Please choose cash at pickup.");
      }
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

        //parallel for reserving the stock
        //Sabay na sinusuri at binabawasan ang stock sa iisang hakbang. Kapag dalawang customer ang 
        //sabay na bumili ng huling 1 kilo, isa lang ang magtatagumpay. Nilo-lock ng database ang row, 
        //kaya mauulit ang pagsuri ng pangalawa pagkatapos matapos ng una
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

      // GCash orders hold their stock only for the payment window; pay-at-pickup orders are
      // held until a set time after their pickup slot (see expireOverdueOrders).
      const now = new Date();
      const paymentDueAt = gcash ? new Date(now.getTime() + settings.paymentWindowMinutes * MINUTE) : null;
      const pickupDeadline = gcash ? null : new Date(pickupAt.getTime() + settings.pickupHoldHours * HOUR);
      const created = await tx.order.create({
        data: {
          customerId,
          pickupAt,
          notes: input.notes || null,
          estimatedTotal,
          status: gcash ? "AWAITING_PAYMENT" : "PENDING",
          paymentMethod: input.paymentMethod,
          paymentDueAt,
          pickupDeadline,
          items: { create: itemsData },
          events: {
            create: {
              type: "CREATED",
              toStatus: gcash ? "AWAITING_PAYMENT" : "PENDING",
              actorId: customerId,
              message: gcash
                ? "Order placed — waiting for the customer’s GCash payment"
                : "Order placed (cash at pickup) and added to the assignment queue",
            },
          },
        },
        select: { id: true, number: true, estimatedTotal: true },
      });

      const amount = formatPeso(created.estimatedTotal.toNumber());
      await notifyUsers(tx, [customerId], {
        type: "ORDER",
        title: gcash
          ? `Please complete your payment within ${settings.paymentWindowMinutes} minutes`
          : `Order ${orderCode(created.number)} received`,
        body: gcash
          ? `Pay ${amount} by GCash for order ${orderCode(created.number)} and submit the reference number by ${deadlineLabel(paymentDueAt!)}, or the order will be cancelled.`
          : `Pay ${amount} (estimate) in cash at pickup. Please pick up your order within ${settings.pickupHoldHours} hour${settings.pickupHoldHours > 1 ? "s" : ""} of your pickup time (by ${deadlineLabel(pickupDeadline!)}), or it will be released.`,
        href: `/orders/${created.id}`,
      });
      await alertOnLowStock(tx, before);
      await publish({ kind: "inventory", topics: ["all"] }, tx);
      await announce(tx, customerId);
      return created;
    },
    { timeout: 15_000 },
  );

  // A GCash order joins the queue only once its payment is submitted.
  if (!gcash) triggerAssignment();
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

      // An unpaid order is held for a set time after it's ready (or after its pickup slot, if
      // later). A paid GCash order is kept until it's collected.
      const readyAt = new Date();
      const settings = await getSettings(tx);
      const holdFrom = Math.max(readyAt.getTime(), order.pickupAt.getTime());
      const pickupDeadline = order.paymentStatus === "PAID" ? null : new Date(holdFrom + settings.pickupHoldHours * HOUR);
      await tx.order.update({
        where: { id: orderId },
        data: { status: "READY", readyAt, finalTotal, pickupDeadline },
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
        body: pickupDeadline
          ? `Final total based on actual weight: ${formatPeso(finalTotal.toNumber())}. Please pick it up by ${deadlineLabel(pickupDeadline)}, or it will be released.`
          : `Final total based on actual weight: ${formatPeso(finalTotal.toNumber())}.`,
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
    if (order.paymentStatus === "SUBMITTED") {
      throw new DomainError("Verify the customer’s GCash payment before handing over the order.");
    }
    const now = new Date();
    const total = order.finalTotal ?? order.estimatedTotal;
    const prepaid = order.paymentStatus === "PAID" && order.amountPaid ? order.amountPaid : null;
    const balance = prepaid ? total.minus(prepaid) : total;
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        completedAt: now,
        paymentStatus: "PAID",
        paymentMethod: prepaid ? (order.paymentMethod ?? "GCASH") : method,
        paidAt: order.paidAt ?? now,
        pickupDeadline: null,
      },
    });
    const paidNote = prepaid
      ? `${formatPeso(prepaid.toNumber())} paid by GCash before pickup` +
        (balance.gt(0)
          ? `; balance ${formatPeso(balance.toNumber())} collected (${method.toLowerCase()})`
          : balance.lt(0)
            ? `; ${formatPeso(balance.abs().toNumber())} to refund to the customer`
            : "")
      : `${formatPeso(total.toNumber())} paid via ${method.toLowerCase()}`;
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "STATUS",
        fromStatus: "READY",
        toStatus: "COMPLETED",
        actorId: actor.id,
        workerId: order.workerId,
        message: `Picked up — ${paidNote}`,
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
  let queued = false;
  await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "CANCELLED") throw new DomainError("Cancelled orders can't take payments.");
    if (order.status === "COMPLETED" && !paid) {
      throw new DomainError("Completed orders must stay paid.");
    }
    const queue = paid && order.status === "AWAITING_PAYMENT";
    await tx.order.update({
      where: { id: orderId },
      data: paid
        ? {
            paymentStatus: "PAID",
            paymentMethod: method ?? order.paymentMethod ?? "CASH",
            paidAt: new Date(),
            amountPaid: order.finalTotal ?? order.estimatedTotal,
            paymentDueAt: null,
            pickupDeadline: null,
            ...(queue ? { status: "PENDING" as const } : {}),
          }
        : { paymentStatus: "UNPAID", paidAt: null, amountPaid: null },
    });
    queued = queue;
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
  if (queued) triggerAssignment();
}

// ───────────────────────────── Cancellation ─────────────────────────────

/** Releases reservations (or returns withdrawn stock) and marks the order cancelled. */
async function cancelInternal(tx: Tx, order: LockedOrder, actor: Actor | null, reason: string) {
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
          actorId: actor?.id ?? null,
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
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason,
      cancelRequest: "NONE",
      paymentDueAt: null,
      pickupDeadline: null,
    },
  });
  const refund =
    order.paymentStatus === "PAID" || order.paymentStatus === "SUBMITTED"
      ? ` Your GCash payment${order.amountPaid ? ` of ${formatPeso(order.amountPaid.toNumber())}` : ""} will be refunded by the shop.`
      : "";
  await tx.orderEvent.create({
    data: {
      orderId: order.id,
      type: "STATUS",
      fromStatus: order.status,
      toStatus: "CANCELLED",
      actorId: actor?.id ?? null,
      message: `${!actor ? "Cancelled automatically" : `Cancelled by ${actor.role === "CUSTOMER" ? "the customer" : actor.name}`}${reason ? ` — ${reason}` : ""}`,
    },
  });
  await notifyUsers(tx, [order.workerId], {
    type: "ORDER",
    title: `Order ${orderCode(order.number)} cancelled`,
    body: reason || "The order was cancelled.",
    href: `/worker/orders/${order.id}`,
  });
  if (actor?.role !== "CUSTOMER") {
    await notifyUsers(tx, [order.customerId], {
      type: "ORDER",
      title: `Order ${orderCode(order.number)} cancelled`,
      body: `${reason || "The order was cancelled."}${refund}`,
      href: `/orders/${order.id}`,
    });
  }
  if (refund) {
    await notifyOwners(tx, {
      type: "ORDER",
      title: `Refund the GCash payment for ${orderCode(order.number)}`,
      body: `The order was cancelled after the customer paid by GCash${order.amountPaid ? ` (${formatPeso(order.amountPaid.toNumber())})` : ""}.`,
      href: `/owner/orders/${order.id}`,
    });
  }
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
    if (order.status === "AWAITING_PAYMENT" || order.status === "PENDING" || order.status === "ASSIGNED") {
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
    assertStatus(order, "AWAITING_PAYMENT", "PENDING", "ASSIGNED", "PROCESSING", "READY");
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

// ───────────────────────────── GCash payments ─────────────────────────────

/**
 * Customer submits a GCash payment: the reference number and a screenshot of the receipt.
 * A GCash order waiting for payment joins the assignment queue right away; staff verify the
 * payment against their GCash app before handing the order over.
 */
export async function submitPaymentProof(actor: Actor, orderId: string, reference: string, file: Buffer) {
  // Receipts are kept large enough to read the small print.
  const { data, info } = await prepareImage(file, { maxEdge: 2000, minEdge: 200, quality: 85 });
  const queued = await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.customerId !== actor.id) throw new DomainError("Order not found.");
    if (order.status === "CANCELLED") {
      throw new DomainError(`This order was cancelled${order.cancelReason ? `: ${order.cancelReason}` : "."} Please place a new order.`);
    }
    if (order.paymentMethod !== "GCASH") throw new DomainError("This order is paid in cash at pickup.");
    if (order.paymentStatus === "PAID") throw new DomainError("This order is already paid.");
    if (order.paymentStatus === "SUBMITTED") throw new DomainError("Your payment is already being verified by the shop.");
    if (order.paymentDueAt && order.paymentDueAt.getTime() < Date.now()) {
      throw new DomainError("The time to pay has run out, so this order is being cancelled. Please place a new order.");
    }
    const reused = await tx.paymentProof.findFirst({
      where: { reference, status: { not: "REJECTED" }, NOT: { orderId } },
      select: { id: true },
    });
    if (reused) throw new DomainError("That reference number was already used for another order. Check your GCash receipt.");

    await tx.paymentProof.create({
      data: {
        orderId,
        reference,
        amount: order.estimatedTotal,
        image: new Uint8Array(data),
        mimeType: "image/webp",
        width: info.width,
        height: info.height,
        submittedBy: actor.id,
      },
    });
    const joinsQueue = order.status === "AWAITING_PAYMENT";
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: "SUBMITTED", paymentDueAt: null, ...(joinsQueue ? { status: "PENDING" as const } : {}) },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "PAYMENT",
        fromStatus: joinsQueue ? "AWAITING_PAYMENT" : null,
        toStatus: joinsQueue ? "PENDING" : null,
        actorId: actor.id,
        message: `GCash payment submitted (ref ${reference})${joinsQueue ? " — added to the assignment queue" : ""}`,
      },
    });
    await notifyOwners(tx, {
      type: "ORDER",
      title: `Verify GCash payment for ${orderCode(order.number)}`,
      body: `${formatPeso(order.estimatedTotal.toNumber())} · reference ${reference}. Check it against the shop’s GCash account.`,
      href: `/owner/orders/${orderId}`,
    });
    await notifyUsers(tx, [order.workerId], {
      type: "ORDER",
      title: `GCash payment submitted for ${orderCode(order.number)}`,
      body: "Verify it before handing the order over.",
      href: `/worker/orders/${orderId}`,
    });
    await announce(tx, order.customerId);
    return joinsQueue;
  });
  if (queued) triggerAssignment();
}

/**
 * Staff confirm or reject a submitted GCash payment. Rejecting gives the customer a fresh
 * payment window to send a correct reference and receipt.
 */
export async function reviewPayment(actor: Actor, orderId: string, accept: boolean, note?: string) {
  await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    assertAssignedTo(order, actor);
    if (order.status === "CANCELLED") throw new DomainError("This order was cancelled.");
    const proof = await tx.paymentProof.findFirst({
      where: { orderId, status: "SUBMITTED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, amount: true },
    });
    if (!proof || order.paymentStatus !== "SUBMITTED") throw new DomainError("There’s no payment waiting for verification.");
    if (!accept && !note?.trim()) throw new DomainError("Tell the customer why the payment couldn’t be verified.");

    const now = new Date();
    await tx.paymentProof.update({
      where: { id: proof.id },
      data: { status: accept ? "ACCEPTED" : "REJECTED", note: accept ? null : note!.trim(), reviewedBy: actor.id, reviewedAt: now },
    });
    let dueBy: Date | null = null;
    if (accept) {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PAID", paymentMethod: "GCASH", paidAt: now, amountPaid: proof.amount, pickupDeadline: null },
      });
    } else {
      const settings = await getSettings(tx);
      dueBy = new Date(now.getTime() + settings.paymentWindowMinutes * MINUTE);
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "REJECTED", paymentDueAt: dueBy } });
    }
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "PAYMENT",
        actorId: actor.id,
        message: accept
          ? `GCash payment verified by ${actor.name} (ref ${proof.reference}, ${formatPeso(proof.amount.toNumber())})`
          : `GCash payment rejected by ${actor.name} — ${note!.trim()}`,
      },
    });
    await notifyUsers(tx, [order.customerId], {
      type: "ORDER",
      title: accept ? `Payment received for ${orderCode(order.number)}` : `We couldn’t verify your GCash payment`,
      body: accept
        ? `Thank you! ${formatPeso(proof.amount.toNumber())} received by GCash.`
        : `${note!.trim()} Please submit a correct reference number and receipt by ${deadlineLabel(dueBy!)}, or the order will be cancelled.`,
      href: `/orders/${orderId}`,
    });
    await audit(tx, {
      actorId: actor.id,
      action: accept ? "order.payment_verified" : "order.payment_rejected",
      entityType: "Order",
      entityId: orderId,
      summary: `${accept ? "Verified" : "Rejected"} GCash payment for ${orderCode(order.number)} (ref ${proof.reference})`,
      details: accept ? { amount: proof.amount.toNumber() } : { reason: note!.trim() },
    });
    await announce(tx, order.customerId);
  });
}

/**
 * Releases orders that tied up stock without being paid for or collected (run by the sweeper):
 *  - GCash orders with no payment submitted (or a rejected one) by their payment deadline;
 *  - packed pay-at-pickup orders not collected by their pickup deadline.
 * Each order is re-checked under its row lock, so concurrent sweepers never double-cancel.
 */
export async function expireOverdueOrders(now = new Date()) {
  const due = await db.$queryRaw<{ id: string; kind: "payment" | "pickup" }[]>`
    SELECT id, 'payment' AS kind FROM "Order"
    WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND "paymentMethod" = 'GCASH'
      AND "paymentStatus" IN ('UNPAID', 'REJECTED') AND "paymentDueAt" < ${now}
    UNION ALL
    SELECT id, 'pickup' AS kind FROM "Order"
    WHERE status = 'READY' AND "paymentStatus" <> 'PAID' AND "pickupDeadline" < ${now}
    LIMIT 100`;
  let cancelled = 0;
  for (const { id, kind } of due) {
    try {
      await db.$transaction(async (tx) => {
        const order = await lockOrder(tx, id);
        if (order.status === "COMPLETED" || order.status === "CANCELLED") return;
        if (kind === "payment") {
          const stillDue =
            order.paymentMethod === "GCASH" &&
            (order.paymentStatus === "UNPAID" || order.paymentStatus === "REJECTED") &&
            !!order.paymentDueAt &&
            order.paymentDueAt < now;
          if (!stillDue) return;
          await cancelInternal(tx, order, null, "The GCash payment wasn’t completed in time.");
        } else {
          const stillDue = order.status === "READY" && order.paymentStatus !== "PAID" && !!order.pickupDeadline && order.pickupDeadline < now;
          if (!stillDue) return;
          await cancelInternal(tx, order, null, `Not picked up by ${deadlineLabel(order.pickupDeadline!)}. The order was released.`);
        }
        cancelled++;
      });
    } catch (err) {
      console.error(`[expiry] couldn't release order ${id}`, err);
    }
  }
  if (cancelled) triggerAssignment();
  return cancelled;
}
