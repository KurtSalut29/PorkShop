"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Incoming = { kind: string; toast?: { title: string; body?: string; href?: string } };
export type LiveStatus = "connecting" | "live" | "reconnecting" | "offline";

// ── Tiny shared store so any component can show the connection state ──
let status: LiveStatus = "connecting";
const subscribers = new Set<() => void>();
function setStatus(next: LiveStatus) {
  if (status === next) return;
  status = next;
  subscribers.forEach((s) => s());
}
const subscribe = (cb: () => void) => {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
};
export function useLiveStatus() {
  return useSyncExternalStore(subscribe, () => status, () => "connecting" as LiveStatus);
}

const CONNECTION_TOAST = "realtime-connection";

/**
 * Keeps every open screen in sync. When the server announces a change (new order, stock
 * movement, assignment…) the current route's Server Components re-render in place.
 * Connection problems are reported to the user rather than failing silently.
 */
export function RealtimeListener() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let source: EventSource | null = null;
    let closed = false;
    let warned = false;
    let lostTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source = new EventSource("/api/events");
      source.onopen = () => {
        if (lostTimer) clearTimeout(lostTimer);
        setStatus("live");
        if (warned) {
          warned = false;
          toast.success("Live updates restored", {
            id: CONNECTION_TOAST,
            description: "You're seeing the latest orders and stock again.",
          });
          router.refresh();
        }
      };
      source.onmessage = (e) => {
        let data: Incoming;
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        if (data.toast) {
          toast.info(data.toast.title, {
            description: data.toast.body,
            action: data.toast.href ? { label: "View", onClick: () => router.push(data.toast!.href!) } : undefined,
          });
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 250);
      };
      source.onerror = () => {
        if (closed) return;
        setStatus(navigator.onLine ? "reconnecting" : "offline");
        // Brief blips are normal (e.g. server restart); only warn if it lasts.
        lostTimer ??= setTimeout(() => {
          lostTimer = null;
          if (status === "live" || closed) return;
          warned = true;
          toast.warning("Live updates paused", {
            id: CONNECTION_TOAST,
            description: "Reconnecting… Changes from other devices will appear once the connection is back.",
            duration: Infinity,
          });
        }, 4000);
        if (source?.readyState === EventSource.CLOSED) setTimeout(connect, 5000);
      };
    };

    const onOffline = () => {
      setStatus("offline");
      toast.error("You're offline", {
        id: "network",
        description: "Actions won't be saved until your connection returns.",
        duration: Infinity,
      });
    };
    const onOnline = () => {
      toast.success("Back online", { id: "network", description: "Your connection has been restored." });
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    connect();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      closed = true;
      source?.close();
      if (lostTimer) clearTimeout(lostTimer);
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}

const LABEL: Record<LiveStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

/** Small status pill: tells staff whether what they see is up to date. */
export function LiveIndicator({ className }: { className?: string }) {
  const s = useLiveStatus();
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
        s === "live" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : s === "offline" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800",
        className,
      )}
      role="status"
      aria-live="polite"
      title={s === "live" ? "Changes from other devices appear instantly" : "Live updates are not connected"}
    >
      <span className={cn("size-1.5 rounded-full", s === "live" ? "live-dot bg-emerald-500" : s === "offline" ? "bg-red-500" : "bg-amber-500")} />
      {LABEL[s]}
    </span>
  );
}
