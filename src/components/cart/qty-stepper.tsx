"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { snapQty, type QtyRule } from "@/lib/pricing";
import { unitLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Quantity input that respects each product's minimum and step (e.g. 0.25 kg or 1 pc). */
export function QtyStepper({
  value,
  onChange,
  rule,
  max,
  size = "default",
  className,
  id,
}: {
  value: number;
  onChange: (qty: number) => void;
  rule: QtyRule;
  max?: number;
  size?: "default" | "sm";
  className?: string;
  id?: string;
}) {
  // While typing we hold a draft; otherwise the field always shows the committed value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);

  const clamp = (q: number) => {
    let next = snapQty(q, rule);
    if (max !== undefined && max >= rule.minOrderQty) next = Math.min(next, Math.floor(max / rule.qtyStep) * rule.qtyStep);
    return Math.round(next * 1000) / 1000;
  };

  const step = (dir: 1 | -1) => onChange(clamp(value + dir * rule.qtyStep));
  const atMin = value <= rule.minOrderQty + 1e-9;
  const atMax = max !== undefined && value + rule.qtyStep > max + 1e-9;
  const h = size === "sm" ? "h-8" : "h-10";

  return (
    <div className={cn("inline-flex items-stretch rounded-lg border bg-card", h, className)}>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={atMin}
        className="grid w-9 place-items-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </button>
      <label className="flex items-center gap-1 border-x px-2">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Number(text);
            const next = Number.isFinite(n) && n > 0 ? clamp(n) : value;
            setDraft(null);
            onChange(next);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="num w-12 bg-transparent text-center text-sm font-medium outline-none"
          aria-label={`Quantity in ${unitLabel(rule.unit)}`}
        />
        <span className="text-xs text-muted-foreground">{unitLabel(rule.unit, value !== 1)}</span>
      </label>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={atMax}
        className="grid w-9 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
