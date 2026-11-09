"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPeso, formatQty } from "@/lib/format";
import { lineEstimate } from "@/lib/pricing";
import type { ProductView } from "@/server/queries/catalog";
import { useCart } from "./cart-context";
import { QtyStepper } from "./qty-stepper";

type CartProduct = Pick<
  ProductView,
  "id" | "slug" | "name" | "category" | "unit" | "price" | "minOrderQty" | "qtyStep" | "available"
>;

function toItem(p: CartProduct, qty: number) {
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    unit: p.unit,
    price: p.price,
    qty,
    minOrderQty: p.minOrderQty,
    qtyStep: p.qtyStep,
  };
}

/** Compact "Add" button on catalog cards — adds the minimum quantity. */
export function QuickAdd({ product }: { product: CartProduct }) {
  const { add, items } = useCart();
  const inCart = items.find((i) => i.productId === product.id);
  const soldOut = product.available < product.minOrderQty;
  return (
    <Button
      size="sm"
      variant={inCart ? "secondary" : "default"}
      disabled={soldOut}
      onClick={(e) => {
        e.preventDefault();
        add(toItem(product, product.minOrderQty));
        toast.success(`${product.name} added`, {
          description: `${formatQty(product.minOrderQty, product.unit)} · adjust the amount in your cart.`,
        });
      }}
      aria-label={`Add ${product.name} to cart`}
    >
      {soldOut ? "Sold out" : inCart ? <><Check className="size-3.5" /> In cart</> : <><Plus className="size-3.5" /> Add</>}
    </Button>
  );
}

/** Full purchase panel on the product page. */
export function AddToCartPanel({ product }: { product: CartProduct }) {
  const { add, items } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(product.unit === "KG" ? Math.max(product.minOrderQty, 1) : product.minOrderQty);
  const inCart = items.find((i) => i.productId === product.id);
  const soldOut = product.available < product.minOrderQty;
  const rule = { unit: product.unit, minOrderQty: product.minOrderQty, qtyStep: product.qtyStep };
  const maxAddable = Math.max(0, product.available - (inCart?.qty ?? 0));

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor="qty" className="mb-1.5 block text-sm font-medium">
            Quantity
          </label>
          <QtyStepper id="qty" value={qty} onChange={setQty} rule={rule} max={product.available} />
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Estimated</p>
          <p className="num text-2xl font-semibold">{formatPeso(lineEstimate(product.price, qty))}</p>
        </div>
      </div>
      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={soldOut || qty > maxAddable + 1e-9}
        onClick={() => {
          add(toItem(product, qty));
          toast.success(`${formatQty(qty, product.unit)} of ${product.name} added to your cart`, {
            action: { label: "View cart", onClick: () => router.push("/cart") },
          });
        }}
      >
        <ShoppingBag className="size-4" />
        {soldOut ? "Sold out" : qty > maxAddable + 1e-9 ? "Not enough stock" : "Add to cart"}
      </Button>
      {inCart && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {formatQty(inCart.qty, product.unit)} already in your{" "}
          <Link href="/cart" className="font-medium text-primary hover:underline">
            cart
          </Link>
        </p>
      )}
      {product.unit === "KG" && (
        <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          Meat is cut and weighed when your order is prepared. The final price uses the actual weight, usually within a few
          grams of what you ordered.
        </p>
      )}
    </div>
  );
}
