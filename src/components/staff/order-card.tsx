import Link from "next/link";
import { CalendarClock, ChevronRight, MessageSquareText, TriangleAlert } from "lucide-react";
import { itemsSummary } from "@/components/orders/order-parts";
import { OrderStatusBadge, PaymentBadge } from "@/components/status";
import { formatPeso, formatShortDate, orderCode } from "@/lib/format";
import { formatSlotRange } from "@/lib/slots";
import type { OrderView } from "@/server/queries/orders";

export function StaffOrderCard({
  order,
  href,
  slotMinutes,
  showWorker = false,
}: {
  order: OrderView;
  href: string;
  slotMinutes: number;
  showWorker?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/30 hover:bg-accent/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num font-semibold">{orderCode(order.number)}</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 truncate text-sm font-medium">{order.customer.name}</p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{itemsSummary(order, 3)}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="num inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarClock className="size-3.5" />
          {formatShortDate(order.pickupAt)} · {formatSlotRange(order.pickupAt, slotMinutes)}
        </span>
        <span className="num font-semibold">{formatPeso(order.total)}</span>
      </div>
      {(order.notes || order.cancelRequest === "PENDING" || showWorker) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
          {order.cancelRequest === "PENDING" && (
            <span className="inline-flex items-center gap-1 font-medium text-amber-800">
              <TriangleAlert className="size-3.5" /> Cancellation requested
            </span>
          )}
          {order.notes && (
            <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
              <MessageSquareText className="size-3.5 shrink-0" />
              <span className="truncate">{order.notes}</span>
            </span>
          )}
          {showWorker && (
            <span className="ml-auto text-muted-foreground">{order.worker ? order.worker.name : "Unassigned"}</span>
          )}
        </div>
      )}
      {order.status === "READY" && (
        <div className="mt-3">
          <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} />
        </div>
      )}
    </Link>
  );
}
