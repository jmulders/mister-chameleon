/**
 * Ga4TrackingProvider
 *
 * Client component that starts Google Analytics 4 (gtag.js) with the platform
 * visitor ID as a GA4 user property, once the visitor allowed analytics.
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   1. The server layout (app/(site)/layout.tsx) reads `mc_session_id` from the
 *      request cookie and passes it as the `visitorId` prop — the stable,
 *      first-party identifier for this browser session.
 *
 *   2. In an effect this component hands the consent state to the GA4 gate
 *      (tracking/ga4-consent.ts), now and on every change. With analytics
 *      allowed the gate fills the dataLayer in this order and adds gtag.js:
 *        a. the consent state in Google's terms (`consent default`), through
 *           the page's one signal shared with the Tag Manager loader, so
 *           Google never sees a `config` before it knows what was allowed;
 *        b. `js`, `set` with the visitor ID as a user property, and `config`.
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
 *   Nothing is written into script text any more: the values go into the
 *   dataLayer as data. The gate still checks all three against a strict
 *   allowlist and starts nothing when one fails.
 *
 * ─── GA4 custom dimension setup ───────────────────────────────────────────────
 *
 *   In GA4 Admin → Custom Definitions, create a User-scoped custom dimension
 *   named exactly `visitorIdParamName` (default: "visitor_id").  Set the
 *   same name in the platform enrichment settings so the Data API query uses
 *   the same column name.
 */

"use client";

import { useEffect } from "react";
import { getConsent, onConsentChange } from "@/tracking/consent-store";
import { createGa4Gate } from "@/tracking/ga4-consent";
import type { ConsentState } from "@/tracking/consent-types";
import { ensureGlobalGtag, insertAsyncScript, pageConsentSignal, pageDataLayer } from "./google-tag-page";

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

// One gate per stream for the life of the page, so a second mount (React
// strict mode, a layout that renders again) cannot start GA4 twice.
const gates = new Map<string, (state: ConsentState) => void>();

function gateFor(stream: Ga4TrackingProviderProps): (state: ConsentState) => void {
  let gate = gates.get(stream.measurementId);
  if (!gate) {
    gate = createGa4Gate(stream, {
      layer:  pageDataLayer,
      signal: pageConsentSignal(),
      insertScript: (src) => {
        ensureGlobalGtag();
        insertAsyncScript(src);
      },
      now: () => new Date(),
    });
    gates.set(stream.measurementId, gate);
  }
  return gate;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Ga4TrackingProvider({
  measurementId,
  visitorId,
  visitorIdParamName,
}: Ga4TrackingProviderProps): null {
  // Consent gate: GA4 tracking is analytics. The gate starts nothing without
  // analytics consent or with an invalid value, so the component is safe to
  // mount unconditionally. It starts GA4 the moment the visitor agrees.
  useEffect(() => {
    const gate = gateFor({ measurementId, visitorId, visitorIdParamName });
    gate(getConsent());
    return onConsentChange(gate);
  }, [measurementId, visitorId, visitorIdParamName]);

  return null;
}
