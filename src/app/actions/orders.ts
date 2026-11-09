"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { placeOrderSchema } from "@/lib/validation";
import { assertRole } from "@/server/dal";
import { toActionError, type ActionResult } from "@/server/errors";
import * as orders from "@/server/orders";
import { getProductsByIds } from "@/server/queries/catalog";

const reasonSchema = z.string().trim().max(200).optional().default("");

export async function placeOrderAction(input: unknown): Promise<ActionResult<{ orderId: string }>> {
  try {
    const user = await assertRole("CUSTOMER");
    const parsed = placeOrderSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your order." };
    const order = await orders.placeOrder(user.id, parsed.data);
    return { ok: true, data: { orderId: order.id } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Re-prices the cart from the server so customers always see current prices and stock. */
export async function refreshCartAction(ids: string[]) {
  const safeIds = z.array(z.string().max(40)).max(50).parse(ids);
  const products = await getProductsByIds(safeIds);
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    unit: p.unit,
    price: p.price,
    available: p.available,
    minOrderQty: p.minOrderQty,
    qtyStep: p.qtyStep,
    archived: p.archived,
    category: p.category,
  }));
}

export async function cancelOrderAction(orderId: string, reason?: string): Promise<ActionResult> {
  try {
    const user = await assertRole("CUSTOMER");
    const outcome = await orders.customerCancel(user, z.string().parse(orderId), reasonSchema.parse(reason));
    refresh();
    return {
      ok: true,
      message: outcome === "cancelled" ? "Your order was cancelled." : "Cancellation requested. The shop will confirm shortly.",
    };
  } catch (err) {
    return toActionError(err);
  }
}

// ── Worker ──
export async function startProcessingAction(orderId: string): Promise<ActionResult> {
  try {
    const user = await assertRole("WORKER", "OWNER");
    await orders.startProcessing(user, orderId);
    refresh();
    return { ok: true, message: "Marked as processing." };
  } catch (err) {
    return toActionError(err);
  }
}

const actualsSchema = z.record(z.string(), z.number().positive().max(500));

export async function markReadyAction(orderId: string, actuals: Record<string, number>): Promise<ActionResult> {
  try {
    const user = await assertRole("WORKER", "OWNER");
    const parsed = actualsSchema.parse(actuals);
    const rounded = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
    await orders.markReady(user, orderId, rounded);
    refresh();
    return { ok: true, message: "Order is ready for pickup. Stock withdrawn automatically." };
  } catch (err) {
    return toActionError(err);
  }
}

const methodSchema = z.enum(["CASH", "GCASH", "CARD"]);

export async function completeOrderAction(orderId: string, method: string): Promise<ActionResult> {
  try {
    const user = await assertRole("WORKER", "OWNER");
    await orders.completeOrder(user, orderId, methodSchema.parse(method));
    refresh();
    return { ok: true, message: "Order completed and payment recorded." };
  } catch (err) {
    return toActionError(err);
  }
}

// ── Owner ──
export async function reassignOrderAction(orderId: string, workerId: string | null): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    await orders.reassignOrder(user, orderId, workerId || null);
    refresh();
    return { ok: true, message: workerId ? "Order reassigned." : "Order returned to the queue." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function resolveCancelAction(orderId: string, approve: boolean): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    await orders.resolveCancelRequest(user, orderId, approve);
    refresh();
    return { ok: true, message: approve ? "Order cancelled and stock released." : "Request declined." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function ownerCancelAction(orderId: string, reason: string): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    const r = z.string().trim().min(3, "Give a short reason.").max(200).safeParse(reason);
    if (!r.success) return { ok: false, message: r.error.issues[0]!.message };
    await orders.ownerCancel(user, orderId, r.data);
    refresh();
    return { ok: true, message: "Order cancelled." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setPaymentAction(orderId: string, paid: boolean, method?: string): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    await orders.setPaymentStatus(user, orderId, paid, method ? methodSchema.parse(method) : undefined);
    refresh();
    return { ok: true, message: paid ? "Payment recorded." : "Marked as unpaid." };
  } catch (err) {
    return toActionError(err);
  }
}
