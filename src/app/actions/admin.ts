"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fieldErrors, productSchema, settingsSchema, workerSchema, workerUpdateSchema } from "@/lib/validation";
import { runAssignment, triggerAssignment } from "@/server/assignment";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { assertRole } from "@/server/dal";
import { toActionError, type ActionResult } from "@/server/errors";
import * as products from "@/server/products";
import { publish } from "@/server/realtime";
import * as workers from "@/server/workers";

const invalid = (error: z.ZodError): ActionResult => ({
  ok: false,
  message: "Check the highlighted fields.",
  fieldErrors: fieldErrors(error),
});

// ── Products ──
export async function saveProductAction(
  productId: string | null,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertRole("OWNER");
    const parsed = productSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error) as ActionResult<{ id: string }>;
    const input = { ...parsed.data, localName: parsed.data.localName || undefined, imageUrl: parsed.data.imageUrl || undefined };
    if (productId) {
      await products.updateProduct(user.id, productId, input);
      refresh();
      return { ok: true, message: "Product updated.", data: { id: productId } };
    }
    const p = await products.createProduct(user.id, input);
    return { ok: true, message: "Product created.", data: { id: p.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveProductAction(productId: string, archived: boolean): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    await products.setProductArchived(user.id, productId, archived);
    refresh();
    return { ok: true, message: archived ? "Product archived. It's hidden from the catalog." : "Product restored." };
  } catch (err) {
    return toActionError(err);
  }
}

// ── Workers ──
export async function createWorkerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    const parsed = workerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    await workers.createWorker(user.id, parsed.data);
    refresh();
    return { ok: true, message: `Worker account created for ${parsed.data.name}.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateWorkerAction(
  workerId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    const parsed = workerUpdateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    await workers.updateWorker(user.id, workerId, parsed.data);
    refresh();
    return { ok: true, message: "Worker updated." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setWorkerActiveAction(workerId: string, active: boolean): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    const requeued = await workers.setWorkerActive(user.id, workerId, active);
    refresh();
    return {
      ok: true,
      message: active
        ? "Worker reactivated."
        : `Worker deactivated.${requeued ? ` ${requeued} open order${requeued > 1 ? "s were" : " was"} returned to the queue.` : ""}`,
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function resetWorkerPasswordAction(
  workerId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    const parsed = workerSchema.shape.password.safeParse(formData.get("password"));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message, fieldErrors: { password: [parsed.error.issues[0]!.message] } };
    await workers.resetWorkerPassword(user.id, workerId, parsed.data);
    return { ok: true, message: "Password reset. The worker has been signed out of all devices." };
  } catch (err) {
    return toActionError(err);
  }
}

// ── Assignment ──
export async function runAssignmentAction(): Promise<ActionResult> {
  try {
    await assertRole("OWNER");
    const n = await runAssignment();
    refresh();
    return {
      ok: true,
      message: n ? `Assigned ${n} queued order${n > 1 ? "s" : ""}.` : "Nothing to assign. No queued orders, or no worker has capacity.",
    };
  } catch (err) {
    return toActionError(err);
  }
}

// ── Settings ──
export async function saveSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("OWNER");
    const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    await db.$transaction(async (tx) => {
      const before = await tx.shopSettings.findUnique({ where: { id: 1 } });
      await tx.shopSettings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
      await audit(tx, {
        actorId: user.id,
        action: "settings.update",
        entityType: "Settings",
        entityId: "1",
        summary: "Updated shop settings",
        details: { before: before ? { ...before, updatedAt: undefined } : null, after: parsed.data },
      });
      await publish({ kind: "settings", topics: ["all"] }, tx);
    });
    triggerAssignment();
    refresh();
    return { ok: true, message: "Settings saved." };
  } catch (err) {
    return toActionError(err);
  }
}
