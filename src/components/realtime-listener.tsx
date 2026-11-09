"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Incoming = { kind: string; toast?: { title: string; body?: string; href?: string } };

/**
 * Keeps every open screen in sync. When the server announces a change (new order, stock
 * movement, assignment…) the current route's Server Components are re-rendered in place —
 * no manual reload, no stale stock counts. Bursts of events are coalesced into one refresh.
 */
export function RealtimeListener() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let source: EventSource | null = null;
    let closed = false;

    const connect = () => {
      source = new EventSource("/api/events");
      source.onmessage = (e) => {
        let data: Incoming;
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        if (data.toast) {
          toast(data.toast.title, {
            description: data.toast.body,
            action: data.toast.href
              ? { label: "View", onClick: () => router.push(data.toast!.href!) }
              : undefined,
          });
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 250);
      };
      source.onerror = () => {
        // EventSource reconnects automatically; if the server closed for good, retry later.
        if (source?.readyState === EventSource.CLOSED && !closed) setTimeout(connect, 5000);
      };
    };

    connect();
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      closed = true;
      source?.close();
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);

  return null;
}
