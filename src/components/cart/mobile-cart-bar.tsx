"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { formatPeso } from "@/lib/format";

/** Pages that already show the cart's total and checkout action themselves. */
const HIDDEN_ON = ["/cart", "/checkout"];

function Bar() {
  const pathname = usePathname();
  const { items, ready, count, subtotal } = useCart();
  if (!ready || count === 0 || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return (
    <>
      {/* Spacer so the bar never covers the end of the page (footer, last product row). */}
      <div className="h-24 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <Link
          href="/cart"
          className="enter flex items-center gap-3 rounded-2xl bg-night py-2.5 pr-4 pl-2.5 text-white shadow-[0_14px_32px_-10px_rgb(20_10_8/0.6)] outline-none focus-visible:ring-2 focus-visible:ring-neon"
        >
          <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary">
            <ShoppingBag className="size-5" />
            <span className="num absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] leading-5 font-bold text-primary">
              {count}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {count} item{count > 1 ? "s" : ""} in your cart
            </span>
            <span className="num block text-xs text-white/70">
              Estimate {formatPeso(subtotal)}
              {items.length > 0 && ` · ${items[0]!.name}${items.length > 1 ? ` +${items.length - 1}` : ""}`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
            View cart <ArrowRight className="size-4" />
          </span>
        </Link>
      </div>
    </>
  );
}

/**
 * Phones only: a cart bar pinned to the bottom of every store page once the cart has items, so
 * the cart is always one thumb-tap away. (The header cart button is still there on every screen.)
 */
export function MobileCartBar() {
  // The pathname is request data: render nothing until it's known.
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
