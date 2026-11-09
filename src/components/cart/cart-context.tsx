"use client";

import { createContext, use, useCallback, useMemo, useSyncExternalStore } from "react";
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

// ── Browser cart store (localStorage, synced across tabs, in-memory fallback) ──

const STORAGE_KEY = "porkshop.cart.v1";
const EMPTY: CartItem[] = [];
const listeners = new Set<() => void>();
let memory: string | null = null; // used when localStorage is unavailable (private mode)
let cache: { raw: string | null; items: CartItem[] } = { raw: null, items: EMPTY };

function parse(raw: string | null): CartItem[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.productId === "string" && i.qty > 0) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readRaw() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
}

function getSnapshot() {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, items: parse(raw) };
  return cache.items;
}

function write(items: CartItem[]) {
  const raw = JSON.stringify(items);
  memory = raw;
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* fall back to memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const noopSubscribe = () => () => {};

const CartContext = createContext<CartContextValue | null>(null);

/**
 * The cart lives in the browser (no account needed to browse). Prices here are only a
 * convenience snapshot — the cart page re-prices from the server and checkout recomputes
 * every total, so a stale or tampered cart can never change what is charged.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  // false during SSR and hydration, true once running in the browser
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const add = useCallback((item: CartItem) => {
    const prev = getSnapshot();
    const existing = prev.find((i) => i.productId === item.productId);
    write(
      existing
        ? prev.map((i) => (i.productId === item.productId ? { ...item, qty: Math.round((i.qty + item.qty) * 1000) / 1000 } : i))
        : [...prev, item],
    );
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    write(getSnapshot().map((i) => (i.productId === productId ? { ...i, qty } : i)));
  }, []);

  const remove = useCallback((productId: string) => {
    write(getSnapshot().filter((i) => i.productId !== productId));
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
      replace: write,
      clear: () => write([]),
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
