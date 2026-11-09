import type { Metadata } from "next";
import { Container } from "@/components/page";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold sm:text-3xl">Your cart</h1>
      <CartView />
    </Container>
  );
}
