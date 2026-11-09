"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/actions/account";
import { PasswordInput, StrengthMeter } from "@/app/(auth)/password-input";
import { useConfirm, useConfirmedFormAction } from "@/components/feedback/confirm";
import { NETWORK_ERROR, notify } from "@/components/feedback/notify";
import { errorFor, Field, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const { onSubmit, pending, fieldErrors: fe } = useConfirmedFormAction(updateProfileAction, {
    loading: "Saving your profile…",
    confirm: (fd) => ({
      title: "Save profile changes?",
      description: "The shop uses these details to contact you about your orders.",
      details: [
        { label: "Name", value: String(fd.get("name") ?? "") },
        { label: "Mobile", value: String(fd.get("phone") ?? "") },
      ],
      confirmLabel: "Save changes",
    }),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5 p-5 sm:p-6" noValidate>
      <Field label="Full name" htmlFor="name" error={errorFor(fe, "name")}>
        <Input id="name" name="name" defaultValue={name} autoComplete="name" aria-invalid={!!errorFor(fe, "name")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" hint="Ask the shop owner if you need to change your email.">
          <Input id="email" value={email} disabled readOnly />
        </Field>
        <Field label="Mobile number" htmlFor="phone" error={errorFor(fe, "phone")}>
          <Input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" aria-invalid={!!errorFor(fe, "phone")} />
        </Field>
      </div>
      <div>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const confirm = useConfirm();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!current) found.current = "Enter your current password.";
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) found.next = "Use at least 8 characters with a letter and a number.";
    if (next && again !== next) found.again = "This doesn’t match the new password.";
    setErrors(found);
    if (Object.keys(found).length) {
      notify.error("Your new password isn’t ready yet", Object.values(found)[0]);
      return;
    }
    const ok = await confirm({
      title: "Change your password?",
      description: "You’ll stay signed in here. Every other device will be signed out and need the new password.",
      confirmLabel: "Change password",
      tone: "warning",
    });
    if (!ok) return;
    setPending(true);
    const id = toast.loading("Changing your password…");
    try {
      const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
      if (error) {
        const wrong = error.code === "INVALID_PASSWORD";
        if (wrong) setErrors({ current: "This isn’t your current password." });
        toast.error(wrong ? "Current password is incorrect" : "Couldn’t change your password", {
          id,
          description: wrong ? "Re-enter your current password and try again." : (error.message ?? "Please try again."),
        });
        return;
      }
      setCurrent("");
      setNext("");
      setAgain("");
      toast.success("Password changed", { id, description: "Other devices have been signed out." });
    } catch {
      toast.error(NETWORK_ERROR.title, { id, description: "Your password was not changed." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 p-5 sm:p-6" noValidate>
      <Field label="Current password" htmlFor="current" error={errors.current}>
        <PasswordInput id="current" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" aria-invalid={!!errors.current} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="New password" htmlFor="new" error={errors.next}>
          <PasswordInput id="new" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" aria-invalid={!!errors.next} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm" error={errors.again}>
          <PasswordInput id="confirm" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" aria-invalid={!!errors.again} />
        </Field>
      </div>
      <StrengthMeter password={next} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Change password
        </Button>
      </div>
    </form>
  );
}
