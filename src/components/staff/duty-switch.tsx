"use client";

import { useOptimistic, useTransition } from "react";
import { Coffee, Power, Zap } from "lucide-react";
import { setDutyStatusAction } from "@/app/actions/account";
import { useConfirm, type ConfirmOptions } from "@/components/feedback/confirm";
import { runAction } from "@/components/feedback/notify";
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
  OFF_DUTY: "bg-stone-700 text-white shadow-sm",
};

const QUESTION: Record<DutyStatus, ConfirmOptions> = {
  ON_DUTY: {
    title: "Go on duty?",
    description: "You’ll start receiving new orders automatically, up to your order limit.",
    confirmLabel: "Go on duty",
  },
  ON_BREAK: {
    title: "Take a break?",
    description: "You keep the orders you already have, but no new orders will be sent to you until you’re back on duty.",
    confirmLabel: "Start break",
    tone: "warning",
  },
  OFF_DUTY: {
    title: "End your shift?",
    description:
      "Orders you haven’t started go back to the queue and are reassigned to other workers. Orders you’re preparing or have packed stay with you, and the owner is told about them.",
    confirmLabel: "Go off duty",
    tone: "warning",
  },
};

/** Availability control: drives whether the dispatcher sends this worker new orders. */
export function DutySwitch({ status, size = "sm" }: { status: DutyStatus; size?: "sm" | "lg" }) {
  const confirm = useConfirm();
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  async function change(next: DutyStatus) {
    if (next === optimistic || pending) return;
    if (!(await confirm(QUESTION[next]))) return;
    startTransition(async () => {
      setOptimistic(next);
      await runAction(() => setDutyStatusAction(next), { loading: "Updating your status…" });
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Duty status"
      className={cn("inline-flex rounded-lg border bg-muted/70 p-0.5", pending && "opacity-80", size === "lg" && "w-full p-1")}
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
              active ? ACTIVE[value] : "text-muted-foreground hover:bg-card hover:text-foreground",
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
