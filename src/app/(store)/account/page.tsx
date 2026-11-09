import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, PageSkeleton } from "@/components/page";
import { ProfilePageBody } from "@/components/shared-pages";

export const metadata: Metadata = { title: "My account" };

export default function Page() {
  return (
    <Container className="py-8 sm:py-10">
      <Suspense fallback={<PageSkeleton />}>
        <ProfilePageBody role="CUSTOMER" />
      </Suspense>
    </Container>
  );
}
