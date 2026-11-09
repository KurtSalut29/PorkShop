import "server-only";
import { EventEmitter } from "node:events";
import { Client } from "pg";
import { db, type Tx } from "./db";

/**
 * Real-time synchronisation across devices and server instances.
 *
 * Writers call `publish()` which issues `pg_notify` — when run inside a transaction, PostgreSQL
 * only delivers the message after COMMIT, so clients never see uncommitted state.
 * Every Next.js instance keeps one LISTEN connection (the hub) and fans messages out to its
 * Server-Sent-Event subscribers, so devices connected to different instances stay in sync.
 */

export const CHANNEL = "porkshop_events";

export type RealtimeKind = "orders" | "inventory" | "catalog" | "workers" | "notification" | "settings";

export type RealtimeEvent = {
  kind: RealtimeKind;
  /** "all", "role:OWNER", "role:WORKER", "user:<id>" */
  topics: string[];
  toast?: { title: string; body?: string; href?: string };
};

export async function publish(event: RealtimeEvent, client: Pick<Tx, "$executeRaw"> = db) {
  await client.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(event)})`;
}

type Listener = (event: RealtimeEvent) => void;

class RealtimeHub {
  private emitter = new EventEmitter();
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  async ensureConnected() {
    if (this.client) return;
    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connect() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.on("notification", (msg) => {
      if (!msg.payload) return;
      try {
        this.emitter.emit("event", JSON.parse(msg.payload) as RealtimeEvent);
      } catch {
        /* ignore malformed payloads */
      }
    });
    client.on("error", (err) => {
      console.error("[realtime] listener error, reconnecting", err.message);
      this.client = null;
      client.end().catch(() => {});
      setTimeout(() => this.ensureConnected().catch(() => {}), 2000);
    });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    this.client = client;
  }

  subscribe(listener: Listener) {
    this.emitter.on("event", listener);
    return () => {
      this.emitter.off("event", listener);
    };
  }
}

const globalForHub = globalThis as unknown as { realtimeHub?: RealtimeHub };
export const realtimeHub = (globalForHub.realtimeHub ??= new RealtimeHub());
