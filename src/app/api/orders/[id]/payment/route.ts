import { NextResponse } from "next/server";
import { gcashReferenceSchema } from "@/lib/validation";
import { getCurrentUser } from "@/server/dal";
import { DomainError } from "@/server/errors";
import { submitPaymentProof } from "@/server/orders";
import { MAX_UPLOAD_BYTES } from "@/server/product-images";

/**
 * Customer submits a GCash payment for their order: the reference number and a screenshot of
 * the receipt. A Route Handler (not a Server Action) because receipt photos can exceed 1 MB.
 * Body: multipart/form-data with `reference` and `file`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Your session has ended. Please sign in again." }, { status: 401 });
  if (user.role !== "CUSTOMER") return NextResponse.json({ message: "Only the customer can submit this payment." }, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ message: "That receipt image is larger than 10 MB. Choose a smaller one." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "The upload didn’t arrive complete. Please try again." }, { status: 400 });
  }
  const reference = gcashReferenceSchema.safeParse(String(form.get("reference") ?? ""));
  if (!reference.success) {
    return NextResponse.json({ message: reference.error.issues[0]!.message, field: "reference" }, { status: 422 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "Attach a screenshot of your GCash receipt.", field: "file" }, { status: 422 });
  }

  try {
    await submitPaymentProof(user, id, reference.data, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) return NextResponse.json({ message: err.message }, { status: 422 });
    console.error("[payment] proof upload failed", err);
    return NextResponse.json({ message: "We couldn’t save your payment. Please try again." }, { status: 500 });
  }
}
