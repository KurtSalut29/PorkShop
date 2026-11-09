"use client";

import { useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { runAssignmentAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function RunDispatcherButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          const res = await runAssignmentAction();
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
      Run dispatcher now
    </Button>
  );
}
