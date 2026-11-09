import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, PageSkeleton } from "@/components/page";
import { NotificationsPageBody } from "@/components/shared-pages";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return (
    <Container className="py-8 sm:py-10">
      <Suspense fallback={<PageSkeleton />}>
        <NotificationsPageBody role="CUSTOMER" />
      </Suspense>
    </Container>
  );
}
