/**
 * Attribution Resolution
 *
 * Captures UTM parameters and referrer domain from the current request,
 * then persists them in the `mc_attr` first-party cookie so that attribution
 * signals survive internal navigations and return visits.
 *
 * ─── Cookie model ─────────────────────────────────────────────────────────────
 *
 *   mc_attr  — JSON-encoded AttributionData, URL-encoded for cookie safety.
 *              Written (or refreshed) by middleware when UTM params are in the URL.
 *              Read by detectVisitorContext() as a fallback when URL params are absent.
 *              Lifetime: 30 days (sliding window, refreshed on each UTM touch).
 *
 * ─── Priority for each field ──────────────────────────────────────────────────
 *
 *   1. Fresh URL query params (utm_source, utm_medium, …)  — highest trust
 *   2. mc_attr cookie (stored from the first UTM touch or referrer capture)
 *   3. null                                                  — default safe value
 *
 * ─── referrerDomain capture strategy ─────────────────────────────────────────
 *
 *   Only an *external* referrer (hostname ≠ the request's own hostname) is
 *   captured and stored.  Internal navigation (e.g. / → /about) carries the
 *   site's own URL as the Referer header, which we don't want to overwrite the
 *   original external referrer with.
 *
 *   The external referrer is stored alongside UTM params in the same cookie so
 *   that the original referral source is available on any subsequent page visit.
 *
 * ─── Fail-safe ────────────────────────────────────────────────────────────────
 *
 *   Every function in this module wraps risky operations (URL parsing,
 *   JSON.parse, decodeURIComponent) in try/catch.  A malformed or tampered
 *   cookie always returns `{}` — never throws.
 *
 * ─── Edge-runtime safe ────────────────────────────────────────────────────────
 *
 *   No Node.js built-ins. Uses only the Web APIs available in Edge/Middleware.
 *   Can be imported directly from middleware.ts without workarounds.
 */

import { readCookies } from "./helpers";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Cookie name for persisted attribution data. */
export const ATTRIBUTION_COOKIE = "mc_attr" as const;

/** Cookie lifetime in seconds — 30 days, same as the session. */
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 30;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Attribution fields that can be persisted across page navigations.
 * All fields are nullable — only the ones available at capture time are set.
 */
export interface AttributionData {
  /** utm_source query parameter, e.g. "google", "linkedin", "newsletter". */
  utmSource:      string | null;
  /** utm_medium query parameter, e.g. "cpc", "email", "social". */
  utmMedium:      string | null;
  /** utm_campaign query parameter, e.g. "spring_sale". */
  utmCampaign:    string | null;
  /** utm_content query parameter — identifies a specific link or creative. */
  utmContent:     string | null;
  /** utm_term query parameter — paid-search keyword. */
  utmTerm:        string | null;
  /** Hostname of the first external referrer, e.g. "linkedin.com". */
  referrerDomain: string | null;
}

/**
 * Result of resolveAttribution().
 * Used by middleware to decide whether to write the cookie,
 * and by detectVisitorContext() to apply stored fallbacks.
 */
export interface AttributionResolution {
  /**
   * Merged attribution data — URL params win over stored cookie.
   * May be partial (only the keys that were resolved are present).
   */
  data: Partial<AttributionData>;

  /**
   * True when the cookie should be written (or refreshed) on the response.
   *
   * This is the case when:
   *   a) Fresh UTM params are present in the URL, or
   *   b) No cookie exists yet and an external referrer was captured.
   */
  shouldSetCookie: boolean;

  /**
   * Pre-serialized value to store as the mc_attr cookie value.
   * null when shouldSetCookie is false.
   */
  serialized: string | null;
}

// ── Serialization ─────────────────────────────────────────────────────────────

/**
 * Encode an AttributionData partial as a cookie-safe string.
 *
 * Only non-null values are serialised to keep the cookie compact.
 * Uses encodeURIComponent(JSON.stringify) for maximum portability.
 *
 * @returns  URL-encoded JSON string, or "" on any error.
 */
export function serializeAttribution(data: Partial<AttributionData>): string {
  try {
    const compact: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value.length > 0) {
        compact[key] = value;
      }
    }
    return encodeURIComponent(JSON.stringify(compact));
  } catch {
    return "";
  }
}

/**
 * Decode the mc_attr cookie value back into a partial AttributionData.
 *
 * Type-validates each field — non-string/missing values are coerced to null.
 * Returns {} (empty partial) on any parse error — never throws.
 */
export function parseAttributionCookie(
  raw: string | undefined,
): Partial<AttributionData> {
  if (!raw) return {};

  try {
    const decoded = decodeURIComponent(raw);
    const obj = JSON.parse(decoded);

    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return {};

    // Type-safe field extraction — only accept non-empty strings
    const str = (key: string): string | null => {
      const v = obj[key];
      return typeof v === "string" && v.length > 0 ? v : null;
    };

    return {
      utmSource:      str("utmSource"),
      utmMedium:      str("utmMedium"),
      utmCampaign:    str("utmCampaign"),
      utmContent:     str("utmContent"),
      utmTerm:        str("utmTerm"),
      referrerDomain: str("referrerDomain"),
    };
  } catch {
    return {};
  }
}

