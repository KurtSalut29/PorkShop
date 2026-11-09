import { StockLevelBadge } from "@/components/status";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatPeso, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductView } from "@/server/queries/catalog";

/** Stock levels with an availability bar: on-hand = reserved for orders + available to sell. */
export function InventoryTable({
  products,
  actions,
  highlightId,
  showValue = false,
}: {
  products: ProductView[];
  actions?: (p: ProductView) => React.ReactNode;
  highlightId?: string;
  showValue?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
            <th className="px-5 py-3 font-semibold">Product</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 text-right font-semibold">On hand</th>
            <th className="px-3 py-3 text-right font-semibold">Reserved</th>
            <th className="px-3 py-3 text-right font-semibold">Available</th>
            <th className="w-40 px-3 py-3 font-semibold">
              <span className="sr-only">Availability</span>
            </th>
            {showValue && <th className="px-3 py-3 text-right font-semibold">Stock value</th>}
            {actions && <th className="px-5 py-3 text-right font-semibold">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((p) => {
            const reservedPct = p.stockQty > 0 ? (p.reservedQty / p.stockQty) * 100 : 0;
            const ceiling = Math.max(p.stockQty, p.lowStockThreshold * 3, 1);
            const fillPct = Math.min(100, (p.stockQty / ceiling) * 100);
            const thresholdPct = Math.min(100, (p.lowStockThreshold / ceiling) * 100);
            return (
              <tr key={p.id} className={cn(highlightId === p.id && "bg-amber-50/60")} id={`product-${p.id}`}>
                <td className="px-5 py-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.sku} · {CATEGORY_LABEL[p.category]}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <StockLevelBadge level={p.level} />
                </td>
                <td className="num px-3 py-3 text-right">{formatQty(p.stockQty, p.unit)}</td>
                <td className="num px-3 py-3 text-right text-muted-foreground">{formatQty(p.reservedQty, p.unit)}</td>
                <td
                  className={cn(
                    "num px-3 py-3 text-right font-semibold",
                    p.level === "out" && "text-red-700",
                    p.level === "low" && "text-amber-700",
                  )}
                >
                  {formatQty(p.available, p.unit)}
                </td>
                <td className="px-3 py-3">
                  <div
                    className="relative h-2 overflow-hidden rounded-full bg-muted"
                    title={`Alert level ${formatQty(p.lowStockThreshold, p.unit)}`}
                  >
                    <div className="absolute inset-y-0 left-0 flex" style={{ width: `${fillPct}%` }}>
                      <div className="h-full bg-stone-400" style={{ width: `${reservedPct}%` }} />
                      <div
                        className={cn(
                          "h-full flex-1",
                          p.level === "ok" ? "bg-emerald-500" : p.level === "low" ? "bg-amber-500" : "bg-red-500",
                        )}
                      />
                    </div>
                    <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${thresholdPct}%` }} />
                  </div>
                </td>
                {showValue && <td className="num px-3 py-3 text-right">{formatPeso(p.stockQty * p.price)}</td>}
                {actions && <td className="px-5 py-3 text-right">{actions(p)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="flex flex-wrap gap-x-5 gap-y-1 border-t px-5 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-stone-400" /> Reserved for open orders
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" /> Available to sell
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-px bg-foreground/40" /> Low-stock alert level
        </span>
      </p>
    </div>
  );
}
