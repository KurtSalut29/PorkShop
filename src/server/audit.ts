import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "./db";

export async function audit(
  tx: Tx,
  entry: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
    details?: Prisma.InputJsonValue;
  },
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      details: entry.details,
    },
  });
}
