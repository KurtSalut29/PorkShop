"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/orders", label: "My orders" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function DesktopLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Store" className="hidden items-center gap-1 md:flex">
      {LINKS.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Store" className="flex gap-1 border-t border-black/[0.06] p-1.5 md:hidden">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-center text-sm font-medium",
            isActive(pathname, l.href) ? "bg-muted text-foreground" : "text-muted-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

function ActiveDesktop() {
  return <DesktopLinks pathname={usePathname()} />;
}
function ActiveMobile() {
  return <MobileLinks pathname={usePathname()} />;
}

/** The pathname is request data, so the active highlight streams in; links render instantly. */
export function StoreNav() {
  return (
    <Suspense fallback={<DesktopLinks pathname="" />}>
      <ActiveDesktop />
    </Suspense>
  );
}

export function MobileStoreNav() {
  return (
    <Suspense fallback={<MobileLinks pathname="" />}>
      <ActiveMobile />
    </Suspense>
  );
}
