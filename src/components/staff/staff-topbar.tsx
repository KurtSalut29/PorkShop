import { NotificationBell } from "@/components/notification-bell";
import { RealtimeListener } from "@/components/realtime-listener";
import { UserMenu } from "@/components/user-menu";
import { requireRole } from "@/server/dal";
import { DutySwitch } from "./duty-switch";

/** Session-aware part of the staff top bar. Rendered inside <Suspense> by the layouts. */
export async function StaffTopbar({ role }: { role: "OWNER" | "WORKER" }) {
  const user = await requireRole(role);
  const base = role === "OWNER" ? "/owner" : "/worker";
  return (
    <>
      <RealtimeListener />
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
