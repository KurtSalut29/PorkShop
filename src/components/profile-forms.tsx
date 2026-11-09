"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/actions/account";
import { PasswordInput, StrengthMeter } from "@/app/(auth)/password-input";
import { errorFor, Field, FormAlert, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const [state, action] = useActionState(updateProfileAction, null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="grid gap-5 p-5 sm:p-6">
      {state && !state.ok && <FormAlert state={state} />}
      <Field label="Full name" htmlFor="name" error={errorFor(fe, "name")}>
        <Input id="name" name="name" defaultValue={name} autoComplete="name" aria-invalid={!!errorFor(fe, "name")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" hint="Contact the shop owner to change your email.">
          <Input id="email" value={email} disabled readOnly />
        </Field>
        <Field label="Mobile number" htmlFor="phone" error={errorFor(fe, "phone")}>
          <Input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" aria-invalid={!!errorFor(fe, "phone")} />
        </Field>
      </div>
      <div>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      setError("Use at least 8 characters with a letter and a number.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) {
      setError(error.code === "INVALID_PASSWORD" ? "Your current password is incorrect." : (error.message ?? "Could not change password."));
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password changed", { description: "Other devices have been signed out." });
  }

  return (
    <form onSubmit={submit} className="grid gap-5 p-5 sm:p-6" noValidate>
      <FormAlert state={error ? { ok: false, message: error } : null} />
      <Field label="Current password" htmlFor="current">
        <PasswordInput id="current" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="New password" htmlFor="new">
          <PasswordInput id="new" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
      <StrengthMeter password={next} />
      <div>
        <Button type="submit" disabled={pending || !current || !next}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Update password
        </Button>
      </div>
    </form>
  );
}
