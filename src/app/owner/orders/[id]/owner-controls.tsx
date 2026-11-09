"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft, Ban, CircleCheck, Loader2, TriangleAlert, Wallet } from "lucide-react";
import { ownerCancelAction, reassignOrderAction, resolveCancelAction, setPaymentAction } from "@/app/actions/orders";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DUTY_STATUS, PAYMENT_METHOD_LABEL, type DutyStatus, type PaymentMethod } from "@/lib/constants";
import { formatPeso, orderCode } from "@/lib/format";
import type { OrderView } from "@/server/queries/orders";

type Worker = { id: string; name: string; dutyStatus: DutyStatus; load: number; capacity: number };

export function CancelRequestPanel({ order }: { order: OrderView }) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  async function decide(approve: boolean) {
    const ok = await confirm(
      approve
        ? {
            title: `Approve cancellation of ${orderCode(order.number)}?`,
            description: "The order is cancelled, its reserved stock is released, and the customer and worker are notified.",
            confirmLabel: "Approve cancellation",
            tone: "destructive",
          }
        : {
            title: "Decline the cancellation request?",
            description: "The order continues as normal. The customer is told it was already being prepared.",
            confirmLabel: "Decline request",
          },
    );
    if (!ok) return;
    start(async () => {
      await runAction(() => resolveCancelAction(order.id, approve), {
        loading: approve ? "Cancelling the order…" : "Declining the request…",
      });
    });
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <div>
          <h2 className="text-base text-amber-950">Cancellation requested</h2>
          <p className="mt-1 text-sm text-amber-900/90">
            {order.cancelReason ? `“${order.cancelReason}”` : "The customer didn’t give a reason."} The order is already being
            prepared.
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" className="flex-1 bg-card" disabled={pending} onClick={() => decide(false)}>
          Decline
        </Button>
        <Button variant="destructive" className="flex-1" disabled={pending} onClick={() => decide(true)}>
          {pending && <Loader2 className="size-4 animate-spin" />} Approve
        </Button>
      </div>
    </section>
  );
}

export function ReassignDialog({ order, workers }: { order: OrderView; workers: Worker[] }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("");
  const [pending, start] = useTransition();
  const canQueue = order.status !== "READY" && order.status !== "PENDING";
  const chosen = workers.find((w) => w.id === target);

  function submit() {
    if (!target) {
      notify.warning("Choose where the order should go", "Pick a worker, or return it to the queue.");
      return;
    }
    start(async () => {
      const res = await runAction(() => reassignOrderAction(order.id, target === "__queue" ? null : target), {
        loading: target === "__queue" ? "Returning to the queue…" : `Assigning to ${chosen?.name}…`,
      });
      if (res?.ok) {
        setOpen(false);
        setTarget("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowRightLeft className="size-4" /> {order.workerId ? "Reassign" : "Assign"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{order.workerId ? `Reassign ${orderCode(order.number)}` : `Assign ${orderCode(order.number)}`}</DialogTitle>
          <DialogDescription>
            {order.worker ? `It’s currently with ${order.worker.name}. ` : ""}
            Both workers are notified as soon as you confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="target">Assign to</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="target" className="w-full">
              <SelectValue placeholder="Choose a worker…" />
            </SelectTrigger>
            <SelectContent position="popper">
              {canQueue && <SelectItem value="__queue">Return to the automatic queue</SelectItem>}
              {workers
                .filter((w) => w.id !== order.workerId)
                .map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span className="flex w-full items-center justify-between gap-6">
                      {w.name}
                      <span className="num text-xs text-muted-foreground">
                        {DUTY_STATUS[w.dutyStatus].label} · {w.load}/{w.capacity}
                      </span>
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {chosen && chosen.dutyStatus !== "ON_DUTY" && (
            <p className="text-[13px] text-amber-800">{chosen.name} isn’t on duty. Make sure they know about this order.</p>
          )}
          {chosen && chosen.load >= chosen.capacity && (
            <p className="text-[13px] text-amber-800">{chosen.name} is already at their order limit.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Go back
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending && <Loader2 className="size-4 animate-spin" />} Confirm reassignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OwnerCancelDialog({ order }: { order: OrderView }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const tooShort = reason.trim().length < 3;

  function submit() {
    if (tooShort) {
      notify.warning("Add a reason first", "The customer sees this reason, so make it clear (3 characters or more).");
      return;
    }
    start(async () => {
      const res = await runAction(() => ownerCancelAction(order.id, reason), { loading: "Cancelling the order…" });
      if (res?.ok) setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Ban className="size-4" /> Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {orderCode(order.number)}?</DialogTitle>
          <DialogDescription>
            {order.status === "READY"
              ? "It’s already packed. The weighed stock goes back into inventory automatically."
              : "Its reserved stock is released immediately."}{" "}
            The customer and the worker are notified. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="cancel-reason">Reason shown to the customer</Label>
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Customer called to cancel" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep order
          </Button>
          <Button variant="destructive" disabled={pending} onClick={submit}>
            {pending && <Loader2 className="size-4 animate-spin" />} Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentControl({ order }: { order: OrderView }) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<PaymentMethod>("GCASH");
  if (order.status === "CANCELLED" || order.status === "COMPLETED") return null;

  async function setPaid(paid: boolean) {
    const ok = await confirm(
      paid
        ? {
            title: "Record this payment?",
            description: "Only do this once the money has arrived, e.g. a GCash transfer you can see. The worker won’t collect it again at pickup.",
            details: [
              { label: "Order", value: orderCode(order.number) },
              { label: "Amount", value: formatPeso(order.total) },
              { label: "Method", value: PAYMENT_METHOD_LABEL[method] },
            ],
            confirmLabel: "Record payment",
          }
        : {
            title: "Mark this order as unpaid?",
            description: "The worker will be asked to collect payment at pickup.",
            confirmLabel: "Mark unpaid",
            tone: "warning",
          },
    );
    if (!ok) return;
    start(async () => {
      await runAction(() => setPaymentAction(order.id, paid, paid ? method : undefined), {
        loading: paid ? "Recording payment…" : "Updating payment…",
      });
    });
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-[0_1px_2px_oklch(0.2_0.01_240/0.05)]">
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-muted-foreground" />
        <h2 className="text-base">Payment</h2>
      </div>
      {order.paymentStatus === "PAID" ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm text-emerald-800">
            <CircleCheck className="size-4" /> Paid in advance
          </p>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setPaid(false)}>
            Mark unpaid
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Record a payment received before pickup.</p>
          <div className="mt-3 flex gap-2">
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-32" aria-label="Payment method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GCASH">GCash</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="flex-1" disabled={pending} onClick={() => setPaid(true)}>
              Record payment
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
