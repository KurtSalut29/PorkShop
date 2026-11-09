import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, Scale, Store } from "lucide-react";
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
import { getSettings } from "@/server/settings";
import { MobileStoreNav, StoreNav } from "./store-nav";

function to12h(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const hour = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${(h ?? 0) < 12 ? "AM" : "PM"}`;
}

async function ShopHours() {
  const s = await getSettings();
  return (
    <>
      Open daily {to12h(s.openTime)} – {to12h(s.closeTime)}
    </>
  );
}

async function HeaderAccount() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        {/* Phones get one button (the sign-in page links to sign-up); wider screens get both. */}
        <Button asChild className="sm:hidden">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button variant="ghost" asChild className="hidden sm:inline-flex">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild className="hidden sm:inline-flex">
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
      <div className="bg-night text-[13px] text-white/75">
        <Container className="flex h-9 items-center justify-center gap-x-6 sm:justify-between">
          <span className="flex items-center gap-2">
            <span className="live-dot size-1.5 rounded-full bg-emerald-400" aria-hidden />
            <Suspense fallback="Open daily">
              <ShopHours />
            </Suspense>
          </span>
          <span className="hidden items-center gap-5 sm:flex">
            <span className="flex items-center gap-1.5">
              <Store className="size-3.5" /> Pickup only
            </span>
            <span className="flex items-center gap-1.5">
              <Scale className="size-3.5" /> Priced by actual weight
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" /> Pay at the counter
            </span>
          </span>
        </Container>
      </div>
      {/* Floating nav: takes no space of its own (main reserves --store-nav), so it hovers over the hero. */}
      <header className="pointer-events-none sticky top-0 z-40 mb-[calc(var(--store-nav)*-1)] h-(--store-nav) pt-3">
        <Container>
          <div className="pointer-events-auto rounded-2xl border border-black/[0.06] bg-card/95 shadow-[0_1px_2px_oklch(0.2_0.03_268/0.06),0_12px_32px_-12px_oklch(0.2_0.03_268/0.28)] backdrop-blur-xl backdrop-saturate-150">
            <div className="flex h-16 items-center gap-4 pr-2.5 pl-3.5 sm:gap-8 sm:pr-3 sm:pl-5">
              <Logo href="/" />
              <StoreNav />
              <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                <CartButton />
                <Suspense fallback={<Skeleton className="h-9 w-32 rounded-lg" />}>
                  <HeaderAccount />
                </Suspense>
              </div>
            </div>
            <MobileStoreNav />
          </div>
        </Container>
      </header>
      <main id="main" className="flex-1 pt-(--store-nav)">
        {children}
      </main>
      <footer className="mt-20 bg-night text-white/70">
        <Container className="grid gap-10 py-12 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo href="/" inverted />
            <p className="mt-4 max-w-xs leading-relaxed">
              Fresh pork from trusted local farms, cut to order and weighed in front of you.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white uppercase">Store hours</p>
            <p className="mt-3">Monday to Sunday</p>
            <p>
              <Suspense fallback="Open daily">
                <ShopHours />
              </Suspense>
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white uppercase">Pickup</p>
            <p className="mt-3 leading-relaxed">
              Choose a time at checkout and we’ll notify you when your order is packed. Pay by cash, GCash or card at the
              counter.
            </p>
          </div>
        </Container>
      </footer>
    </CartProvider>
  );
}
