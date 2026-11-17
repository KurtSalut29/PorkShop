import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Banknote, CalendarClock, PartyPopper, UserRound } from "lucide-react";
import { OrderItemsTable, OrderProgress, OrderTimeline } from "@/components/orders/order-parts";
import { Container, PageHeader, PageSkeleton, Section } from "@/components/page";
import { OrderStatusBadge, PaymentBadge } from "@/components/status";
import { ORDER_STATUS } from "@/lib/constants";
import { formatDateTime, formatPeso, formatShortDate, formatTime, orderCode } from "@/lib/format";
import { formatSlotRange } from "@/lib/slots";
import { requireRole } from "@/server/dal";
import { getCustomerOrder } from "@/server/queries/orders";
import { getSettings } from "@/server/settings";
import { CancelOrderButton } from "./cancel-order";
import { GcashPayment } from "./gcash-payment";

export default function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  return (
    <Container className="py-8 sm:py-10">
      <Suspense fallback={<PageSkeleton />}>
        <OrderDetailView params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function OrderDetailView({
  params,
  searchParams,
}: {
  params: PageProps<"/orders/[id]">["params"];
  searchParams: PageProps<"/orders/[id]">["searchParams"];
}) {
  const user = await requireRole("CUSTOMER");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [order, settings] = await Promise.all([getCustomerOrder(user.id, id), getSettings()]);
  if (!order) notFound();

  const canCancel = ["AWAITING_PAYMENT", "PENDING", "ASSIGNED"].includes(order.status);
  const open = order.status !== "CANCELLED" && order.status !== "COMPLETED";
  const gcash = order.paymentMethod === "GCASH";
  const canRequest = order.status === "PROCESSING" && order.cancelRequest === "NONE";

  return (
    <>
      {sp.placed && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <PartyPopper className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Thank you! Your order has been placed.</p>
            <p className="mt-0.5 text-emerald-900/80">
              {gcash && order.paymentStatus === "UNPAID"
                ? `Complete your GCash payment below within ${settings.paymentWindowMinutes} minutes to secure it.`
                : "We’ll notify you as soon as a butcher picks it up and again when it’s ready."}
            </p>
          </div>
        </div>
      )}
      <PageHeader
        back={{ href: "/orders", label: "All orders" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Order <span className="num">{orderCode(order.number)}</span>
            <OrderStatusBadge status={order.status} audience="customer" />
          </span>
        }
        description={`Placed ${formatDateTime(order.createdAt)} · ${ORDER_STATUS[order.status].description}`}
        actions={
          (canCancel || canRequest) && <CancelOrderButton orderId={order.id} mode={canCancel ? "cancel" : "request"} />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {gcash && open && (
            <GcashPayment
              orderId={order.id}
              amount={order.estimatedTotal}
              dueAt={order.paymentDueAt}
              paymentStatus={order.paymentStatus}
              proof={order.proof}
              gcash={{ name: settings.gcashName, number: settings.gcashNumber, qrUrl: settings.gcashQrUrl }}
            />
          )}
          {!gcash && open && order.paymentStatus !== "PAID" && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950 sm:p-5">
              <Banknote className="mt-0.5 size-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-medium">
                  Pay {formatPeso(order.total)}
                  {order.finalTotal === null ? " (estimate)" : ""} in cash at pickup.
                </p>
                <p className="mt-0.5 text-amber-900/80">
                  {order.pickupDeadline
                    ? <>Please pick up your order by <span className="num font-medium">{formatShortDate(order.pickupDeadline)}, {formatTime(order.pickupDeadline)}</span>. Orders not collected by then are released.</>
                    : `Please pick up your order within ${settings.pickupHoldHours} hour${settings.pickupHoldHours > 1 ? "s" : ""} of your pickup time.`}
                </p>
              </div>
            </div>
          )}
          <Section>
            <div className="p-5 sm:p-6">
              <OrderProgress order={order} />
              {order.cancelRequest === "PENDING" && (
                <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  You asked to cancel this order. The shop will confirm shortly.
                </p>
              )}
              {order.cancelRequest === "REJECTED" && order.status !== "CANCELLED" && (
                <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Your cancellation request was declined because the order was already being prepared.
                </p>
              )}
            </div>
          </Section>
          <Section title="Items">
            <OrderItemsTable order={order} />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Pickup">
            <dl className="space-y-4 p-5 text-sm">
              <div className="flex gap-3">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">Pickup time</dt>
                  <dd className="num font-medium">
                    {formatShortDate(order.pickupAt)}, {formatSlotRange(order.pickupAt, settings.slotMinutes)}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-muted-foreground">Prepared by</dt>
                  <dd className="font-medium">{order.worker ? order.worker.name.split(" ")[0] : "Waiting for an available butcher"}</dd>
                </div>
              </div>
              <div>
                <dt className="mb-1 text-muted-foreground">Payment</dt>
                <dd>
                  <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} />
                </dd>
              </div>
              {order.notes && (
                <div>
                  <dt className="text-muted-foreground">Your notes</dt>
                  <dd className="mt-0.5">{order.notes}</dd>
                </div>
              )}
            </dl>
          </Section>
          <Section title="Activity">
            <div className="p-5">
              <OrderTimeline events={order.events} />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
