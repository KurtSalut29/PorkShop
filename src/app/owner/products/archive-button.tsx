"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { archiveProductAction } from "@/app/actions/admin";
import { useConfirm } from "@/components/feedback/confirm";
import { runAction } from "@/components/feedback/notify";
import { Button } from "@/components/ui/button";

export function ArchiveButton({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  async function toggle() {
    const ok = await confirm(
      archived
        ? {
            title: `Restore ${name}?`,
            description: "It goes back into the catalog and customers can order it again, as long as there’s stock.",
            confirmLabel: "Restore product",
          }
        : {
            title: `Archive ${name}?`,
            description:
              "Customers won’t see it or be able to order it. Its sales and stock history stay in your reports, and you can restore it at any time.",
            confirmLabel: "Archive product",
            tone: "destructive",
          },
    );
    if (!ok) return;
    start(async () => {
      await runAction(() => archiveProductAction(id, !archived), { loading: archived ? "Restoring…" : "Archiving…" });
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={pending}>
      {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
