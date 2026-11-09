"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft, Ban, CircleCheck, Loader2, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ownerCancelAction, reassignOrderAction, resolveCancelAction, setPaymentAction } from "@/app/actions/orders";
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
import { DUTY_STATUS, type DutyStatus } from "@/lib/constants";
import type { OrderView } from "@/server/queries/orders";

type Worker = { id: string; name: string; dutyStatus: DutyStatus; load: number; capacity: number };

function useAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        after?.();
      } else toast.error(res.message ?? "Something went wrong");
    });
  return { pending, run };
}

export function CancelRequestPanel({ order }: { order: OrderView }) {
  const { pending, run } = useAction();
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <div>
          <h2 className="font-semibold text-amber-950">Cancellation requested</h2>
          <p className="mt-1 text-sm text-amber-900/90">
            {order.cancelReason ? `“${order.cancelReason}”` : "The customer didn't give a reason."} The order is already being
            prepared. Approving releases the reserved stock.
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" className="flex-1 bg-card" disabled={pending} onClick={() => run(() => resolveCancelAction(order.id, false))}>
          Decline
        </Button>
        <Button variant="destructive" className="flex-1" disabled={pending} onClick={() => run(() => resolveCancelAction(order.id, true))}>
          {pending && <Loader2 className="size-4 animate-spin" />} Approve cancellation
        </Button>
      </div>
    </section>
  );
}

export function ReassignDialog({ order, workers }: { order: OrderView; workers: Worker[] }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("");
  const { pending, run } = useAction();
  const canQueue = order.status !== "READY" && order.status !== "PENDING";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowRightLeft className="size-4" /> {order.workerId ? "Reassign" : "Assign"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{order.workerId ? "Reassign order" : "Assign order manually"}</DialogTitle>
          <DialogDescription>
            {order.worker ? `Currently with ${order.worker.name}. ` : ""}
            Pick a worker, or return the order to the automatic queue.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="target">Assign to</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="target" className="w-full">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent position="popper">
              {canQueue && <SelectItem value="__queue">Return to automatic queue</SelectItem>}
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
          {target && target !== "__queue" && workers.find((w) => w.id === target)?.dutyStatus !== "ON_DUTY" && (
            <p className="text-[13px] text-amber-800">This worker isn't on duty. Make sure they know about it.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!target || pending}
            onClick={() => run(() => reassignOrderAction(order.id, target === "__queue" ? null : target), () => setOpen(false))}
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OwnerCancelDialog({ order }: { order: OrderView }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Ban className="size-4" /> Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>
            {order.status === "READY"
              ? "The order is already packed. Its weighed stock will be returned to inventory automatically."
              : "Reserved stock is released immediately and the customer is notified."}
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
          <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run(() => ownerCancelAction(order.id, reason), () => setOpen(false))}>
            {pending && <Loader2 className="size-4 animate-spin" />} Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentControl({ order }: { order: OrderView }) {
  const { pending, run } = useAction();
  const [method, setMethod] = useState("GCASH");
  if (order.status === "CANCELLED" || order.status === "COMPLETED") return null;
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-muted-foreground" />
        <h2 className="font-semibold">Payment</h2>
      </div>
      {order.paymentStatus === "PAID" ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm text-emerald-800">
            <CircleCheck className="size-4" /> Paid in advance
          </p>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setPaymentAction(order.id, false))}>
            Undo
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Record a payment received before pickup, e.g. a GCash transfer.</p>
          <div className="mt-3 flex gap-2">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-32" aria-label="Payment method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GCASH">GCash</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="flex-1" disabled={pending} onClick={() => run(() => setPaymentAction(order.id, true, method))}>
              Mark as paid
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
