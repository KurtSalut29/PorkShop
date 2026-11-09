/**
 * Pickup time-slot generation. Pure functions (no I/O) so they run on both server and client
 * and can be unit tested. All wall-clock times are Asia/Manila (UTC+8, no DST).
 */

const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SlotSettings = {
  openTime: string; // "07:00"
  closeTime: string; // "18:00"
  slotMinutes: number;
  leadTimeMinutes: number;
  advanceDays: number;
  slotCapacity: number;
};

export type PickupSlot = {
  iso: string; // UTC instant of the slot start
  label: string; // "9:00 – 10:00 AM"
  remaining: number;
};

export type PickupDay = {
  key: string; // YYYY-MM-DD (Manila)
  label: string; // "Today", "Tomorrow", "Wed, Nov 12"
  slots: PickupSlot[];
};

function parseHm(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Manila calendar date (as a UTC-midnight timestamp) for a given instant. */
function manilaMidnight(instant: Date) {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

function manilaWallToUtc(dayUtcMidnight: number, minutes: number) {
  return new Date(dayUtcMidnight + minutes * 60_000 - OFFSET_MS);
}

function fmtMinutes(total: number) {
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { text: `${h12}:${String(m).padStart(2, "0")}`, period: h24 < 12 ? "AM" : "PM" };
}

function slotLabel(startMin: number, endMin: number) {
  const a = fmtMinutes(startMin);
  const b = fmtMinutes(endMin);
  return a.period === b.period
    ? `${a.text} – ${b.text} ${b.period}`
    : `${a.text} ${a.period} – ${b.text} ${b.period}`;
}

const dayFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function generatePickupDays(
  now: Date,
  s: SlotSettings,
  booked: Record<string, number> = {},
): PickupDay[] {
  const open = parseHm(s.openTime);
  const close = parseHm(s.closeTime);
  const earliest = now.getTime() + s.leadTimeMinutes * 60_000;
  const today = manilaMidnight(now);
  const days: PickupDay[] = [];

  for (let i = 0; i < s.advanceDays; i++) {
    const day = today + i * DAY_MS;
    const slots: PickupSlot[] = [];
    for (let m = open; m + s.slotMinutes <= close; m += s.slotMinutes) {
      const start = manilaWallToUtc(day, m);
      if (start.getTime() < earliest) continue;
      const iso = start.toISOString();
      slots.push({
        iso,
        label: slotLabel(m, m + s.slotMinutes),
        remaining: Math.max(0, s.slotCapacity - (booked[iso] ?? 0)),
      });
    }
    if (slots.length === 0) continue;
    days.push({
      key: new Date(day).toISOString().slice(0, 10),
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayFmt.format(new Date(day)),
      slots,
    });
  }
  return days;
}

/** True when `start` is one of the slots that would be offered at `now`. */
export function isOfferedSlot(start: Date, now: Date, s: SlotSettings) {
  const iso = start.toISOString();
  return generatePickupDays(now, s).some((d) => d.slots.some((slot) => slot.iso === iso));
}

/** Range of instants covered by the bookable window — used to count booked orders per slot. */
export function slotWindow(now: Date, s: SlotSettings) {
  const from = new Date(manilaMidnight(now) - OFFSET_MS);
  const to = new Date(from.getTime() + s.advanceDays * DAY_MS);
  return { from, to };
}

export function formatSlotRange(startIso: string | Date, slotMinutes: number) {
  const start = new Date(startIso);
  const startMin = Math.round((start.getTime() + OFFSET_MS - manilaMidnight(start)) / 60_000);
  return slotLabel(startMin, startMin + slotMinutes);
}
