/**
 * GA4 Measurement Protocol Utility
 *
 * Server-side helper for sending events to Google Analytics 4 via the
 * Measurement Protocol (MP).  Used by API routes that want to forward
 * visitor interaction events to GA4 without relying on client-side gtag.js.
 *
 * ─── GA4 Measurement Protocol endpoint ───────────────────────────────────────
 *
 *   POST https://www.google-analytics.com/mp/collect
 *        ?measurement_id=G-XXXXXXXXXX
 *        &api_secret=<API_SECRET>
 *
 *   Body: { client_id, events: [{ name, params }] }
 *
 *   GA4 MP requires `client_id` (equivalent to the gtag client_id, not the
 *   user_id).  We use the platform's visitor ID (mc_session_id) as the
 *   client_id so that server-sent events and client-side gtag events are
 *   correlated in GA4 under the same client.
 *
 * ─── Event shape ──────────────────────────────────────────────────────────────
 *
 *   A single event object is sent per call — batch if needed by calling
 *   sendGa4MpEvent() multiple times or extending the `events` array.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   `apiSecret` must be obtained from the server-side tenant settings and
 *   must never be exposed to the client.  The caller is responsible for
 *   stripping secrets before passing config to client components.
 *
 * ─── Fire-and-forget ──────────────────────────────────────────────────────────
 *
 *   This utility is intentionally non-throwing.  Network errors, auth errors,
 *   or missing configuration all result in a logged warning and a structured
 *   error result — they never bubble up to the calling API route.
 *
 * ─── References ───────────────────────────────────────────────────────────────
 *
 *   https://developers.google.com/analytics/devguides/collection/protocol/ga4
 *   https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference
 */

import { logger } from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Ga4MpConfig {
  /** GA4 Measurement ID, e.g. "G-XXXXXXXXXX". */
  measurementId: string;
  /** API Secret from GA4 Admin → Data Streams → Measurement Protocol API secrets. */
  apiSecret: string;
  /**
   * Optional stable visitor / user identifier to attach to the MP hit.
   *
   * When provided together with `userIdPropertyName`, the hit is enriched with:
   *   - `user_id`          — the raw UUID (allows GA4 User-ID matching)
   *   - `user_properties`  — `{ [userIdPropertyName]: { value: userId } }`
   *
   * This ensures server-sent MP events carry the same `customUser:{userIdPropertyName}`
   * dimension value as client-side gtag events (which set it via `user_properties`
   * in the `gtag('config', ...)` call).  Without this, server-sent events are
   * anonymous in the GA4 Data API and will NOT appear in GA4 History lookups.
   */
  userId?: string;
  /**
   * Name of the GA4 user property that receives the visitor ID.
   * Must match the `visitorIdParamName` in GA4 Tracking settings and the
   * `visitorIdDimension` in GA4 History settings.
   * Only used when `userId` is also provided.
   */
  userIdPropertyName?: string;
}

export interface Ga4MpEventParams {
  [key: string]: string | number | boolean | undefined;
}

export interface Ga4MpEvent {
  /** GA4 event name, e.g. "page_view", "cta_click". */
  name: string;
  /** Arbitrary event parameters. */
  params?: Ga4MpEventParams;
}

export type Ga4MpResult =
  | { ok: true }
  | { ok: false; error: string };

// ── Allowlist guards ───────────────────────────────────────────────────────────

/** GA4 Measurement IDs: "G-" followed by alphanumeric chars. */
const SAFE_MEASUREMENT_ID = /^G-[A-Z0-9]+$/i;

// ── GA4 MP endpoint ───────────────────────────────────────────────────────────

const GA4_MP_URL = "https://www.google-analytics.com/mp/collect";

// ── Send helper ───────────────────────────────────────────────────────────────

/**
 * Send a single event to GA4 via the Measurement Protocol.
 *
 * @param config       GA4 Measurement ID + API Secret (server-only).
 * @param clientId     The stable visitor identifier (e.g. mc_session_id UUID).
 * @param event        The GA4 event to send.
 *
 * Never throws — returns `{ ok: false, error }` on any failure.
 */
export async function sendGa4MpEvent(
  config:   Ga4MpConfig,
  clientId: string,
  event:    Ga4MpEvent,
): Promise<Ga4MpResult> {
  // Validate measurement ID format.
  if (!SAFE_MEASUREMENT_ID.test(config.measurementId)) {
    return { ok: false, error: "Invalid measurement ID format." };
  }

  if (!config.apiSecret || config.apiSecret.trim().length === 0) {
    return { ok: false, error: "API secret is required for server-side MP sends." };
  }

  if (!clientId || clientId.trim().length === 0) {
    return { ok: false, error: "clientId (visitor ID) is required." };
  }

  const url = new URL(GA4_MP_URL);
  url.searchParams.set("measurement_id", config.measurementId);
  url.searchParams.set("api_secret", config.apiSecret);

  // Build the base MP body.
  const body: Record<string, unknown> = {
    client_id: clientId,
    events:    [{ name: event.name, params: event.params ?? {} }],
  };

  // Attach user_id and user_properties when a visitor identifier is provided.
  // This mirrors the client-side `gtag('config', id, { user_properties: { [name]: id } })`
  // call in Ga4TrackingProvider, ensuring server-sent events carry the same
  // customUser dimension so GA4 History lookups can correlate them.
  if (config.userId?.trim() && config.userIdPropertyName?.trim()) {
    body.user_id         = config.userId;
    body.user_properties = { [config.userIdPropertyName]: { value: config.userId } };
  }

  try {
    const response = await fetch(url.toString(), {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    // GA4 MP returns 204 on success; 400 on malformed payload.
    if (response.status === 204 || response.status === 200) {
      return { ok: true };
    }

    const text = await response.text().catch(() => "");
    logger.warn("[ga4-mp] Unexpected status from GA4 Measurement Protocol", {
      status:        response.status,
      measurementId: config.measurementId,
      eventName:     event.name,
      body:          text.slice(0, 200),
    });

    return { ok: false, error: `GA4 MP returned HTTP ${response.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("[ga4-mp] Failed to send event to GA4 Measurement Protocol", {
      error:         message,
      measurementId: config.measurementId,
      eventName:     event.name,
    });
    return { ok: false, error: message };
  }
}
