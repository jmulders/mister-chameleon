/**
 * LeadinfoProvider
 *
 * Client component that runs the Leadinfo Identify API once per browser
 * session and optionally persists the result in the platform's enrichment
 * context via the mc_li cookie.
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   1. On mount, checks sessionStorage ("mc_li_sent") to avoid re-running on
 *      client-side navigations within the same tab session.
 *
 *   2. Calls the Leadinfo Identify API from the browser:
 *        GET https://api.leadinfo.com/v1/identify
 *        Authorization: Bearer {siteToken}
 *      The browser IP is used automatically — this is the key advantage over
 *      server-side calls which may see a CDN or load-balancer IP.
 *
 *   3. Normalises the response into a LeadinfoData shape.
 *
 *   4. If `pushToDataLayer` is enabled, pushes a "leadinfo_identified" event
 *      with the company fields to window.dataLayer (for GTM consumption).
 *
 *   5. If `storeInContext` is enabled, POSTs the normalised data to
 *      /api/enrichment/leadinfo, which persists it in the mc_li httpOnly
 *      cookie for server-side enrichment on subsequent page loads.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   `siteToken` is a non-secret public identifier embedded by Leadinfo in their
 *   standard browser snippet.  It is safe to pass from the server layout as a
 *   prop.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   All errors (network, JSON parse, API rejection, POST failure) are silently
 *   swallowed.  A failure here never affects page rendering or the experience
 *   pipeline.  The sessionStorage flag is NOT set on error — the component will
 *   retry on the next page load.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Rendered once by the root layout when leadinfo.enabled is true:
 *
 *     <LeadinfoProvider
 *       siteToken={tenantSettings.leadinfo.siteToken}
 *       pushToDataLayer={tenantSettings.leadinfo.pushToDataLayer}
 *       storeInContext={tenantSettings.leadinfo.storeInContext}
 *     />
 */

"use client";

import { useEffect } from "react";

// ── Leadinfo API response shape ────────────────────────────────────────────────
//
// Only the fields we consume are declared.  The Leadinfo API may return more.

interface LeadinfoApiCompany {
  id?:              string | null;
  name?:            string | null;
  city?:            string | null;
  domain?:          string | null;
  country?:         string | null;
  employees?:       string | null;
  employees_total?: number | null;
  sales_volume?:    string | null;
  coc_number?:      string | null;
  branch_code?:     string | null;
  branch_code_sic87?: string | null;
}

interface LeadinfoApiResponse {
  matched?:  boolean;
  company?:  LeadinfoApiCompany | null;
}

// ── Normalised shape sent to /api/enrichment/leadinfo ─────────────────────────

interface LeadinfoPayload {
  matched:         boolean;
  companyId:       string | null;
  companyName:     string | null;
  companyCity:     string | null;
  companyDomain:   string | null;
  companyCountry:  string | null;
  employees:       string | null;
  employeesTotal:  number | null;
  salesVolume:     string | null;
  cocNumber:       string | null;
  branchCode:      string | null;
  branchCodeSic87: string | null;
}

// ── SessionStorage deduplication key ──────────────────────────────────────────

const SENT_FLAG = "mc_li_sent";

// ── Component props ────────────────────────────────────────────────────────────

