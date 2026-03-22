"use client";

/**
 * ScrollDepthTracker
 *
 * Invisible Client Component that emits `scroll_depth` events when the
 * visitor scrolls past configurable milestone percentages of the page.
 * Returns null — renders no DOM.
 *
 * ─── Milestones ───────────────────────────────────────────────────────────────
 *
 *   Default: 25, 50, 75 (percent of scrollable page height)
 *
 *   Each milestone fires at most once per page load. On short pages where
 *   the content fits entirely in the viewport, no scroll events fire
 *   (scrollable height ≤ 0 guard).
 *
 * ─── Performance ─────────────────────────────────────────────────────────────
 *
 *   The scroll listener uses `{ passive: true }` so it never blocks the
 *   browser's scroll rendering pipeline.
 *
 * ─── Cleanup ─────────────────────────────────────────────────────────────────
 *
 *   The listener is removed when the component unmounts, e.g. on route
 *   change in a future multi-page setup. This prevents duplicate listeners
 *   from accumulating.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In a Server Component layout or page:
 *   <ScrollDepthTracker pathname="/" />
 */

import { useEffect, useRef } from "react";
import { trackEvent } from "@/tracking/track-event";

/** Scroll depths (% of page height) at which an event is fired. */
const MILESTONES = [25, 50, 75] as const;

interface ScrollDepthTrackerProps {
  /** Pathname of the current page, included in the event payload. */
  pathname?: string;
}

export function ScrollDepthTracker({ pathname = "/" }: ScrollDepthTrackerProps) {
  // Tracks which milestones have already fired. Set persists across re-renders.
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fired = firedRef.current;

    const handleScroll = () => {
      const scrollTop =
        window.scrollY ?? document.documentElement.scrollTop ?? 0;
      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight;

      // Guard: page shorter than viewport — nothing to track.
      if (scrollableHeight <= 0) return;

      const percent = Math.round((scrollTop / scrollableHeight) * 100);

      for (const milestone of MILESTONES) {
        if (percent >= milestone && !fired.has(milestone)) {
          fired.add(milestone);
          trackEvent("scroll_depth", { depth: milestone, pathname });
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Run once on mount in case the user is already scrolled (e.g. back navigation).
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  // Invisible — renders no DOM nodes.
  return null;
}
