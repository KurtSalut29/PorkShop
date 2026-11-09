import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { itemsSummary } from "@/components/orders/order-parts";
import { EmptyState, PageHeader, Section } from "@/components/page";
import { OrderStatusBadge } from "@/components/status";
import { formatDateTime, formatPeso, orderCode } from "@/lib/format";
import { requireRole } from "@/server/dal";
import { listWorkerHistory } from "@/server/queries/orders";

export const metadata: Metadata = { title: "Order history" };

export default async function WorkerHistoryPage() {
  const user = await requireRole("WORKER");
  const orders = await listWorkerHistory(user.id);
  return (
    <>
      <PageHeader title="Order history" description="Orders you completed, plus ones that were cancelled or reassigned." />
      <Section>
        {orders.length === 0 ? (
          <EmptyState icon={History} title="No past orders yet" description="Completed orders will be listed here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Items</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Finished</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => {
                  const mine = o.worker?.id === user.id;
                  return (
                    <tr key={o.id} className="hover:bg-muted/40">
                      <td className="num px-5 py-3 font-medium">
                        {mine ? (
                          <Link href={`/worker/orders/${o.id}`} className="text-primary hover:underline">
                            {orderCode(o.number)}
                          </Link>
                        ) : (
                          orderCode(o.number)
                        )}
                      </td>
                      <td className="px-3 py-3">{o.customer.name}</td>
                      <td className="max-w-64 truncate px-3 py-3 text-muted-foreground">{itemsSummary(o)}</td>
                      <td className="px-3 py-3">
                        {mine ? <OrderStatusBadge status={o.status} /> : <span className="text-xs text-muted-foreground">Reassigned to {o.worker?.name ?? "queue"}</span>}
                      </td>
                      <td className="num px-3 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(o.completedAt ?? o.cancelledAt ?? o.createdAt)}
                      </td>
                      <td className="num px-5 py-3 text-right font-medium">{formatPeso(o.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
