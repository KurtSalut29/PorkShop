/**
 * Load-balancing rule for automatic order assignment (pure, unit tested).
 *
 *   1. Only on-duty, active workers below their capacity are eligible.
 *   2. Prefer the worker with the fewest active orders (ASSIGNED + PROCESSING).
 *   3. On a tie, prefer the worker who has waited longest since their last assignment
 *      (never-assigned workers first) — a fair round-robin among equally loaded workers.
 *   4. Final tie-break on id keeps the choice deterministic.
 */
export type WorkerLoad = {
  id: string;
  activeCount: number;
  capacity: number;
  lastAssignedAt: Date | null;
};

export function pickWorker<T extends WorkerLoad>(workers: T[]): T | null {
  let best: T | null = null;
  for (const w of workers) {
    if (w.activeCount >= w.capacity) continue;
    if (!best || compare(w, best) < 0) best = w;
  }
  return best;
}

function compare(a: WorkerLoad, b: WorkerLoad) {
  if (a.activeCount !== b.activeCount) return a.activeCount - b.activeCount;
  const ta = a.lastAssignedAt ? a.lastAssignedAt.getTime() : -Infinity;
  const tb = b.lastAssignedAt ? b.lastAssignedAt.getTime() : -Infinity;
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Distribute a batch of orders (already sorted by priority) across workers, mutating the
 * in-memory load as it goes. Returns [orderId, workerId] pairs; orders that don't fit stay queued.
 */
export function planAssignments<T extends WorkerLoad>(
  orderIds: string[],
  workers: T[],
  now: Date,
): Array<{ orderId: string; worker: T; loadAfter: number; assignedAt: Date }> {
  const plan: Array<{ orderId: string; worker: T; loadAfter: number; assignedAt: Date }> = [];
  for (const orderId of orderIds) {
    const worker = pickWorker(workers);
    if (!worker) break;
    worker.activeCount += 1;
    // Strictly increasing timestamps keep round-robin order stable within one batch.
    const assignedAt = new Date(now.getTime() + plan.length);
    worker.lastAssignedAt = assignedAt;
    plan.push({ orderId, worker, loadAfter: worker.activeCount, assignedAt });
  }
  return plan;
}
