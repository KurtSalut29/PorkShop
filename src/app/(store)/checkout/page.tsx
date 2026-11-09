import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, PageSkeleton } from "@/components/page";
import { requireRole } from "@/server/dal";
import { pickupDays } from "@/server/queries/misc";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold sm:text-3xl">Checkout</h1>
      <p className="mt-1 text-muted-foreground">Choose when you'd like to pick up your order.</p>
      <Suspense fallback={<PageSkeleton />}>
        <Checkout />
      </Suspense>
    </Container>
  );
}

async function Checkout() {
  const user = await requireRole("CUSTOMER");
  const { days, slotMinutes } = await pickupDays();
  return <CheckoutForm days={days} slotMinutes={slotMinutes} customer={{ name: user.name, phone: user.phone ?? "" }} />;
}
