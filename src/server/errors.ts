/** An expected, user-facing business rule violation (e.g. "Not enough Pork Belly in stock"). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[] | undefined> };

/** Converts thrown errors into a safe result for the UI; unexpected errors are logged, not leaked. */
export function toActionError(err: unknown): { ok: false; message: string } {
  if (err instanceof DomainError) return { ok: false, message: err.message };
  // Postgres CHECK constraint guarding stock (see migration) — surface it as a stock problem.
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("product_reserved_valid") || msg.includes("product_stock_nonnegative")) {
    return { ok: false, message: "Stock changed while you were working. Please refresh and try again." };
  }
  console.error("[action] unexpected error", err);
  return { ok: false, message: "Something went wrong. Please try again." };
}
