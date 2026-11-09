import { startAssignmentSweeper } from "@/server/assignment";
import { auth } from "@/server/auth";
import { realtimeHub, type RealtimeEvent } from "@/server/realtime";

/**
 * Server-Sent Events stream. Each browser tab keeps one connection; the server forwards only the
 * events addressed to this user's topics (everyone, their role, or them personally).
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const topics = new Set<string>(["all"]);
  if (session) {
    const role = (session.user as { role?: string }).role ?? "CUSTOMER";
    topics.add(`role:${role}`);
    topics.add(`user:${session.user.id}`);
  }

  await realtimeHub.ensureConnected();
  // The background dispatcher sweep starts with the first live connection on this instance.
  startAssignmentSweeper();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send("retry: 3000\n: connected\n\n");

      const unsubscribe = realtimeHub.subscribe((event: RealtimeEvent) => {
        if (!event.topics.some((t) => topics.has(t))) return;
        const personal = session && event.topics.includes(`user:${session.user.id}`);
        send(`data: ${JSON.stringify({ kind: event.kind, toast: personal ? event.toast : undefined })}\n\n`);
      });
      const heartbeat = setInterval(() => send(": ping\n\n"), 25_000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
