"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX2, Check, Loader2, Lock, QrCode, Store } from "lucide-react";
import { placeOrderAction } from "@/app/actions/orders";
import { useCart } from "@/components/cart/cart-context";
import { useConfirm } from "@/components/feedback/confirm";
import { notify, runAction } from "@/components/feedback/notify";
import { Ticket } from "@/components/ticket";
import { FormAlert } from "@/components/form";
import { EmptyState } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPeso, formatQty } from "@/lib/format";
import { lineEstimate } from "@/lib/pricing";
import type { PickupDay } from "@/lib/slots";
import { cn } from "@/lib/utils";

type PaymentOptions = { gcashEnabled: boolean; paymentWindowMinutes: number; pickupHoldHours: number };

export function CheckoutForm({
  days,
  customer,
  payment,
}: {
  days: PickupDay[];
  slotMinutes: number;
  customer: { name: string; phone: string };
  payment: PaymentOptions;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { items, ready, subtotal, clear } = useCart();
  const firstOpenDay = days.find((d) => d.slots.some((s) => s.remaining > 0));
  const [dayKey, setDayKey] = useState(firstOpenDay?.key ?? days[0]?.key ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  // GCash is suggested first when the shop accepts it: a paid order is one the customer will collect.
  const [method, setMethod] = useState<"GCASH" | "CASH">(payment.gcashEnabled ? "GCASH" : "CASH");
  const gcash = method === "GCASH" && payment.gcashEnabled;
  const hold = `${payment.pickupHoldHours} hour${payment.pickupHoldHours > 1 ? "s" : ""}`;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (ready && items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Add some cuts before checking out."
        action={
          <Button asChild>
            <Link href="/shop">Browse cuts</Link>
          </Button>
        }
        className="mt-8 rounded-xl border bg-card"
      />
    );
  }

  const day = days.find((d) => d.key === dayKey);
  const chosen = day?.slots.find((s) => s.iso === slot);

  async function submit() {
    setError(null);
    if (!slot || !chosen) {
      setError("Choose a pickup time to continue.");
      notify.warning("Choose a pickup time first", "Pick a day and an open time slot in step 1.");
      document.getElementById("pickup-heading")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const ok = await confirm({
      title: "Place this order?",
      description: gcash
        ? `We’ll reserve these cuts for ${payment.paymentWindowMinutes} minutes while you pay by GCash. Once your payment is submitted, your order goes to a butcher.`
        : `We’ll reserve these cuts and assign your order to a butcher right away. Please pick it up within ${hold} of your pickup time, or it will be released.`,
      details: [
        ...items.map((i) => ({ label: `${i.name} · ${formatQty(i.qty, i.unit)}`, value: formatPeso(lineEstimate(i.price, i.qty)) })),
        { label: "Pickup", value: `${day?.label}, ${chosen.label}` },
        { label: "Payment", value: gcash ? `GCash, within ${payment.paymentWindowMinutes} min` : "Cash at pickup" },
        { label: "Estimated total", value: formatPeso(subtotal) },
      ],
      confirmLabel: "Place order",
      cancelLabel: "Review again",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await runAction(
        () =>
          placeOrderAction({
            items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
            pickupAt: slot,
            notes: notes.trim() || undefined,
            paymentMethod: gcash ? "GCASH" : "CASH",
          }),
        {
          loading: "Placing your order…",
          success: "Order placed",
          successDescription: gcash
            ? `Please complete your GCash payment within ${payment.paymentWindowMinutes} minutes.`
            : `Please pick it up within ${hold} of your pickup time. You’ll get an update at every step.`,
        },
      );
      if (!res) return;
      if (!res.ok) {
        setError(res.message);
        router.refresh(); // pick up the latest slot capacity and stock
        return;
      }
      clear();
      router.push(`/orders/${res.data!.orderId}?placed=1`);
    });
  }

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="pickup-heading">
          <h2 id="pickup-heading" className="flex items-center gap-2.5 text-base">
            <StepNo n={1} />Pickup time
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each slot has limited capacity so your order is ready without a crowd.
          </p>

          {days.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="No pickup slots right now"
              description="The shop is closed for the remaining days in the booking window. Please check back later."
            />
          ) : (
            <>
              <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pickup day">
                {days.map((d) => {
                  const open = d.slots.filter((s) => s.remaining > 0).length;
                  return (
                    <button
                      key={d.key}
                      role="tab"
                      aria-selected={d.key === dayKey}
                      onClick={() => {
                        setDayKey(d.key);
                        setSlot(null);
                      }}
                      className={cn(
                        "flex min-w-28 flex-col items-start rounded-lg border px-4 py-2.5 text-left transition-colors",
                        d.key === dayKey ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
                      )}
                    >
                      <span className="text-sm font-medium">{d.label}</span>
                      <span className="text-xs text-muted-foreground">{open ? `${open} slots open` : "Fully booked"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Pickup time">
                {day?.slots.map((s) => {
                  const full = s.remaining === 0;
                  const selected = slot === s.iso;
                  return (
                    <button
                      key={s.iso}
                      role="radio"
                      aria-checked={selected}
                      disabled={full}
                      onClick={() => setSlot(s.iso)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : !full && "hover:bg-muted",
                      )}
                    >
                      <span className="num block text-sm font-medium">{s.label}</span>
                      <span
                        className={cn(
                          "text-xs",
                          full ? "text-muted-foreground" : s.remaining <= 2 ? "text-amber-700" : "text-muted-foreground",
                        )}
                      >
                        {full ? "Full" : s.remaining <= 2 ? `${s.remaining} left` : "Available"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2.5 text-base"><StepNo n={2} />Notes for the butcher</h2>
          <Label htmlFor="notes" className="sr-only">
            Notes
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            placeholder="e.g. Cut the liempo into 1-inch strips, ribs for sinigang"
            className="mt-3 min-h-24"
          />
          <p className="mt-1.5 text-right text-xs text-muted-foreground">{notes.length}/300</p>
        </section>

        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2.5 text-base"><StepNo n={3} />Payment</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
            {payment.gcashEnabled && (
              <PaymentChoice
                selected={method === "GCASH"}
                onSelect={() => setMethod("GCASH")}
                icon={QrCode}
                title="Pay now with GCash"
                badge="Order secured"
                body={`Scan the shop’s QR code and upload your receipt within ${payment.paymentWindowMinutes} minutes. Your order is prepared once it’s paid.`}
              />
            )}
            <PaymentChoice
              selected={!gcash}
              onSelect={() => setMethod("CASH")}
              icon={Store}
              title="Cash at pickup"
              body={`Pay the weighed amount at the counter. Please pick up within ${hold} of your pickup time, or the order is released.`}
            />
          </div>
          {!payment.gcashEnabled && (
            <p className="mt-2 text-xs text-muted-foreground">Online payment by GCash isn’t available right now.</p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Pickup under <span className="font-medium text-foreground">{customer.name}</span>
            {customer.phone && <> · {customer.phone}</>}.{" "}
            <Link href="/account" className="text-primary hover:underline">
              Edit
            </Link>
          </p>
        </section>
      </div>

      <aside className="lg:sticky lg:top-28">
        <Ticket
          heading="Order summary"
          meta={`${items.length} item${items.length === 1 ? "" : "s"}`}
          lines={[
            ...items.map((i) => ({ label: `${i.name} · ${formatQty(i.qty, i.unit)}`, value: formatPeso(lineEstimate(i.price, i.qty)) })),
            { label: "Pickup", value: chosen ? `${day?.label}, ${chosen.label}` : "Not chosen yet", muted: !chosen },
          ]}
          total={{ label: "Estimate", value: formatPeso(subtotal) }}
          footnote={
            gcash
              ? "You pay this estimate by GCash now. Any small difference after weighing is settled at pickup."
              : "You pay the weighed amount at the counter."
          }
        />
        <div className="mt-4">
          <FormAlert state={error ? { ok: false, message: error } : null} />
        </div>
        <Button size="lg" className="mt-4 h-11 w-full text-[15px]" onClick={submit} disabled={pending || !ready || days.length === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          {pending ? "Placing order…" : "Review and place order"}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">Free cancellation until we start preparing it.</p>
      </aside>
    </div>
  );
}

function PaymentChoice({
  selected,
  onSelect,
  icon: Icon,
  title,
  body,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        selected ? "border-primary bg-primary/[0.04] ring-1 ring-primary" : "hover:bg-muted/60",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 pr-5 text-sm">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          {title}
          {badge && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{badge}</span>}
        </span>
        <span className="mt-1 block leading-relaxed text-muted-foreground">{body}</span>
      </span>
      {selected && <Check className="absolute top-3 right-3 size-4 text-primary" strokeWidth={3} />}
    </button>
  );
}

function StepNo({ n }: { n: number }) {
  return (
    <span className="grid size-6 place-items-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground" aria-hidden>
      {n}
    </span>
  );
}
