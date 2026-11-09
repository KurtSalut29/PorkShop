"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fieldErrors, profileSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { assertRole, getCurrentUser } from "@/server/dal";
import { toActionError, type ActionResult } from "@/server/errors";
import { publish } from "@/server/realtime";
import { setDutyStatus } from "@/server/workers";

export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Please sign in again." };
    const parsed = profileSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    await db.user.update({ where: { id: user.id }, data: parsed.data });
    refresh();
    return { ok: true, message: "Profile updated." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setDutyStatusAction(status: string): Promise<ActionResult> {
  try {
    const user = await assertRole("WORKER");
    const parsed = z.enum(["ON_DUTY", "ON_BREAK", "OFF_DUTY"]).parse(status);
    const { requeued, label } = await setDutyStatus(user.id, parsed);
    refresh();
    return {
      ok: true,
      message: `You're now ${label.toLowerCase()}.${requeued ? ` ${requeued} unstarted order${requeued > 1 ? "s were" : " was"} returned to the queue.` : ""}`,
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Please sign in again." };
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    await publish({ kind: "notification", topics: [`user:${user.id}`] });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
