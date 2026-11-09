import { CalendarClock, ShieldCheck, Scale } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand";

const POINTS = [
  { icon: Scale, title: "Priced by actual weight", body: "Order by the kilo; pay for exactly what's cut and weighed." },
  { icon: CalendarClock, title: "Pick your pickup time", body: "Reserve a slot and skip the line at the counter." },
  { icon: ShieldCheck, title: "Live order tracking", body: "See the moment your order is assigned, prepared and ready." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="paper pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative flex items-center gap-2.5">
          <LogoMark className="[&_rect]:fill-white/15" />
          <span className="text-[15px] font-semibold tracking-tight">Porkshop</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold">Fresh pork, cut to order and ready when you are.</h2>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="mt-0.5 block text-sm text-primary-foreground/75">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-primary-foreground/60">Open daily · 7:00 AM – 6:00 PM · Pickup only</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
