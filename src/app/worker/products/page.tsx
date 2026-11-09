import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { ProductArt } from "@/components/product-art";
import { StockLevelBadge } from "@/components/status";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatQty, formatUnitPrice } from "@/lib/format";
import { requireRole } from "@/server/dal";
import { listCatalog } from "@/server/queries/catalog";

export const metadata: Metadata = { title: "Products" };

export default async function WorkerProductsPage() {
  await requireRole("WORKER");
  const products = await listCatalog();
  return (
    <>
      <PageHeader title="Products" description="Reference for prices, cuts and ordering rules." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => (
          <article key={p.id} className="flex gap-4 rounded-xl border bg-card p-4 shadow-xs">
            <div className="w-24 shrink-0">
              <ProductArt category={p.category} name={p.name} imageUrl={p.imageUrl} size="sm" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {p.localName ? `${p.localName} · ` : ""}
                    {CATEGORY_LABEL[p.category]}
                  </p>
                </div>
                <StockLevelBadge level={p.level} />
              </div>
              <p className="num mt-2 text-sm font-medium">{formatUnitPrice(p.price, p.unit)}</p>
              <p className="num mt-0.5 text-xs text-muted-foreground">
                Min {formatQty(p.minOrderQty, p.unit)} · step {formatQty(p.qtyStep, p.unit)} · {formatQty(p.available, p.unit)} available
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
