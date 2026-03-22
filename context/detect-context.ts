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
 *  2. Resolve each dimension independently (source / device / visitType)
 *  3. Return a fully typed VisitorContext
 *
 * Source resolution precedence (MVP)
 * ───────────────────────────────────
 *
 *  UTM params  →  evaluated first (they are explicit and intentional)
 *  Referrer    →  fallback when UTM is absent
 *  "direct"    →  no referrer AND no utm_source
 *  "unknown"   →  referrer present but unrecognised AND no utm_source
 *
 * Caching note
 * ────────────
 * This function is intentionally synchronous and pure — no I/O, no caching.
 * Callers are responsible for memoising the result per request lifecycle
 * (e.g. storing in a React cache() wrapper or passing via RSC props).
 */

import type { TrafficSource, VisitorContext } from "./types";
import { detectDevice, parseReferrer, readCookies } from "./helpers";

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
 * @param request - Web API Request (from Route Handler, Middleware, or test)
 * @returns A fully populated VisitorContext — never throws.
 */
export function detectVisitorContext(request: Request): VisitorContext {
  const headers = request.headers;

  // ── 1. Extract raw signals ───────────────────────────────────────────────

  const rawReferrer =
    headers.get("referer") ?? headers.get("referrer") ?? null;

  const userAgent = headers.get("user-agent");
  const cookieHeader = headers.get("cookie");

  // Parse URL — wrap in try/catch; malformed URLs should not crash the server
  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;
  let utmContent: string | null = null;
  let utmTerm: string | null = null;

  try {
    const url = new URL(request.url);
    utmSource = url.searchParams.get("utm_source");
    utmMedium = url.searchParams.get("utm_medium");
    utmCampaign = url.searchParams.get("utm_campaign");
    utmContent = url.searchParams.get("utm_content");
    utmTerm = url.searchParams.get("utm_term");
  } catch {
    // Proceed without UTM data — all remain null
  }

  // ── 2. Parse helpers ─────────────────────────────────────────────────────

  const parsedReferrer = parseReferrer(rawReferrer);
  const cookies = readCookies(cookieHeader);

  // ── 3. Resolve each dimension ────────────────────────────────────────────

  const source = resolveTrafficSource({
    utmSource,
    parsedReferrerSource: parsedReferrer?.inferredSource ?? null,
    hasReferrer: parsedReferrer !== null,
  });

  const device = detectDevice(userAgent);

  const visitType = cookies.get(SEEN_COOKIE) === SEEN_COOKIE_VALUE
    ? "returning"
    : "new";

  // ── 4. Return assembled context ──────────────────────────────────────────

  return {
    // Resolved dimensions
    source,
    device,
    visitType,

    // Raw signals (debugging / future rules)
    rawReferrer,
    referrerDomain: parsedReferrer?.domain ?? null,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    userAgent,
    resolvedAt: Date.now(),
  };
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
