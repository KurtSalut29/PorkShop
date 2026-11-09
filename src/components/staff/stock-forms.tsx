"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { countCorrectionAction, stockMovementAction, type StockActionKind } from "@/app/actions/inventory";
import { errorFor, Field, FormAlert, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatQty, unitLabel } from "@/lib/format";
import type { ProductOption } from "@/server/queries/inventory";

const COPY: Record<StockActionKind, { submit: string; qtyLabel: string; reasonLabel: string; placeholder: string }> = {
  STOCK_IN: {
    submit: "Add stock",
    qtyLabel: "Quantity received",
    reasonLabel: "Supplier / reference",
    placeholder: "e.g. Delivery from Batangas farm, DR #1042",
  },
  WITHDRAWAL: {
    submit: "Record withdrawal",
    qtyLabel: "Quantity taken out",
    reasonLabel: "Reason",
    placeholder: "e.g. Walk-in sale, transfer to kitchen",
  },
  RETURN: {
    submit: "Record return",
    qtyLabel: "Quantity returned",
    reasonLabel: "Reason",
    placeholder: "e.g. Customer returned unused portion",
  },
  SPOILAGE: {
    submit: "Record spoilage",
    qtyLabel: "Quantity written off",
    reasonLabel: "What happened?",
    placeholder: "e.g. Discoloured, past freshness window",
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
  const [state, action] = useActionState(stockMovementAction.bind(null, kind), null);
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const copy = COPY[kind];
  const product = products.find((p) => p.id === productId);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      formRef.current?.reset();
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      {state && !state.ok && <FormAlert state={state} />}
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
              ? `${formatQty(product.available, product.unit)} unreserved`
              : product
                ? `In ${unitLabel(product.unit)}`
                : undefined
          }
        >
          <div className="relative">
            <Input
              id="quantity"
              name="quantity"
              inputMode="decimal"
              placeholder="0"
              className="num pr-12"
              aria-invalid={!!errorFor(fe, "quantity")}
            />
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
        <SubmitButton variant={kind === "SPOILAGE" ? "destructive" : "default"}>{copy.submit}</SubmitButton>
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
  const [state, action] = useActionState(countCorrectionAction, null);
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const product = products.find((p) => p.id === productId);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="grid gap-4">
      {state && !state.ok && <FormAlert state={state} />}
      <Field label="Product" htmlFor="productId" error={errorFor(fe, "productId")}>
        <ProductSelect products={products} value={productId} onChange={setProductId} />
      </Field>
      <Field
        label="Counted quantity on hand"
        htmlFor="countedQty"
        error={errorFor(fe, "countedQty")}
        hint={product ? `System says ${formatQty(product.stockQty, product.unit)}` : "Weigh or count what's physically in the chiller"}
      >
        <Input id="countedQty" name="countedQty" inputMode="decimal" className="num" aria-invalid={!!errorFor(fe, "countedQty")} />
      </Field>
      <Field label="Reason" htmlFor="reason" error={errorFor(fe, "reason")}>
        <Textarea id="reason" name="reason" placeholder="e.g. End-of-day physical count" maxLength={200} className="min-h-20" />
      </Field>
      <div>
        <SubmitButton>Save count</SubmitButton>
      </div>
    </form>
  );
}
