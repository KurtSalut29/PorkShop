"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Ticket } from "@/components/ticket";
import { Button } from "@/components/ui/button";
import { formatPeso, formatQty, formatUnitPrice } from "@/lib/format";
import { lineEstimate } from "@/lib/pricing";
import type { ProductView } from "@/server/queries/catalog";
import { useCart, type CartItem } from "./cart-context";
import { QtyStepper } from "./qty-stepper";

type CartProduct = Pick<
  ProductView,
  "id" | "slug" | "name" | "category" | "unit" | "price" | "minOrderQty" | "qtyStep" | "available" | "imageUrl" | "localName" | "imageStyle"
>;

function toItem(p: CartProduct, qty: number): CartItem {
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
    imageUrl: p.imageUrl,
    imageStyle: p.imageStyle,
    localName: p.localName,
  };
}

/** Adds to the cart and offers an Undo, so a mis-tap never needs a trip to the cart. */
function useAddWithUndo() {
  const { add, items, replace } = useCart();
  const router = useRouter();
  return (product: CartProduct, qty: number) => {
    const before = items;
    add(toItem(product, qty));
    toast.success(`Added ${formatQty(qty, product.unit)} of ${product.name}`, {
      description: `About ${formatPeso(lineEstimate(product.price, qty))}. You can change the amount in your cart.`,
      action: { label: "View cart", onClick: () => router.push("/cart") },
      cancel: {
        label: "Undo",
        onClick: () => {
          replace(before);
          toast.info(`Removed ${product.name} from your cart`);
        },
      },
    });
  };
}

/** Compact "Add" button on catalog cards: adds the minimum quantity. */
export function QuickAdd({ product }: { product: CartProduct }) {
  const { items } = useCart();
  const addWithUndo = useAddWithUndo();
  const inCart = items.find((i) => i.productId === product.id);
  const soldOut = product.available < product.minOrderQty;
  const room = product.available - (inCart?.qty ?? 0);

  return (
    <Button
      size="sm"
      variant={inCart ? "secondary" : "default"}
      disabled={soldOut}
      onClick={(e) => {
        e.preventDefault();
        if (room + 1e-9 < product.minOrderQty) {
          toast.warning(`No more ${product.name} available`, {
            description: `Your cart already holds everything we have (${formatQty(inCart?.qty ?? 0, product.unit)}).`,
          });
          return;
        }
        addWithUndo(product, product.minOrderQty);
      }}
      aria-label={`Add ${product.name} to cart`}
    >
      {soldOut ? (
        "Sold out"
      ) : inCart ? (
        <>
          <Check className="size-3.5" /> In cart
        </>
      ) : (
        <>
          <Plus className="size-3.5" /> Add
        </>
      )}
    </Button>
  );
}

/** Full purchase panel on the product page: quantity, a live estimate ticket, add to cart. */
export function AddToCartPanel({ product }: { product: CartProduct }) {
  const { items } = useCart();
  const addWithUndo = useAddWithUndo();
  const [qty, setQty] = useState(product.unit === "KG" ? Math.max(product.minOrderQty, 1) : product.minOrderQty);
  const inCart = items.find((i) => i.productId === product.id);
  const soldOut = product.available < product.minOrderQty;
  const rule = { unit: product.unit, minOrderQty: product.minOrderQty, qtyStep: product.qtyStep };
  const maxAddable = Math.max(0, product.available - (inCart?.qty ?? 0));
  const tooMuch = qty > maxAddable + 1e-9;

  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        <div>
          <label htmlFor="qty" className="mb-2 block text-sm font-medium">
            How much?
          </label>
          <QtyStepper id="qty" value={qty} onChange={setQty} rule={rule} max={product.available} />
        </div>
        <Ticket
          lines={[
            { label: product.name, value: formatQty(qty, product.unit) },
            { label: "Price", value: formatUnitPrice(product.price, product.unit), muted: true },
          ]}
          total={{ label: "Estimate", value: formatPeso(lineEstimate(product.price, qty)) }}
        />
      </div>
      <Button
        size="lg"
        className="mt-5 h-11 w-full text-[15px]"
        disabled={soldOut || tooMuch}
        onClick={() => addWithUndo(product, qty)}
      >
        <ShoppingBag className="size-4" />
        {soldOut ? "Sold out" : tooMuch ? `Only ${formatQty(maxAddable, product.unit)} more available` : "Add to cart"}
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
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          We cut and weigh your order when we prepare it. You pay for the actual weight, which is usually within a few grams
          of what you ordered.
        </p>
      )}
    </div>
  );
}
