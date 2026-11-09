import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { CartButton } from "@/components/cart/cart-button";
import { CartProvider } from "@/components/cart/cart-context";
import { NotificationBell } from "@/components/notification-bell";
import { Container } from "@/components/page";
import { RealtimeListener } from "@/components/realtime-listener";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import { homeFor } from "@/lib/constants";
import { getCurrentUser } from "@/server/dal";
import { MobileStoreNav, StoreNav } from "./store-nav";

async function HeaderAccount() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <Button variant="ghost" asChild className="hidden sm:inline-flex">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/sign-up">Create account</Link>
        </Button>
      </>
    );
  }
  const isCustomer = user.role === "CUSTOMER";
  return (
    <>
      <NotificationBell userId={user.id} href={isCustomer ? "/notifications" : `${homeFor(user.role)}/notifications`} />
      <UserMenu
        name={user.name}
        email={user.email}
        role={user.role}
        profileHref={isCustomer ? "/account" : `${homeFor(user.role)}/profile`}
        showDashboardLink={!isCustomer}
      />
    </>
  );
}

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <CartProvider>
      <RealtimeListener />
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <Container className="flex h-16 items-center gap-6">
          <Logo href="/" />
          <StoreNav />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <CartButton />
            <Suspense fallback={<Skeleton className="h-9 w-32 rounded-lg" />}>
              <HeaderAccount />
            </Suspense>
          </div>
        </Container>
        <MobileStoreNav />
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="mt-16 border-t bg-card">
        <Container className="grid gap-8 py-10 text-sm sm:grid-cols-3">
          <div>
            <Logo href="/" />
            <p className="mt-3 max-w-xs text-muted-foreground">
              Fresh pork from trusted local farms, cut to order and ready for pickup.
            </p>
          </div>
          <div>
            <p className="font-medium">Store hours</p>
            <p className="mt-2 text-muted-foreground">Monday – Sunday</p>
            <p className="text-muted-foreground">7:00 AM – 6:00 PM</p>
          </div>
          <div>
            <p className="font-medium">How pickup works</p>
            <p className="mt-2 text-muted-foreground">
              Choose a time at checkout. We'll notify you when your order is packed. Pay by cash, GCash or card at the
              counter.
            </p>
          </div>
        </Container>
      </footer>
    </CartProvider>
  );
}
