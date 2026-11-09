import { NotificationsView } from "@/components/notifications-view";
import { PageHeader, Section } from "@/components/page";
import { ChangePasswordForm, ProfileForm } from "@/components/profile-forms";
import type { Role } from "@/lib/constants";
import { requireRole } from "@/server/dal";
import { listNotifications } from "@/server/queries/misc";

/** Notifications page body, shared by every role. Must be rendered inside <Suspense>. */
export async function NotificationsPageBody({ role }: { role: Role }) {
  const user = await requireRole(role);
  const items = await listNotifications(user.id);
  return (
    <>
      <PageHeader title="Notifications" description="Order updates, stock alerts and system messages." />
      <NotificationsView items={items} />
    </>
  );
}

/** Profile page body, shared by every role. Must be rendered inside <Suspense>. */
export async function ProfilePageBody({ role }: { role: Role }) {
  const user = await requireRole(role);
  return (
    <>
      <PageHeader title="Profile & password" description="Keep your contact details current so the shop can reach you." />
      <div className="grid max-w-3xl gap-6">
        <Section title="Personal details">
          <ProfileForm name={user.name} email={user.email} phone={user.phone ?? ""} />
        </Section>
        <Section title="Password" description="Changing your password signs you out on other devices.">
          <ChangePasswordForm />
        </Section>
      </div>
    </>
  );
}
