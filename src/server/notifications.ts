import "server-only";
import type { Tx } from "./db";
import { publish } from "./realtime";

type NotificationInput = {
  type: "ORDER" | "STOCK" | "SYSTEM";
  title: string;
  body: string;
  href?: string;
};

/** Stores an in-app notification for each user and pushes a live toast to their devices. */
export async function notifyUsers(tx: Tx, userIds: (string | null | undefined)[], n: NotificationInput) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;
  await tx.notification.createMany({
    data: ids.map((userId) => ({ userId, ...n })),
  });
  await publish(
    {
      kind: "notification",
      topics: ids.map((id) => `user:${id}`),
      toast: { title: n.title, body: n.body, href: n.href },
    },
    tx,
  );
}

export async function notifyOwners(tx: Tx, n: NotificationInput) {
  const owners = await tx.user.findMany({
    where: { role: "OWNER", active: true },
    select: { id: true },
  });
  await notifyUsers(
    tx,
    owners.map((o) => o.id),
    n,
  );
}
