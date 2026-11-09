import type { Metadata } from "next";
import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { EmptyState, PageHeader, Section } from "@/components/page";
import { ToneBadge } from "@/components/status";
import { Input } from "@/components/ui/input";
import type { Tone } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/dal";
import { listAuditLog } from "@/server/queries/misc";

export const metadata: Metadata = { title: "Audit log" };

const ENTITIES = [
  { key: "", label: "Everything" },
  { key: "Product", label: "Products & stock" },
  { key: "Order", label: "Orders" },
  { key: "User", label: "Workers" },
  { key: "Settings", label: "Settings" },
];

function toneFor(action: string): Tone {
  if (action.includes("spoilage") || action.includes("deactivate") || action.includes("cancel")) return "red";
  if (action.includes("price") || action.includes("correction")) return "amber";
  if (action.includes("create") || action.includes("stock.in")) return "emerald";
  return "stone";
}

export default async function AuditPage({ searchParams }: PageProps<"/owner/audit">) {
  await requireRole("OWNER");
  const sp = await searchParams;
  const entity = typeof sp.entity === "string" ? sp.entity : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const rows = await listAuditLog({ entityType: entity || undefined, q: q || undefined });

  return (
    <>
      <PageHeader title="Audit log" description="A permanent record of sensitive changes: prices, stock adjustments, staff and settings." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {ENTITIES.map((e) => (
            <Link
              key={e.key || "all"}
              href={`/owner/audit${e.key ? `?entity=${e.key}` : ""}`}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-medium",
                entity === e.key ? "bg-card shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {e.label}
            </Link>
          ))}
        </div>
        <form action="/owner/audit" className="relative w-full lg:w-72" role="search">
          {entity && <input type="hidden" name="entity" value={entity} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search entries" className="pl-9" aria-label="Search audit log" />
        </form>
      </div>
      <Section>
        {rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No entries" description="Nothing matches this filter." />
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="num w-40 shrink-0 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                <ToneBadge tone={toneFor(r.action)} className="w-fit">
                  {r.action}
                </ToneBadge>
                <span className="min-w-0 flex-1 text-sm">{r.summary}</span>
                <span className="text-xs text-muted-foreground">{r.actor?.name ?? "System"}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
