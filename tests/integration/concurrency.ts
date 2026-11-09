/**
 * Concurrency & workflow stress test against the real PostgreSQL database.
 *
 *   npm run test:concurrency      (re-seeds the database afterwards)
 *
 * Proves the system's parallel-processing guarantees:
 *   1. Oversell protection — N customers race for the last unit; exactly one wins.
 *   2. Parallel checkouts on plentiful stock all succeed, and reservations add up exactly.
 *   3. Slot capacity holds under a burst of simultaneous bookings.
 *   4. Concurrent dispatchers never double-assign; load stays balanced.
 *   5. Full lifecycle: actual-weight withdrawal, final pricing, payment, cancellation release.
 */
import "dotenv/config";
import { runAssignment } from "@/server/assignment";
import { db } from "@/server/db";
import { completeOrder, customerCancel, markReady, placeOrder, startProcessing } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { generatePickupDays } from "@/lib/slots";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const settings = await getSettings();
  // Give the test plenty of slot capacity except where we test it explicitly.
  await db.shopSettings.update({ where: { id: 1 }, data: { slotCapacity: 100, advanceDays: 3, leadTimeMinutes: 0 } });
  const slots = generatePickupDays(new Date(), { ...settings, slotCapacity: 100, advanceDays: 3, leadTimeMinutes: 0 }).flatMap((d) => d.slots);
  if (slots.length < 3) throw new Error("Need at least 3 offered slots to run the test");

  const customers = await db.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true, name: true } });
  const head = await db.product.findUniqueOrThrow({ where: { slug: "pork-head" } });
  const belly = await db.product.findUniqueOrThrow({ where: { slug: "pork-belly" } });

  console.log("\n1) Oversell protection: 12 parallel orders for the last Pork Head");
  await db.product.update({ where: { id: head.id }, data: { stockQty: 1, reservedQty: 0 } });
  const race = await Promise.allSettled(
    Array.from({ length: 12 }, (_, i) =>
      placeOrder(customers[i % customers.length]!.id, { items: [{ productId: head.id, qty: 1 }], pickupAt: slots[0]!.iso }),
    ),
  );
  const won = race.filter((r) => r.status === "fulfilled").length;
  const headAfter = await db.product.findUniqueOrThrow({ where: { id: head.id } });
  check("exactly one order succeeded", won === 1, `${won} succeeded`);
  check("reserved = on hand = 1", headAfter.reservedQty.eq(1) && headAfter.stockQty.eq(1));
  const reasons = race.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => String(r.reason?.message));
  check("losers got a clear sold-out message", reasons.every((m) => /sold out|left/i.test(m)), reasons[0]);

  console.log("\n2) 20 parallel checkouts of 0.5 kg Pork Belly");
  const bellyBefore = await db.product.findUniqueOrThrow({ where: { id: belly.id } });
  const burst = await Promise.allSettled(
    Array.from({ length: 20 }, (_, i) =>
      placeOrder(customers[i % customers.length]!.id, {
        items: [{ productId: belly.id, qty: 0.5 }],
        pickupAt: slots[1 + (i % (slots.length - 1))]!.iso,
      }),
    ),
  );
  const ok2 = burst.filter((r) => r.status === "fulfilled").length;
  const bellyAfter = await db.product.findUniqueOrThrow({ where: { id: belly.id } });
  check("all 20 succeeded", ok2 === 20, `${ok2}/20`);
  check("reservations add up exactly to 10 kg", bellyAfter.reservedQty.minus(bellyBefore.reservedQty).eq(10), bellyAfter.reservedQty.toString());

  console.log("\n3) Slot capacity: 10 parallel bookings into a slot with 4 places");
  await db.shopSettings.update({ where: { id: 1 }, data: { slotCapacity: 4 } });
  const lastSlot = slots.at(-1)!.iso;
  const existing = await db.order.count({ where: { pickupAt: new Date(lastSlot), status: { not: "CANCELLED" } } });
  const slotBurst = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      placeOrder(customers[i % customers.length]!.id, { items: [{ productId: belly.id, qty: 0.5 }], pickupAt: lastSlot }),
    ),
  );
  const booked = await db.order.count({ where: { pickupAt: new Date(lastSlot), status: { not: "CANCELLED" } } });
  check("slot never exceeds capacity", booked <= 4, `${booked} booked (had ${existing})`);
  check("extra bookings were rejected", slotBurst.filter((r) => r.status === "rejected").length === 10 - Math.max(0, 4 - existing));
  await db.shopSettings.update({ where: { id: 1 }, data: { slotCapacity: 100 } });

  console.log("\n4) Concurrent dispatchers: 3 workers on duty, capacity 5, run 6 dispatchers at once");
  await db.user.updateMany({ where: { role: "WORKER" }, data: { dutyStatus: "ON_DUTY", active: true, maxActiveOrders: null } });
  await db.shopSettings.update({ where: { id: 1 }, data: { maxActiveOrdersPerWorker: 5 } });
  await Promise.all(Array.from({ length: 6 }, () => runAssignment()));
  const loads = await db.order.groupBy({
    by: ["workerId"],
    where: { status: { in: ["ASSIGNED", "PROCESSING"] } },
    _count: { _all: true },
  });
  const counts = loads.map((l) => l._count._all);
  const assignedEvents = await db.orderEvent.groupBy({
    by: ["orderId"],
    where: { type: "ASSIGNED", order: { status: { in: ["ASSIGNED", "PROCESSING"] } } },
    _count: { _all: true },
  });
  check("no worker above capacity", counts.every((c) => c <= 5), JSON.stringify(counts));
  check("load is balanced (max − min ≤ 1)", Math.max(...counts) - Math.min(...counts) <= 1, JSON.stringify(counts));
  check("no order assigned twice", assignedEvents.every((e) => e._count._all === 1));
  const queued = await db.order.count({ where: { status: "PENDING" } });
  check("overflow stays queued instead of overloading", queued === Math.max(0, won + ok2 + (10 - slotBurst.filter((r) => r.status === "rejected").length) - 15), `${queued} queued`);

  console.log("\n5) Lifecycle: weigh 0.52 kg, complete, and cancel another");
  const mine = await db.order.findFirstOrThrow({
    where: { status: "ASSIGNED", items: { some: { productId: belly.id } } },
    include: { items: true, worker: true },
  });
  const actor = { id: mine.worker!.id, name: mine.worker!.name, role: "WORKER" as const };
  const before = await db.product.findUniqueOrThrow({ where: { id: belly.id } });
  await startProcessing(actor, mine.id);
  await markReady(actor, mine.id, { [mine.items[0]!.id]: 0.52 });
  const after = await db.product.findUniqueOrThrow({ where: { id: belly.id } });
  const readyOrder = await db.order.findUniqueOrThrow({ where: { id: mine.id } });
  check("on-hand stock dropped by the actual 0.52 kg", before.stockQty.minus(after.stockQty).eq(0.52));
  check("reservation released by the ordered 0.5 kg", before.reservedQty.minus(after.reservedQty).eq(0.5));
  check("final price uses actual weight", readyOrder.finalTotal!.eq(belly.price.mul(0.52).toDecimalPlaces(2)), readyOrder.finalTotal!.toString());
  const txn = await db.stockTransaction.findFirst({ where: { orderId: mine.id, type: "WITHDRAWAL" } });
  check("automatic WITHDRAWAL transaction recorded", !!txn && txn.quantity.eq(-0.52));
  await completeOrder(actor, mine.id, "GCASH");
  const done = await db.order.findUniqueOrThrow({ where: { id: mine.id } });
  check("completed and marked paid", done.status === "COMPLETED" && done.paymentStatus === "PAID");

  const toCancel = await db.order.findFirstOrThrow({
    where: { status: { in: ["ASSIGNED", "PENDING"] }, items: { some: { productId: belly.id } } },
    include: { customer: true },
  });
  const r0 = await db.product.findUniqueOrThrow({ where: { id: belly.id } });
  await customerCancel({ id: toCancel.customerId, name: toCancel.customer.name, role: "CUSTOMER" }, toCancel.id, "test");
  const r1 = await db.product.findUniqueOrThrow({ where: { id: belly.id } });
  check("customer cancellation releases the reservation", r0.reservedQty.minus(r1.reservedQty).eq(0.5));

  const invariant = await db.$queryRaw<{ id: string; reserved: string; expected: string }[]>`
    SELECT p.id, p."reservedQty"::text AS reserved,
           COALESCE(SUM(i."orderedQty") FILTER (WHERE o.status IN ('PENDING','ASSIGNED','PROCESSING')), 0)::text AS expected
    FROM "Product" p LEFT JOIN "OrderItem" i ON i."productId" = p.id LEFT JOIN "Order" o ON o.id = i."orderId"
    GROUP BY p.id HAVING p."reservedQty" <> COALESCE(SUM(i."orderedQty") FILTER (WHERE o.status IN ('PENDING','ASSIGNED','PROCESSING')), 0)`;
  check("invariant: reserved stock == sum of open (unweighed) order lines, for every product", invariant.length === 0, JSON.stringify(invariant));

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(failures ? 1 : 0);
  });
