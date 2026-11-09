import { cn } from "@/lib/utils";
import {
  DUTY_STATUS,
  ORDER_STATUS,
  PAYMENT_METHOD_LABEL,
  STOCK_TXN,
  TONE_CLASSES,
  TONE_DOT,
  type DutyStatus,
  type OrderStatus,
  type PaymentMethod,
  type StockTxnType,
  type Tone,
} from "@/lib/constants";

export function ToneBadge({
  tone,
  children,
  dot = false,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function OrderStatusBadge({
  status,
  audience = "staff",
  className,
}: {
  status: OrderStatus;
  audience?: "staff" | "customer";
  className?: string;
}) {
  const meta = ORDER_STATUS[status];
  return (
    <ToneBadge tone={meta.tone} dot className={className}>
      {audience === "customer" ? meta.customerLabel : meta.label}
    </ToneBadge>
  );
}

export function DutyBadge({ status }: { status: DutyStatus }) {
  const meta = DUTY_STATUS[status];
  return (
    <ToneBadge tone={meta.tone} dot>
      {meta.label}
    </ToneBadge>
  );
}

export function StockLevelBadge({ level }: { level: "ok" | "low" | "out" }) {
  if (level === "out") return <ToneBadge tone="red">Out of stock</ToneBadge>;
  if (level === "low") return <ToneBadge tone="amber">Low stock</ToneBadge>;
  return <ToneBadge tone="emerald">In stock</ToneBadge>;
}

export function PaymentBadge({ status, method }: { status: "PAID" | "UNPAID"; method?: PaymentMethod | null }) {
  return status === "PAID" ? (
    <ToneBadge tone="emerald">Paid{method ? ` · ${PAYMENT_METHOD_LABEL[method]}` : ""}</ToneBadge>
  ) : (
    <ToneBadge tone="stone">Pay at pickup</ToneBadge>
  );
}

export function StockTxnBadge({ type }: { type: StockTxnType }) {
  const meta = STOCK_TXN[type];
  return <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}
