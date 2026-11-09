/** Manila (UTC+8) calendar helpers for report ranges. */
const OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of the Manila calendar day containing `d`. */
export function manilaDateKey(d: Date) {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant at which the Manila day `key` (YYYY-MM-DD) begins. */
export function manilaDayStart(key: string) {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, day ?? 1) - OFFSET_MS);
}

export function addDaysKey(key: string, days: number) {
  return manilaDateKey(new Date(manilaDayStart(key).getTime() + days * DAY_MS));
}

export function isDateKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

/** Resolve a report range from search params, defaulting to the last `defaultDays` days. */
export function resolveRange(
  from: unknown,
  to: unknown,
  now: Date,
  defaultDays = 30,
): { fromKey: string; toKey: string; start: Date; end: Date } {
  const todayKey = manilaDateKey(now);
  let toKey = isDateKey(to) ? to : todayKey;
  let fromKey = isDateKey(from) ? from : addDaysKey(toKey, -(defaultDays - 1));
  if (fromKey > toKey) [fromKey, toKey] = [toKey, fromKey];
  return { fromKey, toKey, start: manilaDayStart(fromKey), end: manilaDayStart(addDaysKey(toKey, 1)) };
}

export function eachDayKey(fromKey: string, toKey: string) {
  const out: string[] = [];
  for (let k = fromKey; k <= toKey; k = addDaysKey(k, 1)) out.push(k);
  return out;
}
