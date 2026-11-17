import { db } from "@/server/db";
import { getCurrentUser } from "@/server/dal";

/**
 * Serves a GCash receipt screenshot. Private: only staff and the customer who placed the order
 * can see it, and it is never cached by shared caches.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to view this receipt.", { status: 401 });
  const proof = await db.paymentProof.findUnique({
    where: { id },
    select: { image: true, mimeType: true, order: { select: { customerId: true } } },
  });
  const allowed = proof && (user.role === "OWNER" || user.role === "WORKER" || proof.order.customerId === user.id);
  if (!proof || !allowed) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(proof.image), {
    headers: {
      "Content-Type": proof.mimeType,
      "Content-Length": String(proof.image.byteLength),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
