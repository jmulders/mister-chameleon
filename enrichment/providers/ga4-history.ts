/**
 * GA4 Analytics History Enricher
 *
 * Queries Google Analytics 4's Data API to retrieve historical behavioural
 * signals for a returning visitor, identified by a custom User-scoped dimension
 * (configured per-platform, e.g. a first-party visitor ID dimension).
 *
 * ─── Role in the pipeline ─────────────────────────────────────────────────────
 *
 *   This enricher is a *secondary / history* source only.  It NEVER overwrites
 *   live geo fields (`countryCode`, `region`, `city`, etc.) that were already
 *   resolved by IP-based geo stages.  Instead it writes to distinct
 *   `ga*`-prefixed fields that represent what GA4 last observed for this
 *   visitor across historical sessions.
 *
 *   Downstream AI context and rules can then use these GA4 signals to:
 *     • Recognise returning visitors even before any live geo lookup resolves.
 *     • Access session count, last-known location, and channel group to
 *       personalise messaging for known vs. new visitors.
 *
 * ─── GA4 Data API ─────────────────────────────────────────────────────────────
 *
 *   Endpoint:
 *     POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
 *
 *   Auth:
 *     Service Account → JWT (RS256) → OAuth2 Bearer token
 *     Token endpoint: https://oauth2.googleapis.com/token
 *     Scope: https://www.googleapis.com/auth/analytics.readonly
 *
 *   Query strategy:
 *     Dimensions: [visitorIdDimension, city, region, country, sessionDefaultChannelGrouping, date]
 *     Metrics:    [sessions]
 *     Filter:     visitorIdDimension == input.visitorId (EXACT)
 *     DateRange:  lookbackDays ago → today
 *     OrderBy:    date DESC (most recent date first)
 *     Limit:      10 (covers recent dates with distinct location/channel combinations)
 *
 *   Result interpretation:
 *     - Sum all sessions across returned rows → gaSessionCount
 *     - Set gaRowsReturned = number of rows returned
 *     - Row[0] (most recent date) → gaCurrentCity/Region/Country/ChannelGroup
 *     - Row[1] (second most recent date, if present) → gaLastKnownCity/Region/Country/Channel
 *     - gaLastKnown* is null when only one date-row exists (no distinct previous session)
 *     - Set gaHistorySource = "ga4"
 *
 * ─── Caching ──────────────────────────────────────────────────────────────────
 *
 *   Two independent caches:
 *     1. Access token cache  — per service-account client_email, 50-minute TTL.
 *        Avoids repeated JWT signing + OAuth round-trips within the token's
 *        1-hour expiry window.
 *
 *     2. Results cache       — per `${propertyId}:${visitorId}`, configurable TTL
 *        (default 30 minutes).  Scoped to session-level granularity so a single
 *        visitor's GA4 data is fetched at most once per TTL window regardless of
 *        how many page-views they generate.
 *
 * ─── Gate conditions ──────────────────────────────────────────────────────────
 *
 *   The stage is skipped when:
 *     • GA4 history enrichment is disabled in platform settings.
 *     • The service account JSON is not configured.
 *     • `input.visitorId` is null or empty — nothing to look up.
 *
 * ─── Dev mode ─────────────────────────────────────────────────────────────────
 *
 *   When `isDev` is true, the enricher logs the GA4 query, the number of rows
 *   returned, and the aggregated output before writing to the pipeline.
 */

import crypto        from "crypto";
import type { StagedEnricher, EnricherInput, EnrichmentOutput, EnricherContext } from "../types";
import { ProviderCache }                                                          from "../provider-cache";
import { logger }                                                                 from "@/lib/logger";

// ── Service account JSON shape ─────────────────────────────────────────────────

/** Minimal subset of a Google service account JSON key file. */
interface ServiceAccountJson {
  client_email: string;
  private_key:  string;
  token_uri?:   string;
}

// ── Module-level caches ────────────────────────────────────────────────────────
//
// Both caches are module-level singletons so they persist across requests in
// the same Node.js process.  This is correct behaviour for server-side caching.

/** Access token cache — keyed by client_email.  TTL: 50 minutes. */
const tokenCache = new ProviderCache<string>(50 * 60 * 1_000);

/** Results cache — keyed by `${propertyId}:${visitorId}`.  TTL: configurable. */
let resultsCache: ProviderCache<Partial<EnrichmentOutput>> | null = null;
let resultsCacheTtlMs = 30 * 60 * 1_000; // default 30 minutes

