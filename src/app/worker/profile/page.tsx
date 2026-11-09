import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page";
import { ProfilePageBody } from "@/components/shared-pages";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfilePageBody role="WORKER" />
    </Suspense>
  );
}
