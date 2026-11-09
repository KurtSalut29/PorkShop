export type Role = "OWNER" | "WORKER" | "CUSTOMER";
export type OrderStatus = "PENDING" | "ASSIGNED" | "PROCESSING" | "READY" | "COMPLETED" | "CANCELLED";
export type DutyStatus = "ON_DUTY" | "ON_BREAK" | "OFF_DUTY";
export type ProductCategory = "PRIME_CUTS" | "RIBS_AND_BONES" | "GROUND" | "SPECIALTY" | "FAT";
export type StockTxnType = "STOCK_IN" | "WITHDRAWAL" | "RETURN" | "SPOILAGE" | "CORRECTION";
export type PaymentMethod = "CASH" | "GCASH" | "CARD";

export function homeFor(role: Role | string) {
  if (role === "OWNER") return "/owner";
  if (role === "WORKER") return "/worker";
  return "/shop";
}

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  WORKER: "Worker",
  CUSTOMER: "Customer",
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "PENDING",
  "ASSIGNED",
  "PROCESSING",
  "READY",
  "COMPLETED",
];

export const ORDER_STATUS: Record<
  OrderStatus,
  { label: string; customerLabel: string; description: string; tone: Tone }
> = {
  PENDING: {
    label: "In queue",
    customerLabel: "Order received",
    description: "Waiting for an available worker",
    tone: "amber",
  },
  ASSIGNED: {
    label: "Assigned",
    customerLabel: "Assigned to staff",
    description: "A worker has been assigned",
    tone: "sky",
  },
  PROCESSING: {
    label: "Processing",
    customerLabel: "Being prepared",
    description: "Your meat is being cut and weighed",
    tone: "violet",
  },
  READY: {
    label: "Ready for pickup",
    customerLabel: "Ready for pickup",
    description: "Packed and waiting at the counter",
    tone: "emerald",
  },
  COMPLETED: {
    label: "Completed",
    customerLabel: "Picked up",
    description: "Handed over to the customer",
    tone: "stone",
  },
  CANCELLED: {
    label: "Cancelled",
    customerLabel: "Cancelled",
    description: "This order was cancelled",
    tone: "red",
  },
};

export const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "ASSIGNED", "PROCESSING", "READY"];
/** Statuses that count toward a worker's workload when balancing assignments. */
export const WORKLOAD_STATUSES: OrderStatus[] = ["ASSIGNED", "PROCESSING"];

export const DUTY_STATUS: Record<DutyStatus, { label: string; tone: Tone; hint: string }> = {
  ON_DUTY: { label: "On duty", tone: "emerald", hint: "Receiving new orders" },
  ON_BREAK: { label: "On break", tone: "amber", hint: "Keeps current orders, no new ones" },
  OFF_DUTY: { label: "Off duty", tone: "stone", hint: "Unstarted orders return to the queue" },
};

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  PRIME_CUTS: "Prime cuts",
  RIBS_AND_BONES: "Ribs & bones",
  GROUND: "Ground pork",
  SPECIALTY: "Specialty cuts",
  FAT: "Fat & lard",
};

export const STOCK_TXN: Record<StockTxnType, { label: string; tone: Tone }> = {
  STOCK_IN: { label: "Stock in", tone: "emerald" },
  WITHDRAWAL: { label: "Withdrawal", tone: "sky" },
  RETURN: { label: "Return", tone: "violet" },
  SPOILAGE: { label: "Spoilage", tone: "red" },
  CORRECTION: { label: "Count correction", tone: "amber" },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  GCASH: "GCash",
  CARD: "Card",
};

export type Tone = "amber" | "sky" | "violet" | "emerald" | "stone" | "red" | "primary";

export const TONE_CLASSES: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  sky: "bg-sky-50 text-sky-800 ring-sky-600/20",
  violet: "bg-violet-50 text-violet-800 ring-violet-600/20",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  stone: "bg-stone-100 text-stone-700 ring-stone-500/20",
  red: "bg-red-50 text-red-800 ring-red-600/20",
  primary: "bg-primary/10 text-primary ring-primary/20",
};

export const TONE_DOT: Record<Tone, string> = {
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  stone: "bg-stone-400",
  red: "bg-red-500",
  primary: "bg-primary",
};
