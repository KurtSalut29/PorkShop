import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/dal";
import { DomainError } from "@/server/errors";
import { MAX_UPLOAD_BYTES, saveProductImage } from "@/server/product-images";

/**
 * Owner-only product photo upload. A Route Handler rather than a Server Action because
 * actions are capped at 1 MB and phone photos are usually larger.
 * Body: multipart/form-data with a single `file` field. Returns { url, imageStyle, width, height }.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Your session has ended. Please sign in again." }, { status: 401 });
  if (user.role !== "OWNER") return NextResponse.json({ message: "Only the owner can upload product photos." }, { status: 403 });

  // Refuse oversized bodies before reading them (multipart adds a little overhead).
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ message: "That photo is larger than 10 MB. Choose a smaller one." }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ message: "The upload didn’t arrive complete. Please try again." }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ message: "Choose a photo to upload." }, { status: 400 });

  try {
    const saved = await saveProductImage(Buffer.from(await file.arrayBuffer()), user.id);
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) return NextResponse.json({ message: err.message }, { status: 422 });
    console.error("[upload] product image failed", err);
    return NextResponse.json({ message: "We couldn’t save that photo. Please try again." }, { status: 500 });
  }
}
