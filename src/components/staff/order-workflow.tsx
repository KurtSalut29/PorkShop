"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ChefHat, HandCoins, Loader2, PackageCheck, Scale } from "lucide-react";
import { completeOrderAction, markReadyAction, startProcessingAction } from "@/app/actions/orders";
import { useConfirm } from "@/components/feedback/confirm";
import { notify, runAction } from "@/components/feedback/notify";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { formatPeso, formatQty, orderCode, unitLabel } from "@/lib/format";
import { lineEstimate } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { OrderView } from "@/server/queries/orders";

/**
 * The worker's guided workflow for one order. Each stage shows exactly one primary action:
 * Start preparing → Weigh & mark ready (automatic stock withdrawal) → Hand over & take payment.
 */
export function OrderWorkflow({ order }: { order: OrderView }) {
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const onHold = order.cancelRequest === "PENDING";

  if (order.status === "ASSIGNED") {
    return (
      <Panel icon={ChefHat} title="Ready to start" tone="sky">
        <p className="text-sm text-muted-foreground">Check the items and the customer’s notes, then start. The customer is notified.</p>
        {onHold && <HoldNotice />}
        <Button
          size="lg"
          className="mt-4 h-11 w-full"
          disabled={pending || onHold}
          onClick={async () => {
            const ok = await confirm({
              title: `Start preparing ${orderCode(order.number)}?`,
              description: "The customer will see that you’re preparing their order. After this, they can only ask the owner to cancel.",
              details: order.items.map((i) => ({ label: i.productName, value: formatQty(i.orderedQty, i.unit) })),
              confirmLabel: "Start preparing",
            });
            if (!ok) return;
            startTransition(async () => {
              await runAction(() => startProcessingAction(order.id), { loading: "Starting…", success: "You’re preparing this order", successDescription: "Weigh each item when it’s cut." });
            });
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ChefHat className="size-4" />}
          Start preparing
        </Button>
      </Panel>
    );
  }

  if (order.status === "PROCESSING") return <WeighForm order={order} onHold={onHold} />;
  if (order.status === "READY") return <HandoverForm order={order} />;

  if (order.status === "COMPLETED") {
    return (
      <Panel icon={CheckCircle2} title="Order completed" tone="emerald">
        <p className="text-sm text-muted-foreground">
          Picked up and paid{order.paymentMethod ? ` by ${PAYMENT_METHOD_LABEL[order.paymentMethod]}` : ""}.
        </p>
      </Panel>
    );
  }
  return null;
}

function HoldNotice() {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      The customer asked to cancel. Wait for the owner’s decision before continuing.
    </p>
  );
}

