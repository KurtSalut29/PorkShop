import type { Metadata } from "next";
import Link from "next/link";
import { Hourglass, Info, TriangleAlert } from "lucide-react";
import { EmptyState, PageHeader, Section } from "@/components/page";
import { DutyBadge, OrderStatusBadge, ToneBadge } from "@/components/status";
import { formatDateTime, formatPeso, formatShortDate, formatTime, orderCode } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/dal";
import { assignmentOverview } from "@/server/queries/orders";
import { RunDispatcherButton } from "./run-button";

export const metadata: Metadata = { title: "Assignments" };

export default async function AssignmentsPage() {
  await requireRole("OWNER");
  const data = await assignmentOverview();
  const onDuty = data.workers.filter((w) => w.active && w.dutyStatus === "ON_DUTY");
  const freeSlots = onDuty.reduce((s, w) => s + Math.max(0, w.capacity - w.load), 0);

  return (
    <>
      <PageHeader
        title="Automatic assignment"
        description="How the dispatcher is distributing orders across your team right now."
        actions={<RunDispatcherButton />}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border bg-card p-4 text-sm shadow-xs">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Load-balancing rule:</span> each queued order (earliest pickup first) goes
          to the <span className="text-foreground">on-duty</span> worker with the <span className="text-foreground">fewest active orders</span>{" "}
          (assigned + preparing). Ties go to whoever has waited longest since their last assignment. Workers at capacity are
          skipped. Packed orders don’t count toward workload. {onDuty.length} on duty · {freeSlots} free slot{freeSlots === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.workers.map((w) => {
          const pct = Math.min(100, (w.load / w.capacity) * 100);
          return (
            <section key={w.id} className={cn("rounded-xl border bg-card p-5 shadow-xs", !w.active && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{w.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {w.lastAssignedAt ? `Last assigned ${formatDateTime(w.lastAssignedAt)}` : "No assignments yet"}
                  </p>
                </div>
                {w.active ? <DutyBadge status={w.dutyStatus} /> : <ToneBadge tone="stone">Deactivated</ToneBadge>}
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Workload</span>
                  <span className="num font-medium">
                    {w.load} / {w.capacity}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                  role="meter"
                  aria-valuenow={w.load}
                  aria-valuemin={0}
                  aria-valuemax={w.capacity}
                  aria-label={`${w.name} workload`}
                >
                  <div
                    className={cn("h-full rounded-full", pct >= 100 ? "bg-amber-500" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Ready at counter</dt>
                  <dd className="num font-semibold">{w.ready}</dd>
                </div>
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Completed today</dt>
                  <dd className="num font-semibold">{w.completedToday}</dd>
                </div>
              </dl>
              {w.orders.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {w.orders.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/owner/orders/${o.id}`}
                        className="num inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                        title={`Pickup ${formatTime(o.pickupAt)}`}
                      >
                        {orderCode(o.number)}
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            o.status === "ASSIGNED" ? "bg-sky-500" : o.status === "PROCESSING" ? "bg-violet-500" : "bg-emerald-500",
                          )}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Section title="Waiting in queue" description="Assigned automatically as soon as a worker has capacity">
          {data.queue.length === 0 ? (
            <EmptyState icon={Hourglass} title="Queue is empty" description="Every order has been assigned." />
          ) : (
            <ul className="divide-y">
              {data.queue.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <Link href={`/owner/orders/${o.id}`} className="num font-medium text-primary hover:underline">
                      {orderCode(o.number)}
                    </Link>
                    <span className="text-muted-foreground"> · {o.customer.name}</span>
                    <p className="num text-xs text-muted-foreground">
                      Pickup {formatShortDate(o.pickupAt)}, {formatTime(o.pickupAt)} · waiting since {formatTime(o.createdAt)}
                    </p>
                  </div>
                  <span className="num font-medium">{formatPeso(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Needs reassignment" description="Open orders held by off-duty or deactivated workers">
          {data.needsAttention.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nothing needs your attention.</p>
          ) : (
            <ul className="divide-y">
              {data.needsAttention.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <TriangleAlert className="size-4 shrink-0 text-amber-600" />
                    <div>
                      <Link href={`/owner/orders/${o.id}`} className="num font-medium text-primary hover:underline">
                        {orderCode(o.number)}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        With {o.worker?.name} ({o.worker?.active ? "off duty" : "deactivated"})
                      </p>
                    </div>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Assignment log" description="The dispatcher's most recent decisions" className="mt-6">
        {data.log.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <ul className="divide-y">
            {data.log.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span className="num w-36 shrink-0 text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                <ToneBadge tone={e.type === "ASSIGNED" ? "sky" : e.type === "REASSIGNED" ? "violet" : "amber"}>
                  {e.type === "ASSIGNED" ? "Auto" : e.type === "REASSIGNED" ? "Manual" : "Re-queued"}
                </ToneBadge>
                <Link href={`/owner/orders/${e.orderId}`} className="num font-medium text-primary hover:underline">
                  {orderCode(e.orderNumber)}
                </Link>
                <span className="min-w-0 flex-1 text-muted-foreground">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
