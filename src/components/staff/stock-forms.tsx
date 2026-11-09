"use client";

import { useState } from "react";
import { countCorrectionAction, stockMovementAction, type StockActionKind } from "@/app/actions/inventory";
import { useConfirmedFormAction } from "@/components/feedback/confirm";
import { errorFor, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatQty, unitLabel } from "@/lib/format";
import type { ProductOption } from "@/server/queries/inventory";

const COPY: Record<
  StockActionKind,
  { submit: string; qtyLabel: string; reasonLabel: string; placeholder: string; loading: string; verb: string; sign: 1 | -1 }
> = {
  STOCK_IN: {
    submit: "Add stock",
    qtyLabel: "Quantity received",
    reasonLabel: "Supplier / reference",
    placeholder: "e.g. Delivery from Batangas farm, DR #1042",
    loading: "Adding stock…",
    verb: "Add",
    sign: 1,
  },
  WITHDRAWAL: {
    submit: "Record withdrawal",
    qtyLabel: "Quantity taken out",
    reasonLabel: "Reason",
    placeholder: "e.g. Walk-in sale, transfer to kitchen",
    loading: "Recording withdrawal…",
    verb: "Withdraw",
    sign: -1,
  },
  RETURN: {
    submit: "Record return",
    qtyLabel: "Quantity returned",
    reasonLabel: "Reason",
    placeholder: "e.g. Customer returned unused portion",
    loading: "Recording return…",
    verb: "Return",
    sign: 1,
  },
  SPOILAGE: {
    submit: "Record spoilage",
    qtyLabel: "Quantity written off",
    reasonLabel: "What happened?",
    placeholder: "e.g. Discoloured, past freshness window",
    loading: "Recording spoilage…",
    verb: "Write off",
    sign: -1,
  },
};

