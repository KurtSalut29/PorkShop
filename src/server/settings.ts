import "server-only";
import { db, type Tx } from "./db";

export async function getSettings(client: Tx | typeof db = db) {
  const existing = await client.shopSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return client.shopSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

export type Settings = Awaited<ReturnType<typeof getSettings>>;