// ── URL helpers ───────────────────────────────────────────────────────────────

/**
 * Returns true when the URL contains at least one non-empty utm_* parameter.
 */
export function hasUtmParams(url: URL): boolean {
  return (
    !!url.searchParams.get("utm_source")   ||
    !!url.searchParams.get("utm_medium")   ||
    !!url.searchParams.get("utm_campaign") ||
    !!url.searchParams.get("utm_content")  ||
    !!url.searchParams.get("utm_term")
  );
}

/**
 * Extract UTM fields from URL search params.
 * Returns only fields that are present and non-empty.
 */
export function parseUtmFromUrl(url: URL): Partial<AttributionData> {
  const result: Partial<AttributionData> = {};
  const s = url.searchParams;

  const source   = s.get("utm_source")   || null;
  const medium   = s.get("utm_medium")   || null;
  const campaign = s.get("utm_campaign") || null;
  const content  = s.get("utm_content")  || null;
  const term     = s.get("utm_term")     || null;

  if (source)   result.utmSource   = source;
  if (medium)   result.utmMedium   = medium;
  if (campaign) result.utmCampaign = campaign;
  if (content)  result.utmContent  = content;
  if (term)     result.utmTerm     = term;

  return result;
}

// ── Main resolution ───────────────────────────────────────────────────────────

/**
 * Resolve attribution for the current request.
 *
 * Reads UTM params from the URL, referrer domain from the Referer header,
 * and stored attribution from the `mc_attr` cookie.
 *
 * @param request - Standard Web API Request (route handler, middleware, or test).
 * @returns       - AttributionResolution — never throws.
 *
 * @example
 * // In middleware:
 * const attr = resolveAttribution(request);
 * if (attr.shouldSetCookie && attr.serialized) {
 *   response.cookies.set(ATTRIBUTION_COOKIE, attr.serialized, { maxAge: ATTRIBUTION_MAX_AGE, ... });
 * }
 *
 * // In detectVisitorContext():
 * const attr = resolveAttribution(request);
 * const utmSource = freshUtmSource ?? attr.data.utmSource ?? null;
 */
export function resolveAttribution(request: Request): AttributionResolution {
  // ── Read stored cookie ───────────────────────────────────────────────────

  const cookieHeader = request.headers.get("cookie");
  const cookies      = readCookies(cookieHeader);
  const storedRaw    = cookies.get(ATTRIBUTION_COOKIE);
  const stored       = parseAttributionCookie(storedRaw);
  const hasCookie    = !!storedRaw;

  // ── Parse URL UTM params ─────────────────────────────────────────────────

  let urlUtm: Partial<AttributionData> = {};
  let hasFreshUtm = false;
  let requestHostname = "";

  try {
    const url = new URL(request.url);
    requestHostname = url.hostname.replace(/^www\./, "").toLowerCase();

    if (hasUtmParams(url)) {
      hasFreshUtm = true;
      urlUtm = parseUtmFromUrl(url);
    }
  } catch {
    // Malformed request URL — continue without URL signals
  }

  // ── Parse referrer domain ────────────────────────────────────────────────

  let freshReferrerDomain: string | null = null;
  let isExternalReferrer = false;

  try {
    const refHeader =
      request.headers.get("referer") ??
      request.headers.get("referrer");

    if (refHeader) {
      const refDomain = new URL(refHeader).hostname
        .replace(/^www\./, "")
        .toLowerCase();

      // Only capture external referrers — internal navigation (same hostname)
      // would overwrite the original external referrer with the site's own domain.
      isExternalReferrer = refDomain.length > 0 && refDomain !== requestHostname;

      if (isExternalReferrer) {
        freshReferrerDomain = refDomain;
      }
    }
  } catch {
    // Malformed Referer — ignore
  }

  // ── Determine whether the cookie should be updated ───────────────────────

  //   Case A: Fresh UTM params arrived → always refresh cookie (new campaign touch).
  //   Case B: No UTM, no cookie yet, but external referrer → capture initial referrer.
  //   Otherwise: preserve existing cookie unchanged (or absent).
  const shouldSetCookie = hasFreshUtm || (!hasCookie && isExternalReferrer);

  // ── Build merged attribution data ────────────────────────────────────────

  // referrerDomain: fresh external referrer wins; otherwise preserve stored.
  const referrerDomain = freshReferrerDomain ?? stored.referrerDomain ?? null;

  let data: Partial<AttributionData>;

  if (hasFreshUtm) {
    // New campaign visit: URL params override stored UTM; capture current referrer.
    data = {
      ...stored,
      ...urlUtm,
      ...(referrerDomain !== null ? { referrerDomain } : {}),
    };
  } else {
    // No fresh UTM: use stored attribution; optionally capture first referrer.
    data = {
      ...stored,
      ...(isExternalReferrer && referrerDomain !== null ? { referrerDomain } : {}),
    };
  }

  const serialized = shouldSetCookie ? serializeAttribution(data) : null;

  return { data, shouldSetCookie, serialized };
}
