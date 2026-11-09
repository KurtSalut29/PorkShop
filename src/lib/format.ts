/** The shop runs on Philippine time (UTC+8, no daylight saving). */
export const SHOP_TZ = "Asia/Manila";

const pesoFmt = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 3 });
const intFmt = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

export function formatPeso(value: number) {
  return pesoFmt.format(value);
}

export function formatNumber(value: number) {
  return numberFmt.format(value);
}

export function formatInt(value: number) {
  return intFmt.format(value);
}

export type Unit = "KG" | "PIECE";

export function unitLabel(unit: Unit, plural = true) {
  if (unit === "KG") return "kg";
  return plural ? "pcs" : "pc";
}

/** "1.25 kg", "2 pcs", "1 pc" */
export function formatQty(qty: number, unit: Unit) {
  if (unit === "KG") return `${numberFmt.format(qty)} kg`;
  return `${intFmt.format(qty)} ${qty === 1 ? "pc" : "pcs"}`;
}

/** "₱340.00 / kg" */
export function formatUnitPrice(price: number, unit: Unit) {
  return `${formatPeso(price)} / ${unitLabel(unit, false)}`;
}

const dateTimeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: SHOP_TZ,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: SHOP_TZ,
  month: "short",
  day: "numeric",
  year: "numeric",
});
const shortDateFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: SHOP_TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: SHOP_TZ,
  hour: "numeric",
  minute: "2-digit",
});

const toDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

export const formatDateTime = (d: Date | string) => dateTimeFmt.format(toDate(d));
export const formatDate = (d: Date | string) => dateFmt.format(toDate(d));
export const formatShortDate = (d: Date | string) => shortDateFmt.format(toDate(d));
export const formatTime = (d: Date | string) => timeFmt.format(toDate(d));

/** "#000123" */
export function orderCode(n: number) {
  return `#${String(n).padStart(6, "0")}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
