"use client";

import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * One feedback surface for the whole app, centred at the top where it's seen without
 * covering navigation or the action the user just took. Each kind has its own icon and
 * accent bar so meaning never depends on colour alone.
 */
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="top-center"
    offset={14}
    mobileOffset={10}
    visibleToasts={4}
    duration={4500}
    closeButton
    className="toaster group"
    icons={{
      success: <CircleCheck className="size-[18px] text-emerald-600" />,
      info: <Info className="size-[18px] text-sky-600" />,
      warning: <TriangleAlert className="size-[18px] text-amber-600" />,
      error: <OctagonX className="size-[18px] text-red-600" />,
      loading: <Loader2 className="size-[18px] animate-spin text-muted-foreground" />,
    }}
    style={
      {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "12px",
        "--width": "380px",
      } as React.CSSProperties
    }
    toastOptions={{
      classNames: {
        toast:
          "cn-toast !gap-3 !px-4 !py-3.5 !shadow-[0_10px_30px_-8px_oklch(0.2_0.02_240/0.28)] border-l-4! font-sans",
        title: "!text-[14px] !font-semibold",
        description: "!text-[13px] !leading-snug !text-muted-foreground",
        success: "!border-l-emerald-600",
        error: "!border-l-red-600",
        warning: "!border-l-amber-500",
        info: "!border-l-sky-600",
        loading: "!border-l-stone-400",
        actionButton: "!bg-primary !text-primary-foreground !font-medium !rounded-md",
        closeButton: "!bg-card !border-border",
      },
    }}
    {...props}
  />
);

export { Toaster };
