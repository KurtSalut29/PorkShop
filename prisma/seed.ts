/**
 * Seeds Porkshop with the 10 products from the spec, demo accounts and ~2 weeks of realistic
 * history (deliveries, completed orders with actual weights, spoilage) so reports have data.
 *
 *   npm run db:seed        (wipes and re-creates all data)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { Prisma, PrismaClient, type PaymentMethod, type ProductCategory, type SaleUnit } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const OFFSET = 8 * HOUR; // Asia/Manila

// Deterministic pseudo-random numbers so every seed produces the same data.
let state = 20261109;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

type Seed = {
  sku: string;
  name: string;
  localName: string;
  category: ProductCategory;
  unit: SaleUnit;
  price: number;
  min: number;
  step: number;
  low: number;
  finalStock: number;
  description: string;
  popularity: number;
};

const PRODUCTS: Seed[] = [
  { sku: "PK-LEG", name: "Pork Leg", localName: "Pigue", category: "PRIME_CUTS", unit: "KG", price: 330, min: 0.5, step: 0.25, low: 8, finalStock: 32, popularity: 7,
    description: "Lean, meaty cut from the hind leg. Ideal for adobo, menudo, afritada and slow roasts. Sliced, cubed or whole on request." },
  { sku: "PK-RIB", name: "Pork Ribs", localName: "Tadyang", category: "RIBS_AND_BONES", unit: "KG", price: 360, min: 0.5, step: 0.25, low: 6, finalStock: 18, popularity: 8,
    description: "Meaty spare ribs with a good layer of fat. Perfect for sinigang, grilling and baby-back style barbecue. Cut to your preferred length." },
  { sku: "PK-BLY", name: "Pork Belly", localName: "Liempo", category: "PRIME_CUTS", unit: "KG", price: 390, min: 0.5, step: 0.25, low: 8, finalStock: 26, popularity: 10,
    description: "Layered belly with skin on — the favourite for inihaw na liempo, lechon kawali, samgyupsal and crispy pata-style roasts." },
  { sku: "PK-SHD", name: "Pork Shoulder", localName: "Kasim", category: "PRIME_CUTS", unit: "KG", price: 340, min: 0.5, step: 0.25, low: 8, finalStock: 22, popularity: 6,
    description: "Well-marbled shoulder that stays juicy when braised. Great for humba, pulled pork, tocino and pork steak." },
  { sku: "PK-LOI", name: "Pork Loin", localName: "Lomo", category: "PRIME_CUTS", unit: "KG", price: 370, min: 0.5, step: 0.25, low: 5, finalStock: 12, popularity: 5,
    description: "Tender, lean loin for chops, katsu, breaded pork and stir-fries. Boneless; sliced to your thickness." },
  { sku: "PK-HCK", name: "Pork Hock / Feet", localName: "Pata", category: "SPECIALTY", unit: "PIECE", price: 320, min: 1, step: 1, low: 4, finalStock: 9, popularity: 4,
    description: "Whole front or hind pata, cleaned and ready. Made for crispy pata, paksiw na pata and kare-kare. Sold per piece (approx. 1–1.3 kg)." },
  { sku: "PK-GRD", name: "Pork Giniling", localName: "Ground Pork", category: "GROUND", unit: "KG", price: 310, min: 0.25, step: 0.25, low: 6, finalStock: 15, popularity: 9,
    description: "Freshly ground every morning from shoulder and leg trimmings (80/20). For lumpia, embutido, picadillo and siomai." },
  { sku: "PK-HED", name: "Pork Head", localName: "Ulo", category: "SPECIALTY", unit: "PIECE", price: 680, min: 1, step: 1, low: 1, finalStock: 1, popularity: 1,
    description: "Whole cleaned pig head — the base for sisig, dinakdakan and pork stock. Sold per piece; we can split it on request." },
  { sku: "PK-FAT", name: "Pork Fat", localName: "Taba", category: "FAT", unit: "KG", price: 150, min: 0.5, step: 0.5, low: 5, finalStock: 4, popularity: 2,
    description: "Pure back fat for rendering lard, making chicharon or enriching sausages and ground meat." },
  { sku: "PK-BON", name: "Pork Bones", localName: "Buto", category: "RIBS_AND_BONES", unit: "KG", price: 160, min: 1, step: 0.5, low: 5, finalStock: 14, popularity: 3,
    description: "Neck and back bones with some meat left on — the secret to rich bulalo-style soups, nilaga and ramen broth." },
];

/** Product photos supplied by the shop, prepared by scripts/process-images.mjs (public/products/hd). */
const PHOTOS: Record<string, string> = {
  "pork-leg": "/products/hd/pork-leg.webp",
  "pork-ribs": "/products/hd/pork-ribs.webp",
  "pork-belly": "/products/hd/pork-belly.webp",
  "pork-shoulder": "/products/hd/pork-shoulder.webp",
  "pork-loin": "/products/hd/pork-loin.webp",
  "pork-hock-feet": "/products/hd/pork-hock-feet.webp",
  "pork-giniling": "/products/hd/pork-giniling.webp",
  "pork-head": "/products/hd/pork-head.webp",
  "pork-fat": "/products/hd/pork-fat.webp",
  "pork-bones": "/products/hd/pork-bones.webp",
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Manila wall-clock time `daysAgo` days back at hour:minute → UTC Date. */
function manila(daysAgo: number, hour: number, minute = 0) {
  const now = new Date();
  const shifted = new Date(now.getTime() + OFFSET);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(midnight - daysAgo * DAY + hour * HOUR + minute * 60_000 - OFFSET);
}

async function wipe() {
  await db.$transaction([
    db.notification.deleteMany(),
    db.auditLog.deleteMany(),
    db.orderEvent.deleteMany(),
    db.stockTransaction.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.product.deleteMany(),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.verification.deleteMany(),
    db.user.deleteMany(),
    db.shopSettings.deleteMany(),
  ]);
  await db.$executeRawUnsafe(`ALTER SEQUENCE "Order_number_seq" RESTART WITH 1001`);
}

async function createUser(u: {
  name: string;
  email: string;
  phone: string;
  role: "OWNER" | "WORKER" | "CUSTOMER";
  password: string;
  dutyStatus?: "ON_DUTY" | "ON_BREAK" | "OFF_DUTY";
  createdAt: Date;
}) {
  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      emailVerified: true,
      dutyStatus: u.dutyStatus ?? "OFF_DUTY",
      dutyChangedAt: u.dutyStatus ? new Date() : null,
      createdAt: u.createdAt,
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(u.password) },
      },
    },
  });
  return id;
}

