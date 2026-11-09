import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { ConfirmProvider } from "@/components/feedback/confirm";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ViewTransitionGuard } from "@/components/view-transition-guard";
import "./globals.css";

/** Display: wide grotesk with a shop-sign voice. Used sparingly for headings and product labels. */
const display = Archivo({ subsets: ["latin"], variable: "--font-display", axes: ["wdth"], display: "swap" });
/** Body: clean, slightly humanist sans for dense interface text. */
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
/** Utility: receipt-printer mono for prices, weights and order codes (the "scale ticket"). */
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-ticket", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Porkshop: fresh pork, cut to order", template: "%s · Porkshop" },
  description: "Order fresh pork cuts online and pick them up at your chosen time. Priced by the actual weight.",
};

export const viewport: Viewport = {
  themeColor: "#10162a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-PH" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={200}>
          <ConfirmProvider>{children}</ConfirmProvider>
        </TooltipProvider>
        <Toaster />
        <ViewTransitionGuard />
      </body>
    </html>
  );
}
