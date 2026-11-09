"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProductAction } from "@/app/actions/admin";
import { useConfirmedFormAction } from "@/components/feedback/confirm";
import { errorFor, Field, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABEL, type ProductCategory } from "@/lib/constants";
import { formatPeso } from "@/lib/format";
import type { ProductView } from "@/server/queries/catalog";

export function ProductForm({ product }: { product?: ProductView }) {
  const router = useRouter();
  const [unit, setUnit] = useState<"KG" | "PIECE">(product?.unit ?? "KG");
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "PRIME_CUTS");
  const u = unit === "KG" ? "kg" : "pc";

  const { onSubmit, pending, fieldErrors: fe } = useConfirmedFormAction(saveProductAction.bind(null, product?.id ?? null), {
    loading: product ? "Saving changes…" : "Creating product…",
    confirm: (fd) => {
      const v = (k: string) => String(fd.get(k) ?? "").trim();
      const price = Number(v("price"));
      if (!product) {
        return {
          title: `Create ${v("name") || "this product"}?`,
          description: "It appears in the catalog right away with zero stock. Record a delivery to make it orderable.",
          details: [
            { label: "Category", value: CATEGORY_LABEL[v("category") as ProductCategory] ?? "—" },
            { label: "Price", value: Number.isFinite(price) && price > 0 ? `${formatPeso(price)} / ${u}` : "—" },
            { label: "SKU", value: v("sku").toUpperCase() || "—" },
          ],
          confirmLabel: "Create product",
        };
      }
      const changes: { label: string; value: string }[] = [];
      const cmp = (label: string, before: string | number | null | undefined, after: string, fmt = (x: string) => x) => {
        if (String(before ?? "") !== after) changes.push({ label, value: `${fmt(String(before ?? "—")) || "—"} → ${fmt(after) || "—"}` });
      };
      cmp("Name", product.name, v("name"));
      cmp("Local name", product.localName, v("localName"));
      cmp("SKU", product.sku, v("sku").toUpperCase());
      cmp("Category", CATEGORY_LABEL[product.category], CATEGORY_LABEL[v("category") as ProductCategory] ?? "");
      if (Number(v("price")) !== product.price) changes.push({ label: "Price", value: `${formatPeso(product.price)} → ${Number.isFinite(price) ? formatPeso(price) : v("price")}` });
      if (Number(v("lowStockThreshold")) !== product.lowStockThreshold) changes.push({ label: "Low-stock alert", value: `${product.lowStockThreshold} → ${v("lowStockThreshold")} ${u}` });
      if (Number(v("minOrderQty")) !== product.minOrderQty) changes.push({ label: "Minimum order", value: `${product.minOrderQty} → ${v("minOrderQty")} ${u}` });
      if (Number(v("qtyStep")) !== product.qtyStep) changes.push({ label: "Quantity step", value: `${product.qtyStep} → ${v("qtyStep")} ${u}` });
      if (v("description") !== product.description) changes.push({ label: "Description", value: "Updated" });
      if (v("imageUrl") !== (product.imageUrl ?? "")) changes.push({ label: "Image", value: v("imageUrl") ? "Updated" : "Removed" });
      const priceChanged = Number(v("price")) !== product.price;
      return {
        title: changes.length ? `Save ${changes.length} change${changes.length > 1 ? "s" : ""} to ${product.name}?` : "Save without changes?",
        description: priceChanged
          ? "The new price applies to new orders only. Orders already placed keep their original price. Price changes are recorded in the audit log."
          : changes.length
            ? "Changes appear in the catalog immediately."
            : "Nothing has changed since you opened this product.",
        details: changes,
        confirmLabel: "Save changes",
        tone: priceChanged ? "warning" : "default",
      };
    },
    onSuccess: () => {
      if (!product) router.push("/owner/products");
    },
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <section className="rounded-xl border bg-card shadow-xs">
        <header className="border-b px-5 py-4">
          <h2 className="font-semibold">Details</h2>
          <p className="text-sm text-muted-foreground">What customers see in the catalog.</p>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Product name" htmlFor="name" error={errorFor(fe, "name")}>
            <Input id="name" name="name" defaultValue={product?.name} placeholder="e.g. Pork Belly" aria-invalid={!!errorFor(fe, "name")} />
          </Field>
          <Field label="Local name" htmlFor="localName" optional error={errorFor(fe, "localName")}>
            <Input id="localName" name="localName" defaultValue={product?.localName ?? ""} placeholder="e.g. Liempo" />
          </Field>
          <Field label="SKU" htmlFor="sku" error={errorFor(fe, "sku")} hint="Short code used in reports">
            <Input id="sku" name="sku" defaultValue={product?.sku} placeholder="PK-BLY" className="uppercase" aria-invalid={!!errorFor(fe, "sku")} />
          </Field>
          <Field label="Category" htmlFor="category" error={errorFor(fe, "category")}>
            <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABEL) as ProductCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="category" value={category} />
          </Field>
          <Field label="Description" htmlFor="description" error={errorFor(fe, "description")} className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              defaultValue={product?.description}
              className="min-h-24"
              placeholder="Best uses, how it's cut, approximate size…"
              aria-invalid={!!errorFor(fe, "description")}
            />
          </Field>
          <Field label="Image URL" htmlFor="imageUrl" optional error={errorFor(fe, "imageUrl")} className="sm:col-span-2" hint="Leave blank to use the category illustration">
            <Input id="imageUrl" name="imageUrl" type="url" defaultValue={product?.imageUrl ?? ""} placeholder="https://…" />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-card shadow-xs">
        <header className="border-b px-5 py-4">
          <h2 className="font-semibold">Pricing & ordering rules</h2>
          <p className="text-sm text-muted-foreground">Stock quantities are managed on the Stock levels page.</p>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Sold by" htmlFor="unit" error={errorFor(fe, "unit")} hint={product && product.stockQty > 0 ? "Can't change while in stock" : undefined}>
            <Select value={unit} onValueChange={(v) => setUnit(v as "KG" | "PIECE")} disabled={!!product && product.stockQty > 0}>
              <SelectTrigger id="unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KG">Weight (per kg)</SelectItem>
                <SelectItem value="PIECE">Piece (per pc)</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="unit" value={unit} />
          </Field>
          <Field label={`Price per ${u} (₱)`} htmlFor="price" error={errorFor(fe, "price")}>
            <Input id="price" name="price" inputMode="decimal" defaultValue={product?.price} className="num" aria-invalid={!!errorFor(fe, "price")} />
          </Field>
          <Field label={`Low-stock alert at (${u})`} htmlFor="lowStockThreshold" error={errorFor(fe, "lowStockThreshold")}>
            <Input id="lowStockThreshold" name="lowStockThreshold" inputMode="decimal" defaultValue={product?.lowStockThreshold ?? 5} className="num" />
          </Field>
          <Field label={`Minimum order (${u})`} htmlFor="minOrderQty" error={errorFor(fe, "minOrderQty")}>
            <Input id="minOrderQty" name="minOrderQty" inputMode="decimal" defaultValue={product?.minOrderQty ?? (unit === "KG" ? 0.5 : 1)} className="num" />
          </Field>
          <Field label={`Quantity step (${u})`} htmlFor="qtyStep" error={errorFor(fe, "qtyStep")} hint={unit === "KG" ? "e.g. 0.25 = quarter-kilo steps" : "Usually 1"}>
            <Input id="qtyStep" name="qtyStep" inputMode="decimal" defaultValue={product?.qtyStep ?? (unit === "KG" ? 0.25 : 1)} className="num" />
          </Field>
        </div>
      </section>

      <div className="flex gap-2">
        <SubmitButton pending={pending}>{product ? "Save changes" : "Create product"}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => router.push("/owner/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
