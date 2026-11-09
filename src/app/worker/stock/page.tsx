import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/page";
import { StockMovementForm } from "@/components/staff/stock-forms";
import { TransactionsTable } from "@/components/staff/transactions-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRole } from "@/server/dal";
import { listStockTransactions, productOptions } from "@/server/queries/inventory";

export const metadata: Metadata = { title: "Record stock" };

export default async function WorkerStockPage() {
  const user = await requireRole("WORKER");
  const [products, mine] = await Promise.all([
    productOptions(),
    listStockTransactions({ actorId: user.id, take: 15 }),
  ]);

  return (
    <>
      <PageHeader
        title="Record stock"
        description="Order withdrawals are recorded automatically when you mark an order ready. Use this page for everything else."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[480px_1fr]">
        <Section>
          <Tabs defaultValue="WITHDRAWAL" className="p-5">
            <TabsList className="mb-5 grid w-full grid-cols-3">
              <TabsTrigger value="WITHDRAWAL">Withdrawal</TabsTrigger>
              <TabsTrigger value="RETURN">Return</TabsTrigger>
              <TabsTrigger value="SPOILAGE">Spoilage</TabsTrigger>
            </TabsList>
            <TabsContent value="WITHDRAWAL">
              <p className="mb-4 text-sm text-muted-foreground">Product taken out of the chiller for something other than an online order.</p>
              <StockMovementForm kind="WITHDRAWAL" products={products} />
            </TabsContent>
            <TabsContent value="RETURN">
              <p className="mb-4 text-sm text-muted-foreground">Product going back into inventory. Link it to an order if it came from one.</p>
              <StockMovementForm kind="RETURN" products={products} />
            </TabsContent>
            <TabsContent value="SPOILAGE">
              <p className="mb-4 text-sm text-muted-foreground">Write off product that can no longer be sold. The owner is alerted if stock runs low.</p>
              <StockMovementForm kind="SPOILAGE" products={products} />
            </TabsContent>
          </Tabs>
        </Section>
        <Section title="Your recent entries" description="Including automatic withdrawals from your orders">
          <TransactionsTable txns={mine} orderHref={(id) => `/worker/orders/${id}`} />
        </Section>
      </div>
    </>
  );
}
