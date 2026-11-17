"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, ImagePlus, Loader2, QrCode, ReceiptText, Send, TimerReset } from "lucide-react";
import { useConfirm } from "@/components/feedback/confirm";
import { NETWORK_ERROR, notify } from "@/components/feedback/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatPeso, formatTime } from "@/lib/format";
import type { PaymentStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Proof = {
  id: string;
  reference: string;
  amount: number;
  status: "SUBMITTED" | "ACCEPTED" | "REJECTED";
  note: string | null;
  createdAt: string;
  imageUrl: string;
};

const MAX_BYTES = 10 * 1024 * 1024;

/** Seconds left until `iso`, ticking every second. Null until mounted (avoids a hydration mismatch). */
function useSecondsLeft(iso: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000)));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [iso]);
  return left;
}

function upload(orderId: string, reference: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/orders/${orderId}/payment`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const body = xhr.response as { message?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(body?.message ?? "We couldn’t save your payment. Please try again."));
    };
    xhr.onerror = () => reject(new Error(NETWORK_ERROR.description));
    const fd = new FormData();
    fd.append("reference", reference);
    fd.append("file", file);
    xhr.send(fd);
  });
}

/**
 * The customer's GCash payment panel on their order page: pay to the shop's QR code or number,
 * then submit the reference number and a screenshot of the receipt before the timer runs out.
 */
export function GcashPayment({
  orderId,
  amount,
  dueAt,
  paymentStatus,
  proof,
  gcash,
}: {
  orderId: string;
  amount: number;
  dueAt: string | null;
  paymentStatus: PaymentStatus;
  proof: Proof | null;
  gcash: { name: string; number: string; qrUrl: string | null };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ reference?: string; file?: string }>({});
  const [progress, setProgress] = useState<number | null>(null);
  const secondsLeft = useSecondsLeft(paymentStatus === "UNPAID" || paymentStatus === "REJECTED" ? dueAt : null);
  const expired = secondsLeft === 0;

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  // When time runs out the server cancels the order within seconds; refresh to show it.
  useEffect(() => {
    if (!expired) return;
    const t = setTimeout(() => router.refresh(), 35_000);
    return () => clearTimeout(t);
  }, [expired, router]);

  // ── Already paid, or waiting for the shop to verify ──
  if (paymentStatus === "PAID" || paymentStatus === "SUBMITTED") {
    const verified = paymentStatus === "PAID";
    return (
      <section
        className={cn(
          "rounded-2xl border p-5 sm:p-6",
          verified ? "border-emerald-200 bg-emerald-50/70" : "border-sky-200 bg-sky-50/70",
        )}
        aria-label="GCash payment"
      >
        <div className="flex items-start gap-3">
          {verified ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          ) : (
            <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-sky-700" />
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className={cn("font-semibold", verified ? "text-emerald-950" : "text-sky-950")}>
              {verified ? `Paid ${formatPeso(proof?.amount ?? amount)} by GCash` : "Payment submitted. The shop is verifying it."}
            </p>
            <p className={cn("mt-0.5", verified ? "text-emerald-900/80" : "text-sky-900/80")}>
              {verified
                ? "Thank you! Any small difference after weighing is settled at pickup."
                : "Your order is already in line for a butcher. We’ll notify you once the payment is confirmed."}
            </p>
            {proof && (
              <p className="mt-2 text-xs text-muted-foreground">
                Reference <span className="num font-medium text-foreground">{proof.reference}</span> · sent{" "}
                {formatDateTime(proof.createdAt)} ·{" "}
                <a href={proof.imageUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                  View receipt
                </a>
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  const choose = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErrors((e) => ({ ...e, file: "Choose a screenshot or photo of the receipt." }));
    if (f.size > MAX_BYTES) return setErrors((e) => ({ ...e, file: "That image is larger than 10 MB." }));
    setErrors((e) => ({ ...e, file: undefined }));
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(gcash.number);
      notify.success("GCash number copied", gcash.number);
    } catch {
      notify.info("Copy the number manually", gcash.number);
    }
  };

  async function submit() {
    const ref = reference.replace(/[\s-]/g, "");
    const next: typeof errors = {};
    if (!/^\d{10,20}$/.test(ref)) next.reference = "Enter the reference number from your GCash receipt (numbers only, usually 13 digits).";
    if (!file) next.file = "Attach a screenshot of your GCash receipt.";
    setErrors(next);
    if (next.reference || next.file) {
      notify.error(
        Object.keys(next).length > 1 ? "2 fields need your attention" : "One field needs your attention",
        next.reference ?? next.file,
      );
      return;
    }
    const ok = await confirm({
      title: "Submit this GCash payment?",
      description: "The shop will check it against their GCash account. Make sure the reference number matches your receipt.",
      details: [
        { label: "Amount", value: formatPeso(amount) },
        { label: "Reference no.", value: ref },
        { label: "Receipt", value: file!.name },
      ],
      confirmLabel: "Submit payment",
    });
    if (!ok) return;
    const id = toast.loading("Sending your payment…");
    setProgress(0);
    try {
      await upload(orderId, ref, file!, setProgress);
      toast.success("Payment submitted", { id, description: "The shop is verifying it. Your order is now in line for a butcher." });
      router.refresh();
    } catch (err) {
      toast.error("Payment not sent", { id, description: err instanceof Error ? err.message : NETWORK_ERROR.description, duration: 8000 });
    } finally {
      setProgress(null);
    }
  }

  const mm = secondsLeft !== null ? String(Math.floor(secondsLeft / 60)).padStart(2, "0") : "--";
  const ss = secondsLeft !== null ? String(secondsLeft % 60).padStart(2, "0") : "--";
  const urgent = secondsLeft !== null && secondsLeft <= 120;
  const sending = progress !== null;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-card" aria-label="Complete your GCash payment">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-primary/[0.04] px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold">
            {paymentStatus === "REJECTED" ? "Please resubmit your GCash payment" : "Complete your GCash payment"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {dueAt ? <>Pay and submit by <span className="num font-medium text-foreground">{formatTime(dueAt)}</span>, or the order is cancelled.</> : "Pay and submit your receipt below."}
          </p>
        </div>
        {dueAt && (
          <div
            role="timer"
            aria-live="off"
            aria-label={secondsLeft === null ? "Time left" : `${mm} minutes ${ss} seconds left`}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-xl font-semibold tabular-nums",
              expired ? "bg-muted text-muted-foreground" : urgent ? "bg-red-50 text-red-700" : "bg-night text-white",
            )}
          >
            <TimerReset className="size-4" /> {mm}:{ss}
          </div>
        )}
      </header>

      {paymentStatus === "REJECTED" && proof?.note && (
        <div className="flex items-start gap-2.5 border-b bg-red-50 px-5 py-3 text-sm text-red-900 sm:px-6" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-medium">The shop couldn’t verify your last payment:</span> {proof.note}
          </p>
        </div>
      )}

      {expired ? (
        <div className="p-6 text-sm">
          <p className="font-medium">Time’s up.</p>
          <p className="mt-1 text-muted-foreground">
            The payment window has closed, so this order is being cancelled and the cuts are released. You can place a new order anytime.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center gap-3">
            {gcash.qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the QR must stay pixel-sharp
              <img src={gcash.qrUrl} alt="Shop GCash QR code" className="aspect-square w-full max-w-[220px] rounded-xl border bg-white object-contain p-2" />
            ) : (
              <div className="grid aspect-square w-full max-w-[220px] place-items-center rounded-xl border bg-muted text-muted-foreground">
                <QrCode className="size-10" />
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground">Scan with the GCash app</p>
          </div>

          <div className="min-w-0 space-y-5">
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <Num n={1} />
                <div className="min-w-0">
                  <p>
                    Send exactly <span className="num font-semibold">{formatPeso(amount)}</span> by GCash to
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="num rounded-lg bg-muted px-3 py-1.5 text-base font-semibold tracking-wide">
                      {gcash.number.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1 $2 $3")}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={copyNumber}>
                      <Copy className="size-3.5" /> Copy
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Account name: {gcash.name}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <Num n={2} />
                <p>Enter the reference number shown on your GCash receipt.</p>
              </li>
              <li className="flex gap-3">
                <Num n={3} />
                <p>Upload a screenshot of the receipt, then submit.</p>
              </li>
            </ol>

            <div className="grid gap-1.5">
              <Label htmlFor="gcash-ref">Reference number</Label>
              <Input
                id="gcash-ref"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 1012 345 678901"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                aria-invalid={!!errors.reference}
                className="num"
              />
              {errors.reference && <p className="text-[13px] text-destructive">{errors.reference}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="gcash-receipt">Receipt screenshot</Label>
              <input
                ref={fileInput}
                id="gcash-receipt"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => choose(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className={cn(
                  "flex items-center gap-3 rounded-xl border-2 border-dashed p-3 text-left text-sm transition-colors hover:bg-muted/50",
                  errors.file ? "border-destructive/50" : "border-border",
                )}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
                  <img src={preview} alt="" className="size-14 shrink-0 rounded-md border object-cover" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <ImagePlus className="size-5" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{file ? file.name : "Choose the receipt screenshot"}</span>
                  <span className="text-xs text-muted-foreground">{file ? "Tap to choose a different image" : "JPG or PNG, up to 10 MB"}</span>
                </span>
              </button>
              {errors.file && <p className="text-[13px] text-destructive">{errors.file}</p>}
            </div>

            <Button onClick={submit} disabled={sending} size="lg" className="h-11 w-full text-[15px] sm:w-auto">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? `Sending… ${progress}%` : "Submit payment"}
            </Button>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ReceiptText className="mt-0.5 size-3.5 shrink-0" />
              Your receipt is only visible to you and the shop’s staff.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Num({ n }: { n: number }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground" aria-hidden>
      {n}
    </span>
  );
}
