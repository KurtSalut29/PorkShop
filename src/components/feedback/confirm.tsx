"use client";

import { createContext, startTransition, use, useActionState, useCallback, useRef, useState } from "react";
import { CircleHelp, ShieldAlert, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runAction, type ActionLike } from "./notify";

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  /** Key facts of what is about to happen, shown as a printed summary. */
  details?: { label: string; value: React.ReactNode }[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "warning" | "destructive";
};

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

const TONE = {
  default: { icon: CircleHelp, wrap: "bg-primary/10 text-primary", button: "" },
  warning: { icon: TriangleAlert, wrap: "bg-amber-100 text-amber-700", button: "" },
  destructive: {
    icon: ShieldAlert,
    wrap: "bg-red-100 text-red-700",
    button: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30",
  },
};

/** App-wide confirmation dialog. `await confirm({...})` resolves true only on explicit approval. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    resolver.current?.(false);
    setOpts(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  };

  const tone = TONE[opts?.tone ?? "default"];
  const Icon = tone.icon;

  return (
    <ConfirmContext value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => !o && settle(false)}>
        <AlertDialogContent className="data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-md">
          {opts && (
            <>
              <AlertDialogHeader className="flex flex-row items-start gap-4 text-left">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone.wrap)} aria-hidden>
                  <Icon className="size-5" />
                </span>
                <div className="grid gap-1.5">
                  <AlertDialogTitle className="text-base">{opts.title}</AlertDialogTitle>
                  {opts.description && (
                    <AlertDialogDescription className="text-sm leading-relaxed">{opts.description}</AlertDialogDescription>
                  )}
                </div>
              </AlertDialogHeader>
              {opts.details && opts.details.length > 0 && (
                <dl className="ticket space-y-1.5 px-4 py-4 text-[13px]">
                  {opts.details.map((d) => (
                    <div key={d.label} className="ticket-leader">
                      <dt className="text-ticket-ink/70">{d.label}</dt>
                      <dd className="text-right font-medium">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => settle(false)}>{opts.cancelLabel ?? "Go back"}</AlertDialogCancel>
                {/* A plain Button (not AlertDialogAction's Slot) so tone colours merge correctly. */}
                <Button autoFocus className={tone.button} onClick={() => settle(true)}>
                  {opts.confirmLabel ?? "Confirm"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext>
  );
}

export function useConfirm() {
  const ctx = use(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

/**
 * Form submission with confirmation + live toasts. The form stays a plain <form onSubmit>,
 * the confirmation can summarise the submitted values, and the server's field errors come back
 * as `fieldErrors` for inline highlighting.
 */
export function useConfirmedFormAction<S extends ActionLike>(
  action: (prev: S | null, formData: FormData) => Promise<S>,
  opts: {
    loading: string;
    confirm?: (formData: FormData) => ConfirmOptions | null;
    onSuccess?: (result: S, form: HTMLFormElement | null) => void;
  },
) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, dispatch, pending] = useActionState(async (prev: S | null, fd: FormData) => {
    const res = await runAction(() => action(prev, fd), { loading: opts.loading });
    if (res?.ok) opts.onSuccess?.(res, formRef.current);
    return res ?? prev;
  }, null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    formRef.current = e.currentTarget;
    const fd = new FormData(e.currentTarget);
    const question = opts.confirm?.(fd);
    if (question && !(await confirm(question))) return;
    startTransition(() => dispatch(fd));
  }

  return {
    state,
    pending,
    onSubmit,
    fieldErrors: state && !state.ok ? state.fieldErrors : undefined,
  };
}
