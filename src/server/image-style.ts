import "server-only";
import path from "node:path";
import sharp from "sharp";
import { db } from "./db";

export type ImageStyle = "cutout" | "photo";

const cache = new Map<string, Promise<ImageStyle>>();

/**
 * Decides how a product photo should be presented:
 *  - "cutout": a studio shot on white. Blended onto a tinted tile so the white box disappears.
 *  - "photo":  a picture with its own background. Shown full-bleed like a framed photo.
 * Measured once per image from its border pixels (>= 90% near-white = cut-out) and cached.
 */
export function imageStyleFor(url: string | null | undefined): Promise<ImageStyle> {
  if (!url) return Promise.resolve("cutout");
  if (!url.startsWith("/")) return Promise.resolve("photo"); // remote images: don't guess
  let pending = cache.get(url);
  if (!pending) {
    pending = (url.startsWith(UPLOAD_PREFIX) ? uploadedStyle(url) : measureFile(url)).catch(() => "photo" as const);
    cache.set(url, pending);
  }
  return pending;
}

/** Path under which owner-uploaded photos are served (see app/media/products/[file]/route.ts). */
export const UPLOAD_PREFIX = "/media/products/";

/** Uploaded photos are measured once at upload time; read the stored result. */
async function uploadedStyle(url: string): Promise<ImageStyle> {
  const id = url.slice(UPLOAD_PREFIX.length).replace(/\.webp$/, "");
  const row = await db.productImage.findUnique({ where: { id }, select: { style: true } });
  return row?.style === "cutout" ? "cutout" : "photo";
}

function measureFile(url: string) {
  const file = path.join(process.cwd(), "public", path.normalize(url).replace(/^([/\\])+/, ""));
  return measureStyle(file);
}

/**
 * Cut-out or photo, from the image's border: >= 90% near-white border pixels = studio cut-out.
 * Samples a 96px thumbnail: border colour survives a nearest-neighbour shrink, and decoding
 * stays cheap so it never competes with the image optimizer for worker threads.
 */
export async function measureStyle(input: string | Buffer): Promise<ImageStyle> {
  const { data, info } = await sharp(input)
    .resize(96, 96, { fit: "fill", kernel: sharp.kernel.nearest })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let total = 0;
  let white = 0;
  const sample = (x: number, y: number) => {
    const i = (y * W + x) * C;
    total++;
    if (data[i]! >= 248 && data[i + 1]! >= 248 && data[i + 2]! >= 248) white++;
  };
  for (let x = 0; x < W; x++) {
    sample(x, 0);
    sample(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    sample(0, y);
    sample(W - 1, y);
  }
  return white / total >= 0.9 ? "cutout" : "photo";
}

/** Adds `imageStyle` to product views. */
export async function withImageStyles<T extends { imageUrl: string | null }>(items: T[]): Promise<(T & { imageStyle: ImageStyle })[]> {
  const styles = await Promise.all(items.map((p) => imageStyleFor(p.imageUrl)));
  return items.map((p, i) => ({ ...p, imageStyle: styles[i]! }));
}
