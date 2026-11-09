import type { Metadata } from "next";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { DateRangeFilter, SelectFilter } from "@/components/filters";
import { PageHeader, Section } from "@/components/page";
import { TransactionsTable } from "@/components/staff/transactions-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { STOCK_TXN, type StockTxnType } from "@/lib/constants";
import { resolveRange } from "@/lib/dates";
import { requireRole } from "@/server/dal";
import { listStockTransactions, productOptions } from "@/server/queries/inventory";

export const metadata: Metadata = { title: "Stock history" };

export default async function TransactionsPage({ searchParams }: PageProps<"/owner/transactions">) {
  await requireRole("OWNER");
  const sp = await searchParams;
  const range = resolveRange(sp.from, sp.to, new Date(), 30);
  const product = typeof sp.product === "string" ? sp.product : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const [txns, products] = await Promise.all([
    listStockTransactions({ productId: product || undefined, type: type || undefined, start: range.start, end: range.end, take: 500 }),
    productOptions(),
  ]);
  const csv = new URLSearchParams({ from: range.fromKey, to: range.toKey, ...(type && { type }), ...(product && { product }) });

  return (
    <>
      <PageHeader
        title="Stock history"
        description="Every addition, withdrawal, return, write-off and correction, with who recorded it."
        actions={
          <Button variant="outline" asChild>
            <a href={`/api/reports/transactions?${csv}`}>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="mb-4 h-16 rounded-xl" />}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SelectFilter
            basePath="/owner/transactions"
            name="product"
            label="Product"
            value={product}
            allLabel="All products"
            options={products.map((p) => ({ value: p.id, label: p.name }))}
          />
          <SelectFilter
            basePath="/owner/transactions"
            name="type"
            label="Type"
            value={type}
            allLabel="All types"
            options={(Object.keys(STOCK_TXN) as StockTxnType[]).map((t) => ({ value: t, label: STOCK_TXN[t].label }))}
          />
          <DateRangeFilter basePath="/owner/transactions" from={range.fromKey} to={range.toKey} />
        </div>
      </Suspense>
      <Section>
        <TransactionsTable txns={txns} orderHref={(id) => `/owner/orders/${id}`} />
      </Section>
      <p className="mt-3 text-xs text-muted-foreground">Showing up to 500 most recent entries. Export CSV for the full period.</p>
    </>
  );
}
