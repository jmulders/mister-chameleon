"use client";

/**
 * PageTracker
 *
 * Invisible Client Component that fires a client-side `page_view` event
 * once after the page hydrates. Returns null — renders no DOM.
 *
 * ─── Why client-side as well as server-side? ──────────────────────────────────
 *
 *   The homepage Server Component already records a server-side `page_view`
 *   via `after()` — this confirms that Next.js rendered the page.
 *
 *   This component sends a second `page_view` from the browser, tagged with
 *   `{ client: true }`, which confirms that the page actually hydrated and
 *   was visible to the user. The two events serve different purposes:
 *
 *     Server page_view  → "the response was sent" (includes variant keys)
 *     Client page_view  → "the page rendered in the browser"
 *
 *   Future: add Time-to-Interactive or Web Vitals data here.
 *
 * ─── Deduplication ────────────────────────────────────────────────────────────
 *
 *   A ref guard ensures exactly one event per mount, even in React's strict
 *   mode (which double-invokes effects in development to surface side effects).
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In a Server Component layout or page:
 *   <PageTracker pathname="/" />
 */

import { useEffect, useRef } from "react";
import { trackEvent } from "@/tracking/track-event";

interface PageTrackerProps {
  /** Pathname of the current page, e.g. "/". Included in the event payload. */
  pathname?: string;
}

export function PageTracker({ pathname = "/" }: PageTrackerProps) {
  // Guard against double-firing in React Strict Mode and route transitions.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    trackEvent("page_view", {
      pathname,
      // Distinguishes this client-side event from the server-side page_view
      // sent via after() in the homepage Server Component.
      client: true,
    });
  }, [pathname]);

  // Invisible — renders no DOM nodes.
  return null;
}