function getResultsCache(ttlMs: number): ProviderCache<Partial<EnrichmentOutput>> {
  if (!resultsCache || resultsCacheTtlMs !== ttlMs) {
    resultsCache    = new ProviderCache<Partial<EnrichmentOutput>>(ttlMs);
    resultsCacheTtlMs = ttlMs;
  }
  return resultsCache;
}

// ── JWT / OAuth helpers ────────────────────────────────────────────────────────

/** Base64url-encode a Buffer or string (no padding, URL-safe alphabet). */
function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64url");
}

/**
 * Create a signed JWT for Google OAuth2 service account authentication.
 *
 * Uses Node.js `crypto.createSign` with RS256 (RSA-SHA256).  No external
 * libraries required — the `private_key` from the service account JSON is used
 * directly with the standard `RSA-SHA256` sign algorithm.
 */
function createServiceAccountJwt(sa: ServiceAccountJson): string {
  const now = Math.floor(Date.now() / 1_000);

  const header  = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss:   sa.client_email,
    sub:   sa.client_email,
    aud:   sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3_600,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
  }));

  const signingInput = `${header}.${payload}`;
  const signer       = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = base64url(signer.sign(sa.private_key));

  return `${signingInput}.${signature}`;
}

/**
 * Exchange a signed JWT for a short-lived Google OAuth2 Bearer access token.
 *
 * Result is cached for 50 minutes per `client_email` to avoid redundant
 * OAuth round-trips within the 1-hour token lifetime.
 */
async function getAccessToken(sa: ServiceAccountJson): Promise<string> {
  const cacheKey = sa.client_email;
  const cached   = tokenCache.get(cacheKey);
  if (cached.hit) return cached.value;

  const jwt = createServiceAccountJwt(sa);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
    signal: AbortSignal.timeout(8_000),
    cache:  "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GA4 OAuth token exchange failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("GA4 OAuth token exchange returned no access_token");
  }

  tokenCache.set(cacheKey, data.access_token);
  return data.access_token;
}

// ── GA4 Data API query ─────────────────────────────────────────────────────────

/** A single row from the GA4 Data API runReport response. */
interface Ga4Row {
  dimensionValues: Array<{ value: string | null }>;
  metricValues:    Array<{ value: string | null }>;
}

/** Partial shape of the GA4 Data API runReport response. */
interface Ga4ReportResponse {
  rows?:         Ga4Row[];
  rowCount?:     number;
  error?: {
    code?:    number;
    message?: string;
    status?:  string;
  };
}

/**
 * Query the GA4 Data API for historical data about a specific visitor.
 *
 * Dimensions queried (in order):
 *   0: visitorIdDimension             — the custom dimension used to identify the visitor
 *   1: city                           — city for that session date
 *   2: region                         — region for that session date
 *   3: country                        — country for that session date
 *   4: sessionDefaultChannelGrouping  — channel group for that session date
 *   5: date                           — YYYYMMDD session date (drives ordering)
 *
 * Ordered by date DESC so row[0] = most recent session date (→ gaCurrent*) and
 * row[1] = second most recent date (→ gaLastKnown*).
 *
 * @returns Raw GA4 report response, or throws on network/auth error.
 */
