"use client";

/**
 * PageTracker
 *
 * Invisible Client Component that fires a `page_view` event on every client-
 * side route change and retries any previously failed events.  Returns null
 * — renders no DOM.
 *
 * ─── Exactly-once guarantee ───────────────────────────────────────────────────
 *
 *   Each distinct pathname fires at most one page_view per component lifetime:
 *
 *   1. `lastTrackedRef` stores the last pathname for which a page_view was sent.
 *   2. On each effect run (mount + every pathname change), we skip if
 *      `lastTrackedRef.current === pathname`.
 *   3. React Strict Mode double-invoke:  the second invocation finds
 *      `lastTrackedRef.current === pathname` and returns immediately.
 *   4. Parent re-renders that don't change the route: same guard fires.
 *
 *   The component is placed in a persistent layout that never unmounts during
 *   client-side navigation.  If PageTracker were ever unmounted and remounted
 *   (which shouldn't happen in a layout), `lastTrackedRef` resets to null and
 *   the next pathname fires again — this is the correct behaviour (the new
 *   mount represents a new component instance).
 *
 * ─── Route change detection ───────────────────────────────────────────────────
 *
 *   Uses `usePathname()` from Next.js App Router.  This covers:
 *     ✓ First render / SSR hydration
 *     ✓ <Link> client-side navigation
 *     ✓ router.push() / router.replace()
 *     ✓ Browser back/forward button
 *
 *   Query-string changes (e.g. ?tab=1 → ?tab=2) do NOT trigger a new page_view
 *   because `usePathname()` only returns the path segment, not the search string.
 *   This is intentional — query-string-only changes typically do not represent
 *   a meaningful new page load from an analytics standpoint.
 *
 * ─── Retry on route change ───────────────────────────────────────────────────
 *
 *   On every pathname change, PageTracker calls `retryFailedEvents()` before
 *   firing the new page_view.  This drains any failed events from previous
 *   navigations without a dedicated background worker.  Events that have
 *   exceeded MAX_RETRY_COUNT are silently abandoned (they remain "failed" in
 *   the store so the debug panel can display them).
 *
 * ─── Optimistic tracking ──────────────────────────────────────────────────────
 *
 *   `trackEvent` pushes the event to `window.__journey` *before* the async
 *   POST so the debug panel reflects the event immediately without waiting
 *   for the round-trip to complete.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In a layout or root page (no props required):
 *   <PageTracker />
 *
 *   // Legacy: passing pathname is still accepted but ignored internally.
 *   <PageTracker pathname="/" />
 */

import { useEffect, useRef } from "react";
import { usePathname }       from "next/navigation";
import { trackEvent, retryFailedEvents } from "@/tracking/track-event";
import {
  getJourneyStoreVisitorId,
  getJourneyStoreSessionId,
  pushToJourneyStore,
  generateEventId,
} from "@/tracking/journey-store";
import { hasConsent }      from "@/tracking/consent-store";
import { resolvePageMeta } from "@/tracking/page-meta-map";

interface PageTrackerProps {
  /**
   * @deprecated No longer used — the component reads the pathname via
   * `usePathname()` internally.  Kept for backward compatibility so existing
   * call-sites do not need to be updated.
   */
  pathname?: string;
}

export function PageTracker(_props: PageTrackerProps) {
  const pathname        = usePathname();
  // Stores the last pathname for which a page_view was fired.
  // null = nothing fired yet (initial mount).
  const lastTrackedRef  = useRef<string | null>(null);

  useEffect(() => {
    // ── Retry failed events from previous navigations ──────────────────────
    //
    // Called unconditionally on every route change so that transient failures
    // get a second chance whenever the visitor navigates rather than requiring
    // a separate background worker.  Re-sends up to MAX_RETRY_COUNT times per
    // event.  Suppressed (consent-denied) events are never retried.
    retryFailedEvents();

    // ── Skip if we already fired for this exact pathname ───────────────────
    //
    // Guards against:
    //   • React Strict Mode double-invoke (same pathname, second effect run)
    //   • Parent re-renders that don't change the route
    if (lastTrackedRef.current === pathname) return;

    lastTrackedRef.current = pathname;

    // ── Fire the page_view for the new pathname ────────────────────────────
    //
    // payload fields:
    //   page_path   — canonical field the API route reads for journey recording.
    //   pathname    — legacy alias kept for backward compatibility.
    //   visitor_id  — stable localStorage UUID; also sent top-level in POST body
    //                 via trackEvent() for server-side identity linking.
    //   session_id  — client sessionStorage UUID; lets engineers correlate the
    //                 client-visible session with the server httpOnly mc_session_id.
    //   client      — flag indicating this is a client-fired page_view (vs
    //                 server-side after() hook which sets client: false / absent).
    //
    // ── Consent handling ──────────────────────────────────────────────────────
    //   Normal path  (consent granted): trackEvent handles local store + DB write.
    //   No-consent path               : push directly to the local journey store so
    //     the Live State panel reflects navigations immediately, and write to the DB
    //     via /api/scenario/event which intentionally bypasses the consent gate for
    //     demo/admin use.
    // ── Resolve page category + keywords ──────────────────────────────────
    //
    // Two-tier strategy (merged, deduped):
    //
    //   1. resolvePageMeta() — static URL-pattern map for known MC paths.
    //      Covers /pricing, /cases, /contact, /platform, etc.
    //
    //   2. <meta name="keywords"> — CMS-authored keywords injected by
    //      generateMetadata() in the [slug]/page.tsx route.  Next.js updates
    //      <head> metadata before useEffect fires, so these are available here.
    //      They take precedence (placed first) to surface CMS intent signals.
    //
    // Both sets are stored in visitor_journey_events.page_keywords so the
    // scoring engine can build interest profiles from them.
    const { category: page_category, keywords: staticKeywords } = resolvePageMeta(pathname);

    const metaKeywordsAttr =
      typeof document !== "undefined"
        ? (document.querySelector('meta[name="keywords"]')?.getAttribute("content") ?? "")
        : "";
    const cmsKeywords: string[] = metaKeywordsAttr
      ? metaKeywordsAttr.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)
      : [];

    // Merge: CMS keywords first (more specific), static map fills the rest.
    const page_keywords =
      cmsKeywords.length > 0
        ? [...new Set([...cmsKeywords, ...staticKeywords])]
        : staticKeywords;

    const payload = {
      page_path:     pathname,
      pathname,
      visitor_id:    getJourneyStoreVisitorId() ?? undefined,
      session_id:    getJourneyStoreSessionId() ?? undefined,
      client:        true,
      ...(page_category ? { page_category }               : {}),
      ...(page_keywords.length > 0 ? { page_keywords }   : {}),
    };

    if (hasConsent("analytics") && hasConsent("personalization")) {
      trackEvent("page_view", payload);
    } else {
      pushToJourneyStore(generateEventId(), "page_view", {
        ...payload,
        occurred_at:    new Date().toISOString(),
        scenario_panel: true,
      });
      fetch("/api/scenario/event", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ eventType: "page_view", pagePath: pathname }),
        credentials: "include",
      }).catch(() => {/* fire-and-forget */});
    }
  }, [pathname]);

  // Invisible — renders no DOM nodes.
  return null;
}