async function main() {
  console.log("Wiping existing data…");
  await wipe();

  await db.shopSettings.create({ data: { id: 1 } });

  console.log("Creating accounts…");
  const since = manila(30, 8);
  const owner = await createUser({ name: "Ramon Villanueva", email: "owner@porkshop.test", phone: "09171234567", role: "OWNER", password: "Owner1234", createdAt: since });
  const maria = await createUser({ name: "Maria Santos", email: "maria@porkshop.test", phone: "09181112222", role: "WORKER", password: "Worker1234", dutyStatus: "ON_DUTY", createdAt: since });
  const jose = await createUser({ name: "Jose Reyes", email: "jose@porkshop.test", phone: "09182223333", role: "WORKER", password: "Worker1234", dutyStatus: "ON_DUTY", createdAt: since });
  const ana = await createUser({ name: "Ana Cruz", email: "ana@porkshop.test", phone: "09183334444", role: "WORKER", password: "Worker1234", dutyStatus: "OFF_DUTY", createdAt: since });
  const juan = await createUser({ name: "Juan Dela Cruz", email: "customer@porkshop.test", phone: "09191234567", role: "CUSTOMER", password: "Customer1234", createdAt: since });
  const liza = await createUser({ name: "Liza Gomez", email: "liza@porkshop.test", phone: "09192345678", role: "CUSTOMER", password: "Customer1234", createdAt: since });
  const ben = await createUser({ name: "Ben Ramirez", email: "ben@porkshop.test", phone: "09193456789", role: "CUSTOMER", password: "Customer1234", createdAt: since });
  const workers = [maria, jose, ana];
  const workerNames: Record<string, string> = { [maria]: "Maria Santos", [jose]: "Jose Reyes", [ana]: "Ana Cruz" };
  const customers = [juan, liza, ben];

  console.log("Creating products…");
  const products: Awaited<ReturnType<typeof db.product.create>>[] = [];
  for (const p of PRODUCTS) {
    products.push(
      await db.product.create({
        data: {
          sku: p.sku,
          slug: slugify(p.name),
          name: p.name,
          imageUrl: PHOTOS[slugify(p.name)] ?? null,
          localName: p.localName,
          description: p.description,
          category: p.category,
          unit: p.unit,
          price: D(p.price),
          lowStockThreshold: D(p.low),
          minOrderQty: D(p.min),
          qtyStep: D(p.step),
          createdAt: since,
        },
      }),
    );
  }
  await db.auditLog.createMany({
    data: products.map((p) => ({
      actorId: owner,
      action: "product.create",
      entityType: "Product",
      entityId: p.id,
      summary: `Created product ${p.name}`,
      createdAt: since,
    })),
  });

  // ── Simulate 14 days of completed orders (in memory first, to size the deliveries) ──
  type Line = { productIdx: number; qty: number; actual: number };
  type HistOrder = {
    daysAgo: number;
    pickup: Date;
    customer: string;
    worker: string;
    lines: Line[];
    cancelled: boolean;
    method: PaymentMethod;
  };
  const weighted = PRODUCTS.flatMap((p, idx) => Array<number>(p.popularity).fill(idx));
  const history: HistOrder[] = [];
  for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
    const count = between(4, 8);
    for (let n = 0; n < count; n++) {
      const used = new Set<number>();
      const lines: Line[] = [];
      for (let l = 0; l < between(1, 3); l++) {
        const idx = pick(weighted);
        if (used.has(idx)) continue;
        used.add(idx);
        const p = PRODUCTS[idx]!;
        const steps = between(0, p.unit === "KG" ? 6 : 1);
        const qty = Math.round((p.min + steps * p.step) * 1000) / 1000;
        const actual = p.unit === "KG" ? Math.round(qty * (0.96 + rand() * 0.1) * 1000) / 1000 : qty;
        lines.push({ productIdx: idx, qty, actual });
      }
      const r = rand();
      history.push({
        daysAgo,
        pickup: manila(daysAgo, between(8, 16)),
        customer: pick(customers),
        worker: pick(daysAgo > 7 ? workers : [maria, jose]),
        lines,
        cancelled: rand() < 0.08,
        method: r < 0.7 ? "CASH" : r < 0.95 ? "GCASH" : "CARD",
      });
    }
  }
  history.sort((a, b) => a.pickup.getTime() - b.pickup.getTime());

  const spoilage: { daysAgo: number; productIdx: number; qty: number; reason: string }[] = [
    { daysAgo: 9, productIdx: 8, qty: 1.5, reason: "Discoloured after cooler temperature spike" },
    { daysAgo: 5, productIdx: 6, qty: 1, reason: "Past same-day freshness window" },
    { daysAgo: 2, productIdx: 1, qty: 0.75, reason: "Trimming loss" },
  ];

  // Deliveries: one large delivery 15 days ago and a mid-period restock 7 days ago.
  const midpoint = 7;
  const used = PRODUCTS.map((_, idx) => {
    const sum = (filter: (o: HistOrder) => boolean) =>
      history.filter((o) => !o.cancelled && filter(o)).flatMap((o) => o.lines).filter((l) => l.productIdx === idx).reduce((s, l) => s + l.actual, 0);
    const spoil = (filter: (s: { daysAgo: number }) => boolean) =>
      spoilage.filter((s) => s.productIdx === idx && filter(s)).reduce((t, s) => t + s.qty, 0);
    return {
      early: sum((o) => o.daysAgo > midpoint) + spoil((s) => s.daysAgo > midpoint),
      late: sum((o) => o.daysAgo <= midpoint) + spoil((s) => s.daysAgo <= midpoint),
    };
  });

  type Txn = Prisma.StockTransactionCreateManyInput & { createdAt: Date };
  const txns: Txn[] = [];
  PRODUCTS.forEach((p, idx) => {
    // First delivery covers the first week plus a buffer; the restock tops up to the final stock.
    const grain = p.unit === "PIECE" ? 1 : 2; // whole pieces, or half-kilo boxes
    const { early, late } = used[idx]!;
    const first = Math.ceil((early + p.finalStock * 0.4) * grain) / grain;
    const second = Math.round((p.finalStock + late - (first - early)) * 1000) / 1000;
    txns.push({ productId: products[idx]!.id, type: "STOCK_IN", quantity: D(first), balanceAfter: D(0), reason: "Opening delivery — Batangas supplier", actorId: owner, createdAt: manila(15, 6) });
    if (second > 0) {
      txns.push({ productId: products[idx]!.id, type: "STOCK_IN", quantity: D(second), balanceAfter: D(0), reason: "Weekly restock", actorId: owner, createdAt: manila(midpoint, 6, 15) });
    }
  });
  for (const s of spoilage) {
    txns.push({ productId: products[s.productIdx]!.id, type: "SPOILAGE", quantity: D(-s.qty), balanceAfter: D(0), reason: s.reason, actorId: owner, createdAt: manila(s.daysAgo, 18) });
  }

  console.log(`Creating ${history.length} historical orders…`);
  for (const h of history) {
    const created = new Date(h.pickup.getTime() - 2 * HOUR - between(0, 90) * 60_000);
    const assigned = new Date(created.getTime() + 20_000);
    const processing = new Date(h.pickup.getTime() - 60 * 60_000);
    const ready = new Date(h.pickup.getTime() - 15 * 60_000);
    const completed = new Date(h.pickup.getTime() + between(0, 40) * 60_000);
    const lines = h.lines.map((l) => {
      const p = products[l.productIdx]!;
      return {
        p,
        qty: D(l.qty),
        actual: D(l.actual),
        est: p.price.mul(l.qty).toDecimalPlaces(2),
        fin: p.price.mul(l.actual).toDecimalPlaces(2),
      };
    });
    const estimatedTotal = lines.reduce((s, l) => s.plus(l.est), D(0));
    const finalTotal = lines.reduce((s, l) => s.plus(l.fin), D(0));
    const wName = workerNames[h.worker]!;

    const order = await db.order.create({
      data: {
        customerId: h.customer,
        workerId: h.worker,
        status: h.cancelled ? "CANCELLED" : "COMPLETED",
        pickupAt: h.pickup,
        estimatedTotal,
        finalTotal: h.cancelled ? null : finalTotal,
        paymentStatus: h.cancelled ? "UNPAID" : "PAID",
        paymentMethod: h.cancelled ? null : h.method,
        paidAt: h.cancelled ? null : completed,
        cancelReason: h.cancelled ? "Change of plans" : null,
        createdAt: created,
        assignedAt: assigned,
        processingAt: h.cancelled ? null : processing,
        readyAt: h.cancelled ? null : ready,
        completedAt: h.cancelled ? null : completed,
        cancelledAt: h.cancelled ? new Date(assigned.getTime() + 10 * 60_000) : null,
        items: {
          create: lines.map((l) => ({
            productId: l.p.id,
            productName: l.p.name,
            unit: l.p.unit,
            unitPrice: l.p.price,
            orderedQty: l.qty,
            actualQty: h.cancelled ? null : l.actual,
            estimatedTotal: l.est,
            finalTotal: h.cancelled ? null : l.fin,
          })),
        },
        events: {
          create: [
            { type: "CREATED", toStatus: "PENDING", actorId: h.customer, message: "Order placed and added to the assignment queue", createdAt: created },
            { type: "ASSIGNED", fromStatus: "PENDING", toStatus: "ASSIGNED", workerId: h.worker, message: `Automatically assigned to ${wName}`, createdAt: assigned },
            ...(h.cancelled
              ? [{ type: "STATUS", fromStatus: "ASSIGNED" as const, toStatus: "CANCELLED" as const, actorId: h.customer, message: "Cancelled by the customer — Change of plans", createdAt: new Date(assigned.getTime() + 10 * 60_000) }]
              : [
                  { type: "STATUS", fromStatus: "ASSIGNED" as const, toStatus: "PROCESSING" as const, actorId: h.worker, workerId: h.worker, message: `${wName} started preparing the order`, createdAt: processing },
                  { type: "STATUS", fromStatus: "PROCESSING" as const, toStatus: "READY" as const, actorId: h.worker, workerId: h.worker, message: `Weighed and packed by ${wName}`, createdAt: ready },
                  { type: "STATUS", fromStatus: "READY" as const, toStatus: "COMPLETED" as const, actorId: h.worker, workerId: h.worker, message: `Picked up — paid via ${h.method.toLowerCase()}`, createdAt: completed },
                ]),
          ],
        },
      },
    });
    if (!h.cancelled) {
      for (const l of lines) {
        txns.push({ productId: l.p.id, type: "WITHDRAWAL", quantity: l.actual.neg(), balanceAfter: D(0), reason: `Order #${String(order.number).padStart(6, "0")}`, orderId: order.id, actorId: h.worker, createdAt: ready });
      }
    }
  }

  // Write stock transactions chronologically with correct running balances.
  txns.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const balances = new Map<string, Prisma.Decimal>();
  for (const t of txns) {
    const next = (balances.get(t.productId) ?? D(0)).plus(t.quantity as Prisma.Decimal);
    if (next.lt(0)) throw new Error(`Seed produced negative stock for ${t.productId}`);
    balances.set(t.productId, next);
    t.balanceAfter = next;
  }
  await db.stockTransaction.createMany({ data: txns });
  for (const p of products) {
    await db.product.update({ where: { id: p.id }, data: { stockQty: balances.get(p.id) ?? D(0) } });
  }

  await db.auditLog.createMany({
    data: [
      { actorId: owner, action: "worker.create", entityType: "User", entityId: maria, summary: "Created worker account for Maria Santos", createdAt: since },
      { actorId: owner, action: "worker.create", entityType: "User", entityId: jose, summary: "Created worker account for Jose Reyes", createdAt: since },
      { actorId: owner, action: "worker.create", entityType: "User", entityId: ana, summary: "Created worker account for Ana Cruz", createdAt: since },
      ...spoilage.map((s) => ({
        actorId: owner,
        action: "stock.spoilage",
        entityType: "Product",
        entityId: products[s.productIdx]!.id,
        summary: `Wrote off ${s.qty} kg of ${PRODUCTS[s.productIdx]!.name}`,
        createdAt: manila(s.daysAgo, 18),
      })),
      { actorId: owner, action: "product.price_change", entityType: "Product", entityId: products[2]!.id, summary: "Changed price of Pork Belly: ₱375.00 → ₱390.00", createdAt: manila(6, 7) },
    ],
  });

  await db.notification.createMany({
    data: [
      { userId: owner, type: "STOCK", title: "Low stock: Pork Fat", body: "4 kg available (alert level 5 kg).", href: "/owner/inventory", createdAt: manila(1, 17) },
      { userId: owner, type: "STOCK", title: "Low stock: Pork Head", body: "1 pc available (alert level 1 pc).", href: "/owner/inventory", createdAt: manila(1, 15) },
      { userId: juan, type: "SYSTEM", title: "Welcome to Porkshop", body: "Order fresh cuts online and pick them up at your chosen time.", href: "/shop", createdAt: since },
    ],
  });

  console.log("\nSeed complete. Demo accounts:");
  console.table([
    { role: "Owner", email: "owner@porkshop.test", password: "Owner1234" },
    { role: "Worker", email: "maria@porkshop.test", password: "Worker1234" },
    { role: "Worker", email: "jose@porkshop.test", password: "Worker1234" },
    { role: "Worker (off duty)", email: "ana@porkshop.test", password: "Worker1234" },
    { role: "Customer", email: "customer@porkshop.test", password: "Customer1234" },
  ]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
