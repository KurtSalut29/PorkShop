import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck, ShoppingBag, UserCheck } from "lucide-react";
import { LogoEmblem } from "@/components/brand";
import { Container } from "@/components/page";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABEL, type ProductCategory } from "@/lib/constants";
import { formatPeso, formatQty, unitLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listCatalog } from "@/server/queries/catalog";

/** `cover` is the cut whose photo represents the category (it matches the sign label). */
const CATEGORIES: { key: ProductCategory; label: string; blurb: string; cover: string }[] = [
  { key: "PRIME_CUTS", label: "Liempo", blurb: "Belly, leg, shoulder & loin", cover: "pork-belly" },
  { key: "RIBS_AND_BONES", label: "Tadyang", blurb: "Spare ribs & soup bones", cover: "pork-ribs" },
  { key: "GROUND", label: "Giniling", blurb: "Ground fresh every morning", cover: "pork-giniling" },
  { key: "SPECIALTY", label: "Pata", blurb: "Hock, feet & whole head", cover: "pork-hock-feet" },
  { key: "FAT", label: "Taba", blurb: "Back fat for lard & chicharon", cover: "pork-fat" },
];

const STEPS = [
  { icon: ShoppingBag, title: "Choose your cuts", body: "Order by the kilo or by the piece. Stock is live, so what you see is what's in the chiller." },
  { icon: CalendarClock, title: "Pick a pickup time", body: "Reserve an hourly slot. Each slot takes a limited number of orders, so the counter never gets crowded." },
  { icon: UserCheck, title: "A butcher prepares it", body: "Your order goes straight to an available butcher, who cuts and weighs it fresh. You can follow every step." },
  { icon: ClipboardCheck, title: "Pick up and pay", body: "We'll tell you when it's packed. Pay the weighed amount by cash, GCash or card." },
];

export default function HomePage() {
  return (
    <>
      <section className="relative -mt-(--store-nav) overflow-hidden bg-night pt-(--store-nav) text-white">
        <div className="night-glow pointer-events-none absolute inset-0" aria-hidden />
        <Container className="relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_1.05fr]">
          <div className="enter">
            <LogoEmblem className="-ml-2 w-28 sm:w-36" />
            <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-white/55 uppercase">Neighbourhood butcher · Order online</p>
            <h1 className="display-wide mt-5 text-[clamp(2.3rem,4.6vw,3.7rem)] leading-[0.95]">
              CUT TO ORDER.
              <br />
              <span className="text-[oklch(0.74_0.17_355)]">WEIGHED FOR YOU.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
              Reserve fresh pork online, pick it up at your chosen time, and pay for exactly what the scale says.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild className="h-11 px-5 text-[15px]">
                <Link href="/shop">
                  See today’s cuts <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-11 border-white/25 bg-transparent px-5 text-[15px] text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/sign-up">Create an account</Link>
              </Button>
            </div>
          </div>

          <Suspense fallback={<Skeleton className="h-[460px] rounded-2xl bg-white/5" />}>
            <PriceBoard />
          </Suspense>
        </Container>
      </section>

      <Container className="py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl">Shop by cut</h2>
          <Link href="/shop" className="text-sm font-medium text-primary hover:underline">
            All cuts
          </Link>
        </div>
        <Suspense fallback={<CategoryTiles />}>
          <CategoryTilesWithPhotos />
        </Suspense>

        <div className="mt-16 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl">Customer favourites</h2>
            <p className="mt-1 text-sm text-muted-foreground">Stock updates live as orders come in.</p>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-96 rounded-2xl" />
              ))}
            </div>
          }
        >
          <Featured />
        </Suspense>
      </Container>

      <section className="border-y bg-card">
        <Container className="py-16">
          <h2 className="text-2xl">How ordering works</h2>
          <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-mono text-xs font-medium text-muted-foreground">STEP {i + 1}</span>
                </span>
                <p className="mt-4 font-display text-[17px] font-semibold">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    </>
  );
}

