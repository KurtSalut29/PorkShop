import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/page";
import { InventoryTable } from "@/components/staff/inventory-table";
import { requireRole } from "@/server/dal";
import { listInventory } from "@/server/queries/inventory";

export const metadata: Metadata = { title: "Stock levels" };

export default async function WorkerInventoryPage() {
  await requireRole("WORKER");
  const products = await listInventory();
  return (
    <>
      <PageHeader title="Stock levels" description="Live quantities across all devices. Reserved stock is already promised to customer orders." />
      <Section>
        <InventoryTable products={products} />
      </Section>
    </>
  );
}
