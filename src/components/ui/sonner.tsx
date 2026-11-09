"use client";

import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { cn } from "@/lib/utils";

/**
 * One feedback surface for the whole app, centred at the top where it's seen without
 * covering navigation or the action the user just took.
 *
 * Toasts are set in the logo's Night navy, so they stand apart from the light pages they
 * float over. Each kind has its own icon in a tinted badge, so meaning never depends on
 * colour alone. Toasts that carry buttons (Undo, View cart) drop the close button, since
 * the buttons already end them.
 */
function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("grid size-8 place-items-center rounded-[10px] ring-1 ring-inset", className)}>{children}</span>;
}

const ICONS: ToasterProps["icons"] = {
  success: (
    <Badge className="bg-emerald-400/15 text-emerald-300 ring-emerald-300/20">
      <CircleCheck className="size-[18px]" strokeWidth={2.25} />
    </Badge>
  ),
  info: (
    <Badge className="bg-[#4f7be8]/20 text-[#9db8ff] ring-[#9db8ff]/20">
      <Info className="size-[18px]" strokeWidth={2.25} />
    </Badge>
  ),
  warning: (
    <Badge className="bg-amber-400/15 text-amber-300 ring-amber-300/20">
      <TriangleAlert className="size-[18px]" strokeWidth={2.25} />
    </Badge>
  ),
  error: (
    <Badge className="bg-red-400/15 text-red-300 ring-red-300/25">
      <OctagonX className="size-[18px]" strokeWidth={2.25} />
    </Badge>
  ),
  loading: (
    <Badge className="bg-neon/15 text-neon ring-neon/20">
      <Loader2 className="size-[18px] animate-spin" strokeWidth={2.25} />
    </Badge>
  ),
};

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 focus-visible:ring-offset-night";

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    position="top-center"
    offset={16}
    mobileOffset={10}
    gap={10}
    visibleToasts={4}
    duration={4500}
    closeButton
    className="toaster group"
    icons={ICONS}
    style={{ "--width": "400px" } as React.CSSProperties}
    toastOptions={{
      unstyled: true,
      classNames: {
        toast: cn(
          "flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-night py-3 pr-11 pl-3 font-sans text-white",
          "shadow-[0_1px_0_0_oklch(1_0_0/0.06)_inset,0_18px_40px_-12px_oklch(0.12_0.04_268/0.55),0_4px_12px_-4px_oklch(0.12_0.04_268/0.3)]",
          // Buttons end the toast themselves: no close button, and no space reserved for it.
          "has-[[data-button]]:pr-3 [&:has([data-button])_[data-close-button]]:hidden",
        ),
        // Sonner centres its loading spinner in the nearest positioned box: make that the badge slot.
        icon: "relative size-8 shrink-0",
        content: "flex min-w-0 flex-1 flex-col gap-0.5 pt-[5px]",
        title: "text-[14px] leading-[1.35] font-semibold text-white",
        description: "text-[13px] leading-snug text-white/65",
        error: "border-red-300/25",
        warning: "border-amber-300/20",
        actionButton: cn(
          "h-8 shrink-0 cursor-pointer rounded-lg bg-primary px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[oklch(0.58_0.2_3)]",
          focus,
        ),
        cancelButton: cn(
          "h-8 shrink-0 cursor-pointer rounded-lg bg-white/10 px-3 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.16]",
          focus,
        ),
        closeButton: cn(
          "absolute top-2.5 right-2.5 grid size-7 cursor-pointer place-items-center rounded-lg border-0 bg-transparent! text-white/45 transition-colors hover:bg-white/10! hover:text-white [&_svg]:size-3.5",
          focus,
        ),
      },
    }}
    {...props}
  />
);

export { Toaster };
