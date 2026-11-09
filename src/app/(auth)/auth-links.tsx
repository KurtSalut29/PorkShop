"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** A same-site path to return to after signing in or up, or null. Rejects `//evil.com`-style values. */
export function safeNext(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function WithNext({ href, children }: { href: string; children: React.ReactNode }) {
  const next = safeNext(useSearchParams().get("next"));
  return (
    <Link href={next ? `${href}?next=${encodeURIComponent(next)}` : href} className="font-medium text-primary hover:underline">
      {children}
    </Link>
  );
}

/** Link between sign-in and sign-up that keeps where the visitor was heading (e.g. checkout). */
export function AuthSwitchLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <Link href={href} className="font-medium text-primary hover:underline">
          {children}
        </Link>
      }
    >
      <WithNext href={href}>{children}</WithNext>
    </Suspense>
  );
}
