"use client";

import { Fragment, Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronRight,
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
import { LogoMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };
type NavGroup = { label?: string; items: NavItem[] };
type Role = "OWNER" | "WORKER";

const NAV: Record<Role, NavGroup[]> = {
  OWNER: [
    { items: [{ href: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
    {
      label: "Counter",
      items: [
        { href: "/owner/orders", label: "Orders", icon: ClipboardList },
        { href: "/owner/assignments", label: "Assignments", icon: Workflow },
      ],
    },
    {
      label: "Chiller",
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
      label: "Chiller",
      items: [
        { href: "/worker/stock", label: "Record stock", icon: PackageOpen },
        { href: "/worker/inventory", label: "Stock levels", icon: Boxes },
        { href: "/worker/products", label: "Products", icon: Package },
      ],
    },
    { label: "Updates", items: [{ href: "/worker/notifications", label: "Notifications", icon: Bell }] },
  ],
};

const SEGMENT_LABEL: Record<string, string> = {
  owner: "Owner",
  worker: "Worker",
  orders: "Orders",
  assignments: "Assignments",
  products: "Products",
  inventory: "Stock levels",
  transactions: "Stock history",
  workers: "Workers",
  reports: "Reports",
  audit: "Audit log",
  notifications: "Notifications",
  settings: "Settings",
  profile: "Profile",
  stock: "Record stock",
  history: "Order history",
  new: "New",
};

type Badges = Partial<Record<string, React.ReactNode>>;

function SidebarLinks({
  role,
  pathname,
  badges,
  onNavigate,
}: {
  role: Role;
  pathname: string;
  badges?: Badges;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {NAV[role].map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <p className="mb-2 px-3 text-[10.5px] font-semibold tracking-[0.14em] text-sidebar-foreground/45 uppercase">
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
                      "relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary" aria-hidden />}
                    <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/55")} />
                    <span className="truncate">{item.label}</span>
                    {badges?.[item.href]}
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

function ActiveSidebarLinks(props: { role: Role; badges?: Badges; onNavigate?: () => void }) {
  return <SidebarLinks {...props} pathname={usePathname()} />;
}

/** usePathname is request data under Cache Components, so the active highlight streams in. */
function SidebarNav(props: { role: Role; badges?: Badges; onNavigate?: () => void }) {
  return (
    <Suspense fallback={<SidebarLinks {...props} pathname="" />}>
      <ActiveSidebarLinks {...props} />
    </Suspense>
  );
}

function Breadcrumbs() {
  const parts = usePathname().split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      {parts.map((p, i) => {
        const href = "/" + parts.slice(0, i + 1).join("/");
        const label = SEGMENT_LABEL[p] ?? "Details";
        const last = i === parts.length - 1;
        return (
          <Fragment key={href}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
            {last ? (
              <span className="truncate font-medium text-foreground" aria-current="page">
                {label}
              </span>
            ) : (
              <Link href={href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ role, home }: { role: Role; home: string }) {
  return (
    <Link href={home} className="flex items-center gap-3 rounded-lg outline-offset-4">
      <LogoMark className="size-11" />
      <span className="leading-none">
        <span className="display-wide block text-[15px] text-white">PORKSHOP</span>
        <span className="mt-1 block text-[11px] font-medium tracking-wide text-sidebar-foreground/55">
          {role === "OWNER" ? "Owner console" : "Worker station"}
        </span>
      </span>
    </Link>
  );
}

export function AppShell({
  role,
  topbar,
  badges,
  children,
}: {
  role: Role;
  topbar: React.ReactNode;
  badges?: Badges;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const home = role === "OWNER" ? "/owner" : "/worker";

  const footer = (
    <Link
      href="/shop"
      className="flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-white"
    >
      <Store className="size-4" /> View storefront
    </Link>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center px-5">
          <SidebarBrand role={role} home={home} />
        </div>
        <div className="scroll-night flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav role={role} badges={badges} />
        </div>
        <div className="border-t border-sidebar-border p-3">{footer}</div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center px-5">
            <SidebarBrand role={role} home={home} />
          </div>
          <div className="scroll-night overflow-y-auto px-3 py-4">
            <SidebarNav role={role} badges={badges} onNavigate={() => setOpen(false)} />
          </div>
          <div className="mt-auto border-t border-sidebar-border p-3">{footer}</div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
          <Link href={home} className="lg:hidden" aria-label="Home">
            <LogoMark />
          </Link>
          <Suspense fallback={null}>
            <Breadcrumbs />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">{topbar}</div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="enter mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
