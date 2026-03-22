/**
 * Client-side Event Tracking
 *
 * Thin wrapper around POST /api/events for use in Client Components
 * and browser event handlers.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { track } from "@/tracking";
 *
 *   // Typed — payload shape is inferred from eventType:
 *   track({ eventType: "cta_click", payload: { cta_key: "cta_meeting", href: "/contact" } });
 *   track({ eventType: "scroll_depth", payload: { depth: 50 } });
 *
 * ─── Fire-and-forget ──────────────────────────────────────────────────────────
 *
 *   `track()` returns a Promise but callers typically do not await it.
 *   It swallows all errors internally — tracking should never interrupt
 *   the user experience. Network failures, server errors, and validation
 *   errors are all silently discarded.
 *
 * ─── keepalive ────────────────────────────────────────────────────────────────
 *
 *   Requests are sent with `keepalive: true` so the browser completes them
 *   even if the page navigates away immediately after (e.g. a CTA click that
 *   follows an href). This is the correct replacement for the deprecated
 *   `navigator.sendBeacon()` for JSON payloads.
 *
 * ─── Session ──────────────────────────────────────────────────────────────────
 *
 *   The API route reads the session ID from the `mc_session_id` cookie.
 *   The browser sends cookies automatically with same-origin requests,
 *   so no session ID needs to be included in the request body.
 *
 * ─── Server-side page_view events ────────────────────────────────────────────
 *
 *   page_view is sent server-side via `after()` in the homepage Server
 *   Component — it does NOT go through `track()`. This file is for
 *   client-initiated events only.
 */

export type {
  EventType,
  TrackingEvent,
  EventPayloadMap,
  PageViewPayload,
  VariantServedPayload,
  CtaClickPayload,
  ScrollDepthPayload,
} from "./event-types";

export { ALLOWED_EVENT_TYPES, isValidEventType } from "./event-types";

// ── trackEvent() ──────────────────────────────────────────────────────────────
//
// Fire-and-forget (void fetch). The primary helper used by all tracking
// Client Components — preferred in onClick handlers where no await is desired.
// Import from "@/tracking" rather than from "@/tracking/track-event" directly.

export { trackEvent } from "./track-event";

// ── track() ───────────────────────────────────────────────────────────────────

import type { EventType, EventPayloadMap, TrackingEvent } from "./event-types";

/**
 * Sends a typed tracking event to POST /api/events.
 *
 * Fire-and-forget — call without await. Never throws; errors are swallowed.
 *
 * @param event  A typed event object. The payload shape is inferred from eventType.
 *
 * @example
 *   // In an onClick handler — no await needed:
 *   track({ eventType: "cta_click", payload: { cta_key: "cta_meeting" } });
 */
export async function track<T extends EventType>(
  event: TrackingEvent<T>,
): Promise<void> {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: event.eventType,
        payload: (event.payload as Record<string, unknown>) ?? {},
      }),
      // keepalive: true keeps the request alive even if the page navigates away,
      // which is critical for CTA click events where the href fires immediately.
      keepalive: true,
    });
  } catch {
    // Tracking should never break the user experience.
    // Errors are silently discarded in production.
    // For debugging, consider logging to console.warn in development:
    // if (process.env.NODE_ENV === "development") console.warn("[track] failed", event);
  }
}

/**
 * Typed shorthand helpers for common events.
 * These are sugar over `track()` for the most-used event types.
 */

/** Record a CTA button click. */
export function trackCtaClick(
  payload: EventPayloadMap["cta_click"],
): Promise<void> {
  return track({ eventType: "cta_click", payload });
}

/** Record a scroll depth milestone (25 / 50 / 75 / 90 / 100). */
export function trackScrollDepth(
  payload: EventPayloadMap["scroll_depth"],
): Promise<void> {
  return track({ eventType: "scroll_depth", payload });
}
