# Porkshop

**A distributed inventory and order management system with parallel processing and automatic worker assignment.**

Customers order fresh pork cuts online and choose a pickup slot. Orders are distributed automatically to the least-loaded on-duty worker. Workers weigh each cut, and the final price uses the actual weight. Inventory stays in sync on every connected device in real time.

---

## Quick start

Prerequisites: **Node.js 20+** and **Docker Desktop**.

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # then set BETTER_AUTH_SECRET to a long random string
npm run db:up               # starts PostgreSQL in Docker on localhost:5433
npm run db:migrate          # creates the schema
npm run db:seed             # products, demo accounts, 2 weeks of history
npm run dev                 # http://localhost:3000
```

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Owner | `owner@porkshop.test` | `Owner1234` |
| Worker (on duty) | `maria@porkshop.test` | `Worker1234` |
| Worker (on duty) | `jose@porkshop.test` | `Worker1234` |
| Worker (off duty) | `ana@porkshop.test` | `Worker1234` |
| Customer | `customer@porkshop.test` | `Customer1234` |

In development, the sign-in page has one-tap buttons that fill in these accounts.

> **Try the real-time sync:** open the customer's order page in one browser and a worker's board in another (or a private window). As the worker moves the order along, the customer's screen updates live.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run db:up` | Start PostgreSQL (Docker Compose) |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Wipe and re-seed demo data |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm test` | Unit tests (assignment rule, pickup slots, pricing) |
| `npm run test:concurrency` | Stress test against the real database, then re-seeds |
| `npm run typecheck` / `lint` | TypeScript and ESLint |

---

## Features

### Customers
- Registration and sign-in with validation and a password-strength meter.
- Catalog with category filters, search (including local names such as *liempo* and *kasim*) and live stock levels.
- Product pages with a quantity stepper that follows each product's minimum and step (e.g. 0.25 kg).
- Cart that is re-priced and stock-checked against the server.
- Checkout with **pickup time slots** that show remaining capacity.
- Order tracking: a 5-step progress tracker and an activity timeline, updated live.
- Cancellation: instant until preparation starts, then a *request* that the owner approves.
- Notifications (in-app and live toasts) and profile/password settings.

### Workers
- **On duty / On break / Off duty** switch, available from every screen.
- Dashboard with workload against capacity, ready-for-pickup count and stock to watch.
- Kanban board: *To start → Preparing → Ready for pickup*.
- A guided workflow for each order: start preparing, then **enter the actual weights**, which withdraws stock automatically and sets the final price, then hand over and record payment (cash, GCash or card).
- Manual stock withdrawals, returns (linked to an order if needed) and spoilage.
- Read-only product and stock views, plus order history.

### Owner
- Dashboard: today's sales vs. yesterday, open orders, queue, stock alerts, a 14-day revenue chart and team status.
- Orders: status tabs, search, and a "needs decision" filter for cancellation requests.
- **Order controls:** reassign to a worker or back to the queue, approve or decline cancellations, cancel (packed stock is returned automatically), record advance payment, and act on behalf of a worker.
- **Assignment monitor:** live load per worker, the queue, orders held by off-duty or deactivated workers, the dispatcher's decision log, and a "run dispatcher now" button.
- Products: create, edit and archive/restore. Price changes are recorded in the audit log.
- Stock levels: on hand, reserved and available, with an availability bar, deliveries, count corrections and spoilage.
- Stock history with filters and CSV export.
- Workers: create accounts, edit details, set a per-worker capacity, reset passwords, and deactivate (this signs the worker out and re-queues their unfinished orders).
- Reports: sales (daily chart, by product, payment mix, weight variance), stock movement (including spoilage cost) and inventory valuation, each with CSV export.
- Audit log and shop settings (hours, slot length and capacity, lead time, booking window, default worker capacity).

---

## How the distributed parts work

### Oversell protection (parallel checkouts)
Placing an order **reserves** stock with one conditional update per line:

```sql
UPDATE "Product" SET "reservedQty" = "reservedQty" + $qty
WHERE id = $id AND "stockQty" - "reservedQty" >= $qty
```

The row lock taken by `UPDATE` forces racing transactions to re-check the condition, so two customers can never both buy the last kilo. Lines are locked in a fixed order (sorted by product id), which prevents deadlocks. Database `CHECK` constraints (`reservedQty <= stockQty`, `stockQty >= 0`) are the last line of defence.

**Stock lifecycle:**
- *Placed:* the quantity is reserved.
- *Packed:* the actual weight is withdrawn and the reservation released, both in one statement.
- *Cancelled before packing:* the reservation is released.
- *Cancelled after packing:* the weighed stock is returned.

### Automatic, load-balanced assignment
`src/server/assignment.ts` assigns queued orders, earliest pickup first. Each goes to the on-duty worker with the **fewest active orders** (assigned + preparing), as long as they are below their capacity. Ties go to whoever has waited longest since their last assignment. The rule itself is a pure function (`src/lib/assignment.ts`) covered by unit tests.

The dispatcher runs:
- after every event that frees capacity or adds work (order placed, order packed, cancellation, worker clocking in, settings change);
- every 30 seconds as a safety sweep.

It is safe to run on any number of server instances at once: a transaction-scoped PostgreSQL **advisory lock** makes it a single critical section across the whole cluster, and `FOR UPDATE SKIP LOCKED` skips orders that another transaction is busy with.

Pickup-slot capacity uses a per-slot advisory lock, so a burst of bookings can't overfill a slot.

### Real-time synchronisation
Every write calls `pg_notify` *inside its transaction*, so PostgreSQL delivers the message only after commit. Each Next.js instance keeps a single `LISTEN` connection and forwards events over **Server-Sent Events** (`/api/events`), filtered by role and user. In the browser, `RealtimeListener` re-renders the current page's Server Components in place and shows a toast for personal notifications. No extra infrastructure (Redis, websockets) is needed, and it works across multiple server instances.

### Verified
`npm run test:concurrency` runs the services against PostgreSQL and checks:
- 12 parallel orders for the last item produce exactly 1 success;
- 20 parallel checkouts reserve exactly the right quantity;
- a 4-place slot never takes more than 4 bookings, even with 10 at once;
- 6 dispatchers running simultaneously never double-assign, and loads stay balanced (5/5/5);
- actual-weight withdrawal, final pricing, payment and cancellation release all behave correctly;
- for every product, reserved stock equals the sum of open order lines.

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Cache Components, `proxy.ts`), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Radix), Lucide icons, Sonner toasts, Recharts |
| Data | PostgreSQL 17 (Docker), Prisma 7 with the `pg` driver adapter |
| Auth | Better Auth (email + password, database sessions, role field, deactivation hook) |
| Validation | Zod (the same schemas run on the client and the server) |
| Real-time | PostgreSQL `LISTEN/NOTIFY` → Server-Sent Events |
| Tests | Vitest (unit), tsx integration stress test |

### Design system
- **Colors:** warm stone neutrals with a deep **oxblood** primary. Errors use a separate, brighter red so they never read as brand color.
- **Typography:** Inter, with tabular numbers for every price, weight and count.
- **Spacing and controls:** 4/8-px spacing and 36–40 px controls, sized so workers can tap them on tablets.
- **Status colors** are consistent everywhere (queue amber, assigned sky, preparing violet, ready emerald, cancelled red) and always paired with a text label.
- All money is in ₱ and all times are Asia/Manila.

### Project layout
```
prisma/            schema, migrations (with CHECK constraints), seed
src/app/(auth)     sign-in, sign-up
src/app/(store)    landing, shop, product, cart, checkout, orders, account
src/app/worker     worker station
src/app/owner      owner console
src/app/actions    Server Actions (thin: authorise → validate → call a service)
src/app/api        auth handler, SSE events, CSV reports
src/server         services: orders, assignment, inventory, workers, products, realtime, DAL
src/server/queries read models for pages
src/lib            client-safe pure logic: slots, pricing, assignment rule, formatting
src/components     UI building blocks
tests/             unit + concurrency tests
```

### Security notes
- Every page, action and API route verifies the session and role through the Data Access Layer (`src/server/dal.ts`). `proxy.ts` is only an optimistic redirect.
- Visitors can never choose their own role at sign-up. Workers are created by the owner, and deactivated accounts can't sign in.
- Totals are always recomputed on the server. The browser cart is only a convenience.

### Before going to production
- Set a strong `BETTER_AUTH_SECRET` and serve over HTTPS.
- Add email verification and password reset through an email provider (e.g. Resend).
- Use managed PostgreSQL with backups (e.g. Neon or RDS).
- The demo-account buttons are hidden automatically in production builds.
