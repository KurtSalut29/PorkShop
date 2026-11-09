import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page";
import { NavCount, RoleGate, StaffTopbar } from "@/components/staff/staff-topbar";
import { Skeleton } from "@/components/ui/skeleton";

const count = (kind: React.ComponentProps<typeof NavCount>["kind"]) => (
  <Suspense fallback={null}>
    <NavCount kind={kind} role="WORKER" />
  </Suspense>
);

export default function Layout({ children }: LayoutProps<"/worker">) {
  return (
    <AppShell
      role="WORKER"
      badges={{
        "/worker/orders": count("mine"),
        "/worker/inventory": count("stock"),
        "/worker/notifications": count("unread"),
      }}
      topbar={
        <Suspense fallback={<Skeleton className="h-9 w-48 rounded-lg" />}>
          <StaffTopbar role="WORKER" />
        </Suspense>
      }
    >
      <Suspense fallback={<PageSkeleton />}>
        <RoleGate role="WORKER">{children}</RoleGate>
      </Suspense>
    </AppShell>
  );
}
