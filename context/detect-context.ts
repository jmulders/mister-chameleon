/**
 * detectVisitorContext
 *
 * The primary entry point for context detection.
 * Accepts a standard Web API `Request` so it is usable in:
 *   - Next.js Route Handlers (server)
 *   - Next.js Middleware (edge)
 *   - Unit tests (via `new Request(...)`)
 *
 * Detection pipeline
 * ──────────────────
 *
 *  1. Extract raw signals from headers and URL search params
 *  2. Apply attribution cookie fallbacks for any null UTM / referrer fields
 *  3. Resolve each dimension independently (source / device / visitType)
 *  4. Return a fully typed VisitorContext
 *
 * Source resolution precedence
 * ────────────────────────────
 *
 *  UTM params (URL)  →  highest priority (marketer-controlled, explicit)
 *  mc_attr cookie    →  fallback for UTM when URL params are absent (persisted attribution)
 *  Referrer header   →  fallback for source when UTM is absent
 *  "direct"          →  no referrer AND no UTM
 *  "unknown"         →  referrer present but unrecognised AND no UTM
 *
 * Attribution persistence
 * ───────────────────────
 *
 *  UTM params and the first external referrer domain are stored in the `mc_attr`
 *  cookie by middleware on the first UTM-carrying request. On subsequent page
 *  visits (e.g. internal navigation to /about without UTM params in the URL),
 *  the attribution cookie provides the fallback values so that DecisionContext
 *  always carries the original campaign attribution.
 *
 *  See context/attribution.ts for the cookie format and middleware.ts for the
 *  cookie-writing logic.
 *
 * Caching note
 * ────────────
 * This function is intentionally synchronous and pure — no I/O, no caching.
 * Callers are responsible for memoising the result per request lifecycle
 * (e.g. storing in a React cache() wrapper or passing via RSC props).
 */

import type { TrafficSource, VisitorContext } from "./types";
import { detectDevice, parseReferrer, readCookies } from "./helpers";
import { parseAttributionCookie, ATTRIBUTION_COOKIE } from "./attribution";

/** Cookie name set by the client-side tracking layer after the first visit. */
export const SEEN_COOKIE = "mc_seen";

/** Value expected in the SEEN_COOKIE to mark a returning visitor. */
export const SEEN_COOKIE_VALUE = "1";

// ── UTM source → TrafficSource map ───────────────────────────────────────────

/**
 * Normalised UTM source values → TrafficSource.
 * Keys must be lowercase for case-insensitive lookup.
 */
const UTM_SOURCE_MAP: Record<string, TrafficSource> = {
  linkedin: "linkedin",
  "linkedin.com": "linkedin",
  google: "google",
  "google.com": "google",
  "google-ads": "google",
  googleads: "google",
  adwords: "google",
};

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Detect the visitor context from an HTTP request.
 *
 * UTM fields are read from URL query params first. When a param is absent,
 * the value is taken from the `mc_attr` attribution cookie (written by
 * middleware on the first UTM-carrying request). This ensures attribution
 * survives internal navigations and return visits without UTM params.
 *
 * @param request - Web API Request (from Route Handler, Middleware, or test)
 * @returns A fully populated VisitorContext — never throws.
 */
