import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import logo from "../../public/brand/piraso-logo.png";

/**
 * The Piraso emblem (chef pig badge) with a transparent background, so it sits cleanly on
 * light and navy surfaces alike.
 */
/** Small and on every screen (often the largest thing painted while a page loads), so always eager. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt=""
      aria-hidden
      loading="eager"
      sizes="(max-width: 640px) 96px, 160px"
      quality={90}
      className={cn("size-10 shrink-0 object-contain", className)}
    />
  );
}

export function Logo({ href = "/", className, inverted = false }: { href?: string; className?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-md outline-offset-4", className)} aria-label="Piraso home">
      <LogoMark />
      <span className={cn("display-wide text-[17px] leading-none", inverted ? "text-white" : "text-foreground")}>PIRASO</span>
    </Link>
  );
}

/** Full emblem for hero and sign-in panels. */
export function LogoEmblem({ className }: { className?: string }) {
  return <Image src={logo} alt="Piraso" preload quality={90} sizes="(max-width: 768px) 160px, 260px" className={cn("h-auto drop-shadow-[0_10px_30px_rgb(212_3_5/0.28)]", className)} />;
}
