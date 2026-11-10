"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProductAction } from "@/app/actions/admin";
import { useConfirmedFormAction } from "@/components/feedback/confirm";
import { errorFor, Field, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABEL, type ProductCategory } from "@/lib/constants";
import { formatPeso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { PriceTag } from "@/components/ticket";
import { PhotoUpload } from "./photo-upload";
import type { ProductView } from "@/server/queries/catalog";

export function ProductForm({ product }: { product?: ProductView }) {
  const router = useRouter();
  const [unit, setUnit] = useState<"KG" | "PIECE">(product?.unit ?? "KG");
  const [category, setCategory] = useState<ProductCategory>(
    product?.category ?? "PRIME_CUTS",
  );
  const u = unit === "KG" ? "kg" : "pc";
  // Mirrors the fields shown in the live preview (the inputs themselves stay uncontrolled).
  const [draft, setDraft] = useState({
    name: product?.name ?? "",
    localName: product?.localName ?? "",
    imageUrl: product?.imageUrl ?? "",
    price: product ? String(product.price) : "",
    description: product?.description ?? "",
  });
  // How a newly uploaded photo should be shown (measured by the server on upload).
  const [uploadedStyle, setUploadedStyle] = useState<"cutout" | "photo" | undefined>();

  const {
    onSubmit,
    pending,
    fieldErrors: fe,
  } = useConfirmedFormAction(
    saveProductAction.bind(null, product?.id ?? null),
    {
      loading: product ? "Saving changes…" : "Creating product…",
      confirm: (fd) => {
        const v = (k: string) => String(fd.get(k) ?? "").trim();
        const price = Number(v("price"));
        if (!product) {
          return {
            title: `Create ${v("name") || "this product"}?`,
            description:
              "It appears in the catalog right away with zero stock. Record a delivery to make it orderable.",
            details: [
              {
                label: "Category",
                value: CATEGORY_LABEL[v("category") as ProductCategory] ?? "—",
              },
              {
                label: "Price",
                value:
                  Number.isFinite(price) && price > 0
                    ? `${formatPeso(price)} / ${u}`
                    : "—",
              },
              { label: "SKU", value: v("sku").toUpperCase() || "—" },
            ],
            confirmLabel: "Create product",
          };
        }
        const changes: { label: string; value: string }[] = [];
        const cmp = (
          label: string,
          before: string | number | null | undefined,
          after: string,
          fmt = (x: string) => x,
        ) => {
          if (String(before ?? "") !== after)
            changes.push({
              label,
              value: `${fmt(String(before ?? "—")) || "—"} → ${fmt(after) || "—"}`,
            });
        };
        cmp("Name", product.name, v("name"));
        cmp("Local name", product.localName, v("localName"));
        cmp("SKU", product.sku, v("sku").toUpperCase());
        cmp(
          "Category",
          CATEGORY_LABEL[product.category],
          CATEGORY_LABEL[v("category") as ProductCategory] ?? "",
        );
        if (Number(v("price")) !== product.price)
          changes.push({
            label: "Price",
            value: `${formatPeso(product.price)} → ${Number.isFinite(price) ? formatPeso(price) : v("price")}`,
          });
        if (Number(v("lowStockThreshold")) !== product.lowStockThreshold)
          changes.push({
            label: "Low-stock alert",
            value: `${product.lowStockThreshold} → ${v("lowStockThreshold")} ${u}`,
          });
        if (Number(v("minOrderQty")) !== product.minOrderQty)
          changes.push({
            label: "Minimum order",
            value: `${product.minOrderQty} → ${v("minOrderQty")} ${u}`,
          });
        if (Number(v("qtyStep")) !== product.qtyStep)
          changes.push({
            label: "Quantity step",
            value: `${product.qtyStep} → ${v("qtyStep")} ${u}`,
          });
        if (v("description") !== product.description)
          changes.push({ label: "Description", value: "Updated" });
        if (v("imageUrl") !== (product.imageUrl ?? ""))
          changes.push({
            label: "Photo",
            value: v("imageUrl") ? "New photo" : "Removed (category illustration)",
          });
        const priceChanged = Number(v("price")) !== product.price;
        return {
          title: changes.length
            ? `Save ${changes.length} change${changes.length > 1 ? "s" : ""} to ${product.name}?`
            : "Save without changes?",
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
    },
  );

  return (
    <form
      onSubmit={onSubmit}
      onChange={(e) => {
        const el = e.target as unknown as HTMLInputElement;
        if (el.name in draft) setDraft((d) => ({ ...d, [el.name]: el.value }));
      }}
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8"
      noValidate
    >
      <div className="grid gap-6">
        <section className="rounded-xl border bg-card shadow-xs">
          <header className="border-b px-5 py-4">
            <h2 className="font-semibold">Details</h2>
            <p className="text-sm text-muted-foreground">
              What customers see in the catalog.
            </p>
          </header>
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field
              label="Product name"
              htmlFor="name"
              error={errorFor(fe, "name")}
            >
              <Input
                id="name"
                name="name"
                defaultValue={product?.name}
                placeholder="e.g. Pork Belly"
                aria-invalid={!!errorFor(fe, "name")}
              />
            </Field>
            <Field
              label="Local name"
              htmlFor="localName"
              optional
              error={errorFor(fe, "localName")}
            >
              <Input
                id="localName"
                name="localName"
                defaultValue={product?.localName ?? ""}
                placeholder="e.g. Liempo"
              />
            </Field>
            <Field
              label="SKU"
              htmlFor="sku"
              error={errorFor(fe, "sku")}
              hint="Short code used in reports"
            >
              <Input
                id="sku"
                name="sku"
                defaultValue={product?.sku}
                placeholder="PK-BLY"
                className="uppercase"
                aria-invalid={!!errorFor(fe, "sku")}
              />
            </Field>
            <Field
              label="Category"
              htmlFor="category"
              error={errorFor(fe, "category")}
            >
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ProductCategory)}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABEL) as ProductCategory[]).map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <input type="hidden" name="category" value={category} />
            </Field>
            <Field
              label="Description"
              htmlFor="description"
              error={errorFor(fe, "description")}
              className="sm:col-span-2"
            >
              <Textarea
                id="description"
                name="description"
                defaultValue={product?.description}
                className="min-h-24"
                placeholder="Best uses, how it's cut, approximate size…"
                aria-invalid={!!errorFor(fe, "description")}
              />
            </Field>
            <Field label="Photo" htmlFor="productPhoto" optional className="sm:col-span-2">
              <PhotoUpload
                id="productPhoto"
                value={draft.imageUrl}
                error={errorFor(fe, "imageUrl")}
                onChange={({ url, imageStyle }) => {
                  setDraft((d) => ({ ...d, imageUrl: url }));
                  setUploadedStyle(imageStyle);
                }}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-xs">
          <header className="border-b px-5 py-4">
            <h2 className="font-semibold">Pricing & ordering rules</h2>
            <p className="text-sm text-muted-foreground">
              Stock quantities are managed on the Stock levels page.
            </p>
          </header>
          <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Sold by"
              htmlFor="unit"
              error={errorFor(fe, "unit")}
              hint={
                product && product.stockQty > 0
                  ? "Can't change while in stock"
                  : undefined
              }
            >
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as "KG" | "PIECE")}
                disabled={!!product && product.stockQty > 0}
              >
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
            <Field
              label={`Price per ${u} (₱)`}
              htmlFor="price"
              error={errorFor(fe, "price")}
            >
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                defaultValue={product?.price}
                className="num"
                aria-invalid={!!errorFor(fe, "price")}
              />
            </Field>
            <Field
              label={`Low-stock alert at (${u})`}
              htmlFor="lowStockThreshold"
              error={errorFor(fe, "lowStockThreshold")}
            >
              <Input
                id="lowStockThreshold"
                name="lowStockThreshold"
                inputMode="decimal"
                defaultValue={product?.lowStockThreshold ?? 5}
                className="num"
              />
            </Field>
            <Field
              label={`Minimum order (${u})`}
              htmlFor="minOrderQty"
              error={errorFor(fe, "minOrderQty")}
            >
              <Input
                id="minOrderQty"
                name="minOrderQty"
                inputMode="decimal"
                defaultValue={product?.minOrderQty ?? (unit === "KG" ? 0.5 : 1)}
                className="num"
              />
            </Field>
            <Field
              label={`Quantity step (${u})`}
              htmlFor="qtyStep"
              error={errorFor(fe, "qtyStep")}
              hint={
                unit === "KG" ? "e.g. 0.25 = quarter-kilo steps" : "Usually 1"
              }
            >
              <Input
                id="qtyStep"
                name="qtyStep"
                inputMode="decimal"
                defaultValue={product?.qtyStep ?? (unit === "KG" ? 0.25 : 1)}
                className="num"
              />
            </Field>
          </div>
        </section>

        <div className="flex gap-2">
          <SubmitButton pending={pending}>
            {product ? "Save changes" : "Create product"}
          </SubmitButton>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/owner/products")}
          >
            Cancel
          </Button>
        </div>
      </div>

      <CustomerPreview
        draft={draft}
        category={category}
        unit={unit}
        imageStyle={
          uploadedStyle ??
          (product && draft.imageUrl === (product.imageUrl ?? "")
            ? product.imageStyle
            : undefined)
        }
      />
    </form>
  );
}

