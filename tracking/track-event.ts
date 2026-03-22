/**
 * trackEvent — fire-and-forget event helper
 *
 * The simplest possible interface to POST /api/events. Returns void so
 * callers in event handlers never need to await or catch anything.
 *
 * ─── Relationship to track() in index.ts ────────────────────────────────────
 *
 *   This file contains the canonical fetch implementation used by all
 *   client-side tracking. `track()` in index.ts is the type-safe, generic
 *   variant; use it when the payload shape should be inferred from the
 *   event type. Use `trackEvent()` here when you want a plain function call
 *   with no Promise to manage:
 *
 *     // In event handlers — no async/await needed:
 *     <button onClick={() => trackEvent("cta_click", { href })}>...</button>
 *
 *     // When typed payload inference matters:
 *     await track({ eventType: "scroll_depth", payload: { depth: 75 } });
 *
 * ─── Failure behaviour ────────────────────────────────────────────────────────
 *
 *   Network failures, non-2xx responses, and JSON serialisation errors are
 *   all silently swallowed. Tracking must never throw an error that could
 *   interrupt user interaction. The `void fetch(...)` pattern ensures the
 *   returned Promise is intentionally discarded.
 *
 * ─── keepalive ────────────────────────────────────────────────────────────────
 *
 *   `keepalive: true` tells the browser to complete the request even when the
 *   page navigates away (e.g. after a CTA click follows an href). This is the
 *   correct modern replacement for `navigator.sendBeacon()` with JSON payloads.
 *   Caveat: keepalive requests are capped at ~64 KB combined body size per
 *   navigation, which is ample for small analytics payloads.
 *
 * ─── Runtime ─────────────────────────────────────────────────────────────────
 *
 *   Browser-only — uses `fetch` which is available in all target browsers.
 *   Do NOT import this file in Server Components or Edge Middleware;
 *   use the events repository directly on the server instead.
 */

import type { EventType } from "./event-types";
import { getTenantId } from "./get-tenant-id";

/**
 * Sends a named event to POST /api/events. Returns void — never throws.
 *
 * Automatically resolves the active tenant ID from the `__mc_tenant__` inline
 * script element injected by the page server component and includes it in the
 * request body so all client-side events are scoped to the correct tenant.
 *
 * @param type     One of the allowed EventType string literals.
 * @param payload  Optional flat JSON object. Defaults to {} at the API level.
 *
 * @example
 *   // In an onClick handler:
 *   trackEvent("cta_click", { cta_key: "cta_meeting", href: "/contact" });
 *
 *   // Without a payload:
 *   trackEvent("page_view");
 */
export function trackEvent(
  type: EventType,
  payload?: Record<string, unknown>,
): void {
  const tenantId = getTenantId();

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: type,
      // tenantId is a top-level field so the API route stores it in the
      // dedicated events.tenant_id column, not buried in the payload JSONB.
      tenantId: tenantId ?? null,
      payload: payload ?? {},
    }),
    keepalive: true,
  }).catch(() => {
    // Silently discard all errors. Never surface tracking failures to users.
  });
}
