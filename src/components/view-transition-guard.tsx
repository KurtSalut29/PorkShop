"use client";

/**
 * The browser skips a view transition that starts while the tab is hidden (for example, a
 * live update arriving in a background tab) and rejects the transition's promises with
 * "InvalidStateError: Document hidden". React handles the skip, but the rejected promises
 * surface as uncaught errors. Marking them handled keeps the console clean; React still sees
 * the same promises and the page updates normally.
 */
if (typeof document !== "undefined" && typeof document.startViewTransition === "function") {
  const start = document.startViewTransition.bind(document) as (arg?: unknown) => ViewTransition;
  const quiet = () => {};
  (document as { startViewTransition: (arg?: unknown) => ViewTransition }).startViewTransition = (arg) => {
    const t = start(arg);
    t.ready.catch(quiet);
    t.finished.catch(quiet);
    t.updateCallbackDone.catch(quiet);
    return t;
  };
}

export function ViewTransitionGuard() {
  return null;
}
