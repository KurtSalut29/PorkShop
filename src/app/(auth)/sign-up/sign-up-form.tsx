"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { signUpSchema } from "@/lib/validation";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput, StrengthMeter } from "../password-input";

type Values = { name: string; email: string; phone: string; password: string; confirmPassword: string; terms: boolean };

const EMPTY: Values = { name: "", email: "", phone: "", password: "", confirmPassword: "", terms: false };

export function SignUpForm() {
  const router = useRouter();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Cache Components keeps this page alive (hidden) after navigating away — start fresh next time.
  useLayoutEffect(() => {
    return () => {
      setValues(EMPTY);
      setErrors({});
      setFormError(null);
      setPending(false);
    };
  }, []);

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    const { name, email, phone, password } = parsed.data;
    const { error } = await authClient.signUp.email({ name, email, password, phone });
    if (error) {
      setPending(false);
      if (error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
        setErrors({ email: "An account with this email already exists. Try signing in instead." });
      } else {
        setFormError(error.message ?? "We couldn't create your account. Please try again.");
      }
      return;
    }
    toast.success(`Welcome to Porkshop, ${name.split(" ")[0]}!`, { description: "Your account is ready. Start browsing fresh cuts." });
    router.push("/shop");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
      <FormAlert state={formError ? { ok: false, message: formError } : null} />
      <Field label="Full name" htmlFor="name" error={errors.name}>
        <Input id="name" autoComplete="name" value={values.name} onChange={set("name")} aria-invalid={!!errors.name} autoFocus />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={set("email")}
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="Mobile number" htmlFor="phone" error={errors.phone} hint="For pickup updates">
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09171234567"
            value={values.phone}
            onChange={set("phone")}
            aria-invalid={!!errors.phone}
          />
        </Field>
      </div>
      <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters with a letter and a number">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={values.password}
          onChange={set("password")}
          aria-invalid={!!errors.password}
        />
      </Field>
      <StrengthMeter password={values.password} />
      <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={set("confirmPassword")}
          aria-invalid={!!errors.confirmPassword}
        />
      </Field>
      <div className="grid gap-1.5">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="terms"
            className="mt-0.5"
            checked={values.terms}
            onCheckedChange={(v) => setValues((s) => ({ ...s, terms: v === true }))}
            aria-invalid={!!errors.terms}
          />
          <Label htmlFor="terms" className="text-sm leading-snug font-normal text-muted-foreground">
            I understand orders are for <span className="text-foreground">in-store pickup</span> and the final price is based
            on the actual weight of my cuts.
          </Label>
        </div>
        {errors.terms && <p className="pl-7 text-[13px] text-destructive">{errors.terms}</p>}
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
