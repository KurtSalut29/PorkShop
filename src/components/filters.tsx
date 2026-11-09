"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** URL-driven filter controls: every change updates the query string so views are shareable. */
export function useFilterNavigation(basePath: string) {
  const router = useRouter();
  const params = useSearchParams();
  return (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${basePath}${next.size ? `?${next}` : ""}`);
  };
}

export function SelectFilter({
  basePath,
  name,
  label,
  value,
  options,
  allLabel,
}: {
  basePath: string;
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  const set = useFilterNavigation(basePath);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`f-${name}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value || "__all"} onValueChange={(v) => set(name, v === "__all" ? null : v)}>
        <SelectTrigger id={`f-${name}`} className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="__all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DateRangeFilter({ basePath, from, to }: { basePath: string; from: string; to: string }) {
  const set = useFilterNavigation(basePath);
  return (
    <div className="flex gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor="f-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input id="f-from" type="date" defaultValue={from} max={to} onChange={(e) => e.target.value && set("from", e.target.value)} className="num w-40" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input id="f-to" type="date" defaultValue={to} min={from} onChange={(e) => e.target.value && set("to", e.target.value)} className="num w-40" />
      </div>
    </div>
  );
}
