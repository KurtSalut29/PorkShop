import type { Metadata } from "next";
import { Boxes, PackageX, Scale, Wallet } from "lucide-react";
import { PageHeader, Section, StatCard } from "@/components/page";
import { InventoryTable } from "@/components/staff/inventory-table";
import { formatPeso } from "@/lib/format";
import { requireRole } from "@/server/dal";
import { listInventory, productOptions } from "@/server/queries/inventory";
import { RecordDeliveryButton, RowStockMenu } from "./stock-dialogs";

export const metadata: Metadata = { title: "Stock levels" };

export default async function OwnerInventoryPage({ searchParams }: PageProps<"/owner/inventory">) {
  await requireRole("OWNER");
  const sp = await searchParams;
  const [products, options] = await Promise.all([listInventory(), productOptions()]);
  const reservedValue = products.reduce((s, p) => s + p.reservedQty * p.price, 0);
  const stockValue = products.reduce((s, p) => s + p.stockQty * p.price, 0);
  const kg = products.filter((p) => p.unit === "KG").reduce((s, p) => s + p.stockQty, 0);
  const alerts = products.filter((p) => p.level !== "ok").length;

  return (
    <>
      <PageHeader
        title="Stock levels"
        description="On-hand stock, what's reserved for open orders, and what customers can still buy."
        actions={<RecordDeliveryButton products={options} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock value" value={formatPeso(stockValue)} icon={Wallet} hint="At current selling prices" />
        <StatCard label="Reserved for orders" value={formatPeso(reservedValue)} icon={Boxes} hint="Released on cancel, withdrawn when packed" />
        <StatCard label="Meat on hand" value={`${kg.toFixed(1)} kg`} icon={Scale} hint="Excluding per-piece items" />
        <StatCard label="Stock alerts" value={alerts} icon={PackageX} tone={alerts ? "danger" : "default"} hint="Low or out of stock" />
      </div>
      <Section>
        <InventoryTable
          products={products}
          showValue
          highlightId={typeof sp.product === "string" ? sp.product : undefined}
          actions={(p) => <RowStockMenu productId={p.id} name={p.name} products={options} />}
        />
      </Section>
    </>
  );
}
