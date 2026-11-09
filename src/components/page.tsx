import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-7 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="group mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            {back.label}
          </Link>
        )}
        {eyebrow && (
          <div className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</div>
        )}
        <h1 className="text-[1.65rem] leading-tight sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)]", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            {title && <h2 className="text-[15px]">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const STAT_TONE = {
  default: { icon: "bg-muted text-muted-foreground", bar: "bg-border" },
  warning: { icon: "bg-amber-100 text-amber-700", bar: "bg-amber-400" },
  danger: { icon: "bg-red-100 text-red-700", bar: "bg-red-500" },
  success: { icon: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  primary: { icon: "bg-primary/10 text-primary", bar: "bg-primary" },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof STAT_TONE;
  href?: string;
}) {
  const t = STAT_TONE[tone];
  const body = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border bg-card p-5 shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)] transition-all",
        href && "hover:-translate-y-px hover:border-foreground/15 hover:shadow-md",
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", t.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
        {Icon && (
          <span className={cn("grid size-8 place-items-center rounded-lg", t.icon)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="num mt-3 font-display text-[1.75rem] leading-none font-semibold tracking-tight [font-variation-settings:'wdth'_105]">
        {value}
      </p>
      {hint && <p className="mt-2 text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl border-2 border-dashed border-border bg-muted/50 text-muted-foreground">
          <Icon className="size-6" />
        </span>
      )}
      <p className="font-display text-base font-semibold">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-3 h-9 w-64" />
      <Skeleton className="mb-8 h-4 w-96 max-w-full" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}
