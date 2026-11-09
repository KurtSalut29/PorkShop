"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { signInSchema } from "@/lib/validation";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "../password-input";

const DEMO = [
  { label: "Owner", email: "owner@porkshop.test", password: "Owner1234" },
  { label: "Worker", email: "maria@porkshop.test", password: "Worker1234" },
  { label: "Customer", email: "customer@porkshop.test", password: "Customer1234" },
];

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setPending(true);
    const { error } = await authClient.signIn.email({ ...parsed.data, rememberMe: remember });
    if (error) {
      setPending(false);
      setFormError(
        error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "That email and password don't match. Please try again."
          : (error.message ?? "We couldn't sign you in. Please try again."),
      );
      return;
    }
    // Only allow same-site relative redirects.
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    router.push(target);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
      <FormAlert state={formError ? { ok: false, message: formError } : null} />
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          placeholder="you@example.com"
          autoFocus
        />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password}>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
        />
      </Field>
      <div className="flex items-center gap-2">
        <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
        <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
          Keep me signed in on this device
        </Label>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      {process.env.NODE_ENV !== "production" && (
      <div className="rounded-lg border border-dashed bg-muted/40 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Demo accounts — tap to fill</p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO.map((d) => (
            <Button
              key={d.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEmail(d.email);
                setPassword(d.password);
              }}
            >
              {d.label}
            </Button>
          ))}
        </div>
      </div>
      )}
    </form>
  );
}
