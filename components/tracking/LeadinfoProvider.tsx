/**
 * LeadinfoProvider
 *
 * Loads the official Leadinfo tracking script (ping.js) once per browser, using
 * the tenant's Leadinfo site-ID (e.g. "LI-6193BB3EDDE0D").
 *
 * ─── Why this is a script loader, not an API call ─────────────────────────────
 *
 *   Leadinfo has NO public real-time "identify this IP → company" API. Company
 *   identification happens inside Leadinfo's own backend off the back of the
 *   ping.js tracking script, and the results surface in YOUR Leadinfo dashboard
 *   (and via Leadinfo's CRM / webhook integrations). The script does NOT hand
 *   company data back to the page's JavaScript.
 *
 *   An earlier version of this component tried to GET api.leadinfo.com/v1/identify
 *   with the site-ID as a Bearer token. That endpoint is not a real Leadinfo
 *   product, the site-ID is not an API credential, and the call is CORS-blocked
 *   from the browser — so it could never write the mc_li cookie. It has been
 *   replaced with the correct, official snippet.
 *
 *   Consequence: Leadinfo here drives the DASHBOARD only. It does NOT feed the
 *   platform's enrichment context (companyName / industry / size). For IP→company
 *   enrichment that personalization can use, a provider WITH a public API (e.g.
 *   IPinfo) is required — that lives in the server-side enrichment chain.
 *
 * ─── Behaviour ────────────────────────────────────────────────────────────────
 *
 *   • Injects the ping.js snippet once (guarded by the snippet's own `if(!l[i])`
 *     plus a module flag for React strict-mode double-mounts).
 *   • The `siteToken` prop is the Leadinfo site-ID.
 *   • Rendered by the root layout when leadinfo.enabled is true and a siteToken
 *     is configured.
 *
 * `siteToken` is a non-secret public identifier (Leadinfo embeds it in their
 * standard browser snippet), safe to pass from the server layout as a prop.
 */

"use client";

import { useEffect } from "react";

export interface LeadinfoProviderProps {
  /** Leadinfo site-ID (non-secret public identifier), e.g. "LI-6193BB3EDDE0D". */
  siteToken: string;
  /**
   * Deprecated — retained for backward compatibility with existing call sites.
   * Leadinfo's ping.js manages its own dataLayer/cookies; these flags are no-ops
   * now that the component loads the official script instead of calling an API.
   */
  pushToDataLayer?: boolean;
  /** Deprecated — see `pushToDataLayer`. */
  storeInContext?: boolean;
}

// Leadinfo's global command queue function shape.
type LeadinfoFn = ((...args: unknown[]) => void) & { q?: unknown[][]; t?: string };

// Module-level guards so React 18 strict-mode double-mounts don't inject/tap twice.
let injected = false;
let dlTapped = false;
// Synchronous in-flight guard: the once-per-session flag is only set AFTER the
// POST resolves, so without this the scan / tap / poll paths could each fire a
// duplicate POST for the same entry before the flag lands.
let dlPosting = false;

const DL_SENT_FLAG = "mc_li_dl_sent";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Coerce a string OR number to a trimmed string (Leadinfo pushes some as numbers). */
function strAny(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && isFinite(v)) return String(v);
  return null;
}

