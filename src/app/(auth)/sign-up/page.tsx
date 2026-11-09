import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSwitchLink } from "../auth-links";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        Order fresh cuts online and pick them up at a time that suits you.
      </p>
      <Suspense>
        <SignUpForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <AuthSwitchLink href="/sign-in">Sign in</AuthSwitchLink>
      </p>
    </>
  );
}
