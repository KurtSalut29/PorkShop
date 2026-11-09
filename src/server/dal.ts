import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { homeFor, type Role } from "@/lib/constants";
import { auth } from "./auth";
import { db } from "./db";
import { DomainError } from "./errors";

/**
 * Data Access Layer: the single place that turns a request into a verified user.
 * Every page, Server Action and Route Handler goes through here — UI checks are never trusted.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      dutyStatus: true,
    },
  });
  if (!user || !user.active) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/**
 * The signed-in user if they have one of `roles`, otherwise null. Never redirects: for parts of
 * a page (nav badges, top bar) that should simply not render for the wrong visitor, so the
 * page's single gate (RoleGate) is the only place that sends them elsewhere.
 */
export async function getUserWithRole(...roles: Role[]) {
  const user = await getCurrentUser();
  return user && roles.includes(user.role) ? user : null;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

/** For Server Actions: same check, but throws instead of redirecting. */
export async function assertRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("Your session has ended. Please sign in again.");
  if (!roles.includes(user.role)) throw new DomainError("You don't have permission to do that.");
  return user;
}