/** Coerce a string OR number to a number, or null. */
function numAny(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

/**
 * Inspect one dataLayer entry for Leadinfo company fields (the OPTIONAL paid
 * dataLayer feature pushes e.g. { company_name, company_city, ... }). When found,
 * POST to /api/enrichment/leadinfo to set the mc_li cookie → server-side
 * enrichment + Lead Base pick it up. No-op for accounts without the feature.
 */
/** Extract a company name from a dataLayer entry, or null when absent. */
function entryCompanyName(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const nested = (e.company ?? {}) as Record<string, unknown>;
  return str(e.company_name) ?? str(e.companyName) ?? str(nested.name);
}

function handleDataLayerEntry(entry: unknown): void {
  const name = entryCompanyName(entry);
  if (!name) return;
  const e = entry as Record<string, unknown>;
  const nested = (e.company ?? {}) as Record<string, unknown>;

  // Dedup across scan / tap / poll: skip when a POST is already in flight or one
  // already succeeded this session.
  if (dlPosting) return;
  try { if (sessionStorage.getItem(DL_SENT_FLAG)) return; } catch { /* ignore */ }
  dlPosting = true;

  const payload = {
    matched:         true,
    companyName:     name,
    companyId:       strAny(e.company_id),
    companyDomain:   str(e.company_domain)  ?? str(e.companyDomain)  ?? str(nested.domain),
    companyCity:     str(e.company_city)    ?? str(e.companyCity)    ?? str(nested.city),
    companyCountry:  str(e.company_country) ?? str(e.companyCountry) ?? str(nested.country),
    // Richer Leadinfo fields (KvK, SBI, omzet, werknemers). Numbers are coerced.
    cocNumber:       strAny(e.company_coc_number),
    branchCode:      strAny(e.company_branch_code),
    branchCodeSic87: strAny(e.company_branch_code_sic87),
    employees:       strAny(e.company_employees),
    employeesTotal:  numAny(e.company_employees_total),
    salesVolume:     strAny(e.company_sales_volume),
  };

  void fetch("/api/enrichment/leadinfo", {
    method:    "POST",
    headers:   { "Content-Type": "application/json" },
    body:      JSON.stringify(payload),
    keepalive: true,
  })
    .then(() => { try { sessionStorage.setItem(DL_SENT_FLAG, "1"); } catch { /* ignore */ } })
    .catch(() => { /* fail-open */ })
    // Reset the in-flight guard so a failed POST can be retried by a later
    // push/poll; success is already blocked by DL_SENT_FLAG.
    .finally(() => { dlPosting = false; });
}

export function LeadinfoProvider({ siteToken }: LeadinfoProviderProps): null {
  useEffect(() => {
    if (injected || !siteToken) return;

    const token = siteToken;
    const w = window as unknown as {
      leadinfo?:  LeadinfoFn;
      dataLayer?: unknown[];
      GlobalLeadinfoNamespace?: string[];
    };

    if (!w.leadinfo) {
      injected = true;

      // Official Leadinfo snippet, unrolled: register the 'leadinfo' command queue
      // under the site-ID token, then async-load cdn.leadinfo.net/ping.js.
      w.GlobalLeadinfoNamespace = w.GlobalLeadinfoNamespace || [];
      w.GlobalLeadinfoNamespace.push("leadinfo");
      const fn = ((...args: unknown[]) => {
        (fn.q = fn.q || []).push(args);
      }) as LeadinfoFn;
      fn.t = token;
      fn.q = fn.q || [];
      w.leadinfo = fn;

      const script = document.createElement("script");
      script.async = true;
      script.src   = "https://cdn.leadinfo.net/ping.js";
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(script, first);
    } else {
      injected = true;
    }

    // ── dataLayer reader ──────────────────────────────────────────────────────
    // The Leadinfo dataLayer push can land at any time (it fires after window-load
    // + a jQuery load + the async identify call), so a time-boxed poll is fragile.
    // Instead we (1) scan whatever is already in the dataLayer, and (2) tap into
    // dataLayer.push to catch every future entry the instant it's pushed. The tap
    // always calls through to the original, so GTM is unaffected.
    const dl = (w.dataLayer = w.dataLayer || []);
    for (const entry of dl) handleDataLayerEntry(entry);

    if (!dlTapped && typeof dl.push === "function") {
      dlTapped = true;
      const origPush = dl.push.bind(dl);
      dl.push = (...args: unknown[]) => {
        try { args.forEach(handleDataLayerEntry); } catch { /* never break GTM */ }
        return origPush(...args);
      };
    }

    // ── Polling fallback (race-proof) ─────────────────────────────────────────
    // GTM often REPLACES dataLayer.push with its own wrapper and pushes the
    // Leadinfo company LATE (after window-load + jQuery + the async identify),
    // so our tap can be bypassed and the entry can land after the initial scan.
    // Poll the live dataLayer for a company entry and fire once when it appears.
    // The dlPosting / DL_SENT_FLAG guards keep this from double-POSTing. Fail-open.
    let polls = 0;
    const MAX_POLLS = 40; // ~20s at 500ms
    const pollId = window.setInterval(() => {
      polls += 1;
      try {
        let alreadySent = false;
        try { alreadySent = sessionStorage.getItem(DL_SENT_FLAG) != null; } catch { /* ignore */ }
        if (alreadySent) { window.clearInterval(pollId); return; }

        const layer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
        if (Array.isArray(layer)) {
          const hit = layer.find((en) => entryCompanyName(en) != null);
          if (hit) {
            handleDataLayerEntry(hit);
            window.clearInterval(pollId); // fire once, then stop
            return;
          }
        }
      } catch { /* never break GTM */ }
      if (polls >= MAX_POLLS) window.clearInterval(pollId);
    }, 500);

    return () => window.clearInterval(pollId);
  }, [siteToken]);

  return null;
}

export default LeadinfoProvider;
