"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX2, Loader2, Lock, Store } from "lucide-react";
import { toast } from "sonner";
import { placeOrderAction } from "@/app/actions/orders";
import { useCart } from "@/components/cart/cart-context";
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

  function submit() {
    setError(null);
    if (!slot) {
      setError("Choose a pickup time to continue.");
      return;
    }
    startTransition(async () => {
      const res = await placeOrderAction({
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        pickupAt: slot,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        router.refresh(); // refresh slot capacity
        return;
      }
      clear();
      toast.success("Order placed!", { description: "We're assigning it to one of our butchers now." });
      router.push(`/orders/${res.data!.orderId}?placed=1`);
    });
  }

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="pickup-heading">
          <h2 id="pickup-heading" className="font-semibold">
            1. Pickup time
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

        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">2. Notes for the butcher</h2>
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

        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">3. Payment</h2>
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

      <aside className="rounded-xl border bg-card p-5 lg:sticky lg:top-24">
        <h2 className="font-semibold">Your order</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-3">
              <span>
                {i.name}
                <span className="num block text-muted-foreground">{formatQty(i.qty, i.unit)}</span>
              </span>
              <span className="num">{formatPeso(lineEstimate(i.price, i.qty))}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t pt-4">
          <span className="font-medium">Estimated total</span>
          <span className="num text-xl font-semibold">{formatPeso(subtotal)}</span>
        </div>
        {chosen && (
          <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm">
            Pickup <span className="font-medium">{day?.label}</span>, <span className="num">{chosen.label}</span>
          </p>
        )}
        <div className="mt-4">
          <FormAlert state={error ? { ok: false, message: error } : null} />
        </div>
        <Button size="lg" className="mt-4 w-full" onClick={submit} disabled={pending || !ready || days.length === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          {pending ? "Placing order…" : "Place order"}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          You can cancel free of charge until we start preparing it.
        </p>
      </aside>
    </div>
  );
}
