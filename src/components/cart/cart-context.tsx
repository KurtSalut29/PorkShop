"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { lineEstimate } from "@/lib/pricing";
import type { ProductCategory } from "@/lib/constants";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  category: ProductCategory;
  unit: "KG" | "PIECE";
  price: number;
  qty: number;
  minOrderQty: number;
  qtyStep: number;
};

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  count: number;
  subtotal: number;
  add: (item: CartItem) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  replace: (items: CartItem[]) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "porkshop.cart.v1";

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.productId === "string" && i.qty > 0) : [];
  } catch {
    return [];
  }
}

/**
 * The cart lives in the browser (no account needed to browse). Prices here are only a
 * convenience snapshot — the cart page re-prices from the server and checkout recomputes
 * every total, so a stale or tampered cart can never change what is charged.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable (private mode) — cart still works for this tab */
    }
  }, [items, ready]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (!existing) return [...prev, item];
      return prev.map((i) =>
        i.productId === item.productId ? { ...item, qty: Math.round((i.qty + item.qty) * 1000) / 1000 } : i,
      );
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty } : i)));
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      ready,
      count: items.length,
      subtotal: items.reduce((s, i) => s + lineEstimate(i.price, i.qty), 0),
      add,
      setQty,
      remove,
      replace: setItems,
      clear: () => setItems([]),
    }),
    [items, ready, add, setQty, remove],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart() {
  const ctx = use(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
