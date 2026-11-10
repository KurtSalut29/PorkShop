import { getProductImage, uploadedImageId } from "@/server/product-images";
import { UPLOAD_PREFIX } from "@/server/image-style";

/**
 * Serves owner-uploaded product photos. Each upload gets a new id and is never modified,
 * so responses can be cached forever by browsers and CDNs.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = uploadedImageId(`${UPLOAD_PREFIX}${file}`);
  const image = id ? await getProductImage(id) : null;
  if (!image) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
