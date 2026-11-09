"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { KeyRound, MoreHorizontal, Pencil, Power, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  createWorkerAction,
  resetWorkerPasswordAction,
  setWorkerActiveAction,
  updateWorkerAction,
} from "@/app/actions/admin";
import { PasswordInput } from "@/app/(auth)/password-input";
import { errorFor, Field, FormAlert, SubmitButton } from "@/components/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [state, action] = useActionState(createWorkerAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Add worker
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a worker</DialogTitle>
            <DialogDescription>
              Create their account and share the temporary password. They can change it under Profile after signing in.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-4">
            {state && !state.ok && <FormAlert state={state} />}
            <Field label="Full name" htmlFor="w-name" error={errorFor(fe, "name")}>
              <Input id="w-name" name="name" autoComplete="off" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email (used to sign in)" htmlFor="w-email" error={errorFor(fe, "email")}>
                <Input id="w-email" name="email" type="email" autoComplete="off" />
              </Field>
              <Field label="Mobile number" htmlFor="w-phone" error={errorFor(fe, "phone")}>
                <Input id="w-phone" name="phone" type="tel" placeholder="09171234567" />
              </Field>
            </div>
            <Field label="Temporary password" htmlFor="w-password" error={errorFor(fe, "password")} hint="At least 8 characters with a letter and a number">
              <PasswordInput id="w-password" name="password" autoComplete="new-password" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditWorkerDialog({ worker, open, onOpenChange }: { worker: WorkerRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [state, action] = useActionState(updateWorkerAction.bind(null, worker.id), null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {worker.name}</DialogTitle>
          <DialogDescription>Update contact details or give this worker a custom order capacity.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          {state && !state.ok && <FormAlert state={state} />}
          <Field label="Full name" htmlFor="e-name" error={errorFor(fe, "name")}>
            <Input id="e-name" name="name" defaultValue={worker.name} />
          </Field>
          <Field label="Mobile number" htmlFor="e-phone" error={errorFor(fe, "phone")}>
            <Input id="e-phone" name="phone" defaultValue={worker.phone ?? ""} />
          </Field>
          <Field
            label="Max active orders"
            htmlFor="e-cap"
            optional
            error={errorFor(fe, "maxActiveOrders")}
            hint="Leave blank to use the shop default from Settings"
          >
            <Input id="e-cap" name="maxActiveOrders" inputMode="numeric" defaultValue={worker.maxActiveOrders ?? ""} className="num w-32" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton>Save</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ worker, open, onOpenChange }: { worker: WorkerRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [state, action] = useActionState(resetWorkerPasswordAction.bind(null, worker.id), null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {worker.name}</DialogTitle>
          <DialogDescription>They'll be signed out everywhere and must use the new password.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          {state && !state.ok && <FormAlert state={state} />}
          <Field label="New temporary password" htmlFor="r-password" error={state && !state.ok ? errorFor(state.fieldErrors, "password") : undefined}>
            <PasswordInput id="r-password" name="password" autoComplete="new-password" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton>Reset password</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WorkerRowActions({ worker }: { worker: WorkerRow }) {
  const [dialog, setDialog] = useState<"edit" | "password" | "active" | null>(null);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const res = await setWorkerActiveAction(worker.id, !worker.active);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      setDialog(null);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${worker.name}`}>
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
          <DropdownMenuItem variant={worker.active ? "destructive" : "default"} onSelect={() => setDialog("active")}>
            <Power /> {worker.active ? "Deactivate" : "Reactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditWorkerDialog worker={worker} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} />
      <ResetPasswordDialog worker={worker} open={dialog === "password"} onOpenChange={(o) => setDialog(o ? "password" : null)} />
      <AlertDialog open={dialog === "active"} onOpenChange={(o) => setDialog(o ? "active" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{worker.active ? `Deactivate ${worker.name}?` : `Reactivate ${worker.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {worker.active
                ? `They'll be signed out and can't sign in. ${worker.openOrders ? `Their unfinished orders go back to the queue for automatic reassignment; packed orders will be flagged for you.` : "They have no open orders."}`
                : "They'll be able to sign in again. They start off duty."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                toggle();
              }}
              disabled={pending}
              className={worker.active ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            >
              {worker.active ? "Deactivate" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
