"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NETWORK_ERROR, notify } from "@/components/feedback/notify";
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

  // Cache Components keeps this page alive (hidden) after navigating away. Reset it when hidden
  // so returning after sign-out shows a fresh form — not a stuck "Signing in…" button, and
  // never a leftover password in the DOM.
  useLayoutEffect(() => {
    return () => {
      setPending(false);
      setPassword("");
      setErrors({});
      setFormError(null);
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldMap = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
      setErrors(fieldMap);
      notify.error("Check your sign-in details", Object.values(fieldMap)[0]);
      return;
    }
    setErrors({});
    setPending(true);
    const id = toast.loading("Signing you in…");
    let result: Awaited<ReturnType<typeof authClient.signIn.email>>;
    try {
      result = await authClient.signIn.email({ ...parsed.data, rememberMe: remember });
    } catch {
      setPending(false);
      toast.error(NETWORK_ERROR.title, { id, description: NETWORK_ERROR.description });
      return;
    }
    const { data, error } = result;
    if (error) {
      setPending(false);
      const wrongCredentials = error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD";
      if (wrongCredentials) setErrors({ password: "Incorrect email or password." });
      setFormError(wrongCredentials ? null : (error.message ?? null));
      toast.error(wrongCredentials ? "Incorrect email or password" : "Couldn’t sign you in", {
        id,
        description: wrongCredentials
          ? "Check for typos and try again. Passwords are case-sensitive."
          : (error.message ?? "Please try again in a moment."),
        duration: 7000,
      });
      return;
    }
    toast.success(`Welcome back, ${data?.user.name.split(" ")[0] ?? "there"}`, { id, description: "You're signed in." });
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
