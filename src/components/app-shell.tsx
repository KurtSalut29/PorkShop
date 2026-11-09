"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  History,
  LayoutDashboard,
  Menu,
  Package,
  PackageOpen,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Workflow,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };
type NavGroup = { label?: string; items: NavItem[] };

const NAV: Record<"OWNER" | "WORKER", NavGroup[]> = {
  OWNER: [
    { items: [{ href: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
    {
      label: "Operations",
      items: [
        { href: "/owner/orders", label: "Orders", icon: ClipboardList },
        { href: "/owner/assignments", label: "Assignments", icon: Workflow },
      ],
    },
    {
      label: "Inventory",
      items: [
        { href: "/owner/products", label: "Products", icon: Package },
        { href: "/owner/inventory", label: "Stock levels", icon: Boxes },
        { href: "/owner/transactions", label: "Stock history", icon: History },
      ],
    },
    {
      label: "Business",
      items: [
        { href: "/owner/workers", label: "Workers", icon: Users },
        { href: "/owner/reports", label: "Reports", icon: BarChart3 },
        { href: "/owner/audit", label: "Audit log", icon: ShieldCheck },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/owner/notifications", label: "Notifications", icon: Bell },
        { href: "/owner/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  WORKER: [
    {
      items: [
        { href: "/worker", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/worker/orders", label: "My orders", icon: ClipboardList },
        { href: "/worker/history", label: "Order history", icon: History },
      ],
    },
    {
      label: "Inventory",
      items: [
        { href: "/worker/stock", label: "Record stock", icon: PackageOpen },
        { href: "/worker/inventory", label: "Stock levels", icon: Boxes },
        { href: "/worker/products", label: "Products", icon: Package },
      ],
    },
    { label: "Updates", items: [{ href: "/worker/notifications", label: "Notifications", icon: Bell }] },
  ],
};

/** usePathname is request data under Cache Components — stream the active highlight in. */
function SidebarNav(props: { role: "OWNER" | "WORKER"; onNavigate?: () => void }) {
  return (
    <Suspense fallback={<SidebarLinks {...props} pathname="" />}>
      <ActiveSidebarLinks {...props} />
    </Suspense>
  );
}

function ActiveSidebarLinks(props: { role: "OWNER" | "WORKER"; onNavigate?: () => void }) {
  return <SidebarLinks {...props} pathname={usePathname()} />;
}

function SidebarLinks({
  role,
  onNavigate,
  pathname,
}: {
  role: "OWNER" | "WORKER";
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV[role].map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
              {group.label}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  role,
  topbar,
  children,
}: {
  role: "OWNER" | "WORKER";
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const home = role === "OWNER" ? "/owner" : "/worker";
  const subtitle = role === "OWNER" ? "Owner console" : "Worker station";

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href={home} subtitle={subtitle} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav role={role} />
        </div>
        <div className="border-t p-3">
          <Link
            href="/shop"
            className="flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <Store className="size-4" /> View storefront
          </Link>
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center px-5">
            <Logo href={home} subtitle={subtitle} />
          </div>
          <div className="overflow-y-auto px-3 py-4">
            <SidebarNav role={role} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
          <div className="lg:hidden">
            <Logo href={home} />
          </div>
          <div className="ml-auto flex items-center gap-2">{topbar}</div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