function Panel({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: "sky" | "violet" | "emerald";
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)]">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-lg",
            tone === "sky" && "bg-sky-100 text-sky-700",
            tone === "violet" && "bg-violet-100 text-violet-700",
            tone === "emerald" && "bg-emerald-100 text-emerald-700",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <h2 className="text-base">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function WeighForm({ order, onHold }: { order: OrderView; onHold: boolean }) {
  const confirm = useConfirm();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.items.map((i) => [i.id, String(i.orderedQty)])),
  );
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(
    () => Object.fromEntries(order.items.map((i) => [i.id, Number(values[i.id])])) as Record<string, number>,
    [values, order.items],
  );
  const invalidIds = order.items
    .filter((i) => {
      const v = parsed[i.id]!;
      return !Number.isFinite(v) || v <= 0 || (i.unit === "PIECE" && !Number.isInteger(v));
    })
    .map((i) => i.id);
  const total = order.items.reduce((s, i) => s + lineEstimate(i.unitPrice, Number.isFinite(parsed[i.id]) ? parsed[i.id]! : 0), 0);
  const diff = total - order.estimatedTotal;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalidIds.length) {
      notify.error("Enter a weight for every item", "Weights must be greater than zero. Pieces must be whole numbers.");
      return;
    }
    const ok = await confirm({
      title: "Mark as ready for pickup?",
      description: "These weights are withdrawn from stock and set the final price. They can’t be edited afterwards.",
      details: [
        ...order.items.map((i) => ({
          label: `${i.productName} (ordered ${formatQty(i.orderedQty, i.unit)})`,
          value: formatQty(parsed[i.id]!, i.unit),
        })),
        { label: "Final total", value: formatPeso(total) },
      ],
      confirmLabel: "Confirm weights",
      cancelLabel: "Re-weigh",
    });
    if (!ok) return;
    startTransition(async () => {
      await runAction(() => markReadyAction(order.id, parsed), {
        loading: "Recording weights and withdrawing stock…",
        success: "Ready for pickup",
        successDescription: `The customer has been told the final total: ${formatPeso(total)}.`,
      });
    });
  }

  return (
    <Panel icon={Scale} title="Weigh & pack" tone="violet">
      <p className="text-sm text-muted-foreground">Enter what the scale shows. Stock is withdrawn and the final price is set automatically.</p>
      {onHold && <HoldNotice />}
      <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
        {order.items.map((i) => {
          const v = parsed[i.id]!;
          const bad = invalidIds.includes(i.id);
          const off = Number.isFinite(v) && v > 0 && Math.abs(v - i.orderedQty) / i.orderedQty > 0.15;
          return (
            <div key={i.id} className="rounded-xl border bg-muted/30 p-3">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{i.productName}</p>
                <p className="font-mono text-xs text-muted-foreground">ordered {formatQty(i.orderedQty, i.unit)}</p>
              </div>
              <label className={cn("scale-display flex items-center gap-3 rounded-lg px-3 py-2", bad && "ring-2 ring-red-400")}>
                <span className="sr-only">Actual {i.unit === "KG" ? "weight" : "count"} for {i.productName}</span>
                <input
                  inputMode="decimal"
                  value={values[i.id]}
                  onChange={(e) => setValues((s) => ({ ...s, [i.id]: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  className="w-full min-w-0 bg-transparent text-right text-3xl font-semibold tracking-wider outline-none"
                  aria-invalid={bad}
                />
                <span className="w-8 text-sm font-medium uppercase opacity-80">{unitLabel(i.unit)}</span>
              </label>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={off ? "font-medium text-amber-700" : "text-muted-foreground"}>
                  {off ? "More than 15% off the order. Check the scale." : `${formatPeso(i.unitPrice)} / ${unitLabel(i.unit, false)}`}
                </span>
                <span className="num font-medium">{formatPeso(lineEstimate(i.unitPrice, Number.isFinite(v) ? v : 0))}</span>
              </div>
            </div>
          );
        })}
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Final total</span>
          <span className="text-right">
            <span className="num block font-display text-2xl font-semibold">{formatPeso(total)}</span>
            {Math.abs(diff) >= 0.01 && (
              <span className={cn("num text-xs", diff > 0 ? "text-amber-700" : "text-emerald-700")}>
                {diff > 0 ? "+" : "−"}
                {formatPeso(Math.abs(diff))} vs estimate
              </span>
            )}
          </span>
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending || onHold}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
          Mark ready for pickup
        </Button>
      </form>
    </Panel>
  );
}

function HandoverForm({ order }: { order: OrderView }) {
  const confirm = useConfirm();
  const [method, setMethod] = useState<PaymentMethod>(order.paymentMethod ?? "CASH");
  const [pending, startTransition] = useTransition();
  const alreadyPaid = order.paymentStatus === "PAID";

  return (
    <Panel icon={HandCoins} title="Hand over & take payment" tone="emerald">
      <div className="scale-display rounded-xl px-4 py-3 text-center">
        <p className="text-[11px] tracking-[0.2em] uppercase opacity-70">{alreadyPaid ? "Already paid" : "Amount to collect"}</p>
        <p className="mt-1 text-4xl font-semibold">{formatPeso(order.total)}</p>
      </div>
      {!alreadyPaid && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium">Paid with</legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={cn(
                  "h-11 rounded-lg border text-sm font-medium transition-colors",
                  method === m ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "hover:bg-muted",
                )}
              >
                {PAYMENT_METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <Button
        size="lg"
        className="mt-4 h-11 w-full"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: alreadyPaid ? "Confirm the customer picked up the order?" : "Confirm payment and pickup?",
            description: alreadyPaid
              ? "This completes the order."
              : "Only confirm after you’ve received the money. This completes the order and records the payment in sales.",
            details: [
              { label: "Order", value: orderCode(order.number) },
              { label: "Customer", value: order.customer.name },
              { label: alreadyPaid ? "Paid" : "Collect", value: formatPeso(order.total) },
              ...(alreadyPaid ? [] : [{ label: "Method", value: PAYMENT_METHOD_LABEL[method] }]),
            ],
            confirmLabel: alreadyPaid ? "Complete order" : "Payment received",
          });
          if (!ok) return;
          startTransition(async () => {
            await runAction(() => completeOrderAction(order.id, method), { loading: "Completing the order…", success: "Order completed" });
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {alreadyPaid ? "Confirm pickup" : "Payment received · complete order"}
      </Button>
    </Panel>
  );
}
