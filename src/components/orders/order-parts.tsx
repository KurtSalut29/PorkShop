import { Check, CircleX } from "lucide-react";
import { formatDateTime, formatPeso, formatQty, formatTime, formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Ticket } from "@/components/ticket";
import type { OrderDetail, OrderView } from "@/server/queries/orders";

type Step = { key: string; label: string; staffLabel: string; stamp: string | null; caption?: string; warn?: boolean };

/**
 * Visual tracker: Order received → Payment → Assigned to staff → Prepared → Ready for pickup → Picked up.
 * Steps the order has passed are ticked; the next step is highlighted with a short caption of what's
 * happening now (e.g. "Pay by 3:12 PM", "Cutting & weighing").
 */
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

  const gcash = order.paymentMethod === "GCASH";
  const paymentCaption = !gcash
    ? "Cash at pickup"
    : order.paymentStatus === "PAID"
      ? "GCash paid"
      : order.paymentStatus === "SUBMITTED"
        ? "GCash · verifying"
        : order.paymentStatus === "REJECTED"
          ? `Resubmit${order.paymentDueAt ? ` by ${formatTime(order.paymentDueAt)}` : ""}`
          : `Pay${order.paymentDueAt ? ` by ${formatTime(order.paymentDueAt)}` : ""}`;
  const steps: Step[] = [
    { key: "received", label: "Order received", staffLabel: "Received", stamp: order.createdAt },
    {
      key: "payment",
      label: "Payment",
      staffLabel: "Payment",
      stamp: gcash ? (order.proof?.createdAt ?? null) : order.createdAt,
      caption: paymentCaption,
      warn: order.paymentStatus === "REJECTED",
    },
    { key: "assigned", label: "Assigned to staff", staffLabel: "Assigned", stamp: order.assignedAt },
    { key: "prepared", label: "Prepared", staffLabel: "Prepared", stamp: order.processingAt },
    { key: "ready", label: "Ready for pickup", staffLabel: "Ready", stamp: order.readyAt },
    { key: "done", label: "Picked up", staffLabel: "Picked up", stamp: order.completedAt },
  ];
  // The last step the order has reached.
  const reached = { AWAITING_PAYMENT: 0, PENDING: 1, ASSIGNED: 2, PROCESSING: 2, READY: 4, COMPLETED: 5 }[order.status];
  const nowCaption: Record<string, string> = {
    AWAITING_PAYMENT: paymentCaption,
    PENDING: audience === "customer" ? "Finding staff" : "In queue",
    ASSIGNED: "Starting soon",
    PROCESSING: "Cutting & weighing",
    READY: audience === "customer" ? "Waiting for you" : "Awaiting customer",
  };

  return (
    <ol className="grid grid-cols-6 gap-0.5 sm:gap-1" aria-label="Order progress">
      {steps.map((step, i) => {
        const done = i <= reached;
        const current = i === reached + 1 && order.status !== "COMPLETED";
        const caption = step.key === "payment" && (done || current) ? step.caption : current ? nowCaption[order.status] : undefined;
        return (
          <li key={step.key} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
            {i > 0 && (
              <span
                className={cn("absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2", i <= reached + 1 ? "bg-primary" : "bg-border")}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-7 place-items-center rounded-full border-2 bg-card text-xs font-semibold",
                done && !step.warn && "border-primary bg-primary text-primary-foreground",
                current && !step.warn && "border-primary text-primary ring-4 ring-primary/15",
                step.warn && "border-destructive text-destructive ring-4 ring-destructive/15",
                !done && !current && !step.warn && "border-border text-muted-foreground",
              )}
            >
              {done && !step.warn ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("mt-2 text-[10px] leading-tight font-medium tracking-tight max-[359px]:text-[9px] sm:text-xs sm:tracking-normal", !done && !current && "text-muted-foreground")}>
              {audience === "customer" ? step.label : step.staffLabel}
            </span>
            {caption ? (
              <span className={cn("mt-0.5 text-[10px] leading-tight max-[359px]:text-[9px] sm:text-[11px]", step.warn ? "font-medium text-destructive" : current ? "font-medium text-primary" : "text-muted-foreground")}>
                {caption}
              </span>
            ) : (
              step.stamp &&
              done && <span className="num mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{formatTime(step.stamp)}</span>
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
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
            <th className="px-4 py-2.5 font-semibold sm:px-5">Product</th>
            <th className="px-2 py-2.5 text-right font-semibold sm:px-3">Ordered</th>
            {weighed && <th className="px-2 py-2.5 text-right font-semibold sm:px-3">Actual</th>}
            <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Price</th>
            <th className="px-4 py-2.5 text-right font-semibold sm:px-5">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {order.items.map((i) => (
            <tr key={i.id}>
              <td className="px-4 py-3 font-medium sm:px-5">
                {i.productName}
                <span className="num block text-xs font-normal text-muted-foreground sm:hidden">{formatUnitPrice(i.unitPrice, i.unit)}</span>
              </td>
              <td className="num px-2 py-3 text-right whitespace-nowrap sm:px-3">{formatQty(i.orderedQty, i.unit)}</td>
              {weighed && (
                <td className="num px-2 py-3 text-right whitespace-nowrap sm:px-3">{i.actualQty !== null ? formatQty(i.actualQty, i.unit) : "—"}</td>
              )}
              <td className="num hidden px-3 py-3 text-right text-muted-foreground sm:table-cell">{formatUnitPrice(i.unitPrice, i.unit)}</td>
              <td className="num px-4 py-3 text-right font-medium whitespace-nowrap sm:px-5">{formatPeso(i.finalTotal ?? i.estimatedTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t bg-muted/30 p-4 sm:p-5">
        <Ticket
          className="sm:ml-auto sm:max-w-sm"
          lines={[
            { label: "Estimated", value: formatPeso(order.estimatedTotal), muted: order.finalTotal !== null, struck: order.finalTotal !== null },
            ...(order.finalTotal !== null ? [{ label: "Weighed total", value: formatPeso(order.finalTotal) }] : []),
          ]}
          total={{
            label:
              order.finalTotal !== null
                ? "Total"
                : order.paymentMethod === "GCASH"
                  ? order.paymentStatus === "PAID"
                    ? "Paid by GCash"
                    : "Pay by GCash"
                  : "Pay at pickup",
            value: formatPeso(order.total),
          }}
          footnote={
            order.finalTotal === null
              ? order.paymentMethod === "GCASH"
                ? "Final amount is set when your cuts are weighed. Any small difference is settled at pickup."
                : "Final amount is set when your cuts are weighed."
              : undefined
          }
        />
      </div>
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
