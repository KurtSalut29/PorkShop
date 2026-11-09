import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page";
import { requireRole } from "@/server/dal";
import { getProductById } from "@/server/queries/catalog";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/owner/products/[id]">) {
  await requireRole("OWNER");
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: "/owner/products", label: "Products" }}
        title={`Edit ${product.name}`}
        description="Price changes apply to new orders only. Existing orders keep the price they were placed at."
      />
      <ProductForm product={product} />
    </div>
  );
}
