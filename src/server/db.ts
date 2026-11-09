import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 15 });
  return new PrismaClient({
    adapter,
    // Busy moments (a burst of checkouts, the dispatcher, live updates) can briefly use every
    // connection. Wait up to 10s for one instead of failing after Prisma's 2s default.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
}

/** One Prisma client per server instance (re-used across hot reloads in development). */
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
