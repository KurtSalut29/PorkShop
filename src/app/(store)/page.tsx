import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardCheck, Scale, ShoppingBag, UserCheck } from "lucide-react";
import { Container } from "@/components/page";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABEL, type ProductCategory } from "@/lib/constants";
import { listCatalog } from "@/server/queries/catalog";

const CATEGORIES: { key: ProductCategory; blurb: string }[] = [
  { key: "PRIME_CUTS", blurb: "Belly, leg, shoulder & loin" },
  { key: "RIBS_AND_BONES", blurb: "Spare ribs & soup bones" },
  { key: "GROUND", blurb: "Fresh giniling daily" },
  { key: "SPECIALTY", blurb: "Pata & whole head" },
  { key: "FAT", blurb: "Back fat for lard" },
];

const STEPS = [
  { icon: ShoppingBag, title: "Choose your cuts", body: "Order by the kilo or per piece, with live stock so you only buy what's really available." },
  { icon: CalendarClock, title: "Pick a pickup time", body: "Reserve an hourly slot. Each slot has limited capacity, so the counter never gets crowded." },
  { icon: UserCheck, title: "We prepare it", body: "Your order is assigned to an available butcher, who cuts and weighs it fresh." },
  { icon: ClipboardCheck, title: "Pick up & pay", body: "You'll be notified when it's packed. Pay by cash, GCash or card at the counter." },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b bg-card">
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Taking orders today · 7 AM – 6 PM
            </p>
            <h1 className="mt-5 text-4xl leading-[1.1] font-semibold sm:text-5xl">
              Fresh pork, cut to order and ready when you are.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Order online, choose your pickup time, and pay for the exact weight we cut, with no queue at the counter.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/shop">
                  Browse cuts <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sign-up">Create an account</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Priced by actual weight", "Live order tracking", "Pickup slots that don't overbook"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <ProductArt category="PRIME_CUTS" name="Pork belly" size="lg" className="col-span-2 aspect-[16/9] rounded-2xl" />
              <ProductArt category="RIBS_AND_BONES" name="Pork ribs" className="rounded-2xl" />
              <ProductArt category="SPECIALTY" name="Pork hock" className="rounded-2xl" />
            </div>
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg sm:left-8">
              <span className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <Scale className="size-4" />
              </span>
              <div className="text-sm">
                <p className="font-medium">Order #001042 is ready</p>
                <p className="text-muted-foreground">1.27 kg Liempo · ₱495.30</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-14">
        <h2 className="text-xl font-semibold">Shop by category</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={`/shop?category=${c.key}`}
              className="group rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-primary/30"
            >
              <ProductArt category={c.key} name={CATEGORY_LABEL[c.key]} size="sm" className="aspect-[3/2]" />
              <p className="mt-3 text-sm font-medium group-hover:text-primary">{CATEGORY_LABEL[c.key]}</p>
              <p className="text-xs text-muted-foreground">{c.blurb}</p>
            </Link>
          ))}
        </div>

        <div className="mt-14 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Popular this week</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live stock, updated as orders come in.</p>
          </div>
          <Link href="/shop" className="text-sm font-medium text-primary hover:underline">
            View all cuts
          </Link>
        </div>
        <Suspense
          fallback={
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-xl" />
              ))}
            </div>
          }
        >
          <Featured />
        </Suspense>
      </Container>

      <section className="border-y bg-card">
        <Container className="py-14">
          <h2 className="text-xl font-semibold">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </span>
                  <span className="num text-sm font-medium text-muted-foreground">Step {i + 1}</span>
                </span>
                <p className="mt-4 font-medium">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    </>
  );
}

async function Featured() {
  const featuredSlugs = ["pork-belly", "pork-ribs", "pork-giniling", "pork-leg"];
  const products = (await listCatalog()).filter((p) => featuredSlugs.includes(p.slug));
  products.sort((a, b) => featuredSlugs.indexOf(a.slug) - featuredSlugs.indexOf(b.slug));
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
