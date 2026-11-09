import { NotificationBell } from "@/components/notification-bell";
import { LiveIndicator, RealtimeListener } from "@/components/realtime-listener";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/server/db";
import { requireRole } from "@/server/dal";
import { listInventory } from "@/server/queries/inventory";
import { DutySwitch } from "./duty-switch";

/** Session-aware part of the staff top bar. Rendered inside <Suspense> by the layouts. */
export async function StaffTopbar({ role }: { role: "OWNER" | "WORKER" }) {
  const user = await requireRole(role);
  const base = role === "OWNER" ? "/owner" : "/worker";
  return (
    <>
      <RealtimeListener />
      <LiveIndicator className="hidden md:inline-flex" />
      {role === "WORKER" && <DutySwitch status={user.dutyStatus} />}
      <NotificationBell userId={user.id} href={`${base}/notifications`} />
      <UserMenu name={user.name} email={user.email} role={user.role} profileHref={`${base}/profile`} />
    </>
  );
}

/** Wraps page content so it renders only for the right role. Rendered inside <Suspense>. */
export async function RoleGate({ role, children }: { role: "OWNER" | "WORKER"; children: React.ReactNode }) {
  await requireRole(role);
  return <>{children}</>;
}

export type NavCountKind = "orders" | "queue" | "stock" | "unread" | "mine";

/** Live count shown next to a navigation item. Rendered inside <Suspense fallback={null}>. */
export async function NavCount({ kind, role }: { kind: NavCountKind; role: "OWNER" | "WORKER" }) {
  const user = await requireRole(role);
  let count = 0;
  let urgent = false;
  if (kind === "orders") {
    const [open, attention] = await Promise.all([
      db.order.count({ where: { status: { in: ["PENDING", "ASSIGNED", "PROCESSING", "READY"] } } }),
      db.order.count({ where: { cancelRequest: "PENDING" } }),
    ]);
    count = open;
    urgent = attention > 0;
  } else if (kind === "queue") {
    count = await db.order.count({ where: { status: "PENDING" } });
    urgent = count > 0;
  } else if (kind === "stock") {
    count = (await listInventory()).filter((p) => p.level !== "ok").length;
    urgent = count > 0;
  } else if (kind === "unread") {
    count = await db.notification.count({ where: { userId: user.id, readAt: null } });
  } else if (kind === "mine") {
    count = await db.order.count({ where: { workerId: user.id, status: { in: ["ASSIGNED", "PROCESSING", "READY"] } } });
  }
  if (!count) return null;
  return (
    <span
      className={
        urgent
          ? "num ml-auto rounded-full bg-sidebar-primary px-1.5 py-px text-[11px] font-semibold text-white"
          : "num ml-auto rounded-full bg-sidebar-accent px-1.5 py-px text-[11px] font-semibold text-sidebar-foreground"
      }
      aria-label={`${count}${urgent ? ", needs attention" : ""}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
