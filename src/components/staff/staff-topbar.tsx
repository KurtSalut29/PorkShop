import { NotificationBell } from "@/components/notification-bell";
import { LiveIndicator, RealtimeListener } from "@/components/realtime-listener";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/server/db";
import { getCurrentUser, getUserWithRole } from "@/server/dal";
import { homeFor } from "@/lib/constants";
import { listInventory } from "@/server/queries/inventory";
import { DutySwitch } from "./duty-switch";
import { WrongWorkspace } from "./wrong-workspace";

/** Session-aware part of the staff top bar. Rendered inside <Suspense> by the layouts. */
export async function StaffTopbar({ role }: { role: "OWNER" | "WORKER" }) {
  const user = await getUserWithRole(role);
  if (!user) return null; // RoleGate sends the visitor to the right place
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

/**
 * Wraps page content so it renders only for the right role. Rendered inside <Suspense>.
 * This is the one place a staff area turns a visitor away. It hands them off on the client
 * instead of throwing a redirect, so the page never renders (or fetches) anything for them
 * and the rest of the layout doesn't trip over the same check six times.
 */
export async function RoleGate({ role, children }: { role: "OWNER" | "WORKER"; children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <WrongWorkspace href="/sign-in" reason="signed-out" />;
  if (user.role !== role) return <WrongWorkspace href={homeFor(user.role)} reason="wrong-role" />;
  return <>{children}</>;
}

export type NavCountKind = "orders" | "queue" | "stock" | "unread" | "mine";

/** Live count shown next to a navigation item. Rendered inside <Suspense fallback={null}>. */
export async function NavCount({ kind, role }: { kind: NavCountKind; role: "OWNER" | "WORKER" }) {
  const user = await getUserWithRole(role);
  if (!user) return null;
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
