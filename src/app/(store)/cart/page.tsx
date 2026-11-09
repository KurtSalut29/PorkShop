import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/page";
import { getCurrentUser } from "@/server/dal";
import { CartView, type CartViewer } from "./cart-view";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold sm:text-3xl">Your cart</h1>
      {/* The session is request data: the cart renders at once and the checkout button settles when it arrives. */}
      <Suspense fallback={<CartView viewer="loading" />}>
        <CartForViewer />
      </Suspense>
    </Container>
  );
}

async function CartForViewer() {
  const user = await getCurrentUser();
  const viewer: CartViewer = !user ? "guest" : user.role === "CUSTOMER" ? "customer" : "staff";
  return <CartView viewer={viewer} />;
}
