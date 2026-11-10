import "server-only";
import sharp, { type Metadata } from "sharp";
import { db } from "./db";
import { DomainError } from "./errors";
import { UPLOAD_PREFIX, measureStyle, type ImageStyle } from "./image-style";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB: a full-resolution phone photo fits
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "gif", "tiff"]);
const MAX_EDGE = 1600; // px on the longest side: sharp on retina product pages, small on disk
const MIN_EDGE = 300; // smaller than this looks blurry on a product card

export type UploadedImage = { url: string; imageStyle: ImageStyle; width: number; height: number };

/**
 * Validates and stores a product photo. The file's real format is read from its bytes (the
 * browser's filename and type are not trusted), phone rotation is applied, metadata (including
 * GPS location) is stripped, and the result is re-encoded as WebP at most 1600px on its longest side.
 */
export async function saveProductImage(file: Buffer, uploadedBy: string): Promise<UploadedImage> {
  if (file.byteLength === 0) throw new DomainError("That file is empty. Choose a photo and try again.");
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new DomainError("That photo is larger than 10 MB. Choose a smaller one.");

  let meta: Metadata;
  try {
    meta = await sharp(file).metadata();
  } catch {
    throw new DomainError("That file isn’t a photo we can read. Use a JPG, PNG or WebP image.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new DomainError("That file type isn’t supported. Use a JPG, PNG or WebP image.");
  }
  const w = meta.autoOrient?.width ?? meta.width ?? 0;
  const h = meta.autoOrient?.height ?? meta.height ?? 0;
  if (Math.max(w, h) < MIN_EDGE) {
    throw new DomainError(`That photo is only ${w}×${h} px. Use one at least ${MIN_EDGE} px wide so it stays sharp.`);
  }

  const { data, info } = await sharp(file, { animated: false })
    .rotate() // apply the camera's orientation, then drop the EXIF data
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  const imageStyle = await measureStyle(data);

  const row = await db.productImage.create({
    data: {
      data: new Uint8Array(data),
      mimeType: "image/webp",
      width: info.width,
      height: info.height,
      byteSize: data.byteLength,
      style: imageStyle,
      uploadedBy,
    },
    select: { id: true },
  });
  return { url: `${UPLOAD_PREFIX}${row.id}.webp`, imageStyle, width: info.width, height: info.height };
}

/** The id of an uploaded photo from its URL, or null for any other image. */
export function uploadedImageId(url: string | null | undefined) {
  if (!url?.startsWith(UPLOAD_PREFIX)) return null;
  const id = url.slice(UPLOAD_PREFIX.length).replace(/\.webp$/, "");
  return /^[a-z0-9]{20,40}$/.test(id) ? id : null;
}

export function getProductImage(id: string) {
  return db.productImage.findUnique({ where: { id }, select: { data: true, mimeType: true } });
}

/** Deletes an uploaded photo once no product uses it any more (e.g. after it was replaced). */
export async function deleteImageIfUnused(url: string | null | undefined) {
  const id = uploadedImageId(url);
  if (!id) return;
  const inUse = await db.product.count({ where: { imageUrl: url! } });
  if (!inUse) await db.productImage.deleteMany({ where: { id } });
}
