import type { Metadata } from "next";
import { AuthSwitchLink } from "../auth-links";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">Sign in to order, track pickups or manage the shop.</p>
      <Suspense>
        <SignInForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to Porkshop?{" "}
        <AuthSwitchLink href="/sign-up">Create a customer account</AuthSwitchLink>
      </p>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Staff accounts are created by the shop owner.
      </p>
    </>
  );
}
