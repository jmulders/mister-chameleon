/**
 * Ga4TrackingProvider
 *
 * Client component that injects the Google Analytics 4 gtag.js loader and
 * initialises the tracker with the platform visitor ID as a GA4 user property.
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   1. The server layout (app/layout.tsx) reads `mc_session_id` from the
 *      request cookie and passes it as the `visitorId` prop — the stable,
 *      first-party identifier for this browser session.
 *
 *   2. This component renders two <Script> tags via next/script:
 *        a. The gtag.js loader from Google Tag Manager CDN.
 *        b. An inline init block that calls `gtag('config', measurementId, …)`
 *           with the visitor ID set as a User Property.
 *
 *   3. Because the visitor ID is a User Property on every gtag event, GA4's
 *      Data API can filter/group by the same ID using the custom dimension
 *      named by `visitorIdParamName` (default: "visitor_id").  This connects
 *      the GA4 Analytics History enricher (which reads the Data API) to the
 *      same visitor identity as the tracking events.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   `mc_session_id` is httpOnly and cannot be read by client JS.  The server
 *   layout reads it server-side and passes it here as a prop — the UUID itself
 *   is non-secret (it is a session correlation ID, not a credential).
 *
 *   `measurementId` and `visitorIdParamName` are non-secret config values.
 *   All three are interpolated into the inline script using a strict allowlist
 *   regex to prevent injection.
 *
 * ─── GA4 custom dimension setup ───────────────────────────────────────────────
 *
 *   In GA4 Admin → Custom Definitions, create a User-scoped custom dimension
 *   named exactly `visitorIdParamName` (default: "visitor_id").  Set the
 *   same name in the platform enrichment settings so the Data API query uses
 *   the same column name.
 */

"use client";

import Script from "next/script";
import { hasConsent } from "@/tracking/consent-store";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface Ga4TrackingProviderProps {
  /** GA4 Measurement ID, e.g. "G-XXXXXXXXXX". */
  measurementId: string;

  /**
   * The stable visitor identifier sourced from `mc_session_id` cookie.
   * Sent as a GA4 user property so every event carries this ID.
   */
  visitorId: string;

  /**
   * Name of the GA4 user property / custom dimension that receives the
   * visitor ID.  Must match the custom dimension name in GA4 Admin and the
   * `visitorIdDimension` setting in the GA4 History enricher.
   * Default: "visitor_id"
   */
  visitorIdParamName: string;
}

// ── Allowlist regex for safe inline script interpolation ──────────────────────

/** GA4 Measurement IDs: "G-" followed by alphanumeric characters and hyphens. */
const SAFE_MEASUREMENT_ID = /^G-[A-Z0-9]+$/i;
/** UUID v4: hex digits and hyphens (mc_session_id format). */
const SAFE_VISITOR_ID = /^[0-9a-f-]{32,36}$/i;
/** Custom dimension names: letters, digits, underscores only. */
const SAFE_PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;

// ── Component ─────────────────────────────────────────────────────────────────

export function Ga4TrackingProvider({
  measurementId,
  visitorId,
  visitorIdParamName,
}: Ga4TrackingProviderProps) {
  // Consent gate: GA4 tracking is analytics. Without analytics consent, inject no
  // gtag scripts. (Consistent with the other client trackers; self-guarding so the
  // component is safe to mount unconditionally.)
  if (!hasConsent("analytics")) return null;

  // Validate all interpolated values against allowlists before use.
  // If any value fails validation, bail out — emit no scripts and no error.
  if (
    !SAFE_MEASUREMENT_ID.test(measurementId) ||
    !SAFE_VISITOR_ID.test(visitorId) ||
    !SAFE_PARAM_NAME.test(visitorIdParamName)
  ) {
    return null;
  }

  return (
    <>
      {/*
       * gtag.js loader — loaded after the page is interactive so it does
       * not block first paint.  The `id` parameter must match `measurementId`
       * so the gtag('config') call below can target the right stream.
       */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />

      {/*
       * Inline init block — runs immediately after the loader.
       * Sets `window.dataLayer`, registers the `gtag` function, then:
       *
       *   1. gtag('set', { user_properties: … })
       *      Registers visitor_id as a GLOBAL user property before any event
       *      fires.  Global properties persist for the entire session and are
       *      automatically attached to every subsequent gtag event — including
       *      the page_view fired by gtag('config') below.  This is the
       *      belt-and-suspenders approach: even if the config call is replayed
       *      (e.g. on SPA navigation), the user property remains set.
       *
       *   2. gtag('config', measurementId)
       *      Initialises the GA4 stream and fires the initial page_view.
       *      user_properties is NOT repeated here — it is already registered
       *      globally by the preceding gtag('set') call.
       *
       * Because visitor_id is set only via user_properties (never as an event
       * param), GA4 correctly records it as a User-scoped custom dimension.
       * The GA4 Data API filter `customUser:{visitorIdParamName} == visitorId`
       * in the GA4 History enricher will then find rows for this visitor.
       */}
      <Script
        id="mc-gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: [
            "window.dataLayer=window.dataLayer||[];",
            "function gtag(){dataLayer.push(arguments);}",
            "gtag('js',new Date());",
            // Set visitor_id globally FIRST so it is attached to all events,
            // including the page_view fired by the config call below.
            `gtag('set',{user_properties:{'${visitorIdParamName}':'${visitorId}'}});`,
            // Initialise the GA4 stream (fires page_view automatically).
            // No user_properties here — they are already registered globally above.
            `gtag('config','${measurementId}');`,
          ].join(""),
        }}
      />
    </>
  );
}
