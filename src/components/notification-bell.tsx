import Link from "next/link";
import { Bell } from "lucide-react";
import { unreadCount } from "@/server/queries/misc";

export async function NotificationBell({ userId, href }: { userId: string; href: string }) {
  const count = await unreadCount(userId);
  return (
    <Link
      href={href}
      className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
    >
      <Bell className="size-[18px]" />
      {count > 0 && (
        <span className="num absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
