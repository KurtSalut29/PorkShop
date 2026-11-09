import { CalendarClock, Radio, Scale } from "lucide-react";
import Link from "next/link";
import { Logo, LogoEmblem } from "@/components/brand";

const POINTS = [
  { icon: Scale, title: "Priced by actual weight", body: "Order by the kilo and pay for exactly what the scale shows." },
  { icon: CalendarClock, title: "Your pickup time", body: "Reserve a slot and skip the line at the counter." },
  { icon: Radio, title: "Live order tracking", body: "See the moment your order is assigned, prepared and packed." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-night text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="night-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative">
          <Link href="/" aria-label="Porkshop home">
            <LogoEmblem className="-ml-2 w-36" />
          </Link>
        </div>
        <div className="relative max-w-md">
          <p className="display-wide text-[2.6rem] leading-[0.95]">
            FRESH PORK,
            <br />
            <span className="text-[oklch(0.74_0.17_355)]">READY WHEN YOU ARE.</span>
          </p>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.07] ring-1 ring-white/10">
                  <Icon className="size-[18px]" />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="mt-0.5 block text-sm text-white/60">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-xs tracking-wider text-white/40 uppercase">Pickup only · Cash · GCash · Card</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="enter mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
