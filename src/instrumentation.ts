/**
 * Runs once when a server instance starts. Starts the background sweeper so overdue orders are
 * released and the queue keeps moving even when nobody has the app open.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return; // not while building
  const { startSweeper } = await import("./server/sweeper");
  startSweeper();
}
