import { Container, PageSkeleton } from "@/components/page";

export default function Loading() {
  return (
    <Container className="py-10">
      <PageSkeleton />
    </Container>
  );
}
