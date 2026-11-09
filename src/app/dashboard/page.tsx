import { Suspense } from "react";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/constants";
import { getCurrentUser } from "@/server/dal";

/** Post-login landing: sends each role to its own home. */
export default function DashboardRedirect() {
  return (
    <Suspense>
      <RedirectByRole />
    </Suspense>
  );
}

async function RedirectByRole(): Promise<null> {
  const user = await getCurrentUser();
  redirect(user ? homeFor(user.role) : "/sign-in");
}
