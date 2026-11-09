"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX2, Loader2, Lock, Store } from "lucide-react";
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

export function CheckoutForm({
  days,
  customer,
}: {
  days: PickupDay[];
  slotMinutes: number;
  customer: { name: string; phone: string };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { items, ready, subtotal, clear } = useCart();
  const firstOpenDay = days.find((d) => d.slots.some((s) => s.remaining > 0));
  const [dayKey, setDayKey] = useState(firstOpenDay?.key ?? days[0]?.key ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
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
      description: "We’ll reserve these cuts for you and assign your order to a butcher right away. You can cancel free of charge until preparation starts.",
      details: [
        ...items.map((i) => ({ label: `${i.name} · ${formatQty(i.qty, i.unit)}`, value: formatPeso(lineEstimate(i.price, i.qty)) })),
        { label: "Pickup", value: `${day?.label}, ${chosen.label}` },
        { label: "Payment", value: "At the counter" },
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
          }),
        {
          loading: "Placing your order…",
          success: "Order placed",
          successDescription: "We’re assigning it to a butcher now. You’ll get an update at every step.",
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
          <div className="mt-3 flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <Store className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Pay at pickup</p>
              <p className="mt-0.5 text-muted-foreground">
                Cash, GCash or card at the counter. You pay the final amount based on the actual weight.
              </p>
            </div>
          </div>
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
          footnote="You pay the weighed amount at the counter."
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

function StepNo({ n }: { n: number }) {
  return (
    <span className="grid size-6 place-items-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground" aria-hidden>
      {n}
    </span>
  );
}
