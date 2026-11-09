import Link from "next/link";
import { QuickAdd } from "@/components/cart/add-to-cart";
import { ProductArt } from "@/components/product-art";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatPeso, formatQty, unitLabel } from "@/lib/format";
import type { ProductView } from "@/server/queries/catalog";

export function ProductCard({ product }: { product: ProductView }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md">
      <Link href={`/shop/${product.slug}`} className="absolute inset-0 z-0 rounded-xl" aria-label={product.name} />
      <div className="p-2 pb-0">
        <ProductArt category={product.category} name={product.name} imageUrl={product.imageUrl} className="aspect-[2/1] rounded-lg sm:aspect-[4/3]" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-muted-foreground">{CATEGORY_LABEL[product.category]}</p>
        <h3 className="mt-1 font-semibold leading-snug">{product.name}</h3>
        {product.localName && <p className="text-sm text-muted-foreground">{product.localName}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <p className="num text-lg font-semibold">
              {formatPeso(product.price)}
              <span className="text-sm font-normal text-muted-foreground"> / {unitLabel(product.unit, false)}</span>
            </p>
            <p
              className={
                product.level === "out"
                  ? "text-xs font-medium text-red-700"
                  : product.level === "low"
                    ? "text-xs font-medium text-amber-700"
                    : "text-xs text-muted-foreground"
              }
            >
              {product.level === "out"
                ? "Sold out today"
                : product.level === "low"
                  ? `Only ${formatQty(product.available, product.unit)} left`
                  : "In stock"}
            </p>
          </div>
          <div className="relative z-10">
            <QuickAdd product={product} />
          </div>
        </div>
      </div>
    </article>
  );
}
