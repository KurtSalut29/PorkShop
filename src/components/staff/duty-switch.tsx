"use client";

import { useOptimistic, useTransition } from "react";
import { Coffee, Power, Zap } from "lucide-react";
import { toast } from "sonner";
import { setDutyStatusAction } from "@/app/actions/account";
import { DUTY_STATUS, type DutyStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const OPTIONS: { value: DutyStatus; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "ON_DUTY", short: "On duty", icon: Zap },
  { value: "ON_BREAK", short: "Break", icon: Coffee },
  { value: "OFF_DUTY", short: "Off", icon: Power },
];

const ACTIVE: Record<DutyStatus, string> = {
  ON_DUTY: "bg-emerald-600 text-white shadow-sm",
  ON_BREAK: "bg-amber-500 text-white shadow-sm",
  OFF_DUTY: "bg-stone-600 text-white shadow-sm",
};

/** Availability control: drives whether the dispatcher sends this worker new orders. */
export function DutySwitch({ status, size = "sm" }: { status: DutyStatus; size?: "sm" | "lg" }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  function change(next: DutyStatus) {
    if (next === optimistic) return;
    startTransition(async () => {
      setOptimistic(next);
      const res = await setDutyStatusAction(next);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Duty status"
      className={cn("inline-flex rounded-lg border bg-muted/60 p-0.5", pending && "opacity-80", size === "lg" && "w-full p-1")}
    >
      {OPTIONS.map(({ value, short, icon: Icon }) => {
        const active = optimistic === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            title={DUTY_STATUS[value].hint}
            onClick={() => change(value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
              size === "sm" ? "h-8 px-2.5 text-xs" : "h-11 flex-1 px-3 text-sm",
              active ? ACTIVE[value] : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
            <span className={size === "sm" ? "hidden sm:inline" : ""}>{size === "sm" ? short : DUTY_STATUS[value].label}</span>
          </button>
        );
      })}
    </div>
  );
}
