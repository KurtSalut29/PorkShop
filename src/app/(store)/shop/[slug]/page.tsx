import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronRight, Scale, Snowflake } from "lucide-react";
import { AddToCartPanel } from "@/components/cart/add-to-cart";
import { Container, PageSkeleton } from "@/components/page";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { StockLevelBadge } from "@/components/status";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatPeso, formatQty, unitLabel } from "@/lib/format";
import { getProductBySlug, listRelated } from "@/server/queries/catalog";

export default function ProductPage({ params }: PageProps<"/shop/[slug]">) {
  return (
    <Container className="py-8 sm:py-10">
      <Suspense fallback={<PageSkeleton />}>
        <ProductDetail params={params} />
      </Suspense>
    </Container>
  );
}

async function ProductDetail({ params }: { params: PageProps<"/shop/[slug]">["params"] }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const related = await listRelated(product);

  return (
    <div className="enter">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/shop" className="hover:text-foreground">
          Shop
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href={`/shop?category=${product.category}`} className="hover:text-foreground">
          {CATEGORY_LABEL[product.category]}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <ProductArt
          category={product.category}
          name={product.name}
          label={product.localName}
          imageUrl={product.imageUrl}
          imageStyle={product.imageStyle}
          priority
          size="lg"
          className="aspect-[4/3] rounded-3xl lg:sticky lg:top-24"
        />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StockLevelBadge level={product.level} />
            <span className="font-mono text-xs text-muted-foreground">SKU {product.sku}</span>
          </div>
          <h1 className="mt-4 text-4xl sm:text-5xl">{product.name}</h1>
          {product.localName && (
            <p className="mt-2 text-lg text-muted-foreground">
              Known at the counter as <span className="font-medium text-foreground">{product.localName}</span>
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="num font-display text-4xl font-semibold tracking-tight">
              {formatPeso(product.price)}
              <span className="ml-1 font-sans text-base font-normal text-muted-foreground">per {unitLabel(product.unit, false)}</span>
            </p>
            <p className="pb-1 text-sm text-muted-foreground">
              {product.level === "out"
                ? "Sold out for now. Check back after the next delivery."
                : `${formatQty(product.available, product.unit)} available · minimum ${formatQty(product.minOrderQty, product.unit)}`}
            </p>
          </div>

          <p className="mt-6 max-w-prose leading-relaxed text-foreground/85">{product.description}</p>

          <div className="mt-8">
            <AddToCartPanel product={product} />
          </div>

          <ul className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <li className="flex items-center gap-2">
              <Scale className="size-4 shrink-0 text-primary" /> Priced by actual weight
            </li>
            <li className="flex items-center gap-2">
              <Snowflake className="size-4 shrink-0 text-primary" /> Kept chilled until pickup
            </li>
            <li className="flex items-center gap-2">
              <CalendarClock className="size-4 shrink-0 text-primary" /> You choose the pickup time
            </li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl">Often bought together</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
