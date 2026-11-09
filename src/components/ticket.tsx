import { cn } from "@/lib/utils";

/**
 * The scale ticket: Porkshop's signature element. Modelled on the label a meat scale prints:
 * perforated edges, receipt mono figures and dotted leaders. Used wherever money or weight is
 * the point: prices, cart and order totals, confirmations.
 */
export function Ticket({
  heading,
  meta,
  lines,
  total,
  footnote,
  className,
}: {
  heading?: React.ReactNode;
  meta?: React.ReactNode;
  lines: { label: React.ReactNode; value: React.ReactNode; muted?: boolean; struck?: boolean }[];
  total?: { label: React.ReactNode; value: React.ReactNode };
  footnote?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ticket px-5 pt-6 pb-6 text-[13px]", className)}>
      {(heading || meta) && (
        <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-dashed border-ticket-rule pb-3">
          {heading && <span className="text-[11px] font-semibold tracking-[0.18em] uppercase">{heading}</span>}
          {meta && <span className="text-[11px] text-ticket-ink/60">{meta}</span>}
        </div>
      )}
      <dl className="space-y-1.5">
        {lines.map((l, i) => (
          <div key={i} className={cn("ticket-leader", l.muted && "text-ticket-ink/60")}>
            <dt className="min-w-0 truncate">{l.label}</dt>
            <dd className={cn("shrink-0 text-right tabular-nums", l.struck && "line-through decoration-1")}>{l.value}</dd>
          </div>
        ))}
      </dl>
      {total && (
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-ticket-ink/80 pt-3">
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase">{total.label}</span>
          <span className="text-xl font-semibold tabular-nums">{total.value}</span>
        </div>
      )}
      {footnote && <p className="mt-3 font-sans text-[12px] leading-relaxed text-ticket-ink/65">{footnote}</p>}
    </div>
  );
}

/** Compact price label for product cards: "₱390.00 /KG". */
export function PriceTag({ price, unit, className }: { price: string; unit: string; className?: string }) {
  return (
    <span className={cn("ticket inline-flex items-baseline gap-1 px-2.5 py-1.5 leading-none", className)}>
      <span className="text-[15px] font-semibold tabular-nums">{price}</span>
      <span className="text-[10px] font-medium tracking-wider uppercase opacity-70">/{unit}</span>
    </span>
  );
}
