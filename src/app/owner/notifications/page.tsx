import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page";
import { NotificationsPageBody } from "@/components/shared-pages";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return (
    <div className="max-w-3xl">
      <Suspense fallback={<PageSkeleton />}>
        <NotificationsPageBody role="OWNER" />
      </Suspense>
    </div>
  );
}
