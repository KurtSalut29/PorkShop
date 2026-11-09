import { notFound } from "next/navigation";
import { StaffOrderDetail } from "@/components/staff/order-detail";
import { OrderWorkflow } from "@/components/staff/order-workflow";
import { requireRole } from "@/server/dal";
import { getWorkerOrder } from "@/server/queries/orders";
import { getSettings } from "@/server/settings";

export default async function WorkerOrderPage({ params }: PageProps<"/worker/orders/[id]">) {
  const user = await requireRole("WORKER");
  const { id } = await params;
  const [order, settings] = await Promise.all([getWorkerOrder(user.id, id), getSettings()]);
  if (!order) notFound();
  return (
    <StaffOrderDetail
      order={order}
      slotMinutes={settings.slotMinutes}
      back={{ href: "/worker/orders", label: "My orders" }}
      sidebarTop={<OrderWorkflow order={order} />}
    />
  );
}
