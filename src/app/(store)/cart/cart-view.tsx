"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { refreshCartAction } from "@/app/actions/orders";
import { useCart } from "@/components/cart/cart-context";
import { QtyStepper } from "@/components/cart/qty-stepper";
import { useConfirm } from "@/components/feedback/confirm";
import { NETWORK_ERROR } from "@/components/feedback/notify";
import { EmptyState } from "@/components/page";
import { ProductArt } from "@/components/product-art";
import { Ticket } from "@/components/ticket";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeso, formatQty, formatUnitPrice } from "@/lib/format";
import { lineEstimate } from "@/lib/pricing";

type Issue = { kind: "gone" | "stock" | "price"; message: string };

export function CartView() {
  const { items, ready, setQty, remove, replace, subtotal } = useCart();
  const confirm = useConfirm();
  const [issues, setIssues] = useState<Record<string, Issue>>({});
  const [checkedIds, setCheckedIds] = useState<string | null>(null);

  // Re-price and re-check stock against the server whenever the set of products changes.
  const ids = items.map((i) => i.productId).join(",");
  const checked = ids === "" || checkedIds === ids;
  useEffect(() => {
    if (!ready || !ids) return;
    let cancelled = false;
    refreshCartAction(ids.split(","))
      .then((fresh) => {
        if (cancelled) return;
        const byId = new Map(fresh.map((p) => [p.id, p]));
        const found: Record<string, Issue> = {};
        let changed = false;
        const next = items.map((item) => {
          const p = byId.get(item.productId);
          if (!p || p.archived) {
            found[item.productId] = { kind: "gone", message: "No longer sold. Remove it to continue." };
            return item;
          }
          if (p.price !== item.price) {
            changed = true;
            found[item.productId] = { kind: "price", message: `Price changed from ${formatPeso(item.price)} to ${formatPeso(p.price)}.` };
          }
          if (p.available + 1e-9 < item.qty) {
            found[item.productId] = {
              kind: "stock",
              message: p.available >= p.minOrderQty ? `Only ${formatQty(p.available, p.unit)} left. Lower the amount.` : "Sold out right now. Remove it to continue.",
            };
          }
          if (item.imageUrl !== p.imageUrl) changed = true;
          return { ...item, price: p.price, name: p.name, minOrderQty: p.minOrderQty, qtyStep: p.qtyStep, imageUrl: p.imageUrl, imageStyle: p.imageStyle, localName: p.localName };
        });
        setIssues(found);
        if (changed) replace(next);
        setCheckedIds(ids);

        const list = Object.values(found);
        const blocking = list.filter((i) => i.kind !== "price").length;
        if (blocking) {
          toast.warning(`${blocking} item${blocking > 1 ? "s" : ""} in your cart need${blocking > 1 ? "" : "s"} attention`, {
            id: "cart-check",
            description: "Some cuts sold out or have less stock than you asked for. They're marked below.",
          });
        } else if (list.length) {
          toast.info("Prices updated", { id: "cart-check", description: "Your cart now shows today’s prices." });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCheckedIds(ids);
        toast.error(NETWORK_ERROR.title, { id: "cart-check", description: "We couldn’t check today’s prices and stock. Showing your saved cart." });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the set of products changes
  }, [ready, ids]);

  async function askRemove(productId: string, name: string, qty: string) {
    const ok = await confirm({
      title: `Remove ${name}?`,
      description: `${qty} will be taken out of your cart.`,
      confirmLabel: "Remove",
      cancelLabel: "Keep it",
      tone: "destructive",
    });
    if (!ok) return;
    const before = items;
    remove(productId);
    toast.success(`Removed ${name}`, {
      cancel: { label: "Undo", onClick: () => replace(before) },
    });
  }

  if (!ready) {
    return (
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Browse today’s cuts and add what you need. We’ll have it cut and ready at your pickup time."
        action={
          <Button asChild>
            <Link href="/shop">See today’s cuts</Link>
          </Button>
        }
        className="mt-8 rounded-2xl border bg-card"
      />
    );
  }

  const blocking = Object.values(issues).some((i) => i.kind !== "price");

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map((item) => {
          const issue = issues[item.productId];
          const rule = { unit: item.unit, minOrderQty: item.minOrderQty, qtyStep: item.qtyStep };
          return (
            <li key={item.productId} className="flex gap-4 p-4 sm:p-5">
              <Link href={`/shop/${item.slug}`} className="w-20 shrink-0 sm:w-24">
                <ProductArt category={item.category} name={item.name} imageUrl={item.imageUrl} imageStyle={item.imageStyle} size="sm" className="rounded-lg" />
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
                          : "mt-1 flex items-center gap-1.5 text-[13px] font-medium text-red-700"
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
                    onClick={() => askRemove(item.productId, item.name, formatQty(item.qty, item.unit))}
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

      <aside className="lg:sticky lg:top-28">
        <Ticket
          heading="Your order"
          meta={`${items.length} item${items.length > 1 ? "s" : ""}`}
          lines={[
            ...items.map((i) => ({ label: `${i.name} · ${formatQty(i.qty, i.unit)}`, value: formatPeso(lineEstimate(i.price, i.qty)) })),
            { label: "Pickup", value: "Free", muted: true },
          ]}
          total={{ label: "Estimate", value: formatPeso(subtotal) }}
          footnote="The final amount uses the actual weight of your cuts. You’ll see it when your order is packed."
        />
        <Button asChild={!blocking && checked} size="lg" className="mt-4 h-11 w-full text-[15px]" disabled={blocking || !checked}>
          {!blocking && checked ? (
            <Link href="/checkout">
              Choose a pickup time <ArrowRight className="size-4" />
            </Link>
          ) : (
            <span>{checked ? "Fix the marked items to continue" : "Checking today’s stock…"}</span>
          )}
        </Button>
        <Link href="/shop" className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground">
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
