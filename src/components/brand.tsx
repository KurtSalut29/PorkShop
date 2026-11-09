import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      {/* Monogram P with a cleaver-notch — simple, legible at 16px */}
      <path
        d="M11 23.5V8.5h6.2c3.3 0 5.5 2 5.5 5s-2.2 5-5.5 5H14.6v5H11Zm3.6-8.1h2.4c1.4 0 2.2-.7 2.2-1.9s-.8-1.9-2.2-1.9h-2.4v3.8Z"
        fill="white"
      />
      <path d="M22.5 21.5h3v2h-3z" fill="white" opacity=".7" />
    </svg>
  );
}

export function Logo({ href = "/", className, subtitle }: { href?: string; className?: string; subtitle?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-md outline-offset-4", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">Porkshop</span>
        {subtitle && <span className="mt-1 text-[11px] font-medium text-muted-foreground">{subtitle}</span>}
      </span>
    </Link>
  );
}
