"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { refreshCartAction } from "@/app/actions/orders";
import { useCart } from "@/components/cart/cart-context";
import { QtyStepper } from "@/components/cart/qty-stepper";
import { EmptyState } from "@/components/page";
import { ProductArt } from "@/components/product-art";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeso, formatQty, formatUnitPrice } from "@/lib/format";
import { lineEstimate } from "@/lib/pricing";

type Issue = { kind: "gone" | "stock" | "price"; message: string };

export function CartView() {
  const { items, ready, setQty, remove, replace, subtotal } = useCart();
  const [issues, setIssues] = useState<Record<string, Issue>>({});
  const [checkedIds, setCheckedIds] = useState<string | null>(null);

  // Re-price and re-check stock against the server whenever the set of products changes.
  const ids = items.map((i) => i.productId).join(",");
  const checked = ids === "" || checkedIds === ids;
  useEffect(() => {
    if (!ready || !ids) return;
    let cancelled = false;
    refreshCartAction(ids.split(",")).then((fresh) => {
      if (cancelled) return;
      const byId = new Map(fresh.map((p) => [p.id, p]));
      const found: Record<string, Issue> = {};
      let changed = false;
      const next = items.map((item) => {
        const p = byId.get(item.productId);
        if (!p || p.archived) {
          found[item.productId] = { kind: "gone", message: "No longer available. Please remove it." };
          return item;
        }
        if (p.price !== item.price) {
          changed = true;
          found[item.productId] = {
            kind: "price",
            message: `Price updated from ${formatPeso(item.price)} to ${formatPeso(p.price)}.`,
          };
        }
        if (p.available + 1e-9 < item.qty) {
          found[item.productId] = {
            kind: "stock",
            message:
              p.available >= p.minOrderQty
                ? `Only ${formatQty(p.available, p.unit)} left. Lower the quantity.`
                : "Sold out right now.",
          };
        }
        return { ...item, price: p.price, name: p.name, minOrderQty: p.minOrderQty, qtyStep: p.qtyStep };
      });
      setIssues(found);
      if (changed) replace(next);
      setCheckedIds(ids);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when products change
  }, [ready, ids]);

  if (!ready) {
    return (
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Browse today's fresh cuts and add what you need. We'll have it cut and ready at your pickup time."
        action={
          <Button asChild>
            <Link href="/shop">Browse cuts</Link>
          </Button>
        }
        className="mt-8 rounded-xl border bg-card"
      />
    );
  }

  const blocking = Object.values(issues).some((i) => i.kind !== "price");

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <ul className="divide-y rounded-xl border bg-card">
        {items.map((item) => {
          const issue = issues[item.productId];
          const rule = { unit: item.unit, minOrderQty: item.minOrderQty, qtyStep: item.qtyStep };
          return (
            <li key={item.productId} className="flex gap-4 p-4 sm:p-5">
              <Link href={`/shop/${item.slug}`} className="w-20 shrink-0 sm:w-24">
                <ProductArt category={item.category} name={item.name} size="sm" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/shop/${item.slug}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <p className="num text-sm text-muted-foreground">{formatUnitPrice(item.price, item.unit)}</p>
                  {issue && (
                    <p
                      className={
                        issue.kind === "price"
                          ? "mt-1 flex items-center gap-1.5 text-[13px] text-amber-800"
                          : "mt-1 flex items-center gap-1.5 text-[13px] text-red-700"
                      }
                    >
                      <AlertTriangle className="size-3.5 shrink-0" /> {issue.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <QtyStepper size="sm" value={item.qty} rule={rule} onChange={(q) => setQty(item.productId, q)} />
                  <p className="num w-24 text-right font-semibold">{formatPeso(lineEstimate(item.price, item.qty))}</p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(item.productId)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="rounded-xl border bg-card p-5 lg:sticky lg:top-24">
        <h2 className="font-semibold">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Items</dt>
            <dd className="num">{items.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Estimated subtotal</dt>
            <dd className="num font-medium">{formatPeso(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Pickup</dt>
            <dd>Free</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t pt-4">
          <span className="font-medium">Estimated total</span>
          <span className="num text-xl font-semibold">{formatPeso(subtotal)}</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The final amount is based on the actual weight of your cuts and is shown when your order is ready.
        </p>
        <Button asChild={!blocking && checked} size="lg" className="mt-5 w-full" disabled={blocking || !checked}>
          {!blocking && checked ? (
            <Link href="/checkout">
              Choose pickup time <ArrowRight className="size-4" />
            </Link>
          ) : (
            <span>{checked ? "Fix the items above to continue" : "Checking stock…"}</span>
          )}
        </Button>
        <Link href="/shop" className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground">
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