/** The hero: the counter's price board, live. Prices and remaining stock come straight from inventory. */
async function PriceBoard() {
  const products = await listCatalog();
  return (
    <div className="enter rounded-2xl border border-white/10 bg-[oklch(0.15_0.035_268)] p-2 shadow-[0_30px_60px_-20px_oklch(0_0_0/0.6)] [animation-delay:80ms]">
      <div className="flex items-center justify-between px-4 pt-3 pb-3.5">
        <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-white/80 uppercase">Today at the counter</p>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-300">
          <span className="live-dot size-1.5 rounded-full bg-emerald-400" aria-hidden /> LIVE STOCK
        </span>
      </div>
      <ul className="divide-y divide-white/[0.07] rounded-xl bg-white/[0.03]">
        {products.map((p) => {
          const pct = Math.min(100, (p.available / Math.max(p.lowStockThreshold * 4, 1)) * 100);
          return (
            <li key={p.id}>
              <Link
                href={`/shop/${p.slug}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2.5 transition-colors hover:bg-white/[0.04] sm:grid-cols-[1.3fr_1fr_auto]"
              >
                <span className="min-w-0">
                  <span className="display-wide block truncate text-[15px] text-white uppercase">
                    {p.localName ?? p.name.replace(/^Pork\s+/i, "")}
                  </span>
                  <span className="block truncate text-xs text-white/45">{p.name}</span>
                </span>
                <span className="hidden items-center gap-2.5 sm:flex">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        p.level === "out" ? "bg-transparent" : p.level === "low" ? "bg-amber-400" : "bg-emerald-400",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      "w-16 text-right font-mono text-[11px]",
                      p.level === "out" ? "text-red-300" : p.level === "low" ? "text-amber-300" : "text-white/50",
                    )}
                  >
                    {p.level === "out" ? "SOLD OUT" : formatQty(p.available, p.unit)}
                  </span>
                </span>
                <span className="text-right font-mono text-[15px] font-semibold text-white tabular-nums">
                  {formatPeso(p.price)}
                  <span className="ml-1 text-[10px] font-medium text-white/45 uppercase">/{unitLabel(p.unit, false)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="px-4 pt-3 pb-2 text-xs text-white/40">Updates the moment an order is placed or a delivery arrives.</p>
    </div>
  );
}

/** Category tiles use the photo of their cover cut, falling back to any photographed cut in that category. */
async function CategoryTilesWithPhotos() {
  const products = await listCatalog();
  const photos = Object.fromEntries(
    CATEGORIES.map((c) => {
      const p =
        products.find((x) => x.slug === c.cover && x.imageUrl) ?? products.find((x) => x.category === c.key && x.imageUrl);
      return [c.key, p ? { imageUrl: p.imageUrl, imageStyle: p.imageStyle } : undefined];
    }),
  ) as Partial<Record<ProductCategory, { imageUrl: string | null; imageStyle: "cutout" | "photo" }>>;
  return <CategoryTiles photos={photos} />;
}

function CategoryTiles({
  photos = {},
}: {
  photos?: Partial<Record<ProductCategory, { imageUrl: string | null; imageStyle: "cutout" | "photo" }>>;
}) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CATEGORIES.map((c) => (
        <Link
          key={c.key}
          href={`/shop?category=${c.key}`}
          className="group rounded-2xl border bg-card p-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_oklch(0.2_0.02_240/0.25)]"
        >
          <ProductArt
            category={c.key}
            name={CATEGORY_LABEL[c.key]}
            label={c.label}
            imageUrl={photos[c.key]?.imageUrl}
            imageStyle={photos[c.key]?.imageStyle}
            className="aspect-[5/4] rounded-xl"
          />
          <div className="px-1.5 pt-3 pb-1">
            <p className="text-sm font-semibold group-hover:text-primary">{CATEGORY_LABEL[c.key]}</p>
            <p className="text-xs text-muted-foreground">{c.blurb}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function Featured() {
  const featuredSlugs = ["pork-belly", "pork-ribs", "pork-giniling", "pork-hock-feet"];
  const products = (await listCatalog()).filter((p) => featuredSlugs.includes(p.slug));
  products.sort((a, b) => featuredSlugs.indexOf(a.slug) - featuredSlugs.indexOf(b.slug));
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} eager />
      ))}
    </div>
  );
}
