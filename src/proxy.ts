import { NextResponse, type NextRequest } from "next/server";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { homeFor } from "@/lib/constants";

/**
 * Optimistic route protection, before any rendering happens:
 *  - visitors without a session cookie go to sign-in;
 *  - signed-in users opening another role's area go to their own home, using the signed
 *    session cache cookie (no database call).
 * Real authorisation (valid session + correct role, re-read from the database) is still
 * enforced by the Data Access Layer on every page, action and API route.
 */
const PROTECTED = ["/owner", "/worker", "/orders", "/checkout", "/account", "/notifications", "/dashboard"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];
const ROLE_AREAS = [
  { prefix: "/owner", role: "OWNER" },
  { prefix: "/worker", role: "WORKER" },
] as const;

const inArea = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);

  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  const area = ROLE_AREAS.find((a) => inArea(pathname, a.prefix));
  if (hasSession && area) {
    const cached = await getCookieCache(request).catch(() => null);
    const role = (cached?.user as { role?: unknown } | undefined)?.role;
    // No cache (expired or unreadable): the page's RoleGate decides instead.
    if (typeof role === "string" && role !== area.role) return NextResponse.redirect(new URL(homeFor(role), request.url));
  }
  if (hasSession && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
