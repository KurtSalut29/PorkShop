import type { Metadata } from "next";
import { Users } from "lucide-react";
import { EmptyState, PageHeader, Section } from "@/components/page";
import { DutyBadge, ToneBadge } from "@/components/status";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/dal";
import { listWorkers } from "@/server/queries/misc";
import { getSettings } from "@/server/settings";
import { AddWorkerButton, WorkerRowActions } from "./worker-dialogs";

export const metadata: Metadata = { title: "Workers" };

export default async function WorkersPage() {
  await requireRole("OWNER");
  const [workers, settings] = await Promise.all([listWorkers(), getSettings()]);

  return (
    <>
      <PageHeader title="Workers" description="Staff accounts that receive orders automatically." actions={<AddWorkerButton />} />
      <Section>
        {workers.length === 0 ? (
          <EmptyState icon={Users} title="No workers yet" description="Add your first worker so orders can be assigned." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Worker</th>
                  <th className="px-3 py-3 font-medium">Mobile</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Open orders</th>
                  <th className="px-3 py-3 text-right font-medium">Capacity</th>
                  <th className="px-3 py-3 text-right font-medium">Completed</th>
                  <th className="px-3 py-3 font-medium">Since</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {workers.map((w) => (
                  <tr key={w.id} className={cn(!w.active && "text-muted-foreground")}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(w.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{w.name}</p>
                          <p className="text-xs text-muted-foreground">{w.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="num px-3 py-3">{w.phone ?? "—"}</td>
                    <td className="px-3 py-3">{w.active ? <DutyBadge status={w.dutyStatus} /> : <ToneBadge tone="stone">Deactivated</ToneBadge>}</td>
                    <td className="num px-3 py-3 text-right">{w.openOrders}</td>
                    <td className="num px-3 py-3 text-right">
                      {w.maxActiveOrders ?? settings.maxActiveOrdersPerWorker}
                      {w.maxActiveOrders === null && <span className="text-xs text-muted-foreground"> (default)</span>}
                    </td>
                    <td className="num px-3 py-3 text-right">{w.completed}</td>
                    <td className="num px-3 py-3 text-muted-foreground">{formatDate(w.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <WorkerRowActions worker={w} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