export interface LeadinfoProviderProps {
  /** Leadinfo site/tracking token (non-secret public identifier). */
  siteToken: string;
  /**
   * When true, push a "leadinfo_identified" event to window.dataLayer after
   * a successful identify call.  Default: false.
   */
  pushToDataLayer?: boolean;
  /**
   * When true, POST the normalised result to /api/enrichment/leadinfo to
   * persist it in the mc_li cookie for server-side enrichment.
   * Default: true.
   */
  storeInContext?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LeadinfoProvider({
  siteToken,
  pushToDataLayer = false,
  storeInContext  = true,
}: LeadinfoProviderProps): null {
  useEffect(() => {
    // ── Deduplication: skip if already sent in this browser session ───────────
    try {
      if (sessionStorage.getItem(SENT_FLAG)) return;
    } catch {
      // sessionStorage unavailable (private mode, storage policy, etc.)
      // Fall through — re-sending is harmless and just refreshes stable data.
    }

    void runIdentify(siteToken, pushToDataLayer, storeInContext);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── Core identify logic ────────────────────────────────────────────────────────
//
// Extracted from the useEffect so it can be a top-level async function and
// avoid the linting footgun of async useEffect callbacks.

async function runIdentify(
  siteToken:       string,
  pushToDataLayer: boolean,
  storeInContext:  boolean,
): Promise<void> {
  try {
    // ── 1. Call Leadinfo Identify API ──────────────────────────────────────────
    const response = await fetch("https://api.leadinfo.com/v1/identify", {
      method:  "GET",
      headers: { Authorization: `Bearer ${siteToken}` },
      // No credentials: "include" — the Leadinfo API uses the Bearer token,
      // not cookies.  We do NOT want to send the visitor's own cookies to
      // a third-party endpoint.
    });

    if (!response.ok) {
      // Non-2xx: Leadinfo returned an error (e.g. invalid token, rate limit).
      // Silently discard — do not set the flag so we can retry next load.
      return;
    }

    let apiResult: LeadinfoApiResponse;
    try {
      apiResult = (await response.json()) as LeadinfoApiResponse;
    } catch {
      // JSON parse error — malformed response; silently discard.
      return;
    }

    // ── 2. Normalise the response ──────────────────────────────────────────────
    const company = apiResult.company ?? null;
    const matched = apiResult.matched === true && company !== null;

    const payload: LeadinfoPayload = {
      matched,
      companyId:       strOrNull(company?.id),
      companyName:     strOrNull(company?.name),
      companyCity:     strOrNull(company?.city),
      companyDomain:   strOrNull(company?.domain),
      companyCountry:  strOrNull(company?.country),
      employees:       strOrNull(company?.employees),
      employeesTotal:  numOrNull(company?.employees_total),
      salesVolume:     strOrNull(company?.sales_volume),
      cocNumber:       strOrNull(company?.coc_number),
      branchCode:      strOrNull(company?.branch_code),
      branchCodeSic87: strOrNull(company?.branch_code_sic87),
    };

    // ── 3. Push to dataLayer (optional) ───────────────────────────────────────
    if (pushToDataLayer && matched) {
      try {
        type DataLayerEntry = Record<string, unknown>;
        const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer;
        if (Array.isArray(dl)) {
          dl.push({
            event:                   "leadinfo_identified",
            leadinfo_company_id:     payload.companyId,
            leadinfo_company_name:   payload.companyName,
            leadinfo_company_city:   payload.companyCity,
            leadinfo_company_domain: payload.companyDomain,
            leadinfo_country:        payload.companyCountry,
            leadinfo_employees:      payload.employees,
          });
        }
      } catch {
        // Non-fatal — continue to storeInContext step.
      }
    }

    // ── 4. Persist in server context via mc_li cookie (optional) ──────────────
    if (storeInContext) {
      try {
        const postResponse = await fetch("/api/enrichment/leadinfo", {
          method:    "POST",
          headers:   { "Content-Type": "application/json" },
          body:      JSON.stringify(payload),
          keepalive: true,
        });

        if (!postResponse.ok) {
          // Server rejected the payload — do not set the flag so we retry.
          return;
        }
      } catch {
        // Network error on the POST — do not set the flag.
        return;
      }
    }

    // ── 5. Mark as sent so we don't re-run on client-side navigation ──────────
    try {
      sessionStorage.setItem(SENT_FLAG, "1");
    } catch {
      // Ignore sessionStorage errors.
    }
  } catch {
    // Top-level catch — absorb any unexpected error.
    // A failure here must never surface to the user or affect rendering.
  }
}

// ── Type helpers ───────────────────────────────────────────────────────────────

function strOrNull(val: string | null | undefined): string | null {
  return typeof val === "string" && val.length > 0 ? val : null;
}

function numOrNull(val: number | null | undefined): number | null {
  return typeof val === "number" && isFinite(val) ? val : null;
}

export default LeadinfoProvider;
