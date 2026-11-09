"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ChefHat, HandCoins, Loader2, PackageCheck, Scale } from "lucide-react";
import { toast } from "sonner";
import { completeOrderAction, markReadyAction, startProcessingAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { formatPeso, formatQty, unitLabel } from "@/lib/format";
import { lineEstimate } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { OrderView } from "@/server/queries/orders";

/**
 * The worker's guided workflow for one order. Each stage shows exactly one primary action:
 * Start preparing → Weigh & mark ready (auto stock withdrawal) → Hand over & record payment.
 */
export function OrderWorkflow({ order }: { order: OrderView }) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message ?? "Done");
      else toast.error(res.message ?? "Something went wrong");
    });

  const onHold = order.cancelRequest === "PENDING";

  if (order.status === "ASSIGNED") {
    return (
      <Panel icon={ChefHat} title="Ready to start" tone="sky">
        <p className="text-sm text-muted-foreground">
          Review the items and notes, then start preparing. The customer will be notified.
        </p>
        {onHold && <HoldNotice />}
        <Button size="lg" className="mt-4 w-full" disabled={pending || onHold} onClick={() => run(() => startProcessingAction(order.id))}>
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
          Picked up and paid{order.paymentMethod ? ` via ${PAYMENT_METHOD_LABEL[order.paymentMethod]}` : ""}.
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
      The customer requested a cancellation. Wait for the owner’s decision before continuing.
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
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-lg",
            tone === "sky" && "bg-sky-50 text-sky-700",
            tone === "violet" && "bg-violet-50 text-violet-700",
            tone === "emerald" && "bg-emerald-50 text-emerald-700",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function WeighForm({ order, onHold }: { order: OrderView; onHold: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.items.map((i) => [i.id, String(i.orderedQty)])),
  );
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(
    () => Object.fromEntries(order.items.map((i) => [i.id, Number(values[i.id])])) as Record<string, number>,
    [values, order.items],
  );
  const invalid = order.items.some((i) => {
    const v = parsed[i.id]!;
    return !Number.isFinite(v) || v <= 0 || (i.unit === "PIECE" && !Number.isInteger(v));
  });
  const total = order.items.reduce((s, i) => s + lineEstimate(i.unitPrice, Number.isFinite(parsed[i.id]) ? parsed[i.id]! : 0), 0);
  const diff = total - order.estimatedTotal;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await markReadyAction(order.id, parsed);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <Panel icon={Scale} title="Weigh & pack" tone="violet">
      <p className="text-sm text-muted-foreground">
        Enter the actual weight from the scale. Stock is withdrawn automatically and the customer sees the final price.
      </p>
      {onHold && <HoldNotice />}
      <form onSubmit={submit} className="mt-4 space-y-3">
        {order.items.map((i) => {
          const v = parsed[i.id]!;
          const off = Number.isFinite(v) && Math.abs(v - i.orderedQty) / i.orderedQty > 0.15;
          return (
            <div key={i.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{i.productName}</p>
                  <p className="num text-xs text-muted-foreground">Ordered {formatQty(i.orderedQty, i.unit)}</p>
                </div>
                <p className="num text-sm font-medium">{formatPeso(lineEstimate(i.unitPrice, Number.isFinite(v) ? v : 0))}</p>
              </div>
              <label className="mt-2 flex items-center gap-2">
                <span className="sr-only">Actual quantity for {i.productName}</span>
                <Input
                  inputMode="decimal"
                  value={values[i.id]}
                  onChange={(e) => setValues((s) => ({ ...s, [i.id]: e.target.value }))}
                  className="num h-10 text-base"
                  aria-invalid={!Number.isFinite(v) || v <= 0}
                />
                <span className="w-8 text-sm text-muted-foreground">{unitLabel(i.unit)}</span>
              </label>
              {off && <p className="mt-1.5 text-xs text-amber-700">More than 15% off the ordered amount. Double-check the scale.</p>}
            </div>
          );
        })}
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Final total</span>
          <span className="text-right">
            <span className="num block text-xl font-semibold">{formatPeso(total)}</span>
            {Math.abs(diff) >= 0.01 && (
              <span className={cn("num text-xs", diff > 0 ? "text-amber-700" : "text-emerald-700")}>
                {diff > 0 ? "+" : "−"}
                {formatPeso(Math.abs(diff))} vs estimate
              </span>
            )}
          </span>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending || invalid || onHold}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
          Mark ready for pickup
        </Button>
      </form>
    </Panel>
  );
}

function HandoverForm({ order }: { order: OrderView }) {
  const [method, setMethod] = useState<PaymentMethod>(order.paymentMethod ?? "CASH");
  const [pending, startTransition] = useTransition();
  const alreadyPaid = order.paymentStatus === "PAID";

  return (
    <Panel icon={HandCoins} title="Hand over & take payment" tone="emerald">
      <div className="rounded-lg bg-muted/60 p-4 text-center">
        <p className="text-sm text-muted-foreground">{alreadyPaid ? "Already paid" : "Amount to collect"}</p>
        <p className="num mt-1 text-3xl font-semibold">{formatPeso(order.total)}</p>
      </div>
      {!alreadyPaid && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium">Payment method</legend>
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
        className="mt-4 w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await completeOrderAction(order.id, method);
            if (res.ok) toast.success(res.message);
            else toast.error(res.message);
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {alreadyPaid ? "Confirm pickup" : `Payment received · complete order`}
      </Button>
    </Panel>
  );
}
