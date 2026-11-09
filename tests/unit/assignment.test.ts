import { describe, expect, it } from "vitest";
import { pickWorker, planAssignments, type WorkerLoad } from "@/lib/assignment";

const w = (id: string, activeCount: number, lastAssignedAt: string | null = null, capacity = 5): WorkerLoad => ({
  id,
  activeCount,
  capacity,
  lastAssignedAt: lastAssignedAt ? new Date(lastAssignedAt) : null,
});

describe("pickWorker (load balancing)", () => {
  it("returns null when nobody is available", () => {
    expect(pickWorker([])).toBeNull();
  });

  it("prefers the worker with the fewest active orders", () => {
    expect(pickWorker([w("a", 3), w("b", 1), w("c", 2)])?.id).toBe("b");
  });

  it("breaks ties by longest wait since last assignment, never-assigned first", () => {
    const workers = [w("a", 1, "2026-11-09T10:00:00Z"), w("b", 1, "2026-11-09T09:00:00Z"), w("c", 1, null)];
    expect(pickWorker(workers)?.id).toBe("c");
    expect(pickWorker(workers.slice(0, 2))?.id).toBe("b");
  });

  it("skips workers at capacity", () => {
    expect(pickWorker([w("a", 5, null, 5), w("b", 4, null, 5)])?.id).toBe("b");
    expect(pickWorker([w("a", 5, null, 5)])).toBeNull();
  });
});

describe("planAssignments", () => {
  it("spreads a burst of orders evenly (round-robin among equals)", () => {
    const workers = [w("a", 0), w("b", 0), w("c", 0)];
    const plan = planAssignments(["o1", "o2", "o3", "o4", "o5", "o6"], workers, new Date("2026-11-09T08:00:00Z"));
    const counts = plan.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.worker.id]: (acc[p.worker.id] ?? 0) + 1 }), {});
    expect(counts).toEqual({ a: 2, b: 2, c: 2 });
    // order of the first round follows the deterministic tie-break
    expect(plan.slice(0, 3).map((p) => p.worker.id)).toEqual(["a", "b", "c"]);
  });

  it("fills the least-loaded worker first, then balances", () => {
    const workers = [w("busy", 3), w("idle", 0)];
    const plan = planAssignments(["o1", "o2", "o3", "o4"], workers, new Date());
    expect(plan.map((p) => p.worker.id)).toEqual(["idle", "idle", "idle", "busy"]);
  });

  it("leaves orders queued when total capacity runs out", () => {
    const workers = [w("a", 1, null, 2), w("b", 2, null, 2)];
    const plan = planAssignments(["o1", "o2", "o3"], workers, new Date());
    expect(plan).toHaveLength(1);
    expect(plan[0]!.loadAfter).toBe(2);
  });
});
