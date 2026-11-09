import Image from "next/image";
import { Beef, Bone, Drumstick, Ham, Soup } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductCategory } from "@/lib/constants";

/**
 * Product imagery. Photos sit on a lightly tinted counter tile with multiply blending, so each
 * studio cut-out loses its white box and every product reads as part of one set. The local name
 * rides along as a small shop-sign label, because that's what shoppers here ask for.
 * Without a photo, the tile becomes a solid shop-sign card with the name set large.
 */
const ART: Record<
  ProductCategory,
  { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; sign: string; tint: string; fg: string; sub: string }
> = {
  PRIME_CUTS: { icon: Beef, sign: "bg-[#c02a5e]", tint: "bg-[#fbeef2]", fg: "text-white", sub: "text-white/65" },
  RIBS_AND_BONES: { icon: Bone, sign: "bg-[#1b2440]", tint: "bg-[#eef1f7]", fg: "text-white", sub: "text-white/55" },
  GROUND: { icon: Soup, sign: "bg-[#d2544c]", tint: "bg-[#fcf0ee]", fg: "text-white", sub: "text-white/65" },
  SPECIALTY: { icon: Ham, sign: "bg-[#5d2a56]", tint: "bg-[#f5eef5]", fg: "text-white", sub: "text-white/60" },
  FAT: { icon: Drumstick, sign: "bg-[#efe1c2]", tint: "bg-[#fbf6ea]", fg: "text-[#3a2a12]", sub: "text-[#3a2a12]/55" },
};

const CATEGORY_SHORT: Record<ProductCategory, string> = {
  PRIME_CUTS: "Prime cut",
  RIBS_AND_BONES: "Ribs & bones",
  GROUND: "Ground",
  SPECIALTY: "Specialty",
  FAT: "Fat & lard",
};

const SIZES = {
  sm: "120px",
  md: "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 320px",
  lg: "(max-width: 1024px) 90vw, 560px",
};

export function ProductArt({
  category,
  name,
  label,
  imageUrl,
  className,
  size = "md",
  priority = false,
  imageStyle = "cutout",
}: {
  category: ProductCategory;
  name: string;
  /** Shop-sign text; defaults to the product name. Pass the local name when there is one. */
  label?: string | null;
  imageUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
  /** "cutout" = studio shot on white (blended onto the tile); "photo" = has its own background (full-bleed). */
  imageStyle?: "cutout" | "photo";
}) {
  const art = ART[category];
  const text = (label || name).replace(/^Pork\s+/i, "");

  if (imageUrl) {
    const local = imageUrl.startsWith("/");
    const cutout = imageStyle === "cutout";
    return (
      <div className={cn("relative isolate aspect-[4/3] w-full overflow-hidden rounded-lg", art.tint, className)}>
        <div className={cn("absolute", !cutout ? "inset-0" : size === "sm" ? "inset-1.5" : size === "lg" ? "inset-[9%]" : "inset-[8%]")}>
          {local ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes={SIZES[size]}
              preload={priority}
              quality={90}
              className={cutout ? "object-contain mix-blend-multiply" : "object-cover"}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- owner-provided URLs from any host
            <img src={imageUrl} alt={name} className={cn("size-full", cutout ? "object-contain mix-blend-multiply" : "object-cover")} />
          )}
        </div>
        {size !== "sm" && (
          <span
            className={cn(
              "display-wide absolute bottom-2.5 left-2.5 rounded-md px-2 py-1 text-[11px] leading-none uppercase shadow-sm",
              art.sign,
              art.fg,
              size === "lg" && "bottom-5 left-5 px-3 py-1.5 text-base",
            )}
          >
            {text}
          </span>
        )}
      </div>
    );
  }

  const Icon = art.icon;
  return (
    <div role="img" aria-label={name} className={cn("relative isolate aspect-[4/3] w-full overflow-hidden rounded-lg", art.sign, className)}>
      <Icon
        strokeWidth={1}
        className={cn("absolute -right-[8%] -bottom-[14%] -z-10 opacity-[0.16]", art.fg, size === "sm" ? "size-[78%]" : "size-[70%]")}
      />
      {size !== "sm" && (
        <span className={cn("absolute top-3 left-3.5 text-[10px] font-semibold tracking-[0.18em] uppercase", art.sub, size === "lg" && "top-5 left-6 text-xs")}>
          {CATEGORY_SHORT[category]}
        </span>
      )}
      <span
        className={cn(
          "display-wide absolute right-3 bottom-2.5 left-3.5 leading-[0.9] break-words uppercase",
          art.fg,
          size === "sm" && "right-2 bottom-1.5 left-2 text-[11px]",
          size === "md" && "text-[clamp(1.35rem,3.2vw,2rem)]",
          size === "lg" && "right-6 bottom-5 left-6 text-[clamp(2.5rem,6vw,4.5rem)]",
        )}
      >
        {text}
      </span>
    </div>
  );
}
