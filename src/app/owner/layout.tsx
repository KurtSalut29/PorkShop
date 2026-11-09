import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page";
import { NavCount, RoleGate, StaffTopbar } from "@/components/staff/staff-topbar";
import { Skeleton } from "@/components/ui/skeleton";

const count = (kind: React.ComponentProps<typeof NavCount>["kind"]) => (
  <Suspense fallback={null}>
    <NavCount kind={kind} role="OWNER" />
  </Suspense>
);

export default function Layout({ children }: LayoutProps<"/owner">) {
  return (
    <AppShell
      role="OWNER"
      badges={{
        "/owner/orders": count("orders"),
        "/owner/assignments": count("queue"),
        "/owner/inventory": count("stock"),
        "/owner/notifications": count("unread"),
      }}
      topbar={
        <Suspense fallback={<Skeleton className="h-9 w-48 rounded-lg" />}>
          <StaffTopbar role="OWNER" />
        </Suspense>
      }
    >
      <Suspense fallback={<PageSkeleton />}>
        <RoleGate role="OWNER">{children}</RoleGate>
      </Suspense>
    </AppShell>
  );
}
