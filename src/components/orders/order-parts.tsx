import { Check, CircleX } from "lucide-react";
import { ORDER_STATUS, ORDER_STATUS_ORDER } from "@/lib/constants";
import { formatDateTime, formatPeso, formatQty, formatTime, formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderDetail, OrderView } from "@/server/queries/orders";

/** Visual tracker: Received → Assigned → Being prepared → Ready → Picked up. */
export function OrderProgress({ order, audience = "customer" }: { order: OrderView; audience?: "customer" | "staff" }) {
  if (order.status === "CANCELLED") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
        <CircleX className="size-5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">This order was cancelled{order.cancelledAt ? ` on ${formatDateTime(order.cancelledAt)}` : ""}.</p>
          {order.cancelReason && <p className="mt-0.5 text-red-800/80">Reason: {order.cancelReason}</p>}
        </div>
      </div>
    );
  }
  const stamps: Record<string, string | null> = {
    PENDING: order.createdAt,
    ASSIGNED: order.assignedAt,
    PROCESSING: order.processingAt,
    READY: order.readyAt,
    COMPLETED: order.completedAt,
  };
  const currentIndex = ORDER_STATUS_ORDER.indexOf(order.status);

  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {ORDER_STATUS_ORDER.map((status, i) => {
        const done = i < currentIndex || order.status === "COMPLETED";
        const current = i === currentIndex && order.status !== "COMPLETED";
        const meta = ORDER_STATUS[status];
        return (
          <li key={status} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
            {i > 0 && (
              <span
                className={cn("absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2", i <= currentIndex ? "bg-primary" : "bg-border")}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-7 place-items-center rounded-full border-2 bg-card text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                current && "border-primary text-primary ring-4 ring-primary/15",
                !done && !current && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("mt-2 text-[11px] leading-tight font-medium sm:text-xs", !done && !current && "text-muted-foreground")}>
              {audience === "customer" ? meta.customerLabel : meta.label}
            </span>
            {stamps[status] && (done || current) && (
              <span className="num mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{formatTime(stamps[status]!)}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderItemsTable({ order }: { order: OrderView }) {
  const weighed = order.items.some((i) => i.actualQty !== null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-5 py-2.5 font-medium">Product</th>
            <th className="px-3 py-2.5 text-right font-medium">Ordered</th>
            {weighed && <th className="px-3 py-2.5 text-right font-medium">Actual</th>}
            <th className="px-3 py-2.5 text-right font-medium">Price</th>
            <th className="px-5 py-2.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {order.items.map((i) => (
            <tr key={i.id}>
              <td className="px-5 py-3 font-medium">{i.productName}</td>
              <td className="num px-3 py-3 text-right">{formatQty(i.orderedQty, i.unit)}</td>
              {weighed && (
                <td className="num px-3 py-3 text-right">{i.actualQty !== null ? formatQty(i.actualQty, i.unit) : "—"}</td>
              )}
              <td className="num px-3 py-3 text-right text-muted-foreground">{formatUnitPrice(i.unitPrice, i.unit)}</td>
              <td className="num px-5 py-3 text-right font-medium">{formatPeso(i.finalTotal ?? i.estimatedTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="space-y-1.5 border-t px-5 py-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Estimated total</dt>
          <dd className={cn("num", order.finalTotal !== null && "line-through")}>{formatPeso(order.estimatedTotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="font-medium">{order.finalTotal !== null ? "Final total (actual weight)" : "Amount to pay at pickup"}</dt>
          <dd className="num text-lg font-semibold">{formatPeso(order.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function OrderTimeline({ events }: { events: OrderDetail["events"] }) {
  return (
    <ol className="relative space-y-5 border-l pl-6">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn(
              "absolute top-1.5 -left-[29px] size-2.5 rounded-full ring-4 ring-card",
              e.type === "CANCEL_REQUESTED" || e.toStatus === "CANCELLED" ? "bg-red-500" : "bg-primary/70",
            )}
            aria-hidden
          />
          <p className="text-sm">{e.message}</p>
          <p className="num mt-0.5 text-xs text-muted-foreground">
            {formatDateTime(e.createdAt)}
            {e.actor && <> · {e.actor.name}</>}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function itemsSummary(order: OrderView, max = 2) {
  const names = order.items.map((i) => i.productName);
  return names.length > max ? `${names.slice(0, max).join(", ")} +${names.length - max} more` : names.join(", ");
}
