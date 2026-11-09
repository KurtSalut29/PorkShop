import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarClock, Scale, Snowflake } from "lucide-react";
import { AddToCartPanel } from "@/components/cart/add-to-cart";
import { Container, PageSkeleton } from "@/components/page";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { StockLevelBadge } from "@/components/status";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatPeso, formatQty, unitLabel } from "@/lib/format";
import { getProductBySlug, listRelated } from "@/server/queries/catalog";
import Link from "next/link";

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
    <>
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/shop" className="hover:text-foreground">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/shop?category=${product.category}`} className="hover:text-foreground">
          {CATEGORY_LABEL[product.category]}
        </Link>
      </nav>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductArt
          category={product.category}
          name={product.name}
          imageUrl={product.imageUrl}
          size="lg"
          className="rounded-2xl border"
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StockLevelBadge level={product.level} />
            <span className="text-sm text-muted-foreground">SKU {product.sku}</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold">{product.name}</h1>
          {product.localName && <p className="mt-1 text-lg text-muted-foreground">{product.localName}</p>}
          <p className="num mt-5 text-3xl font-semibold">
            {formatPeso(product.price)}
            <span className="text-base font-normal text-muted-foreground"> per {unitLabel(product.unit, false)}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.level === "out"
              ? "Sold out for now. Check back after our next delivery."
              : `${formatQty(product.available, product.unit)} available · minimum ${formatQty(product.minOrderQty, product.unit)}`}
          </p>
          <p className="mt-6 leading-relaxed text-foreground/90">{product.description}</p>

          <div className="mt-8">
            <AddToCartPanel product={product} />
          </div>

          <ul className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <li className="flex items-center gap-2">
              <Scale className="size-4 shrink-0" /> Weighed on pickup
            </li>
            <li className="flex items-center gap-2">
              <Snowflake className="size-4 shrink-0" /> Kept chilled
            </li>
            <li className="flex items-center gap-2">
              <CalendarClock className="size-4 shrink-0" /> Choose a pickup slot
            </li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-semibold">You might also need</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
