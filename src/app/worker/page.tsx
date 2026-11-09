import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Gauge, PackageCheck } from "lucide-react";
import { EmptyState, PageHeader, Section, StatCard } from "@/components/page";
import { DutySwitch } from "@/components/staff/duty-switch";
import { StaffOrderCard } from "@/components/staff/order-card";
import { DUTY_STATUS } from "@/lib/constants";
import { formatQty } from "@/lib/format";
import { requireRole } from "@/server/dal";
import { workerDashboardStats } from "@/server/queries/dashboard";
import { listInventory } from "@/server/queries/inventory";
import { listWorkerQueue } from "@/server/queries/orders";
import { getSettings } from "@/server/settings";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Worker dashboard" };

export default async function WorkerDashboard() {
  const user = await requireRole("WORKER");
  const [queue, stats, settings, inventory, me] = await Promise.all([
    listWorkerQueue(user.id),
    workerDashboardStats(user.id),
    getSettings(),
    listInventory(),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { maxActiveOrders: true } }),
  ]);
  const capacity = me.maxActiveOrders ?? settings.maxActiveOrdersPerWorker;
  const active = queue.filter((o) => o.status === "ASSIGNED" || o.status === "PROCESSING");
  const ready = queue.filter((o) => o.status === "READY");
  const low = inventory.filter((p) => p.level !== "ok");
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Hello, ${firstName}`} description="Your assigned orders, sorted by pickup time." />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <section className="rounded-xl border bg-card p-5 shadow-xs">
          <p className="text-sm font-medium">Your availability</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{DUTY_STATUS[user.dutyStatus].hint}.</p>
          <div className="mt-4">
            <DutySwitch status={user.dutyStatus} size="lg" />
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Workload"
            value={`${active.length} / ${capacity}`}
            hint={active.length >= capacity ? "At capacity, new orders go to others" : "Active orders"}
            icon={Gauge}
            tone={active.length >= capacity ? "warning" : "default"}
          />
          <StatCard label="Ready for pickup" value={ready.length} hint="Waiting at the counter" icon={PackageCheck} tone="success" />
          <StatCard label="Completed today" value={stats.completedToday} hint={`${stats.handledTotal} all time`} icon={CheckCircle2} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Section
          title="Your queue"
          description="New orders are assigned automatically while you're on duty."
          actions={
            <Link href="/worker/orders" className="text-sm font-medium text-primary hover:underline">
              Open board
            </Link>
          }
        >
          {queue.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={user.dutyStatus === "ON_DUTY" ? "No orders right now" : "You're not receiving orders"}
              description={
                user.dutyStatus === "ON_DUTY"
                  ? "Sit tight. New orders will appear here instantly."
                  : "Switch to On duty to start receiving orders."
              }
            />
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {queue.map((o) => (
                <StaffOrderCard key={o.id} order={o} href={`/worker/orders/${o.id}`} slotMinutes={settings.slotMinutes} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Stock to watch" description="Low or out-of-stock products">
          {low.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">All products are well stocked.</p>
          ) : (
            <ul className="divide-y">
              {low.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className={p.level === "out" ? "num text-red-700" : "num text-amber-700"}>
                    {p.level === "out" ? "Out" : formatQty(p.available, p.unit)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
