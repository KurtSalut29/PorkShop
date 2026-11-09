import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Banknote, ClipboardList, Hourglass, PackageX, TrendingDown, TrendingUp } from "lucide-react";
import { RevenueChart } from "@/components/charts";
import { itemsSummary } from "@/components/orders/order-parts";
import { PageHeader, Section, StatCard } from "@/components/page";
import { DutyBadge, OrderStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { formatPeso, formatQty, formatTime, orderCode } from "@/lib/format";
import { requireRole } from "@/server/dal";
import { ownerDashboard } from "@/server/queries/dashboard";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Owner dashboard" };

export default async function OwnerDashboard() {
  const user = await requireRole("OWNER");
  const [d, settings] = await Promise.all([ownerDashboard(), getSettings()]);
  const delta = d.yesterdayRevenue > 0 ? ((d.todayRevenue - d.yesterdayRevenue) / d.yesterdayRevenue) * 100 : null;

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Live overview of sales, orders, stock and your team."
        actions={
          <Button variant="outline" asChild>
            <Link href="/owner/reports">Open reports</Link>
          </Button>
        }
      />

      {d.attention > 0 && (
        <Link
          href="/owner/orders?attention=1"
          className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 transition-colors hover:bg-amber-100"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <span className="font-medium">
              {d.attention} cancellation request{d.attention > 1 ? "s" : ""}
            </span>{" "}
            waiting for your decision.
          </span>
          <span className="ml-auto font-medium">Review →</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales today"
          value={formatPeso(d.todayRevenue)}
          icon={Banknote}
          hint={
            delta === null ? (
              `${d.todayCompleted} completed order${d.todayCompleted === 1 ? "" : "s"}`
            ) : (
              <span className="inline-flex items-center gap-1">
                {delta >= 0 ? <TrendingUp className="size-3.5 text-emerald-700" /> : <TrendingDown className="size-3.5 text-red-700" />}
                <span className="num">{Math.abs(delta).toFixed(0)}%</span> vs yesterday · {d.todayCompleted} order{d.todayCompleted === 1 ? "" : "s"}
              </span>
            )
          }
        />
        <StatCard label="Open orders" value={d.openOrders} icon={ClipboardList} hint="Assigned, preparing or ready" href="/owner/orders?status=ACTIVE" />
        <StatCard
          label="Waiting in queue"
          value={d.queue}
          icon={Hourglass}
          tone={d.queue > 0 ? "warning" : "default"}
          hint={d.queue > 0 ? "No worker capacity available" : "Every order has a worker"}
          href="/owner/assignments"
        />
        <StatCard
          label="Low / out of stock"
          value={d.lowStock.length}
          icon={PackageX}
          tone={d.lowStock.length ? "danger" : "default"}
          hint={`${d.productCount} products · ${formatPeso(d.stockValue)} in stock`}
          href="/owner/inventory"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Section
          title="Revenue, last 14 days"
          description={`${formatPeso(d.sales.totalRevenue)} from ${d.sales.totalOrders} completed orders · avg ${formatPeso(d.sales.averageOrder)}`}
        >
          <div className="p-4 pt-5">
            <RevenueChart data={d.sales.series} />
          </div>
        </Section>

        <Section
          title="Team"
          description="Live duty status and workload"
          actions={
            <Link href="/owner/assignments" className="text-sm font-medium text-primary hover:underline">
              Monitor
            </Link>
          }
        >
          <ul className="divide-y">
            {d.workers.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{w.name}</p>
                  <p className="num text-xs text-muted-foreground">
                    {w.load} active / {settings.maxActiveOrdersPerWorker} capacity
                  </p>
                </div>
                <DutyBadge status={w.dutyStatus} />
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Section
          title="Latest orders"
          actions={
            <Link href="/owner/orders" className="text-sm font-medium text-primary hover:underline">
              All orders
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <tbody className="divide-y">
                {d.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40">
                    <td className="num px-5 py-3 font-medium">
                      <Link href={`/owner/orders/${o.id}`} className="text-primary hover:underline">
                        {orderCode(o.number)}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{o.customer.name}</p>
                      <p className="max-w-56 truncate text-xs text-muted-foreground">{itemsSummary(o)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{o.worker?.name ?? "Queue"}</td>
                    <td className="num px-5 py-3 text-right font-medium">{formatPeso(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="Stock alerts"
          actions={
            <Link href="/owner/inventory" className="text-sm font-medium text-primary hover:underline">
              Inventory
            </Link>
          }
        >
          {d.lowStock.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">All products are above their alert levels.</p>
          ) : (
            <ul className="divide-y">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="num text-xs text-muted-foreground">Alert at {formatQty(p.lowStockThreshold, p.unit)}</p>
                  </div>
                  <span className={p.level === "out" ? "num font-semibold text-red-700" : "num font-semibold text-amber-700"}>
                    {p.level === "out" ? "Out of stock" : `${formatQty(p.available, p.unit)} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">Updated {formatTime(new Date())}</p>
        </Section>
      </div>
    </>
  );
}
