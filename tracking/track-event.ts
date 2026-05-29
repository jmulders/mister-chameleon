/**
 * trackEvent — client-side event helper
 *
 * The simplest possible interface to POST /api/events. Returns void so
 * callers in event handlers never need to await or catch anything.
 *
 * ─── Event identity ───────────────────────────────────────────────────────────
 *
 *   A UUID is generated *before* the fetch and used as both the local store
 *   key and the `eventId` sent to the server (stored in
 *   `visitor_journey_events.event_id`).  This enables deterministic
 *   deduplication in the merge algorithm — no timestamp heuristics needed.
 *
 * ─── Client-side timestamp (occurredAt) ──────────────────────────────────────
 *
 *   Each event records the exact time it occurred on the client (`occurredAt`),
 *   generated as `new Date().toISOString()` before the fetch fires.  This
 *   timestamp is sent in the POST body as `occurredAt` so the server stores it
 *   as `occurred_at` in the DB instead of the server receive time.
 *
 *   Why this matters: events in the retry queue can be sent minutes after they
 *   occurred (network failure, tab backgrounded, etc.).  Without the client
 *   timestamp, `occurred_at` in the DB would be the retry time — distorting
 *   recency scores and sequence detection.  With it, the DB always stores when
 *   the event actually happened.
 *
 * ─── Visitor identity (visitorId) ────────────────────────────────────────────
 *
 *   The stable visitor UUID from localStorage (mc_visitor_id) is included in
 *   every POST as `visitorId`.  The server extracts and stores it so journey
 *   events can be linked back to a persistent visitor identity — enabling
 *   cross-session behavioral analysis without cookie-based server stitching.
 *
 * ─── Optimistic local store ───────────────────────────────────────────────────
 *
 *   Before sending the network request, `trackEvent` pushes the event into
 *   `window.__journey` with `syncStatus = "pending"`.  Once the fetch
 *   resolves, sync status is updated:
 *
 *     201 → synced      (event is in the DB)
 *     200 + suppressed → suppressed (consent denied server-side; not in DB)
 *     4xx / 5xx → failed (event likely not persisted)
 *     network error → failed
 *
 *   Note: `res.ok` is true for both 200 and 201.  We check the specific
 *   response body for `suppressed: true` to distinguish a consent-suppressed
 *   response from a genuine write confirmation.
 *
 * ─── Retry-on-send ────────────────────────────────────────────────────────────
 *
 *   Each call to `trackEvent()` first checks for previously failed events
 *   (up to MAX_RETRY_COUNT per event) and re-sends them using the same
 *   fire-and-forget fetch.  This piggybacks retries on natural user
 *   activity without requiring a dedicated background queue.
 *
 *   Retried events include their original `occurredAt` so the server stores
 *   the original event time even if the retry is sent much later.
 *
 * ─── keepalive ────────────────────────────────────────────────────────────────
 *
 *   `keepalive: true` completes the request even when the page navigates away.
 *   Capped at ~64 KB combined body per navigation; ample for analytics payloads.
 *
 * ─── Runtime ─────────────────────────────────────────────────────────────────
 *
 *   Browser-only.  Do NOT import in Server Components or Edge Middleware.
 */

import type { EventType }          from "./event-types";
import { getTenantId }             from "./get-tenant-id";
import {
  generateEventId,
  pushToJourneyStore,
  markJourneyEventSynced,
  markJourneyEventFailed,
  markJourneyEventSuppressed,
  getAndResetFailedJourneyEvents,
  getJourneyStoreVisitorId,
} from "./journey-store";
import { hasConsent } from "./consent-store";

// ── Internal fetch helper ─────────────────────────────────────────────────────

/**
 * Fires a single POST /api/events fetch for `eventId` and updates the local
 * store with the outcome.  Fire-and-forget: returns void, never throws.
 *
 * Used by both `trackEvent()` (new events) and the retry path (failed events).
 *
 * @param eventId    Client-generated UUID — canonical dedup key.
 * @param type       Event type string (e.g. "page_view").
 * @param payload    Arbitrary event payload.
 * @param tenantId   Active tenant slug (null when unavailable).
 * @param occurredAt ISO-8601 timestamp of when the event actually occurred.
 *                   Sent as `occurredAt` so the server uses this instead of
 *                   server-receive time — essential for retried events.
 * @param visitorId  Stable localStorage visitor UUID (null when unavailable).
 *                   Sent as `visitorId` for server-side identity linking.
 */
