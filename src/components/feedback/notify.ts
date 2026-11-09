"use client";

import { toast } from "sonner";

/**
 * Single source of user feedback. Every outcome (success, failure, warning, info, or
 * "still working") goes through here, so the app speaks with one consistent voice.
 */
export const notify = {
  success: (title: string, description?: string) => toast.success(title, { description }),
  error: (title: string, description?: string) => toast.error(title, { description, duration: 7000 }),
  warning: (title: string, description?: string) => toast.warning(title, { description, duration: 6000 }),
  info: (title: string, description?: string) => toast.info(title, { description }),
  loading: (title: string, description?: string) => toast.loading(title, { description }),
};

export type ActionLike = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const NETWORK_ERROR = {
  title: "Couldn’t reach the shop’s server",
  description: "Check your internet connection and try again. Nothing was changed.",
};

/**
 * Runs a server action with live feedback: a loading toast appears immediately and turns
 * into a success or error toast in place. Network failures are reported, never swallowed.
 */
export async function runAction<R extends ActionLike>(
  fn: () => Promise<R>,
  opts: { loading: string; success?: string; successDescription?: string },
): Promise<R | null> {
  const id = toast.loading(opts.loading);
  try {
    const res = await fn();
    if (res.ok) {
      // Prefer the caller's short title; the server's message (which has specifics) becomes the detail.
      const title = opts.success ?? res.message ?? "Done";
      const description = opts.successDescription ?? (opts.success && res.message !== title ? res.message : undefined);
      toast.success(title, { id, description });
    } else if (res.fieldErrors && Object.keys(res.fieldErrors).length) {
      const first = Object.values(res.fieldErrors).find((v) => v?.length)?.[0];
      const count = Object.values(res.fieldErrors).filter((v) => v?.length).length;
      toast.error(count > 1 ? `${count} fields need your attention` : "One field needs your attention", {
        id,
        description: first ? `${first} The fields are highlighted in the form.` : "Fix the highlighted fields and try again.",
        duration: 7000,
      });
    } else {
      toast.error(res.message ?? "That didn’t work", { id, duration: 7000 });
    }
    return res;
  } catch (err) {
    console.error(err);
    toast.error(NETWORK_ERROR.title, { id, description: NETWORK_ERROR.description, duration: 8000 });
    return null;
  }
}
