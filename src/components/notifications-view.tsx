"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BellOff, CheckCheck, ClipboardList, Info } from "lucide-react";
import { markNotificationsReadAction } from "@/app/actions/account";
import { useConfirm } from "@/components/feedback/confirm";
import { runAction } from "@/components/feedback/notify";
import { EmptyState } from "@/components/page";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationView } from "@/server/queries/misc";

const ICON = { ORDER: ClipboardList, STOCK: AlertTriangle, SYSTEM: Info } as const;

export function NotificationsView({ items }: { items: NotificationView[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const unread = items.filter((n) => !n.read).length;

  const open = (n: NotificationView) => {
    if (!n.read) startTransition(() => void markNotificationsReadAction([n.id]));
    if (n.href) router.push(n.href);
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <p className="text-sm text-muted-foreground">
          {unread ? `${unread} unread` : "You're all caught up"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={!unread || pending}
          onClick={async () => {
            const ok = await confirm({
              title: `Mark all ${unread} as read?`,
              description: "They’ll stay in your list, just without the unread highlight.",
              confirmLabel: "Mark all as read",
            });
            if (!ok) return;
            startTransition(async () => {
              await runAction(() => markNotificationsReadAction(), { loading: "Updating…", success: "All caught up", successDescription: "Every notification is marked as read." });
            });
          }}
        >
          <CheckCheck className="size-4" /> Mark all as read
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications yet" description="Order updates and alerts will show up here." />
      ) : (
        <ul className="divide-y">
          {items.map((n) => {
            const Icon = ICON[n.type as keyof typeof ICON] ?? Info;
            return (
              <li key={n.id}>
                <button
                  onClick={() => open(n)}
                  className={cn(
                    "flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40",
                    !n.read && "bg-primary/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
                      n.type === "STOCK" ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.read && "font-semibold")}>{n.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
                    <span className="num mt-1 block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function NotificationsLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-sm text-primary hover:underline">
      View all
    </Link>
  );
}
