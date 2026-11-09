import Link from "next/link";
import { QuickAdd } from "@/components/cart/add-to-cart";
import { ProductArt } from "@/components/product-art";
import { PriceTag } from "@/components/ticket";
import { formatPeso, formatQty, unitLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductView } from "@/server/queries/catalog";

/** Availability as a short, honest line plus a thin meter of what's left today. */
function Availability({ product }: { product: ProductView }) {
  const pct = Math.min(100, (product.available / Math.max(product.lowStockThreshold * 4, 1)) * 100);
  return (
    <div className="mt-3">
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full",
            product.level === "out" ? "bg-transparent" : product.level === "low" ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        className={cn(
          "mt-1.5 text-xs",
          product.level === "out" ? "font-medium text-red-700" : product.level === "low" ? "font-medium text-amber-800" : "text-muted-foreground",
        )}
      >
        {product.level === "out"
          ? "Sold out today"
          : product.level === "low"
            ? `Only ${formatQty(product.available, product.unit)} left`
            : `${formatQty(product.available, product.unit)} at the counter`}
      </p>
    </div>
  );
}

export function ProductCard({ product, eager = false }: { product: ProductView; eager?: boolean }) {
  const soldOut = product.level === "out";
  return (
    <article className="group relative flex flex-col rounded-2xl border bg-card p-2 shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_oklch(0.2_0.02_240/0.25)]">
      <Link href={`/shop/${product.slug}`} className="absolute inset-0 z-0 rounded-2xl" aria-label={product.name} />
      <ProductArt
        category={product.category}
        name={product.name}
        label={product.localName}
        imageUrl={product.imageUrl}
        imageStyle={product.imageStyle}
        eager={eager}
        className={cn("aspect-[16/9] rounded-xl sm:aspect-[4/3]", soldOut && "grayscale-[0.7]")}
      />
      <div className="flex flex-1 flex-col px-2.5 pt-3.5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] leading-snug">{product.name}</h3>
          <PriceTag price={formatPeso(product.price)} unit={unitLabel(product.unit, false)} className="-mt-0.5 shrink-0" />
        </div>
        <Availability product={product} />
        <div className="relative z-10 mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Min. {formatQty(product.minOrderQty, product.unit)}
          </span>
          <QuickAdd product={product} />
        </div>
      </div>
    </article>
  );
}
