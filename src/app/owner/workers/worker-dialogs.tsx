"use client";

import { useState, useTransition } from "react";
import { KeyRound, MoreHorizontal, Pencil, Power, UserPlus } from "lucide-react";
import {
  createWorkerAction,
  resetWorkerPasswordAction,
  setWorkerActiveAction,
  updateWorkerAction,
} from "@/app/actions/admin";
import { PasswordInput } from "@/app/(auth)/password-input";
import { useConfirm, useConfirmedFormAction } from "@/components/feedback/confirm";
import { runAction } from "@/components/feedback/notify";
import { errorFor, Field, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { WorkerRow } from "@/server/queries/misc";

export function AddWorkerButton() {
  const [open, setOpen] = useState(false);
  const { onSubmit, pending, fieldErrors: fe } = useConfirmedFormAction(createWorkerAction, {
    loading: "Creating the worker account…",
    confirm: (fd) => ({
      title: `Create an account for ${String(fd.get("name") || "this worker")}?`,
      description: "They can sign in straight away with this email and the temporary password. Share the password with them in person.",
      details: [
        { label: "Email", value: String(fd.get("email") ?? "") },
        { label: "Mobile", value: String(fd.get("phone") ?? "") },
        { label: "Starts as", value: "Off duty" },
      ],
      confirmLabel: "Create account",
    }),
    onSuccess: () => setOpen(false),
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Add worker
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a worker</DialogTitle>
            <DialogDescription>They can change the temporary password under Profile after signing in.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <Field label="Full name" htmlFor="w-name" error={errorFor(fe, "name")}>
              <Input id="w-name" name="name" autoComplete="off" aria-invalid={!!errorFor(fe, "name")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email (used to sign in)" htmlFor="w-email" error={errorFor(fe, "email")}>
                <Input id="w-email" name="email" type="email" autoComplete="off" aria-invalid={!!errorFor(fe, "email")} />
              </Field>
              <Field label="Mobile number" htmlFor="w-phone" error={errorFor(fe, "phone")}>
                <Input id="w-phone" name="phone" type="tel" placeholder="09171234567" aria-invalid={!!errorFor(fe, "phone")} />
              </Field>
            </div>
            <Field label="Temporary password" htmlFor="w-password" error={errorFor(fe, "password")} hint="At least 8 characters with a letter and a number">
              <PasswordInput id="w-password" name="password" autoComplete="new-password" aria-invalid={!!errorFor(fe, "password")} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending} pendingLabel="Creating…">
                Create account
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditWorkerDialog({ worker, open, onOpenChange }: { worker: WorkerRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { onSubmit, pending, fieldErrors: fe } = useConfirmedFormAction(updateWorkerAction.bind(null, worker.id), {
    loading: "Saving worker details…",
    confirm: (fd) => {
      const cap = String(fd.get("maxActiveOrders") ?? "").trim();
      return {
        title: `Save changes to ${worker.name}?`,
        description: cap !== String(worker.maxActiveOrders ?? "") ? "A new order limit affects automatic assignment right away." : undefined,
        details: [
          { label: "Name", value: String(fd.get("name") ?? "") },
          { label: "Mobile", value: String(fd.get("phone") ?? "") },
          { label: "Order limit", value: cap || "Shop default" },
        ],
        confirmLabel: "Save changes",
      };
    },
    onSuccess: () => onOpenChange(false),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {worker.name}</DialogTitle>
          <DialogDescription>Update contact details or give this worker their own order limit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Full name" htmlFor="e-name" error={errorFor(fe, "name")}>
            <Input id="e-name" name="name" defaultValue={worker.name} />
          </Field>
          <Field label="Mobile number" htmlFor="e-phone" error={errorFor(fe, "phone")}>
            <Input id="e-phone" name="phone" defaultValue={worker.phone ?? ""} />
          </Field>
          <Field label="Max active orders" htmlFor="e-cap" optional error={errorFor(fe, "maxActiveOrders")} hint="Leave blank to use the shop default from Settings">
            <Input id="e-cap" name="maxActiveOrders" inputMode="numeric" defaultValue={worker.maxActiveOrders ?? ""} className="num w-32" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pending={pending}>Save</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ worker, open, onOpenChange }: { worker: WorkerRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { onSubmit, pending, fieldErrors: fe } = useConfirmedFormAction(resetWorkerPasswordAction.bind(null, worker.id), {
    loading: "Resetting password…",
    confirm: () => ({
      title: `Reset ${worker.name}’s password?`,
      description: "They’ll be signed out on every device and must use the new password. Share it with them in person.",
      confirmLabel: "Reset password",
      tone: "warning",
    }),
    onSuccess: () => onOpenChange(false),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {worker.name}</DialogTitle>
          <DialogDescription>Choose a temporary password for them to sign in with.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="New temporary password" htmlFor="r-password" error={errorFor(fe, "password")}>
            <PasswordInput id="r-password" name="password" autoComplete="new-password" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pending={pending}>Reset password</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WorkerRowActions({ worker }: { worker: WorkerRow }) {
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<"edit" | "password" | null>(null);
  const [pending, start] = useTransition();

  async function toggleActive() {
    const ok = await confirm(
      worker.active
        ? {
            title: `Deactivate ${worker.name}?`,
            description: `They’ll be signed out immediately and can’t sign in. ${
              worker.openOrders
                ? "Orders they haven’t finished go back to the queue for automatic reassignment. Packed orders are flagged on the Assignments page."
                : "They have no open orders."
            }`,
            details: [{ label: "Open orders", value: String(worker.openOrders) }],
            confirmLabel: "Deactivate",
            tone: "destructive",
          }
        : {
            title: `Reactivate ${worker.name}?`,
            description: "They can sign in again. They start off duty and won’t receive orders until they go on duty.",
            confirmLabel: "Reactivate",
          },
    );
    if (!ok) return;
    start(async () => {
      await runAction(() => setWorkerActiveAction(worker.id, !worker.active), {
        loading: worker.active ? "Deactivating…" : "Reactivating…",
      });
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${worker.name}`} disabled={pending}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Pencil /> Edit details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("password")}>
            <KeyRound /> Reset password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant={worker.active ? "destructive" : "default"} onSelect={() => void toggleActive()}>
            <Power /> {worker.active ? "Deactivate" : "Reactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditWorkerDialog worker={worker} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} />
      <ResetPasswordDialog worker={worker} open={dialog === "password"} onOpenChange={(o) => setDialog(o ? "password" : null)} />
    </>
  );
}
