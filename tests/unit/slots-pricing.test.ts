import { describe, expect, it } from "vitest";
import { generatePickupDays, isOfferedSlot, type SlotSettings } from "@/lib/slots";
import { lineEstimate, snapQty, stockLevel, validateQty } from "@/lib/pricing";
import { resolveRange } from "@/lib/dates";

const settings: SlotSettings = {
  openTime: "07:00",
  closeTime: "18:00",
  slotMinutes: 60,
  leadTimeMinutes: 60,
  advanceDays: 3,
  slotCapacity: 8,
};

describe("pickup slots (Asia/Manila)", () => {
  it("offers hourly slots after the lead time, in Manila time", () => {
    // 10:20 Manila = 02:20 UTC → first slot must start at or after 11:20 → 12:00 Manila (04:00Z)
    const now = new Date("2026-11-09T02:20:00Z");
    const days = generatePickupDays(now, settings);
    expect(days[0]!.label).toBe("Today");
    expect(days[0]!.slots[0]!.iso).toBe("2026-11-09T04:00:00.000Z");
    expect(days[0]!.slots[0]!.label).toBe("12:00 – 1:00 PM");
    expect(days[0]!.slots.at(-1)!.label).toBe("5:00 – 6:00 PM");
    expect(days[1]!.slots).toHaveLength(11); // 7 AM … 5 PM starts
  });

  it("skips today after closing and reports remaining capacity", () => {
    const now = new Date("2026-11-09T10:30:00Z"); // 6:30 PM Manila
    const days = generatePickupDays(now, settings, { "2026-11-09T23:00:00.000Z": 8, "2026-11-10T00:00:00.000Z": 5 });
    expect(days[0]!.label).toBe("Tomorrow");
    expect(days[0]!.slots[0]!.remaining).toBe(0); // 7 AM fully booked
    expect(days[0]!.slots[1]!.remaining).toBe(3);
  });

  it("rejects instants that are not on the offered grid", () => {
    const now = new Date("2026-11-09T00:00:00Z");
    expect(isOfferedSlot(new Date("2026-11-09T05:00:00Z"), now, settings)).toBe(true);
    expect(isOfferedSlot(new Date("2026-11-09T05:30:00Z"), now, settings)).toBe(false);
    expect(isOfferedSlot(new Date("2026-11-20T05:00:00Z"), now, settings)).toBe(false);
  });
});

describe("pricing & quantity rules", () => {
  const kg = { unit: "KG" as const, minOrderQty: 0.5, qtyStep: 0.25 };
  const pc = { unit: "PIECE" as const, minOrderQty: 1, qtyStep: 1 };

  it("validates minimums and steps", () => {
    expect(validateQty(1.25, kg)).toBeNull();
    expect(validateQty(0.25, kg)).toMatch(/Minimum/);
    expect(validateQty(1.3, kg)).toMatch(/steps/);
    expect(validateQty(2, pc)).toBeNull();
    expect(validateQty(1.5, pc)).toMatch(/whole/);
  });

  it("snaps to the grid and rounds money to centavos", () => {
    expect(snapQty(1.3, kg)).toBe(1.25);
    expect(snapQty(0.1, kg)).toBe(0.5);
    expect(lineEstimate(390, 1.27)).toBe(495.3);
    expect(lineEstimate(333.33, 0.75)).toBe(250);
  });

  it("classifies stock levels", () => {
    expect(stockLevel(0, 5)).toBe("out");
    expect(stockLevel(5, 5)).toBe("low");
    expect(stockLevel(5.5, 5)).toBe("ok");
  });

  it("resolves report ranges on Manila day boundaries", () => {
    const r = resolveRange("2026-11-01", "2026-11-03", new Date());
    expect(r.start.toISOString()).toBe("2026-10-31T16:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-03T16:00:00.000Z");
  });
});
