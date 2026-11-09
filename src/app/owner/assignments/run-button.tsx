"use client";

import { useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { runAssignmentAction } from "@/app/actions/admin";
import { useConfirm } from "@/components/feedback/confirm";
import { runAction } from "@/components/feedback/notify";
import { Button } from "@/components/ui/button";

export function RunDispatcherButton({ disabled }: { disabled?: boolean }) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || disabled}
      onClick={async () => {
        const ok = await confirm({
          title: "Assign queued orders now?",
          description:
            "The dispatcher runs automatically, but you can run it now. Queued orders go to on-duty workers with spare capacity, using the usual load-balancing rule.",
          confirmLabel: "Run dispatcher",
        });
        if (!ok) return;
        start(async () => {
          await runAction(() => runAssignmentAction(), { loading: "Assigning queued orders…" });
        });
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
      Run dispatcher now
    </Button>
  );
}
