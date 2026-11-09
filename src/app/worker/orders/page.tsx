import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { StaffOrderCard } from "@/components/staff/order-card";
import { TONE_DOT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/dal";
import { listWorkerQueue } from "@/server/queries/orders";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "My orders" };

const COLUMNS = [
  { status: "ASSIGNED", title: "To start", tone: "sky", empty: "Nothing waiting" },
  { status: "PROCESSING", title: "Preparing", tone: "violet", empty: "Nothing in progress" },
  { status: "READY", title: "Ready for pickup", tone: "emerald", empty: "Nothing at the counter" },
] as const;

export default async function WorkerOrdersPage() {
  const user = await requireRole("WORKER");
  const [orders, settings] = await Promise.all([listWorkerQueue(user.id), getSettings()]);

  return (
    <>
      <PageHeader title="My orders" description="Work through each column from left to right. Updates sync instantly." />
      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className="rounded-xl bg-muted/50 p-3" aria-label={col.title}>
              <header className="mb-3 flex items-center gap-2 px-1">
                <span className={cn("size-2 rounded-full", TONE_DOT[col.tone])} aria-hidden />
                <h2 className="text-sm font-semibold">{col.title}</h2>
                <span className="num ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-medium">{items.length}</span>
              </header>
              <div className="space-y-3">
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">{col.empty}</p>
                ) : (
                  items.map((o) => (
                    <StaffOrderCard key={o.id} order={o} href={`/worker/orders/${o.id}`} slotMinutes={settings.slotMinutes} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
