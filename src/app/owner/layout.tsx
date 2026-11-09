import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page";
import { RoleGate, StaffTopbar } from "@/components/staff/staff-topbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Layout({ children }: LayoutProps<"/owner">) {
  return (
    <AppShell
      role="OWNER"
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
