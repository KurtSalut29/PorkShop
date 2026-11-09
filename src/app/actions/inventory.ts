"use server";

import { refresh } from "next/cache";
import { countCorrectionSchema, fieldErrors, returnSchema, stockMovementSchema } from "@/lib/validation";
import { assertRole } from "@/server/dal";
import { toActionError, type ActionResult } from "@/server/errors";
import * as inventory from "@/server/inventory";

export type StockActionKind = "STOCK_IN" | "SPOILAGE" | "WITHDRAWAL" | "RETURN";

const PERMISSIONS: Record<StockActionKind, ("OWNER" | "WORKER")[]> = {
  STOCK_IN: ["OWNER"],
  SPOILAGE: ["OWNER", "WORKER"],
  WITHDRAWAL: ["OWNER", "WORKER"],
  RETURN: ["OWNER", "WORKER"],
};

const SUCCESS: Record<StockActionKind, string> = {
  STOCK_IN: "Stock added.",
  SPOILAGE: "Spoilage recorded.",
  WITHDRAWAL: "Withdrawal recorded.",
  RETURN: "Return recorded.",
};

export async function stockMovementAction(
  kind: StockActionKind,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await assertRole(...PERMISSIONS[kind]);
    const raw = Object.fromEntries(formData);
    if (kind === "RETURN") {
      const parsed = returnSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
      const { productId, quantity, reason, orderNumber } = parsed.data;
      await inventory.recordReturn(user.id, productId, quantity, reason || undefined, orderNumber);
    } else {
      const parsed = stockMovementSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
      const { productId, quantity, reason } = parsed.data;
      if (kind === "STOCK_IN") await inventory.addStock(user.id, productId, quantity, reason || undefined);
      if (kind === "SPOILAGE") await inventory.recordSpoilage(user.id, productId, quantity, reason || undefined);
      if (kind === "WITHDRAWAL") await inventory.recordManualWithdrawal(user.id, productId, quantity, reason || undefined);
    }
    refresh();
    return { ok: true, message: SUCCESS[kind] };
  } catch (err) {
    return toActionError(err);
  }
}

export async function countCorrectionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    const parsed = countCorrectionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    await inventory.correctCount(user.id, parsed.data.productId, parsed.data.countedQty, parsed.data.reason);
    refresh();
    return { ok: true, message: "Stock count corrected." };
  } catch (err) {
    return toActionError(err);
  }
}
