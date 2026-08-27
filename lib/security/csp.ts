/**
 * Content-Security-Policy — the single source of truth.
 *
 * Built per request in middleware.ts (a fresh nonce each time) and emitted as
 * either `Content-Security-Policy-Report-Only` (default) or the enforcing
 * `Content-Security-Policy` header, switched by the CSP_ENFORCE env flag. Ship
 * report-only first, watch the browser console for violations across a real
 * page + the Scenario/Leadinfo flow, then flip CSP_ENFORCE=true as a separate,
 * clearly-marked step.
 *
 * Allowances are deliberately tight for scripts (the only real XSS vector) and
 * pragmatic elsewhere:
 *   - script-src : 'self' + per-request nonce (Next hydration + the GTM inline
 *                  snippet) + the GTM and Leadinfo CDNs (external src). No bare
 *                  'unsafe-inline' — inline scripts ride the nonce.
 *   - font-src   : 'self' (next/font is self-hosted under /_next) + data:.
 *   - style-src  : 'self' 'unsafe-inline' — Next and the layout emit inline
 *                  <style>; styles are not a script-execution vector.
 *   - connect-src: 'self' + Leadinfo (identify/ping) + GA/GTM + Supabase.
 *   - img-src    : 'self' data: blob: https: — next/image proxies remote images
 *                  same-origin; tracking pixels + CMS/CDN images load over https.
 *   - frame-ancestors: the Statamic CP origins (dev localhost:8000; prod *.ploi.it
 *                  + STATAMIC_CP_ORIGIN) so Live Preview can embed the page.
 */

/** The name of the CSP header to emit, given the enforce flag. */
export function cspHeaderName(enforce: boolean = cspEnforced()): string {
  return enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

/** Whether the CSP is enforced (blocks) vs report-only (logs). Default: report-only. */
export function cspEnforced(): boolean {
  const v = (process.env.CSP_ENFORCE ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Space-separated custom Statamic CP origins (may be empty). */
function cpOrigins(): string {
  return (process.env.STATAMIC_CP_ORIGIN ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .join(" ");
}

/** The Supabase origin (host) the browser talks to, derived from the public URL. */
function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try { return new URL(url).origin; } catch { return null; }
}

export interface BuildCspOptions {
  /** Per-request nonce (base64), applied to inline scripts. */
  nonce: string;
  /** Development relaxes frame-ancestors (localhost CP) and drops upgrade-insecure. */
  isDev: boolean;
}

/**
 * Build the CSP directive string. Pure and deterministic given its inputs +
 * env, so it is unit-testable.
 */
export function buildContentSecurityPolicy({ nonce, isDev }: BuildCspOptions): string {
  const sb = supabaseOrigin();
  const extraCp = cpOrigins();

  const frameAncestors = isDev
    ? "'self' http://localhost:8000"
    : `'self' https://*.ploi.it${extraCp ? ` ${extraCp}` : ""}`;

  const directives: Array<[string, string]> = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["form-action", "'self'"],
    ["frame-ancestors", frameAncestors],

    // Scripts. PRODUCTION is strict: 'self' + per-request nonce (Next hydration +
    // GTM inline snippet) + the GTM and Leadinfo CDNs (external <script src>).
    // No bare 'unsafe-inline'/'unsafe-eval' — inline scripts ride the nonce, and a
    // production Next build nonces every script it emits.
    //
    // DEVELOPMENT relaxes this: Turbopack's HMR runtime injects non-nonced inline
    // scripts and React's dev build uses eval() for its debugging tooling, both of
    // which a strict policy blocks. So dev allows 'unsafe-inline' + 'unsafe-eval'
    // (and drops the nonce, since a nonce would make browsers ignore
    // 'unsafe-inline'). This relaxation NEVER ships — it is gated on isDev, and
    // production keeps the nonce-only policy.
    // Note: Leadinfo's ping.js pulls jQuery from code.jquery.com, so that host is
    // allowlisted too (found via report-only verification of a live Leadinfo page).
    ["script-src", isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://cdn.leadinfo.net https://code.jquery.com"
      : `'self' 'nonce-${nonce}' https://www.googletagmanager.com https://cdn.leadinfo.net https://code.jquery.com`],

    // Next.js + the layout emit inline <style>; allow inline styles (not a script
    // vector). Google Fonts stylesheet host kept for any GTM/GA font pulls.
    ["style-src", "'self' 'unsafe-inline' https://fonts.googleapis.com"],

    // next/font is self-hosted under /_next; data: covers inlined faces.
    ["font-src", "'self' data: https://fonts.gstatic.com"],

    // next/image proxies remote images same-origin; tracking pixels + CMS/CDN
    // images load over https. Images cannot execute, so https: is safe here.
    ["img-src", "'self' data: blob: https:"],

    // Self-hosted hero video + R2/CDN media.
    ["media-src", "'self' data: blob: https:"],

    // XHR/fetch/websocket/beacon: self (incl. POST /api/enrichment/leadinfo),
    // Leadinfo identify/ping, GA/GTM, and Supabase (REST + realtime websocket).
    ["connect-src", [
      "'self'",
      "https://*.leadinfo.net",
      "https://api.leadinfo.com",
      "https://www.googletagmanager.com",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      ...(sb ? [sb, sb.replace(/^https:/, "wss:")] : ["https://*.supabase.co", "wss://*.supabase.co"]),
      // Dev only: Turbopack/webpack HMR websocket to the local server.
      ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
    ].join(" ")],

    // The GTM <noscript> iframe embeds googletagmanager.com/ns.html.
    ["frame-src", "'self' https://www.googletagmanager.com"],
    ["worker-src", "'self' blob:"],
    ["manifest-src", "'self'"],
  ];

  if (!isDev) directives.push(["upgrade-insecure-requests", ""]);

  return directives
    .map(([k, v]) => (v ? `${k} ${v}` : k))
    .join("; ");
}
