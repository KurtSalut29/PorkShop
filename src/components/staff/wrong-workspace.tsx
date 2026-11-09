"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Shown by RoleGate for a visitor who doesn't belong in this area; moves them on right away. */
export function WrongWorkspace({ href, reason }: { href: string; reason: "signed-out" | "wrong-role" }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [router, href]);
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div>
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        <p className="mt-3 font-medium">{reason === "signed-out" ? "Please sign in to continue" : "This area is for another role"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Taking you to{" "}
          <Link href={href} replace className="font-medium text-primary hover:underline">
            {reason === "signed-out" ? "sign in" : "your workspace"}
          </Link>
          …
        </p>
      </div>
    </div>
  );
}
