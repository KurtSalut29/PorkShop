"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { archiveProductAction } from "@/app/actions/admin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ArchiveButton({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const res = await archiveProductAction(id, !archived);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });

  if (archived) {
    return (
      <Button variant="ghost" size="sm" onClick={run} disabled={pending}>
        <ArchiveRestore className="size-3.5" /> Restore
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending}>
          <Archive className="size-3.5" /> Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be hidden from the catalog and can't be ordered. Its sales and stock history stay in your reports, and you
            can restore it at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={run}>Archive product</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
