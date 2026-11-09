import { ViewTransition } from "react";

/**
 * Page-to-page motion. Used by every route folder's template.tsx: templates remount when
 * their segment changes, so the old page plays `page-exit` and the new one `page-enter`
 * (see the "Page transitions" block in globals.css). `default="none"` keeps everything
 * else still: live refreshes, form saves, filters and Suspense reveals don't animate.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
