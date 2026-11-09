import Link from "next/link";
import { History } from "lucide-react";
import { EmptyState } from "@/components/page";
import { StockTxnBadge } from "@/components/status";
import { formatDateTime, formatQty, orderCode } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockTxnView } from "@/server/queries/inventory";

export function TransactionsTable({ txns, orderHref }: { txns: StockTxnView[]; orderHref?: (id: string) => string }) {
  if (txns.length === 0) {
    return <EmptyState icon={History} title="No stock movements" description="Nothing matches these filters yet." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">When</th>
            <th className="px-3 py-3 font-medium">Product</th>
            <th className="px-3 py-3 font-medium">Type</th>
            <th className="px-3 py-3 text-right font-medium">Change</th>
            <th className="px-3 py-3 text-right font-medium">Balance</th>
            <th className="px-3 py-3 font-medium">Details</th>
            <th className="px-5 py-3 font-medium">By</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {txns.map((t) => (
            <tr key={t.id}>
              <td className="num px-5 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(t.createdAt)}</td>
              <td className="px-3 py-3 font-medium">{t.product.name}</td>
              <td className="px-3 py-3">
                <StockTxnBadge type={t.type} />
              </td>
              <td
                className={cn(
                  "num px-3 py-3 text-right font-medium whitespace-nowrap",
                  t.quantity > 0 ? "text-emerald-700" : "text-foreground",
                )}
              >
                {t.quantity > 0 ? "+" : "−"}
                {formatQty(Math.abs(t.quantity), t.product.unit)}
              </td>
              <td className="num px-3 py-3 text-right whitespace-nowrap text-muted-foreground">
                {formatQty(t.balanceAfter, t.product.unit)}
              </td>
              <td className="max-w-72 px-3 py-3">
                <span className="line-clamp-2 text-muted-foreground">
                  {t.order && orderHref ? (
                    <Link href={orderHref(t.order.id)} className="num font-medium text-primary hover:underline">
                      {orderCode(t.order.number)}
                    </Link>
                  ) : null}
                  {t.order && orderHref && t.reason && !t.reason.startsWith("Order") ? " · " : ""}
                  {t.order && orderHref && t.reason?.startsWith("Order") ? "" : t.reason}
                </span>
              </td>
              <td className="px-5 py-3 whitespace-nowrap">{t.actor?.name ?? "System"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
