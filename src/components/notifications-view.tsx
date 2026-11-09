"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellOff,
  CheckCheck,
  ClipboardList,
  Info,
} from "lucide-react";
import { markNotificationsReadAction } from "@/app/actions/account";
import { useConfirm } from "@/components/feedback/confirm";
import { runAction } from "@/components/feedback/notify";
import { EmptyState } from "@/components/page";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationView } from "@/server/queries/misc";

const ICON = {
  ORDER: ClipboardList,
  STOCK: AlertTriangle,
  SYSTEM: Info,
} as const;

const TYPE_LABEL = {
  ORDER: "Orders",
  STOCK: "Stock alerts",
  SYSTEM: "System",
} as const;
type Filter = "ALL" | "UNREAD" | keyof typeof TYPE_LABEL;

/** "Today", "Yesterday" or the date, in shop time. */
function dayLabel(d: Date | string) {
  const day = formatDate(d);
  const now = Date.now();
  if (day === formatDate(new Date(now))) return "Today";
  if (day === formatDate(new Date(now - 86_400_000))) return "Yesterday";
  return day;
}

export function NotificationsView({ items }: { items: NotificationView[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("ALL");
  const unread = items.filter((n) => !n.read).length;

  // Only offer the type filters this person actually receives (customers never get stock alerts).
  const types = (Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[]).filter(
    (t) => items.some((n) => n.type === t),
  );
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: items.length },
    { key: "UNREAD", label: "Unread", count: unread },
    ...types.map((t) => ({
      key: t,
      label: TYPE_LABEL[t],
      count: items.filter((n) => n.type === t).length,
    })),
  ];
  const shown = items.filter((n) =>
    filter === "ALL" ? true : filter === "UNREAD" ? !n.read : n.type === filter,
  );

  const groups: { label: string; items: NotificationView[] }[] = [];
  for (const n of shown) {
    const label = dayLabel(n.createdAt);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  const open = (n: NotificationView) => {
    if (!n.read)
      startTransition(() => void markNotificationsReadAction([n.id]));
    if (n.href) router.push(n.href);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4">
        <div
          role="tablist"
          aria-label="Filter notifications"
          className="flex flex-wrap gap-1"
        >
          {filters.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-night text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "num rounded-full px-1.5 text-[11px] leading-[18px]",
                  filter === f.key
                    ? "bg-white/15 text-white"
                    : f.key === "UNREAD" && f.count
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!unread || pending}
          onClick={async () => {
            const ok = await confirm({
              title: `Mark all ${unread} as read?`,
              description:
                "They’ll stay in your list, just without the unread highlight.",
              confirmLabel: "Mark all as read",
            });
            if (!ok) return;
            startTransition(async () => {
              await runAction(() => markNotificationsReadAction(), {
                loading: "Updating…",
                success: "All caught up",
                successDescription: "Every notification is marked as read.",
              });
            });
          }}
        >
          <CheckCheck className="size-4" /> Mark all as read
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No notifications yet"
          description="Order updates and alerts will show up here."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title={filter === "UNREAD" ? "You’re all caught up" : "Nothing here"}
          description={
            filter === "UNREAD"
              ? "No unread notifications. New ones appear here the moment they arrive."
              : "No notifications of this kind yet."
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <h3 className="border-b bg-muted/40 px-5 py-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {g.label}
            </h3>
            <ul className="divide-y border-b last:border-b-0">
              {g.items.map((n) => {
                const Icon = ICON[n.type as keyof typeof ICON] ?? Info;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => open(n)}
                      className={cn(
                        "grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/40",
                        !n.read && "bg-primary/[0.035]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 place-items-center rounded-full",
                          n.type === "STOCK"
                            ? "bg-amber-50 text-amber-700"
                            : n.type === "ORDER"
                              ? "bg-[#4f7be8]/10 text-[#3b63c9]"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span
                          className={cn(
                            "block text-sm",
                            !n.read && "font-semibold",
                          )}
                        >
                          {n.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {n.body}
                        </span>
                        <span className="num mt-1 block text-xs text-muted-foreground sm:hidden">
                          {formatTime(n.createdAt)}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 pt-1">
                        <span
                          className="num hidden text-xs text-muted-foreground sm:block"
                          title={formatDateTime(n.createdAt)}
                        >
                          {formatTime(n.createdAt)}
                        </span>
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            n.read ? "bg-transparent" : "bg-primary",
                          )}
                          aria-label={n.read ? undefined : "Unread"}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
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
