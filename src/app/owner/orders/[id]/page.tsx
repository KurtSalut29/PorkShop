import { notFound } from "next/navigation";
import { StaffOrderDetail } from "@/components/staff/order-detail";
import { OrderWorkflow } from "@/components/staff/order-workflow";
import { requireRole } from "@/server/dal";
import { getOrderForOwner, listAssignableWorkers } from "@/server/queries/orders";
import { getSettings } from "@/server/settings";
import { CancelRequestPanel, OwnerCancelDialog, PaymentControl, ReassignDialog } from "./owner-controls";

export default async function OwnerOrderPage({ params }: PageProps<"/owner/orders/[id]">) {
  await requireRole("OWNER");
  const { id } = await params;
  const [order, workers, settings] = await Promise.all([getOrderForOwner(id), listAssignableWorkers(), getSettings()]);
  if (!order) notFound();
  const open = !["COMPLETED", "CANCELLED"].includes(order.status);

  return (
    <StaffOrderDetail
      order={order}
      slotMinutes={settings.slotMinutes}
      back={{ href: "/owner/orders", label: "Orders" }}
      actions={
        open && (
          <>
            <ReassignDialog order={order} workers={workers} />
            <OwnerCancelDialog order={order} />
          </>
        )
      }
      sidebarTop={
        <>
          {order.cancelRequest === "PENDING" && open && <CancelRequestPanel order={order} />}
          {order.worker && open && (
            <section className="rounded-xl border bg-card p-5 text-sm shadow-xs">
              <p className="text-muted-foreground">Assigned worker</p>
              <p className="mt-0.5 font-medium">{order.worker.name}</p>
              {(!order.worker.active || order.worker.dutyStatus === "OFF_DUTY") && (
                <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-amber-900">
                  {order.worker.active ? "This worker is off duty." : "This worker was deactivated."} Consider reassigning.
                </p>
              )}
            </section>
          )}
          {open && order.status !== "PENDING" && (
            <details className="group rounded-xl border bg-card shadow-xs">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium">
                Act on behalf of the worker <span className="text-muted-foreground group-open:hidden">▾</span>
              </summary>
              <div className="border-t p-3">
                <OrderWorkflow order={order} />
              </div>
            </details>
          )}
          <PaymentControl order={order} />
        </>
      }
    />
  );
}
