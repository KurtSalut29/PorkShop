import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Search } from "lucide-react";
import { itemsSummary } from "@/components/orders/order-parts";
import { EmptyState, PageHeader, Section } from "@/components/page";
import { OrderStatusBadge, PaymentBadge } from "@/components/status";
import { Input } from "@/components/ui/input";
import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";
import { formatPeso, formatShortDate, formatTime, orderCode } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/dal";
import { listOrders, orderStatusCounts } from "@/server/queries/orders";

export const metadata: Metadata = { title: "Orders" };

const TABS: { key: string; label: string }[] = [
  { key: "ACTIVE", label: "Active" },
  { key: "PENDING", label: ORDER_STATUS.PENDING.label },
  { key: "ASSIGNED", label: ORDER_STATUS.ASSIGNED.label },
  { key: "PROCESSING", label: ORDER_STATUS.PROCESSING.label },
  { key: "READY", label: "Ready" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "ALL", label: "All" },
];

export default async function OwnerOrdersPage({ searchParams }: PageProps<"/owner/orders">) {
  await requireRole("OWNER");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "ACTIVE";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const attention = sp.attention === "1";
  const [orders, { counts, attention: attentionCount }] = await Promise.all([
    listOrders({ status: attention ? "ALL" : status, q, attention }),
    orderStatusCounts(),
  ]);
  const activeCount = (["PENDING", "ASSIGNED", "PROCESSING", "READY"] as OrderStatus[]).reduce((s, k) => s + (counts[k] ?? 0), 0);
  const countFor = (key: string) =>
    key === "ACTIVE" ? activeCount : key === "ALL" ? Object.values(counts).reduce((s, n) => s + (n ?? 0), 0) : (counts[key as OrderStatus] ?? 0);
  const href = (params: Record<string, string>) => {
    const u = new URLSearchParams(params);
    if (q) u.set("q", q);
    return `/owner/orders?${u}`;
  };

  return (
    <>
      <PageHeader title="Orders" description="Every customer order and where it is in the pipeline. Updates live." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => {
            const active = !attention && status === t.key;
            return (
              <Link
                key={t.key}
                href={href({ status: t.key })}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-card text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span className="num rounded-full bg-muted px-1.5 text-xs">{countFor(t.key)}</span>
              </Link>
            );
          })}
          {attentionCount > 0 && (
            <Link
              href="/owner/orders?attention=1"
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium",
                attention ? "bg-amber-100 text-amber-900" : "text-amber-800 hover:bg-amber-50",
              )}
            >
              Needs decision <span className="num rounded-full bg-amber-200/70 px-1.5 text-xs">{attentionCount}</span>
            </Link>
          )}
        </div>
        <form action="/owner/orders" className="relative w-full lg:w-72" role="search">
          <input type="hidden" name="status" value={status} />
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Order # or customer" className="pl-9" aria-label="Search orders" />
        </form>
      </div>

      <Section>
        {orders.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No orders here" description="Try another status or clear the search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Worker</th>
                  <th className="px-3 py-3 font-medium">Pickup</th>
                  <th className="px-3 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/owner/orders/${o.id}`} className="num font-medium text-primary hover:underline">
                        {orderCode(o.number)}
                      </Link>
                      <p className="num text-xs text-muted-foreground">{formatShortDate(o.createdAt)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{o.customer.name}</p>
                      <p className="max-w-56 truncate text-xs text-muted-foreground">{itemsSummary(o)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <OrderStatusBadge status={o.status} />
                        {o.cancelRequest === "PENDING" && <span className="text-xs font-medium text-amber-800">Cancel requested</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {o.worker ? (
                        <span className={cn(!o.worker.active || o.worker.dutyStatus === "OFF_DUTY" ? "text-amber-800" : "")}>
                          {o.worker.name}
                          {(!o.worker.active || o.worker.dutyStatus === "OFF_DUTY") && o.status !== "COMPLETED" && o.status !== "CANCELLED" && (
                            <span className="block text-xs">{o.worker.active ? "Off duty" : "Deactivated"}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="num px-3 py-3 whitespace-nowrap">
                      {formatShortDate(o.pickupAt)}
                      <span className="block text-xs text-muted-foreground">{formatTime(o.pickupAt)}</span>
                    </td>
                    <td className="px-3 py-3">
                      {o.status !== "CANCELLED" && <PaymentBadge status={o.paymentStatus} method={o.paymentMethod} />}
                    </td>
                    <td className="num px-5 py-3 text-right font-medium">{formatPeso(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
