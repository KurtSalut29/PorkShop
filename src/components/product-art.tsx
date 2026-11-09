import { Beef, Bone, Drumstick, Ham, Soup } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductCategory } from "@/lib/constants";

const ART: Record<ProductCategory, { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; bg: string; fg: string }> = {
  PRIME_CUTS: { icon: Beef, bg: "bg-[oklch(0.93_0.035_25)]", fg: "text-[oklch(0.45_0.13_22)]" },
  RIBS_AND_BONES: { icon: Bone, bg: "bg-[oklch(0.94_0.03_70)]", fg: "text-[oklch(0.5_0.09_60)]" },
  GROUND: { icon: Soup, bg: "bg-[oklch(0.93_0.03_40)]", fg: "text-[oklch(0.48_0.11_35)]" },
  SPECIALTY: { icon: Ham, bg: "bg-[oklch(0.935_0.025_10)]", fg: "text-[oklch(0.46_0.11_10)]" },
  FAT: { icon: Drumstick, bg: "bg-[oklch(0.95_0.025_85)]", fg: "text-[oklch(0.52_0.08_75)]" },
};

/** Product imagery: uses the uploaded photo when present, otherwise a calm category illustration. */
export function ProductArt({
  category,
  name,
  imageUrl,
  className,
  size = "md",
}: {
  category: ProductCategory;
  name: string;
  imageUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- owner-provided URLs from any host
      <img src={imageUrl} alt={name} className={cn("aspect-[4/3] w-full rounded-lg object-cover", className)} />
    );
  }
  const art = ART[category];
  const Icon = art.icon;
  return (
    <div
      role="img"
      aria-label={name}
      className={cn("paper relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg", art.bg, className)}
    >
      <Icon
        strokeWidth={1.25}
        className={cn(
          art.fg,
          size === "sm" && "size-6",
          size === "md" && "size-14",
          size === "lg" && "size-24",
        )}
      />
    </div>
  );
}
