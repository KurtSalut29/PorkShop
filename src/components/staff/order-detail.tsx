import { CalendarClock, Mail, MessageSquareText, Phone, UserRound } from "lucide-react";
import { OrderItemsTable, OrderProgress, OrderTimeline } from "@/components/orders/order-parts";
import { PageHeader, Section } from "@/components/page";
import { OrderStatusBadge, PaymentBadge } from "@/components/status";
import { formatDateTime, formatShortDate, orderCode } from "@/lib/format";
import { formatSlotRange } from "@/lib/slots";
import type { OrderDetail } from "@/server/queries/orders";

/** Order detail layout shared by the worker and owner consoles. */
export function StaffOrderDetail({
  order,
  slotMinutes,
  back,
  actions,
  sidebarTop,
}: {
  order: OrderDetail;
  slotMinutes: number;
  back: { href: string; label: string };
  actions?: React.ReactNode;
  sidebarTop?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{orderCode(order.number)}</span>
            <OrderStatusBadge status={order.status} />
          </span>
        }
        description={`Placed ${formatDateTime(order.createdAt)}`}
        actions={actions}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section>
            <div className="p-5 sm:p-6">
              <OrderProgress order={order} audience="staff" />
            </div>
          </Section>
          <Section title="Items">
            <OrderItemsTable order={order} />
          </Section>
          <Section title="Activity">
            <div className="p-5">
              <OrderTimeline events={order.events} />
            </div>
          </Section>
        </div>
        <div className="space-y-6">
          {sidebarTop}
          <Section title="Pickup details">
            <dl className="space-y-4 p-5 text-sm">
              <Row icon={CalendarClock} label="Pickup">
                <span className="num">
                  {formatShortDate(order.pickupAt)}, {formatSlotRange(order.pickupAt, slotMinutes)}
                </span>
              </Row>
              <Row icon={UserRound} label="Customer">
                {order.customer.name}
              </Row>
              {order.customer.phone && (
                <Row icon={Phone} label="Mobile">
                  <a href={`tel:${order.customer.phone}`} className="num text-primary hover:underline">
                    {order.customer.phone}
                  </a>
                </Row>
              )}
              <Row icon={Mail} label="Email">
                <span className="break-all">{order.customer.email}</span>
              </Row>
              {order.notes && (
                <Row icon={MessageSquareText} label="Customer notes">
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-950">{order.notes}</span>
                </Row>
              )}
              <div>
                <dt className="mb-1 text-muted-foreground">Payment</dt>
                <dd>
                  <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} />
                </dd>
              </div>
            </dl>
          </Section>
        </div>
      </div>
    </>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-medium">{children}</dd>
      </div>
    </div>
  );
}
