"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/feedback/confirm";
import { NETWORK_ERROR } from "@/components/feedback/notify";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { ROLE_LABEL, homeFor, type Role } from "@/lib/constants";
import { initials } from "@/lib/format";

export function UserMenu({
  name,
  email,
  role,
  profileHref,
  showDashboardLink = false,
}: {
  name: string;
  email: string;
  role: Role;
  profileHref: string;
  showDashboardLink?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  async function signOut() {
    const ok = await confirm({
      title: "Sign out of Porkshop?",
      description:
        role === "WORKER"
          ? "Your duty status stays as it is. Switch to Off duty first if you're ending your shift, so your unstarted orders go to someone else."
          : "You'll need your email and password to sign in again on this device.",
      confirmLabel: "Sign out",
      cancelLabel: "Stay signed in",
      tone: role === "WORKER" ? "warning" : "default",
    });
    if (!ok) return;
    const id = toast.loading("Signing you out…");
    try {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message);
      toast.success("You're signed out", { id, description: "See you next time." });
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR.title, { id, description: "You're still signed in. Try again when you're back online." });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-full p-0.5 pr-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:rounded-lg sm:pr-2"
        aria-label="Account menu"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-sm font-medium">{name}</span>
          <span className="block text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showDashboardLink && (
          <DropdownMenuItem asChild>
            <Link href={homeFor(role)}>
              <LayoutDashboard /> Go to dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <UserRound /> Profile & password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} variant="destructive">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
