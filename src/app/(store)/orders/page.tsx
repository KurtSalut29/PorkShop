import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { itemsSummary } from "@/components/orders/order-parts";
import { Container, EmptyState, PageSkeleton } from "@/components/page";
import { OrderStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { formatPeso, formatShortDate, orderCode } from "@/lib/format";
import { formatSlotRange } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/dal";
import { listCustomerOrders, type OrderView } from "@/server/queries/orders";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "My orders" };

export default function OrdersPage({ searchParams }: PageProps<"/orders">) {
  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold sm:text-3xl">My orders</h1>
      <p className="mt-1 text-muted-foreground">Track current pickups and view past orders.</p>
      <Suspense fallback={<PageSkeleton />}>
        <OrdersList searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function OrdersList({ searchParams }: { searchParams: PageProps<"/orders">["searchParams"] }) {
  const user = await requireRole("CUSTOMER");
  const sp = await searchParams;
  const tab = sp.tab === "past" ? "past" : "active";
  const [orders, settings] = await Promise.all([listCustomerOrders(user.id, tab), getSettings()]);

  return (
    <>
      <div className="mt-6 inline-flex rounded-lg border bg-card p-1" role="tablist">
        {[
          { key: "active", label: "Current" },
          { key: "past", label: "Past orders" },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.key === "active" ? "/orders" : "/orders?tab=past"}
            role="tab"
            aria-selected={tab === t.key}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tab === "active" ? "No orders in progress" : "No past orders yet"}
          description={tab === "active" ? "When you place an order you can follow every step here." : "Completed and cancelled orders will appear here."}
          action={
            <Button asChild>
              <Link href="/shop">Start an order</Link>
            </Button>
          }
          className="mt-6 rounded-xl border bg-card"
        />
      ) : (
        <ul className="mt-6 divide-y rounded-xl border bg-card">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} slotMinutes={settings.slotMinutes} />
          ))}
        </ul>
      )}
    </>
  );
}

function OrderRow({ order, slotMinutes }: { order: OrderView; slotMinutes: number }) {
  return (
    <li>
      <Link href={`/orders/${order.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/40 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num font-semibold">{orderCode(order.number)}</span>
            <OrderStatusBadge status={order.status} audience="customer" />
            {order.cancelRequest === "PENDING" && <span className="text-xs text-amber-700">Cancellation requested</span>}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{itemsSummary(order, 3)}</p>
          <p className="num mt-1 text-sm">
            Pickup {formatShortDate(order.pickupAt)}, {formatSlotRange(order.pickupAt, slotMinutes)}
          </p>
        </div>
        <div className="text-right">
          <p className="num font-semibold">{formatPeso(order.total)}</p>
          <p className="text-xs text-muted-foreground">{order.finalTotal !== null ? "Final" : "Estimated"}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