function sendEventFetch(
  eventId:    string,
  type:       string,
  payload:    Record<string, unknown>,
  tenantId:   string | null,
  occurredAt: string,
  visitorId:  string | null,
): void {
  fetch("/api/events", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      eventType: type,
      tenantId,
      payload,
      // Client-generated UUID — stored in DB for merge deduplication.
      eventId,
      // Client occurrence timestamp — server uses this as occurred_at instead
      // of server receive time.  Critical for accuracy of retried events.
      occurredAt,
      // Stable visitor identity from localStorage for cross-session linking.
      visitorId,
    }),
    keepalive: true,
  })
    .then(async (res) => {
      if (res.status === 201 || res.status === 200) {
        // Try to read the body to check for the `suppressed` flag.
        // The server returns { ok: true, suppressed: true } when consent was
        // denied server-side.  A genuine write returns { ok: true, eventId }.
        let body: Record<string, unknown> = {};
        try {
          body = await res.clone().json() as Record<string, unknown>;
        } catch {
          // Non-JSON body — treat as synced.
        }

        if (body["suppressed"] === true) {
          // Server rejected event due to consent — not in DB, do not retry.
          markJourneyEventSuppressed(eventId);
        } else {
          // Genuine 201 Created — event is now in the DB.
          markJourneyEventSynced(eventId);
        }
      } else {
        // 4xx / 5xx — event likely not persisted; eligible for retry.
        markJourneyEventFailed(eventId);
      }
    })
    .catch(() => {
      // Network failure — event not persisted; eligible for retry.
      markJourneyEventFailed(eventId);
    });
}

// ── Retry helper ──────────────────────────────────────────────────────────────

/**
 * Re-sends all previously failed events (up to their retry limit).
 * Piggybacks on the next natural user action (page navigation, CTA click, etc.)
 * without requiring a dedicated background worker.
 *
 * Each retried event is sent with its original `occurredAt` timestamp so the
 * server stores the correct event time even if the retry is sent much later.
 *
 * Events that have already been retried MAX_RETRY_COUNT times are abandoned
 * (they remain "failed" in the store so the debug panel can show them).
 *
 * No-op when consent is not granted — suppressed events are excluded from
 * the retry pool by design (status "suppressed" ≠ "failed").
 */
export function retryFailedEvents(): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("analytics") || !hasConsent("personalization")) return;

  const tenantId  = getTenantId();
  const visitorId = getJourneyStoreVisitorId();
  const failed    = getAndResetFailedJourneyEvents();

  for (const ev of failed) {
    // Re-send with the same eventId and original occurredAt.
    // The server will upsert ON CONFLICT event_id DO NOTHING so even if the
    // first attempt actually succeeded (we just never got the response), the
    // retry is silently ignored — no duplicates in the DB.
    sendEventFetch(
      ev.eventId,
      ev.eventType,
      ev.payload,
      tenantId ?? null,
      ev.occurredAt,   // original client timestamp — not server receive time
      visitorId,
    );
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sends a named event to POST /api/events. Returns void — never throws.
 *
 * Automatically resolves the active tenant ID from the `__mc_tenant__` inline
 * script element and the stable visitor ID from localStorage.
 *
 * Also:
 *   • Retries any previously failed events (up to their retry limit).
 *   • Generates a stable eventId for deduplication.
 *   • Records the exact occurrence timestamp (client-side, before any network delay).
 *   • Pushes to the optimistic local journey store (status: pending).
 *   • Updates sync status to synced / suppressed / failed once the response arrives.
 *
 * @param type     One of the allowed EventType string literals.
 * @param payload  Optional flat JSON object. Defaults to {} at the API level.
 *
 * @example
 *   trackEvent("cta_click", { cta_key: "cta_meeting", href: "/contact" });
 *   trackEvent("page_view");
 */
export function trackEvent(
  type:     EventType,
  payload?: Record<string, unknown>,
): void {
  // ── 0. Consent gate ───────────────────────────────────────────────────────
  //
  // Both analytics and personalization consent are required to track events.
  //
  //   analytics       — covers event logging and GA4 forwarding
  //   personalization — covers behavioral journey tracking and scoring
  //
  // When either category is denied, the event is not sent or stored locally.
  // This ensures no behavioral data is collected without explicit consent.
  //
  // Note: on first page load the banner may not yet have been dismissed.
  // The privacy-first default (DEFAULT_CONSENT) denies both categories,
  // so no events are sent until the user responds to the banner.
  if (!hasConsent("analytics") || !hasConsent("personalization")) {
    return;
  }

  const tenantId  = getTenantId();
  const visitorId = getJourneyStoreVisitorId();

  // ── 1. Drain failed retry queue before sending the new event ─────────────
  //
  // This piggybacks retries on natural user activity.  Each failed event is
  // re-sent at most MAX_RETRY_COUNT times (tracked in the store).  Suppressed
  // events (consent-denied) are excluded — they will never reach the server.
  retryFailedEvents();

  // ── 2. Generate a stable event UUID ──────────────────────────────────────
  const eventId = generateEventId();

  // ── 3. Capture exact occurrence timestamp ─────────────────────────────────
  //
  // Generated HERE — before any network I/O — so it reflects when the event
  // actually occurred, not when the server received it.  For retried events
  // this is already stored in the local event's `occurredAt` field.
  const occurredAt = new Date().toISOString();

  // ── 4. Optimistic local store (status: pending) ───────────────────────────
  //
  // Dedup is enforced inside push() — a second push with the same eventId
  // is silently ignored.
  pushToJourneyStore(eventId, type, {
    ...(payload ?? {}),
    tenantId:   tenantId ?? null,
    // Include visitor_id and occurred_at in the payload so the local store
    // carries the full event context for debugging and state derivation.
    visitor_id: visitorId,
    occurred_at: occurredAt,
  });

  // ── 5. Async remote write ─────────────────────────────────────────────────
  sendEventFetch(eventId, type, payload ?? {}, tenantId ?? null, occurredAt, visitorId);
}
