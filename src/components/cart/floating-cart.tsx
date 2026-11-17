"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { formatPeso } from "@/lib/format";

/** Pages that already show the cart's total and checkout action themselves. */
const HIDDEN_ON = ["/cart", "/checkout"];

function Floating() {
  const pathname = usePathname();
  const { ready, count, subtotal } = useCart();
  const button = useRef<HTMLAnchorElement>(null);
  const previous = useRef<number | null>(null);

  // A small hop whenever the cart grows, so adding an item visibly lands somewhere.
  useEffect(() => {
    if (!ready) return;
    const grew = previous.current !== null && subtotal > previous.current;
    previous.current = subtotal;
    if (!grew || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    button.current?.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], {
      duration: 450,
      easing: "cubic-bezier(0.3, 1.6, 0.5, 1)",
    });
  }, [ready, subtotal]);

  if (!ready || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <Link
      ref={button}
      href="/cart"
      aria-label={count ? `View cart, ${count} item${count > 1 ? "s" : ""}, estimate ${formatPeso(subtotal)}` : "View cart, empty"}
      className="enter fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-full bg-night py-2 pr-5 pl-2 text-white shadow-[0_14px_32px_-10px_rgb(20_10_8/0.6)] ring-1 ring-white/20 transition-colors outline-none hover:bg-night-deep focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 sm:right-6 sm:bottom-6"
    >
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary" aria-hidden>
        <ShoppingBag className="size-[18px]" />
        {count > 0 && (
          <span className="num absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-primary">
            {count}
          </span>
        )}
      </span>
      <span className="leading-tight" aria-hidden>
        <span className="flex items-center gap-1 text-sm font-semibold">
          View cart <ArrowRight className="size-3.5" />
        </span>
        <span className="num block text-xs text-white/70">{count ? `Estimate ${formatPeso(subtotal)}` : "Empty"}</span>
      </span>
    </Link>
  );
}

/**
 * A "View cart" button floating at the bottom right of every store page, on every screen size,
 * so the cart is one tap away without scrolling back up to the header.
 */
export function FloatingCart() {
  // The pathname is request data: render nothing until it's known.
  return (
    <Suspense fallback={null}>
      <Floating />
    </Suspense>
  );
}