/** Only preview an image once its address looks complete, so half-typed URLs don't show a broken picture. */
const previewableImage = (url: string) =>
  /^https?:\/\/[^\s/]+\.[^\s/]+\/\S+$/i.test(url) ||
  /^\/[\w\-./]+\.(png|jpe?g|webp|avif|gif)$/i.test(url)
    ? url
    : null;

/** Live preview of the catalog card, updated as the owner types. */
function CustomerPreview({
  draft,
  category,
  unit,
  imageStyle,
}: {
  draft: {
    name: string;
    localName: string;
    imageUrl: string;
    price: string;
    description: string;
  };
  category: ProductCategory;
  unit: "KG" | "PIECE";
  imageStyle?: "cutout" | "photo";
}) {
  const price = Number(draft.price);
  const imageUrl = previewableImage(draft.imageUrl.trim());
  const name = draft.name.trim() || "Product name";
  return (
    <aside className="xl:sticky xl:top-24" aria-label="Customer preview">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        <Eye className="size-3.5" /> Customer view
      </p>
      <div className="rounded-2xl border bg-card p-2 shadow-[0_12px_28px_-16px_oklch(0.2_0.02_240/0.3)]">
        <ProductArt
          category={category}
          name={name}
          label={draft.localName.trim() || null}
          imageUrl={imageUrl}
          imageStyle={
            imageStyle ?? (imageUrl?.startsWith("/") ? "cutout" : "photo")
          }
          className="aspect-[4/3] rounded-xl"
        />
        <div className="px-2.5 pt-3.5 pb-2.5">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={cn(
                "text-[15px] leading-snug",
                !draft.name.trim() && "text-muted-foreground",
              )}
            >
              {name}
            </h3>
            <PriceTag
              price={
                Number.isFinite(price) && price > 0 ? formatPeso(price) : "₱—"
              }
              unit={unit === "KG" ? "kg" : "pc"}
              className="-mt-0.5 shrink-0"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {CATEGORY_LABEL[category]}
          </p>
          {draft.description.trim() && (
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {draft.description.trim()}
            </p>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        This is how the product appears in the shop. Stock shows as sold out
        until you record a delivery.
      </p>
    </aside>
  );
}
