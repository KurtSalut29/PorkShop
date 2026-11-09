/** Client-side estimates. The server recomputes every total with exact decimals. */
export function lineEstimate(price: number, qty: number) {
  return Math.round(price * qty * 100) / 100;
}

const EPS = 1e-9;

export type QtyRule = { unit: "KG" | "PIECE"; minOrderQty: number; qtyStep: number };

/** Returns an error message, or null when the quantity is valid for the product. */
export function validateQty(qty: number, rule: QtyRule): string | null {
  if (!Number.isFinite(qty) || qty <= 0) return "Enter a quantity greater than zero.";
  if (rule.unit === "PIECE" && !Number.isInteger(qty)) return "Pieces must be whole numbers.";
  if (qty + EPS < rule.minOrderQty)
    return `Minimum order is ${rule.minOrderQty}${rule.unit === "KG" ? " kg" : " pc"}.`;
  const steps = qty / rule.qtyStep;
  if (Math.abs(steps - Math.round(steps)) > 1e-6)
    return `Quantity must be in steps of ${rule.qtyStep}${rule.unit === "KG" ? " kg" : " pc"}.`;
  return null;
}

/** Snap a value onto the product's quantity grid (used by steppers). */
export function snapQty(qty: number, rule: QtyRule) {
  const snapped = Math.round(qty / rule.qtyStep) * rule.qtyStep;
  return Math.max(rule.minOrderQty, Math.round(snapped * 1000) / 1000);
}

export function stockLevel(available: number, threshold: number): "out" | "low" | "ok" {
  if (available <= EPS) return "out";
  if (available <= threshold + EPS) return "low";
  return "ok";
}
