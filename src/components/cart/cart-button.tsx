"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart-context";

export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link
      href="/cart"
      className="relative inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      aria-label={ready && count ? `Cart, ${count} item${count > 1 ? "s" : ""}` : "Cart"}
    >
      <ShoppingBag className="size-[18px]" />
      <span className="hidden sm:inline">Cart</span>
      {ready && count > 0 && (
        <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
