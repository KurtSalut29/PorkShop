import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Ban, Banknote, Download, Receipt, Scale } from "lucide-react";
import { ProductRevenueChart, RevenueChart } from "@/components/charts";
import { DateRangeFilter } from "@/components/filters";
import { PageHeader, Section, StatCard } from "@/components/page";
import { StockLevelBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { resolveRange } from "@/lib/dates";
import { formatPeso, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/dal";
import { inventoryReport, movementReport, salesReport } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Reports" };

const TABS = [
  { key: "sales", label: "Sales" },
  { key: "movements", label: "Stock movements" },
  { key: "inventory", label: "Inventory valuation" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default async function ReportsPage({ searchParams }: PageProps<"/owner/reports">) {
  await requireRole("OWNER");
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "sales";
  const range = resolveRange(sp.from, sp.to, new Date(), 30);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ from: range.fromKey, to: range.toKey, ...extra }).toString();

  return (
    <>
      <PageHeader
        title="Reports"
        description="Sales, stock movement and inventory value. All amounts use actual weighed totals."
        actions={
          <Button variant="outline" asChild>
            <a href={`/api/reports/${tab}?${qs({})}`}>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
        }
      />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="inline-flex w-fit rounded-lg border bg-card p-1" role="tablist">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/owner/reports?${qs({ tab: t.key })}`}
              role="tab"
              aria-selected={tab === t.key}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {tab !== "inventory" && (
          <Suspense fallback={<Skeleton className="h-14 w-80" />}>
            <DateRangeFilter basePath="/owner/reports" from={range.fromKey} to={range.toKey} />
          </Suspense>
        )}
      </div>
      {tab === "sales" && <SalesTab range={range} />}
      {tab === "movements" && <MovementsTab range={range} />}
      {tab === "inventory" && <InventoryTab />}
    </>
  );
}

type Range = ReturnType<typeof resolveRange>;

async function SalesTab({ range }: { range: Range }) {
  const r = await salesReport(range);
  const best = [...r.series].sort((a, b) => b.revenue - a.revenue)[0];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatPeso(r.totalRevenue)} icon={Banknote} hint={best?.revenue ? `Best day ${best.day}` : "No sales in range"} />
        <StatCard label="Completed orders" value={r.totalOrders} icon={Receipt} hint={`Average ${formatPeso(r.averageOrder)}`} />
        <StatCard
          label="Weight variance"
          value={`${r.weightVariance >= 0 ? "+" : "−"}${formatPeso(Math.abs(r.weightVariance))}`}
          icon={Scale}
          hint="Final vs estimated totals"
        />
        <StatCard label="Cancelled" value={r.cancelled} icon={Ban} hint="Orders cancelled in range" />
      </div>

      <Section title="Daily revenue" description={`${range.fromKey} to ${range.toKey}`}>
        <div className="p-4 pt-5">
          <RevenueChart data={r.series} height={300} />
        </div>
        <details className="border-t">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">View as table</summary>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b bg-muted/50 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                  <th className="px-5 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 text-right font-semibold">Orders</th>
                  <th className="px-5 py-2 text-right font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.series.map((d) => (
                  <tr key={d.day}>
                    <td className="num px-5 py-2">{d.day}</td>
                    <td className="num px-3 py-2 text-right">{d.orders}</td>
                    <td className="num px-5 py-2 text-right">{formatPeso(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Section title="Revenue by product">
          {r.byProduct.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">No sales in this range.</p>
          ) : (
            <>
              <div className="p-4">
                <ProductRevenueChart data={r.byProduct} />
              </div>
              <table className="w-full border-t text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                    <th className="px-5 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 text-right font-semibold">Sold</th>
                    <th className="px-3 py-2 text-right font-semibold">Orders</th>
                    <th className="px-5 py-2 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.byProduct.map((p) => (
                    <tr key={p.productId}>
                      <td className="px-5 py-2 font-medium">{p.name}</td>
                      <td className="num px-3 py-2 text-right">{formatQty(p.qty, p.unit)}</td>
                      <td className="num px-3 py-2 text-right">{p.orders}</td>
                      <td className="num px-5 py-2 text-right">{formatPeso(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Section>
        <Section title="Payment methods" description="Completed orders">
          <ul className="divide-y">
            {r.byMethod.length === 0 && <li className="px-5 py-6 text-sm text-muted-foreground">No payments in range.</li>}
            {r.byMethod.map((m) => {
              const pct = r.totalRevenue ? (m.revenue / r.totalRevenue) * 100 : 0;
              return (
                <li key={m.method} className="px-5 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{PAYMENT_METHOD_LABEL[m.method as PaymentMethod]}</span>
                    <span className="num">{formatPeso(m.revenue)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[#c02a5e]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="num w-24 text-right text-xs text-muted-foreground">
                      {pct.toFixed(0)}% · {m.orders} orders
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>
    </div>
  );
}

async function MovementsTab({ range }: { range: Range }) {
  const r = await movementReport(range);
  const sign = (n: number) => (Math.abs(n) < 0.0005 ? "—" : n.toFixed(3).replace(/\.?0+$/, ""));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Stock movements" value={r.totals.transactions} hint="Entries in this range" />
        <StatCard label="Spoilage cost" value={formatPeso(r.totals.spoilageValue)} tone={r.totals.spoilageValue ? "danger" : "default"} hint="At selling price" />
        <StatCard label="Products tracked" value={r.table.length} />
      </div>
      <Section title="Movement by product" description="Quantities in each product's unit (kg or pcs)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 text-right font-semibold">Stock in</th>
                <th className="px-3 py-3 text-right font-semibold">Withdrawn</th>
                <th className="px-3 py-3 text-right font-semibold">Returned</th>
                <th className="px-3 py-3 text-right font-semibold">Spoiled</th>
                <th className="px-3 py-3 text-right font-semibold">Corrections</th>
                <th className="px-3 py-3 text-right font-semibold">On hand now</th>
                <th className="px-5 py-3 text-right font-semibold">Spoilage cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {r.table.map((p) => (
                <tr key={p.productId}>
                  <td className="px-5 py-3 font-medium">
                    {p.name} <span className="text-xs font-normal text-muted-foreground">({p.unit === "KG" ? "kg" : "pcs"})</span>
                  </td>
                  <td className="num px-3 py-3 text-right text-emerald-700">{sign(p.stockIn)}</td>
                  <td className="num px-3 py-3 text-right">{sign(p.withdrawn)}</td>
                  <td className="num px-3 py-3 text-right">{sign(p.returned)}</td>
                  <td className={cn("num px-3 py-3 text-right", p.spoiled > 0 && "text-red-700")}>{sign(p.spoiled)}</td>
                  <td className="num px-3 py-3 text-right">{sign(p.corrected)}</td>
                  <td className="num px-3 py-3 text-right font-medium">{formatQty(p.onHand, p.unit)}</td>
                  <td className="num px-5 py-3 text-right">{p.spoilageValue ? formatPeso(p.spoilageValue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

async function InventoryTab() {
  const r = await inventoryReport();
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Inventory value" value={formatPeso(r.totalValue)} hint="On-hand stock at selling price" />
        <StatCard label="Low stock" value={r.lowCount} tone={r.lowCount ? "warning" : "default"} />
        <StatCard label="Out of stock" value={r.outCount} tone={r.outCount ? "danger" : "default"} />
      </div>
      <Section title="Current inventory">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 text-right font-semibold">On hand</th>
                <th className="px-3 py-3 text-right font-semibold">Reserved</th>
                <th className="px-3 py-3 text-right font-semibold">Available</th>
                <th className="px-3 py-3 text-right font-semibold">Price</th>
                <th className="px-5 py-3 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {r.products.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-3 py-3">
                    <StockLevelBadge level={p.level} />
                  </td>
                  <td className="num px-3 py-3 text-right">{formatQty(p.stockQty, p.unit)}</td>
                  <td className="num px-3 py-3 text-right text-muted-foreground">{formatQty(p.reservedQty, p.unit)}</td>
                  <td className="num px-3 py-3 text-right">{formatQty(p.available, p.unit)}</td>
                  <td className="num px-3 py-3 text-right">{formatPeso(p.price)}</td>
                  <td className="num px-5 py-3 text-right font-medium">{formatPeso(p.stockQty * p.price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td className="px-5 py-3 font-semibold" colSpan={6}>
                  Total
                </td>
                <td className="num px-5 py-3 text-right font-semibold">{formatPeso(r.totalValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>
    </div>
  );
}
