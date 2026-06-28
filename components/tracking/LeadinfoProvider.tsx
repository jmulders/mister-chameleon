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

// Module-level guard so React 18 strict-mode double-mounts don't inject twice.
let injected = false;

const DL_SENT_FLAG = "mc_li_dl_sent";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Inspect one dataLayer entry for Leadinfo company fields (the OPTIONAL paid
 * dataLayer feature pushes e.g. { company_name, company_city, ... }). When found,
 * POST to /api/enrichment/leadinfo to set the mc_li cookie → server-side
 * enrichment + Lead Base pick it up. No-op for accounts without the feature.
 */
function handleDataLayerEntry(entry: unknown): void {
  if (!entry || typeof entry !== "object") return;
  const e = entry as Record<string, unknown>;
  const nested = (e.company ?? {}) as Record<string, unknown>;
  const name = str(e.company_name) ?? str(e.companyName) ?? str(nested.name);
  if (!name) return;

  try { if (sessionStorage.getItem(DL_SENT_FLAG)) return; } catch { /* ignore */ }

  const payload = {
    matched:        true,
    companyName:    name,
    companyDomain:  str(e.company_domain)  ?? str(e.companyDomain)  ?? str(nested.domain),
    companyCity:    str(e.company_city)    ?? str(e.companyCity)    ?? str(nested.city),
    companyCountry: str(e.company_country) ?? str(e.companyCountry) ?? str(nested.country),
  };

  void fetch("/api/enrichment/leadinfo", {
    method:    "POST",
    headers:   { "Content-Type": "application/json" },
    body:      JSON.stringify(payload),
    keepalive: true,
  })
    .then(() => { try { sessionStorage.setItem(DL_SENT_FLAG, "1"); } catch { /* ignore */ } })
    .catch(() => { /* fail-open */ });
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

    // ── Opportunistic dataLayer reader ────────────────────────────────────────
    // Poll the dataLayer (non-invasive — we never wrap GTM's push) for ~20s and
    // forward any Leadinfo company push to enrichment. Only does something when
    // the paid Leadinfo dataLayer feature is active.
    let idx = 0;
    const scan = () => {
      const dl = w.dataLayer;
      if (!Array.isArray(dl)) return;
      for (; idx < dl.length; idx++) handleDataLayerEntry(dl[idx]);
    };
    scan();
    const interval = window.setInterval(scan, 1500);
    const stop = window.setTimeout(() => window.clearInterval(interval), 20000);

    return () => { window.clearInterval(interval); window.clearTimeout(stop); };
  }, [siteToken]);

  return null;
}

export default LeadinfoProvider;
