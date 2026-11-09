import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PackageSearch, Search } from "lucide-react";
import { Container, EmptyState } from "@/components/page";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABEL, type ProductCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { listCatalog } from "@/server/queries/catalog";

export const metadata: Metadata = { title: "Shop fresh cuts" };

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ProductCategory[];

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <Container className="py-8 sm:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">Fresh cuts</h1>
        <p className="text-muted-foreground">Cut and weighed when you order. Prices are per kilo unless marked per piece.</p>
      </div>
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const products = await listCatalog({ q, category });

  const chip = (value: string, label: string) => {
    const params = new URLSearchParams();
    if (value) params.set("category", value);
    if (q) params.set("q", q);
    const active = category === value;
    return (
      <Link
        key={value || "all"}
        href={`/shop${params.size ? `?${params}` : ""}`}
        aria-current={active ? "true" : undefined}
        className={cn(
          "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
          active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          {chip("", "All cuts")}
          {CATEGORIES.map((c) => chip(c, CATEGORY_LABEL[c]))}
        </div>
        <form action="/shop" className="relative w-full lg:w-72" role="search">
          {category && <input type="hidden" name="category" value={category} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search e.g. liempo, ribs" className="pl-9" aria-label="Search products" />
        </form>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No cuts match your search"
          description="Try a different name. Many cuts are also listed by their local name, like “liempo” or “kasim”."
          action={
            <Link href="/shop" className="text-sm font-medium text-primary hover:underline">
              Clear filters
            </Link>
          }
          className="mt-10 rounded-xl border bg-card"
        />
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "product" : "products"}
            {q && <> matching “{q}”</>}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} eager={i < 4} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function CatalogSkeleton() {
  return (
    <>
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    </>
  );
}