function ProductSelect({
  products,
  value,
  onChange,
  invalid,
}: {
  products: ProductOption[];
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="productId" className="w-full" aria-invalid={invalid}>
          <SelectValue placeholder="Choose a product" />
        </SelectTrigger>
        <SelectContent position="popper">
          {products.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex w-full items-center justify-between gap-6">
                {p.name}
                <span className="num text-xs text-muted-foreground">{formatQty(p.stockQty, p.unit)} on hand</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="productId" value={value} />
    </>
  );
}

export function StockMovementForm({
  kind,
  products,
  defaultProductId,
  onDone,
}: {
  kind: StockActionKind;
  products: ProductOption[];
  defaultProductId?: string;
  onDone?: () => void;
}) {
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const copy = COPY[kind];
  const product = products.find((p) => p.id === productId);

  const { onSubmit, pending, fieldErrors: fe } = useConfirmedFormAction(stockMovementAction.bind(null, kind), {
    loading: copy.loading,
    confirm: (fd) => {
      const p = products.find((x) => x.id === fd.get("productId"));
      const qty = Number(fd.get("quantity"));
      // Let the server explain missing or invalid values; only confirm a complete entry.
      if (!p || !Number.isFinite(qty) || qty <= 0) return null;
      const after = p.stockQty + copy.sign * qty;
      return {
        title: `${copy.verb} ${formatQty(qty, p.unit)} of ${p.name}?`,
        description: "This is recorded in stock history and the audit log with your name.",
        details: [
          { label: "On hand now", value: formatQty(p.stockQty, p.unit) },
          { label: copy.sign > 0 ? "Adding" : "Removing", value: `${copy.sign > 0 ? "+" : "−"}${formatQty(qty, p.unit)}` },
          { label: "On hand after", value: formatQty(Math.max(0, after), p.unit) },
          ...(fd.get("reason") ? [{ label: "Note", value: String(fd.get("reason")) }] : []),
        ],
        confirmLabel: copy.submit,
        tone: kind === "SPOILAGE" ? "destructive" : kind === "WITHDRAWAL" ? "warning" : "default",
      };
    },
    onSuccess: (_res, form) => {
      form?.reset();
      onDone?.();
    },
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Product" htmlFor="productId" error={errorFor(fe, "productId")}>
        <ProductSelect products={products} value={productId} onChange={setProductId} invalid={!!errorFor(fe, "productId")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={copy.qtyLabel}
          htmlFor="quantity"
          error={errorFor(fe, "quantity")}
          hint={
            product && kind !== "STOCK_IN" && kind !== "RETURN"
              ? `${formatQty(product.available, product.unit)} not reserved for orders`
              : product
                ? `In ${unitLabel(product.unit)}`
                : undefined
          }
        >
          <div className="relative">
            <Input id="quantity" name="quantity" inputMode="decimal" placeholder="0" className="num pr-12" aria-invalid={!!errorFor(fe, "quantity")} />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              {product ? unitLabel(product.unit) : ""}
            </span>
          </div>
        </Field>
        {kind === "RETURN" && (
          <Field label="Order number" htmlFor="orderNumber" optional error={errorFor(fe, "orderNumber")}>
            <Input id="orderNumber" name="orderNumber" inputMode="numeric" placeholder="e.g. 1042" className="num" />
          </Field>
        )}
      </div>
      <Field label={copy.reasonLabel} htmlFor="reason" optional={kind !== "SPOILAGE"} error={errorFor(fe, "reason")}>
        <Textarea id="reason" name="reason" placeholder={copy.placeholder} maxLength={200} className="min-h-20" />
      </Field>
      <div>
        <SubmitButton pending={pending} variant={kind === "SPOILAGE" ? "destructive" : "default"}>
          {copy.submit}
        </SubmitButton>
      </div>
    </form>
  );
}

export function CountCorrectionForm({
  products,
  defaultProductId,
  onDone,
}: {
  products: ProductOption[];
  defaultProductId?: string;
  onDone?: () => void;
}) {
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const product = products.find((p) => p.id === productId);
  const { onSubmit, pending, fieldErrors: fe } = useConfirmedFormAction(countCorrectionAction, {
    loading: "Saving the count…",
    confirm: (fd) => {
      const p = products.find((x) => x.id === fd.get("productId"));
      const counted = Number(fd.get("countedQty"));
      if (!p || fd.get("countedQty") === "" || !Number.isFinite(counted)) return null;
      const delta = counted - p.stockQty;
      return {
        title: `Set ${p.name} to ${formatQty(counted, p.unit)}?`,
        description: "On-hand stock will match your physical count. The difference is logged as a correction.",
        details: [
          { label: "System count", value: formatQty(p.stockQty, p.unit) },
          { label: "Your count", value: formatQty(counted, p.unit) },
          { label: "Difference", value: `${delta >= 0 ? "+" : "−"}${formatQty(Math.abs(delta), p.unit)}` },
        ],
        confirmLabel: "Save count",
        tone: "warning",
      };
    },
    onSuccess: () => onDone?.(),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Product" htmlFor="productId" error={errorFor(fe, "productId")}>
        <ProductSelect products={products} value={productId} onChange={setProductId} />
      </Field>
      <Field
        label="Counted quantity on hand"
        htmlFor="countedQty"
        error={errorFor(fe, "countedQty")}
        hint={product ? `System says ${formatQty(product.stockQty, product.unit)}` : "Weigh or count what’s physically in the chiller"}
      >
        <Input id="countedQty" name="countedQty" inputMode="decimal" className="num" aria-invalid={!!errorFor(fe, "countedQty")} />
      </Field>
      <Field label="Reason" htmlFor="reason" error={errorFor(fe, "reason")}>
        <Textarea id="reason" name="reason" placeholder="e.g. End-of-day physical count" maxLength={200} className="min-h-20" />
      </Field>
      <div>
        <SubmitButton pending={pending}>Save count</SubmitButton>
      </div>
    </form>
  );
}