async function queryGa4Report(
  propertyId:           string,
  visitorIdDimension:   string,
  visitorId:            string,
  lookbackDays:         number,
  accessToken:          string,
): Promise<Ga4ReportResponse> {
  // The GA4 custom dimension name format: "customUser:dimensionName"
  const dimName = visitorIdDimension.startsWith("customUser:")
    ? visitorIdDimension
    : `customUser:${visitorIdDimension}`;

  const body = {
    dimensions: [
      { name: dimName },
      { name: "city" },
      { name: "region" },
      { name: "country" },
      { name: "sessionDefaultChannelGrouping" },
      { name: "date" },
    ],
    metrics: [
      { name: "sessions" },
    ],
    dimensionFilter: {
      filter: {
        fieldName:     dimName,
        stringFilter:  { value: visitorId, matchType: "EXACT" },
      },
    },
    dateRanges: [
      { startDate: `${lookbackDays}daysAgo`, endDate: "today" },
    ],
    orderBys: [
      { dimension: { dimensionName: "date" }, desc: true },
    ],
    limit: 10,
  };

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;

  const response = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${accessToken}`,
    },
    body:   JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
    cache:  "no-store",
  });

  const data = (await response.json()) as Ga4ReportResponse;

  if (!response.ok) {
    const msg = data?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`GA4 Data API error: ${msg}`);
  }

  return data;
}

// ── Result aggregation ─────────────────────────────────────────────────────────

// GA4 often returns "(not set)" for unknown values — treat as null.
function normaliseGa4String(v: string | null | undefined): string | null {
  if (!v || v === "(not set)" || v === "(not provided)") return null;
  return v;
}

/**
 * Extract location + channel fields from a single GA4 row.
 *
 * Dimension layout (matches the query in queryGa4Report):
 *   dim[0] = visitorId (filter value — skipped)
 *   dim[1] = city
 *   dim[2] = region
 *   dim[3] = country
 *   dim[4] = sessionDefaultChannelGrouping
 *   dim[5] = date (YYYYMMDD — used for ordering, not extracted here)
 */
function extractRowFields(row: Ga4Row): {
  city: string | null;
  region: string | null;
  country: string | null;
  channel: string | null;
} {
  const dim = row.dimensionValues;
  return {
    city:    normaliseGa4String(dim[1]?.value),
    region:  normaliseGa4String(dim[2]?.value),
    country: normaliseGa4String(dim[3]?.value),
    channel: normaliseGa4String(dim[4]?.value),
  };
}

/**
 * Aggregate raw GA4 rows (ordered by date DESC) into the enrichment output fields.
 *
 * Row[0] → gaCurrent* (most recent session date).
 * Row[1] → gaLastKnown* (previous session date, if present; null when only one row).
 *
 * gaSessionCount sums sessions across all rows.
 * gaRowsReturned is the raw count of rows returned by the Data API.
 */
function aggregateGa4Rows(rows: Ga4Row[]): Partial<EnrichmentOutput> {
  if (rows.length === 0) return { gaRowsReturned: 0 };

  let totalSessions = 0;
  for (const row of rows) {
    const sessions = parseInt(row.metricValues[0]?.value ?? "0", 10);
    if (!isNaN(sessions)) totalSessions += sessions;
  }

  // Row[0] — most recent date (ordered by date DESC) → gaCurrent*
  const current = extractRowFields(rows[0]);

  // Row[1] — previous date (if present) → gaLastKnown*
  const previous = rows.length >= 2 ? extractRowFields(rows[1]) : null;

  return {
    gaCurrentCity:         current.city,
    gaCurrentRegion:       current.region,
    gaCurrentCountry:      current.country,
    gaCurrentChannelGroup: current.channel,
    gaLastKnownCity:       previous?.city    ?? null,
    gaLastKnownRegion:     previous?.region  ?? null,
    gaLastKnownCountry:    previous?.country ?? null,
    gaLastChannelGroup:    previous?.channel ?? null,
    gaSessionCount:        totalSessions > 0 ? totalSessions : null,
    gaRowsReturned:        rows.length,
    gaHistorySource:       "ga4",
  };
}

// ── Options ────────────────────────────────────────────────────────────────────

export interface Ga4HistoryEnricherOptions {
  /**
   * Google Analytics 4 property ID (numeric string, e.g. "123456789").
   * Required — the enricher is a no-op without this.
   */
  propertyId: string;

  /**
   * Parsed service account JSON object (from the platform store secret).
   * Must include `client_email` and `private_key`.
   * Required — the enricher cannot authenticate without this.
   */
  serviceAccount: ServiceAccountJson;

  /**
   * Name of the User-scoped custom dimension in GA4 used to store the
   * first-party visitor ID, e.g. "visitor_id".
   * The "customUser:" prefix is added automatically if absent.
   * Default: "visitor_id"
   */
  visitorIdDimension?: string;

  /**
   * How far back (in days) to look for GA4 sessions for this visitor.
   * Larger values find more returning visitors at the cost of slower queries
   * against very large GA4 datasets.
   * Default: 90 days.
   */
  lookbackDays?: number;

  /**
   * Cache TTL for GA4 results, in milliseconds.
   * Results are cached per `${propertyId}:${visitorId}`.
   * Default: 30 minutes (1 800 000 ms).
   */
  cacheTtlMs?: number;

  /** Enable verbose debug logging. Default: false. */
  isDev?: boolean;
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Create a `StagedEnricher` that queries GA4 historical data for the current
 * visitor and writes `ga*`-prefixed fields into the enrichment output.
 *
 * Gate conditions (shouldRun):
 *   - `input.visitorId` must be a non-empty string.
 *
 * The enricher NEVER overwrites live geo fields — it writes only to the
 * `gaCurrentCity/Region/Country/ChannelGroup`, `gaLastKnownCity/Region/Country`,
 * `gaLastChannelGroup`, `gaSessionCount`, `gaRowsReturned`, and `gaHistorySource` fields.
 */
export function createGa4HistoryEnricher(
  options: Ga4HistoryEnricherOptions,
): StagedEnricher {
  const {
    propertyId,
    serviceAccount,
    visitorIdDimension = "visitor_id",
    lookbackDays       = 90,
    cacheTtlMs         = 30 * 60 * 1_000,
    isDev              = false,
  } = options;

  return {
    label: "GA4 History",

    shouldRun: (input: EnricherInput): boolean => {
      return !!(input.visitorId && input.visitorId.trim().length > 0);
    },

    getSkipReason: (input: EnricherInput): string => {
      if (!input.visitorId || !input.visitorId.trim()) {
        return "No visitorId available in EnricherInput — GA4 history lookup requires a first-party visitor identifier.";
      }
      return "GA4 history skipped.";
    },

    enricher: async (
      input: EnricherInput,
      _accumulated: Partial<EnrichmentOutput>,
      ctx?: EnricherContext,
    ): Promise<Partial<EnrichmentOutput>> => {
      const visitorId = input.visitorId?.trim() ?? "";
      if (!visitorId) return {};

      // ── Results cache check ────────────────────────────────────────────────
      const cache    = getResultsCache(cacheTtlMs);
      const cacheKey = `${propertyId}:${visitorId}`;
      const cached   = cache.get(cacheKey);

      if (cached.hit) {
        ctx?.setCacheSource("provider-cache");
        // Always log cache hits so operators can trace GA4 history flow without
        // needing to enable dev mode or reproduce locally.
        logger.debug("[ga4-history] cache hit", {
          visitorId,
          propertyId,
          gaRowsReturned:        (cached.value as Partial<EnrichmentOutput>).gaRowsReturned ?? null,
          gaSessionCount:        (cached.value as Partial<EnrichmentOutput>).gaSessionCount ?? null,
          gaCurrentCity:         (cached.value as Partial<EnrichmentOutput>).gaCurrentCity ?? null,
          gaCurrentCountry:      (cached.value as Partial<EnrichmentOutput>).gaCurrentCountry ?? null,
          gaLastKnownCity:       (cached.value as Partial<EnrichmentOutput>).gaLastKnownCity ?? null,
          gaLastKnownCountry:    (cached.value as Partial<EnrichmentOutput>).gaLastKnownCountry ?? null,
        });
        return cached.value;
      }
      ctx?.setCacheSource("fresh");

      // ── Fetch access token (cached 50 min) ────────────────────────────────
      let accessToken: string;
      try {
        accessToken = await getAccessToken(serviceAccount);
      } catch (err) {
        logger.warn("[ga4-history] OAuth token exchange failed — skipping GA4 history lookup", {
          visitorId,
          propertyId,
          error: err instanceof Error ? err.message : String(err),
        });
        return {};
      }

      // ── Query GA4 Data API ─────────────────────────────────────────────────
      //
      // Always log the visitorId being sent so operators can confirm it matches
      // the value stored in GA4 (and therefore the GA4 History enricher will find rows).
      logger.debug("[ga4-history] querying GA4 Data API", {
        propertyId,
        visitorIdDimension,
        visitorId,
        lookbackDays,
      });

      let report: Ga4ReportResponse;
      try {
        report = await queryGa4Report(
          propertyId,
          visitorIdDimension,
          visitorId,
          lookbackDays,
          accessToken,
        );
      } catch (err) {
        logger.warn("[ga4-history] GA4 Data API query failed", {
          visitorId,
          propertyId,
          error: err instanceof Error ? err.message : String(err),
        });
        return {};
      }

      // ── Aggregate rows → output ────────────────────────────────────────────
      const rows   = report.rows ?? [];
      const output = aggregateGa4Rows(rows);

      // Always log lookup results — rowsReturned: 0 here is the key indicator
      // that GA4 has not yet associated any events with this visitorId user property.
      logger.debug("[ga4-history] GA4 Data API result", {
        visitorId,
        propertyId,
        rowsReturned:          rows.length,
        rowCount:              report.rowCount ?? 0,
        gaSessionCount:        output.gaSessionCount ?? null,
        // Current session (most recent date row)
        gaCurrentCity:         output.gaCurrentCity ?? null,
        gaCurrentRegion:       output.gaCurrentRegion ?? null,
        gaCurrentCountry:      output.gaCurrentCountry ?? null,
        gaCurrentChannelGroup: output.gaCurrentChannelGroup ?? null,
        // Previous session (second most recent date row; null when only one row)
        gaLastKnownCity:       output.gaLastKnownCity ?? null,
        gaLastKnownRegion:     output.gaLastKnownRegion ?? null,
        gaLastKnownCountry:    output.gaLastKnownCountry ?? null,
        gaLastChannelGroup:    output.gaLastChannelGroup ?? null,
        hasData:               rows.length > 0,
        hasPreviousSession:    rows.length >= 2,
      });

      // ── Cache and return ───────────────────────────────────────────────────
      cache.set(cacheKey, output);
      return output;
    },
  };
}

// ── Test helper ────────────────────────────────────────────────────────────────

/**
 * Minimal connectivity test for the GA4 Data API.
 *
 * Fetches metadata for the configured property (`getMetadata` endpoint) — a
 * lightweight, read-only call that validates the service account token and
 * property access without running a full report query.
 *
 * @returns Array of `{ label, value }` pairs suitable for the test result UI.
 */
export async function testGa4Connection(
  propertyId:     string,
  serviceAccount: ServiceAccountJson,
): Promise<{ ok: true; fields: Array<{ label: string; value: string | null }> }
         | { ok: false; errorType: "auth" | "config" | "network" | "unknown"; message: string }> {
  let accessToken: string;
  try {
    // Bypass token cache for test — always fetch fresh.
    const jwt = createServiceAccountJwt(serviceAccount);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion:  jwt,
      }),
      signal: AbortSignal.timeout(8_000),
      cache:  "no-store",
    });
    const data = (await res.json()) as { access_token?: string; error?: string };
    if (!res.ok || !data.access_token) {
      return {
        ok:        false,
        errorType: "auth",
        message:   `Service account authentication failed: ${data.error ?? `HTTP ${res.status}`}`,
      };
    }
    accessToken = data.access_token;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok:        false,
      errorType: "network",
      message:   `Failed to reach Google OAuth endpoint: ${msg}`,
    };
  }

  // ── Validate property access via getMetadata ───────────────────────────────
  try {
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}/metadata`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal:  AbortSignal.timeout(8_000),
      cache:   "no-store",
    });

    if (res.status === 403 || res.status === 401) {
      return {
        ok:        false,
        errorType: "auth",
        message:   `Access denied to GA4 property ${propertyId} (HTTP ${res.status}). Ensure the service account has "Viewer" role in GA4.`,
      };
    }

    if (res.status === 404) {
      return {
        ok:        false,
        errorType: "config",
        message:   `GA4 property ${propertyId} not found. Verify the property ID is correct.`,
      };
    }

    if (!res.ok) {
      return {
        ok:        false,
        errorType: "network",
        message:   `GA4 metadata endpoint returned HTTP ${res.status}.`,
      };
    }

    const meta = (await res.json()) as {
      dimensions?: Array<{ apiName?: string; uiName?: string }>;
      metrics?:    Array<{ apiName?: string; uiName?: string }>;
    };

    const dimensionCount = meta.dimensions?.length ?? 0;
    const metricCount    = meta.metrics?.length    ?? 0;

    // Look for custom User-scoped dimensions in the metadata.
    const customDims = (meta.dimensions ?? [])
      .filter((d) => d.apiName?.startsWith("customUser:"))
      .map((d) => d.apiName ?? "")
      .slice(0, 3)
      .join(", ");

    return {
      ok: true,
      fields: [
        { label: "Property ID",        value: propertyId },
        { label: "Service account",    value: serviceAccount.client_email },
        { label: "Dimensions found",   value: String(dimensionCount) },
        { label: "Metrics found",      value: String(metricCount) },
        { label: "Custom user dims",   value: customDims || "(none found)" },
        { label: "Auth",               value: "✓ Service account authenticated" },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok:        false,
      errorType: "network",
      message:   `GA4 metadata request failed: ${msg}`,
    };
  }
}

// ── Debug cache flush ─────────────────────────────────────────────────────────

/**
 * Flush the in-process GA4 visit-history results cache.
 *
 * Called by `enrichment/flush-debug.ts` during a debug session reset so that
 * the post-reset request re-fetches GA4 history rather than serving TTL-cached
 * (up to 30 min) results.
 *
 * The cache is lazily initialized — if it has never been used, this is a no-op.
 */
export function flushGa4HistoryProviderCache(): void {
  if (resultsCache) resultsCache.flush();
}
