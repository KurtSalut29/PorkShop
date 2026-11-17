"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock3, ExternalLink, Loader2, QrCode, ShieldAlert, XCircle } from "lucide-react";
import { reviewPaymentAction } from "@/app/actions/orders";
import { useConfirm } from "@/components/feedback/confirm";
import { notify, runAction } from "@/components/feedback/notify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatPeso, formatTime, orderCode } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderView } from "@/server/queries/orders";

const REJECT_REASONS = [
  "We couldn’t find this reference number in our GCash account.",
  "The amount received doesn’t match the order total.",
  "The receipt image is unclear. Please upload a clearer screenshot.",
];

/**
 * Staff view of a GCash order's payment. When the customer has submitted a reference and receipt,
 * staff check it against the shop's GCash app and confirm or reject it here.
 */
export function PaymentReview({ order }: { order: OrderView }) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  if (order.paymentMethod !== "GCASH" || order.status === "CANCELLED") return null;
  const proof = order.proof;

  async function accept() {
    const ok = await confirm({
      title: "Confirm the GCash payment?",
      description: "Only confirm after you’ve seen this payment arrive in the shop’s GCash account.",
      details: [
        { label: "Order", value: orderCode(order.number) },
        { label: "Amount", value: formatPeso(proof!.amount) },
        { label: "Reference no.", value: proof!.reference },
      ],
      confirmLabel: "Payment received",
    });
    if (!ok) return;
    start(async () => {
      await runAction(() => reviewPaymentAction(order.id, true), { loading: "Confirming the payment…", success: "Payment verified" });
    });
  }

  function reject() {
    if (note.trim().length < 5) {
      notify.warning("Add a reason first", "The customer sees it, so tell them what to fix.");
      return;
    }
    start(async () => {
      const res = await runAction(() => reviewPaymentAction(order.id, false, note), { loading: "Rejecting the payment…", success: "Payment rejected" });
      if (res?.ok) {
        setRejecting(false);
        setNote("");
      }
    });
  }

  const tone =
    order.paymentStatus === "SUBMITTED"
      ? "border-amber-300 bg-amber-50/60"
      : order.paymentStatus === "PAID"
        ? "border-emerald-200 bg-emerald-50/50"
        : order.paymentStatus === "REJECTED"
          ? "border-red-200 bg-red-50/50"
          : "bg-card";

  return (
    <section className={cn("rounded-2xl border p-5", tone)} aria-label="GCash payment">
      <div className="flex items-center gap-2">
        <QrCode className="size-4 text-muted-foreground" />
        <h2 className="text-base">GCash payment</h2>
      </div>

      {order.paymentStatus === "SUBMITTED" && proof ? (
        <>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <ShieldAlert className="size-4" /> Check this payment in the shop’s GCash app
          </p>
          <ProofDetails proof={proof} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setRejecting(true)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <XCircle className="size-4" /> Reject
            </Button>
            <Button disabled={pending} onClick={accept}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Received
            </Button>
          </div>
        </>
      ) : order.paymentStatus === "PAID" ? (
        <>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-4" /> Verified · {formatPeso(order.amountPaid ?? proof?.amount ?? 0)} received
          </p>
          {proof && <ProofDetails proof={proof} />}
        </>
      ) : order.paymentStatus === "REJECTED" ? (
        <>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-red-800">
            <XCircle className="size-4" /> Rejected · waiting for the customer to resubmit
            {order.paymentDueAt && <> by {formatTime(order.paymentDueAt)}</>}
          </p>
          {proof?.note && <p className="mt-1 text-sm text-muted-foreground">Reason: {proof.note}</p>}
        </>
      ) : (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock3 className="size-4" /> Waiting for the customer to pay
          {order.paymentDueAt && <> by <span className="num font-medium text-foreground">{formatTime(order.paymentDueAt)}</span></>}. Unpaid orders are cancelled automatically.
        </p>
      )}

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this GCash payment?</DialogTitle>
            <DialogDescription>
              The customer is asked to send a correct reference and receipt. If they don’t in time, the order is cancelled automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="reject-note">Reason shown to the customer</Label>
            <div className="flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setNote(r)}
                  className={cn("rounded-full border px-2.5 py-1 text-left text-xs hover:bg-muted", note === r && "border-primary bg-primary/5 text-primary")}
                >
                  {r}
                </button>
              ))}
            </div>
            <Textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="What should the customer fix?" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Keep reviewing
            </Button>
            <Button variant="destructive" disabled={pending} onClick={reject}>
              {pending && <Loader2 className="size-4 animate-spin" />} Reject payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ProofDetails({ proof }: { proof: NonNullable<OrderView["proof"]> }) {
  return (
    <div className="mt-3 flex gap-3">
      <a href={proof.imageUrl} target="_blank" rel="noreferrer" className="group relative shrink-0" aria-label="Open the receipt in a new tab">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated image */}
        <img src={proof.imageUrl} alt="GCash receipt" className="h-24 w-16 rounded-md border bg-white object-cover object-top" />
        <span className="absolute inset-0 grid place-items-center rounded-md bg-night/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <ExternalLink className="size-4" />
        </span>
      </a>
      <dl className="grid min-w-0 content-start gap-1 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Amount</dt>
          <dd className="num font-semibold">{formatPeso(proof.amount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reference no.</dt>
          <dd className="num font-medium break-all">{proof.reference}</dd>
        </div>
        <dd className="text-xs text-muted-foreground">Sent {formatDateTime(proof.createdAt)}</dd>
      </dl>
    </div>
  );
}
