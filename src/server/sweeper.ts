import "server-only";
import { runAssignment } from "./assignment";
import { expireOverdueOrders } from "./orders";

const g = globalThis as unknown as { pirasoSweeper?: NodeJS.Timeout };

const isBusy = (err: unknown) => (err as { code?: string })?.code === "P2028"; // no transaction slot in time

/**
 * Background safety net, one per server instance (started by instrumentation.ts):
 *  1. releases orders whose GCash payment or pickup deadline has passed;
 *  2. re-runs the dispatcher in case an assignment trigger was missed.
 * Both are safe to run on many instances at once (row locks and an advisory lock).
 */
export function startSweeper(intervalMs = 30_000) {
  if (g.pirasoSweeper) return;
  const tick = async () => {
    try {
      await expireOverdueOrders();
    } catch (err) {
      if (isBusy(err)) console.warn("[expiry] database busy, will retry on the next sweep");
      else console.error("[expiry] sweep failed", err);
    }
    try {
      await runAssignment();
    } catch (err) {
      if (isBusy(err)) console.warn("[assignment] database busy, will retry on the next sweep");
      else console.error("[assignment] sweep failed", err);
    }
  };
  g.pirasoSweeper = setInterval(tick, intervalMs);
  g.pirasoSweeper.unref?.();
  console.log(`[sweeper] started: checks overdue payments and pickups every ${intervalMs / 1000} s`);
}
