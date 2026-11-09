import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { requireRole } from "@/server/dal";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireRole("OWNER");
  return (
    <div>
      <PageHeader
        back={{ href: "/owner/products", label: "Products" }}
        title="Add product"
        description="New products start with zero stock. Record a delivery on the Stock levels page to make them available."
      />
      <ProductForm />
    </div>
  );
}
