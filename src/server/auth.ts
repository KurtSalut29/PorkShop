import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

export const auth = betterAuth({
  appName: "Piraso",
  database: prismaAdapter(db, { provider: "postgresql" }),
  // Sign-in works from whatever address the app was opened with (localhost, this laptop's
  // Wi-Fi address, or a tunnel URL), not only BETTER_AUTH_URL. Requests from other sites are
  // still refused: a browser's Origin only matches the host it actually sent the request to.
  trustedOrigins: (request) => {
    const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
    if (!host) return [];
    const proto = request?.headers.get("x-forwarded-proto") ?? new URL(request!.url).protocol.replace(":", "");
    return [`${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`];
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  user: {
    additionalFields: {
      // `input: false` — a visitor can never choose their own role at sign-up.
      role: { type: "string", required: false, defaultValue: "CUSTOMER", input: false },
      phone: { type: "string", required: false, input: true },
      active: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Deactivated accounts (e.g. a worker who left) can no longer sign in.
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { active: true },
          });
          if (!user?.active) {
            throw new APIError("FORBIDDEN", {
              message: "This account has been deactivated. Please contact the shop owner.",
            });
          }
        },
      },
    },
  },
  rateLimit: { enabled: process.env.NODE_ENV === "production", window: 60, max: 30 },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
