"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveProductAction } from "@/app/actions/admin";
import { errorFor, Field, FormAlert, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABEL, type ProductCategory } from "@/lib/constants";
import type { ProductView } from "@/server/queries/catalog";

export function ProductForm({ product }: { product?: ProductView }) {
  const router = useRouter();
  const [state, action] = useActionState(saveProductAction.bind(null, product?.id ?? null), null);
  const [unit, setUnit] = useState<"KG" | "PIECE">(product?.unit ?? "KG");
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "PRIME_CUTS");
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const u = unit === "KG" ? "kg" : "pc";

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      if (!product) router.push("/owner/products");
    }
  }, [state, product, router]);

  return (
    <form action={action} className="grid gap-6">
      {state && !state.ok && <FormAlert state={state} />}
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
        <SubmitButton>{product ? "Save changes" : "Create product"}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => router.push("/owner/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
