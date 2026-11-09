import type { Metadata } from "next";
import Link from "next/link";
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
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          Create a customer account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Staff accounts are created by the shop owner.
      </p>
    </>
  );
}