export function detectVisitorContext(request: Request): VisitorContext {
  const headers = request.headers;

  // ── 1. Extract raw signals ───────────────────────────────────────────────

  const rawReferrer =
    headers.get("referer") ?? headers.get("referrer") ?? null;

  const userAgent    = headers.get("user-agent");
  const cookieHeader = headers.get("cookie");

  // Parse URL — wrap in try/catch; malformed URLs should not crash the server
  let urlUtmSource:   string | null = null;
  let urlUtmMedium:   string | null = null;
  let urlUtmCampaign: string | null = null;
  let urlUtmContent:  string | null = null;
  let urlUtmTerm:     string | null = null;
  let urlGclid:   string | null = null;
  let urlFbclid:  string | null = null;
  let urlMsclkid: string | null = null;
  let urlTtclid:  string | null = null;
  let requestHostname = "";

  try {
    const url = new URL(request.url);
    requestHostname    = url.hostname.replace(/^www\./, "").toLowerCase();
    urlUtmSource   = url.searchParams.get("utm_source")   || null;
    urlUtmMedium   = url.searchParams.get("utm_medium")   || null;
    urlUtmCampaign = url.searchParams.get("utm_campaign") || null;
    urlUtmContent  = url.searchParams.get("utm_content")  || null;
    urlUtmTerm     = url.searchParams.get("utm_term")     || null;
    urlGclid   = normaliseClickId(url.searchParams.get("gclid"));
    urlFbclid  = normaliseClickId(url.searchParams.get("fbclid"));
    urlMsclkid = normaliseClickId(url.searchParams.get("msclkid"));
    urlTtclid  = normaliseClickId(url.searchParams.get("ttclid"));
  } catch {
    // Proceed without URL signals — all remain null
  }

  // ── 2. Parse helpers ─────────────────────────────────────────────────────

  const parsedReferrer = parseReferrer(rawReferrer);
  const cookies        = readCookies(cookieHeader);

  // ── 3. Attribution cookie fallback ───────────────────────────────────────
  //
  // When UTM params are absent from the URL (e.g. the visitor navigated to
  // an internal page after arriving via a campaign URL), read stored values
  // from the mc_attr cookie.  URL params always win if both are present.
  //
  // referrerDomain: use the current (fresh) referrer only when it is external.
  // For internal navigation (same hostname), the stored external referrer is
  // preserved so rules always see the original referral source.

  const stored = parseAttributionCookie(cookies.get(ATTRIBUTION_COOKIE));

  const utmSource   = urlUtmSource   ?? stored.utmSource   ?? null;
  const utmMedium   = urlUtmMedium   ?? stored.utmMedium   ?? null;
  const utmCampaign = urlUtmCampaign ?? stored.utmCampaign ?? null;
  const utmContent  = urlUtmContent  ?? stored.utmContent  ?? null;
  const utmTerm     = urlUtmTerm     ?? stored.utmTerm     ?? null;

  // Referrer domain: fresh external referrer wins; same-origin navigation falls
  // back to the stored external referrer so the original referral is preserved.
  const freshDomain = parsedReferrer?.domain ?? null;
  const isExternal  = freshDomain !== null && freshDomain !== requestHostname;
  const referrerDomain = isExternal
    ? freshDomain
    : (stored.referrerDomain ?? freshDomain ?? null);

  // ── 4. Resolve each dimension ────────────────────────────────────────────

  const source = resolveTrafficSource({
    utmSource,
    parsedReferrerSource: parsedReferrer?.inferredSource ?? null,
    hasReferrer: parsedReferrer !== null,
  });

  const device = detectDevice(userAgent);

  const visitType = cookies.get(SEEN_COOKIE) === SEEN_COOKIE_VALUE
    ? "returning"
    : "new";

  // ── 5. Return assembled context ──────────────────────────────────────────

  return {
    // Resolved dimensions
    source,
    device,
    visitType,

    // Raw signals (debugging / future rules)
    rawReferrer,
    referrerDomain,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    gclid:   urlGclid,
    fbclid:  urlFbclid,
    msclkid: urlMsclkid,
    ttclid:  urlTtclid,
    userAgent,
    resolvedAt: Date.now(),
  };
}

/**
 * Normalise an ad click identifier from a query parameter.
 *
 * Ad platforms sometimes send very long opaque tokens; trim whitespace, drop
 * empties, and cap the stored length so a hostile URL cannot bloat the row.
 */
function normaliseClickId(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 512);
}

// ── Source resolution ─────────────────────────────────────────────────────────

interface ResolveSourceInput {
  utmSource: string | null;
  parsedReferrerSource: TrafficSource | null;
  /** True when a Referer header was present, even if unrecognised */
  hasReferrer: boolean;
}

/**
 * Resolve a single TrafficSource from the available signals.
 *
 * Precedence:
 *  1. utm_source   — explicit, marketer-controlled, highest trust
 *  2. Referrer     — implicit, browser-provided
 *  3. direct       — no referrer, no UTM (typed URL, bookmark, dark social)
 *  4. unknown      — referrer present but unrecognised
 */
function resolveTrafficSource({
  utmSource,
  parsedReferrerSource,
  hasReferrer,
}: ResolveSourceInput): TrafficSource {
  // UTM source takes priority
  if (utmSource) {
    const normalised = utmSource.toLowerCase().trim();
    const mapped = UTM_SOURCE_MAP[normalised];
    if (mapped) return mapped;
    // Unrecognised UTM source → unknown (still came from somewhere deliberate)
    return "unknown";
  }

  // Referrer-based fallback
  if (parsedReferrerSource) return parsedReferrerSource;

  // Referrer present but unrecognised domain
  if (hasReferrer) return "unknown";

  // No referrer, no UTM → direct
  return "direct";
}
