import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { PageHeader, Section } from "@/components/page";
import { ProductArt } from "@/components/product-art";
import { StockLevelBadge, ToneBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatQty, formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/dal";
import { listCatalog } from "@/server/queries/catalog";
import { ArchiveButton } from "./archive-button";

export const metadata: Metadata = { title: "Products" };

export default async function OwnerProductsPage({ searchParams }: PageProps<"/owner/products">) {
  await requireRole("OWNER");
  const sp = await searchParams;
  const showArchived = sp.archived === "1";
  const all = await listCatalog({ includeArchived: true });
  const products = all.filter((p) => p.archived === showArchived);
  const archivedCount = all.filter((p) => p.archived).length;

  return (
    <>
      <PageHeader
        title="Products"
        description="Your catalog, prices and ordering rules."
        actions={
          <Button asChild>
            <Link href="/owner/products/new">
              <Plus className="size-4" /> Add product
            </Link>
          </Button>
        }
      />
      <div className="mb-4 inline-flex rounded-lg border bg-card p-1">
        {[
          { href: "/owner/products", label: `Active (${all.length - archivedCount})`, on: !showArchived },
          { href: "/owner/products?archived=1", label: `Archived (${archivedCount})`, on: showArchived },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              t.on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Section>
        {products.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {showArchived ? "No archived products." : "No products yet. Add your first cut."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Category</th>
                  <th className="px-3 py-3 text-right font-semibold">Price</th>
                  <th className="px-3 py-3 font-semibold">Ordering</th>
                  <th className="px-3 py-3 font-semibold">Stock</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 shrink-0">
                          <ProductArt category={p.category} name={p.name} label={p.localName} imageUrl={p.imageUrl} imageStyle={p.imageStyle} size="sm" className="rounded-md" />
                        </div>
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.sku}
                            {p.localName ? ` · ${p.localName}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{CATEGORY_LABEL[p.category]}</td>
                    <td className="num px-3 py-3 text-right font-medium">{formatUnitPrice(p.price, p.unit)}</td>
                    <td className="num px-3 py-3 text-xs text-muted-foreground">
                      Min {formatQty(p.minOrderQty, p.unit)} · step {formatQty(p.qtyStep, p.unit)}
                    </td>
                    <td className="px-3 py-3">
                      {p.archived ? <ToneBadge tone="stone">Archived</ToneBadge> : <StockLevelBadge level={p.level} />}
                      <p className="num mt-1 text-xs text-muted-foreground">{formatQty(p.available, p.unit)} available</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/owner/products/${p.id}`}>
                            <Pencil className="size-3.5" /> Edit
                          </Link>
                        </Button>
                        <ArchiveButton id={p.id} name={p.name} archived={p.archived} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
