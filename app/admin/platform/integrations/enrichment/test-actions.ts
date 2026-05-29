/**
 * Enrichment Integration — Test Connection Server Actions
 *
 * One dedicated server action per provider.  Each action:
 *   1. Reads credentials server-side from the platform store (no secret ever
 *      crosses the server→client boundary).
 *   2. Calls a minimal, read-only endpoint with a fixed safe test input.
 *   3. Returns a structured `TestConnectionResult` — never throws.
 *
 * ─── Fixed test inputs ────────────────────────────────────────────────────────
 *
 *   IP address:    8.8.8.8   (Google Public DNS — always reachable, well-known)
 *   Country code:  NL        (Netherlands — for Nager.Date holiday lookups)
 *   KvK query:     ING       (large Dutch bank — reliable overheid.io/openkvk result)
 *
 * ─── Error taxonomy ──────────────────────────────────────────────────────────
 *
 *   "config"  — credentials not configured (no API call attempted)
 *   "auth"    — HTTP 401 or 403 (bad key / expired token)
 *   "empty"   — credentials are valid but the API returned no usable data
 *   "network" — connection timeout, DNS failure, unexpected HTTP error
 *   "unknown" — catch-all for unexpected exceptions
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Credential values are read inside the action and used only for the outbound
 *   HTTP request.  They are never included in the returned result object.
 */

"use server";

import {
  getPlatformMaxMindSettings,
  getPlatformEnrichmentSettings,
  getPlatformReverseGeocodeSettings,
  getPlatformGa4HistorySettings,
} from "@/platform/platform-store";
import { testGa4Connection } from "@/enrichment/providers/ga4-history";

// ── Shared result type ────────────────────────────────────────────────────────

/** A single key/value field to display in the test result panel. */
export interface TestResultField {
  label: string;
  value: string | null;
}

/** Structured result returned by every test action. */
export type TestConnectionResult =
  | {
      ok:         true;
      /** Key response fields to surface in the UI. */
      fields:     TestResultField[];
      /** Round-trip latency in milliseconds. */
      latencyMs:  number;
    }
  | {
      ok:         false;
      /** Error category — used to render a tailored message in the UI. */
      errorType:  "config" | "auth" | "empty" | "network" | "unknown";
      /** Human-readable error description. */
      message:    string;
      latencyMs:  number;
    };

// ── Shared helpers ────────────────────────────────────────────────────────────

function elapsed(startMs: number): number {
  return Date.now() - startMs;
}

function networkError(message: string, latencyMs: number): TestConnectionResult {
  return { ok: false, errorType: "network", message, latencyMs };
}

function authError(status: number, latencyMs: number): TestConnectionResult {
  return {
    ok:        false,
    errorType: "auth",
    message:   `Authentication failed (HTTP ${status}). Check that the key is correct and has not expired.`,
    latencyMs,
  };
}

// ── 1. Nager.Date ─────────────────────────────────────────────────────────────

/**
 * Test Nager.Date — no credentials required.
 *
 * Endpoint: GET https://date.nager.at/api/v3/PublicHolidays/{year}/NL
 * Shows: holiday count for NL in the current year, first holiday name and date.
 */
export async function testNagerDateConnectionAction(): Promise<TestConnectionResult> {
  const start = Date.now();
  const year  = new Date().getFullYear();

  try {
    const url      = `https://date.nager.at/api/v3/PublicHolidays/${year}/NL`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal:  AbortSignal.timeout(6_000),
      cache:   "no-store",
    });

    if (!response.ok) {
      return networkError(`API returned HTTP ${response.status}`, elapsed(start));
    }

    const data = (await response.json()) as Array<{
      date?:      string;
      localName?: string;
      name?:      string;
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, errorType: "empty", message: "API is reachable but returned no holidays for NL.", latencyMs: elapsed(start) };
    }

    const first = data[0];
    return {
      ok:       true,
      latencyMs: elapsed(start),
      fields: [
        { label: "Country",         value: `NL (${year})` },
        { label: "Holidays found",  value: String(data.length) },
        { label: "First holiday",   value: first.localName ?? first.name ?? null },
        { label: "Date",            value: first.date ?? null },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return networkError(msg.includes("timeout") ? "Request timed out after 6 s." : msg, elapsed(start));
  }
}

// ── 2. OpenKvK ────────────────────────────────────────────────────────────────

/**
 * Test OpenKvK (overheid.io) — requires ovio-api-key.
 *
 * Endpoint: GET https://api.overheid.io/v3/suggest/openkvk/{query}
 *
 * The suggest endpoint is purpose-built for company name search: it handles
 * spaces, partial names, and fuzzy matches.  The list endpoint (/v3/openkvk)
 * uses Elasticsearch full-text and requires explicit queryfields[] — the
 * suggest endpoint is simpler and more reliable for name-first lookups.
 *
 * @param query  Company name to search for. Defaults to "ING" (large Dutch bank, reliable result).
 * @param city   Optional city hint — used to prefer a result with a matching postcode city if
 *               the full detail is fetched, but the suggest endpoint itself does not filter by city.
 */
export async function testOpenKvKConnectionAction(
  query: string = "ING",
  city?: string,
): Promise<TestConnectionResult> {
  const start = Date.now();

  // Sanitise inputs — trim and fall back to defaults.
  const safeQuery = (query ?? "").trim() || "ING";
  const safeCity  = (city  ?? "").trim() || undefined;

  // Read the ovio API key from the platform store.
  const enrichmentSettings = await getPlatformEnrichmentSettings();
  const ovioApiKey = enrichmentSettings.ok ? (enrichmentSettings.data.ovioApiKey ?? "") : "";

  if (!ovioApiKey) {
    return {
      ok:        false,
      errorType: "config",
      message:   "overheid.io API key (ovio-api-key) is not configured. Add the key in the API Keys section above and save first. Register for free at https://overheid.io/register.",
      latencyMs: elapsed(start),
    };
  }

  type SuggestResult = {
    link:    string;
    kvknummer: number | string;
    postcode:  string | null;
    naam:      string | string[];
  };
  type FetchResult = { status: number; results: SuggestResult[] | null; source?: string };

  /** Normalise naam to a single display string regardless of API shape. */
  function toNaamString(naam: string | string[] | null | undefined): string {
    if (!naam) return "";
    if (Array.isArray(naam)) return naam[0] ?? "";
    return naam;
  }

  /** Fetch via the suggest endpoint: GET /v3/suggest/openkvk/{q} */
  async function fetchSuggest(q: string): Promise<FetchResult> {
    const url = `https://api.overheid.io/v3/suggest/openkvk/${encodeURIComponent(q)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "ovio-api-key": ovioApiKey },
      signal:  AbortSignal.timeout(6_000),
      cache:   "no-store",
    });
    if (response.status === 401 || response.status === 403) return { status: response.status, results: null };
    if (!response.ok) return { status: response.status, results: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;
    if (!Array.isArray(data)) return { status: 200, results: [] };
    return { status: 200, results: data as SuggestResult[], source: "suggest" };
  }

  /**
   * Fetch via the list endpoint: GET /v3/openkvk?query={q}
   * No explicit queryfields[] — uses the API default (huidigeHandelsNamen + kvknummer).
   * Adding queryfields[]=huidigeHandelsNamen appears to be MORE restrictive (exact/phrase),
   * while omitting it uses a broader default Elasticsearch query.
   */
  async function fetchList(q: string): Promise<FetchResult> {
    const url =
      `https://api.overheid.io/v3/openkvk` +
      `?query=${encodeURIComponent(q)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "ovio-api-key": ovioApiKey },
      signal:  AbortSignal.timeout(6_000),
      cache:   "no-store",
    });
    if (response.status === 401 || response.status === 403) return { status: response.status, results: null };
    if (!response.ok) return { status: response.status, results: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as Record<string, any>;
    type Bedrijf = { naam?: string; kvknummer?: string; bezoeklocatie?: { postcode?: string }; inschrijvingstype?: string };
    const bedrijven: Bedrijf[] = data._embedded?.bedrijf ?? [];
    const mapped: SuggestResult[] = bedrijven.map((b) => ({
      link:      b.inschrijvingstype?.toLowerCase().includes("hoofd") ? "hoofdvestiging" : (b.inschrijvingstype ?? ""),
      kvknummer: b.kvknummer ?? "",
      postcode:  b.bezoeklocatie?.postcode ?? null,
      naam:      b.naam ?? "",
    }));
    return { status: 200, results: mapped, source: "list" };
  }

  /**
   * Search strategy (in order — stops at first non-empty result):
   *   1. List: "{company} {city}" combined  (only when city hint provided — mirrors openkvk.nl)
   *   2. List: full query alone
   *   3. List: suffix-stripped query  (e.g. "STEETS B.V." → "STEETS")
   *   4. Suggest: full query (fuzzy — last resort, may return phonetically similar names)
   *   5. Suggest: suffix-stripped query (fuzzy)
   *
   * List is tried before suggest because suggest uses edit-distance fuzzy matching
   * that easily confuses similar names (e.g. "STEETS" → "Smeets").
   * The city-combined query (step 1) mirrors what openkvk.nl does internally.
   */
  async function search(q: string): Promise<{ result: FetchResult; usedQuery: string }> {
    const stripped = q
      .replace(/\s+(B\.?V\.?|N\.?V\.?|V\.?O\.?F\.?|B\.V|N\.V|VOF|BV|NV|CV|Inc\.?|Ltd\.?|S\.A\.?|GmbH)\.?\s*$/i, "")
      .trim();

    // 1. List — company + city combined (when city hint provided)
    if (safeCity) {
      const withCity = `${q} ${safeCity}`;
      const lc = await fetchList(withCity);
      if (lc.results === null) return { result: lc, usedQuery: withCity };
      if (lc.results.length > 0) return { result: lc, usedQuery: withCity };
    }

    // 2. List — full query alone
    const l1 = await fetchList(q);
    if (l1.results === null) return { result: l1, usedQuery: q };
    if (l1.results.length > 0) return { result: l1, usedQuery: q };

    // 3. List — suffix stripped
    if (stripped && stripped !== q) {
      const l2 = await fetchList(stripped);
      if (l2.results === null) return { result: l2, usedQuery: stripped };
      if (l2.results.length > 0) return { result: l2, usedQuery: stripped };
    }

    // 4. Suggest — full query (fuzzy)
    const s1 = await fetchSuggest(q);
    if (s1.results === null) return { result: s1, usedQuery: q };
    if (s1.results.length > 0) return { result: s1, usedQuery: q };

    // 5. Suggest — suffix stripped (fuzzy)
    if (stripped && stripped !== q) {
      const s2 = await fetchSuggest(stripped);
      if (s2.results && s2.results.length > 0) return { result: s2, usedQuery: stripped };
    }

    return { result: l1, usedQuery: q }; // all attempts empty
  }

  try {
    const { result: attempt, usedQuery } = await search(safeQuery);

    if (attempt.results === null) {
      return (attempt.status === 401 || attempt.status === 403)
        ? authError(attempt.status, elapsed(start))
        : networkError(`API returned HTTP ${attempt.status}`, elapsed(start));
    }

    const results = attempt.results;

    if (results.length === 0) {
      return {
        ok:        false,
        errorType: "empty",
        message:   `API is reachable but "${safeQuery}" returned no results from overheid.io (tried both suggest and list endpoints). Check that the company name is spelled correctly and is a Dutch KvK-registered entity.`,
        latencyMs: elapsed(start),
      };
    }

    // Build display label for the query used.
    const queryLabel = usedQuery !== safeQuery
      ? `${safeQuery} → retried as "${usedQuery}"${safeCity ? ` (city hint: ${safeCity})` : ""}`
      : safeCity ? `${safeQuery} (city hint: ${safeCity})` : safeQuery;

    // Show top-5 names so the user can verify their company is in the list.
    const top5Names = results
      .slice(0, 5)
      .map((r) => toNaamString(r.naam))
      .filter(Boolean)
      .join(", ");

    // Top result (prefer Hoofdvestiging).
    const top = results.find((r) => String(r.link).toLowerCase().includes("hoofdvestiging")) ?? results[0];

    return {
      ok:        true,
      latencyMs: elapsed(start),
      fields: [
        { label: "Query",          value: queryLabel },
        { label: "Results found",  value: String(results.length) },
        { label: "Top 5 matches",  value: top5Names || null },
        { label: "KvK number",     value: top.kvknummer != null ? String(top.kvknummer) : null },
        { label: "Postcode",       value: top.postcode ?? null },
        { label: "Source",         value: attempt.source ?? null },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return networkError(msg.includes("timeout") ? "Request timed out after 6 s." : msg, elapsed(start));
  }
}

// ── 3. IPinfo Lite ────────────────────────────────────────────────────────────

/**
 * Test IPinfo Lite — requires API token from platform store.
 *
 * Endpoint: GET https://ipinfo.io/8.8.8.8?token={token}
 * Shows: country, city, org (ASN + name), hostname.
 */
export async function testIpinfoConnectionAction(): Promise<TestConnectionResult> {
  const start    = Date.now();
  const settings = await getPlatformEnrichmentSettings();

  if (!settings.ok) {
    return { ok: false, errorType: "unknown", message: `Could not read settings: ${settings.error}`, latencyMs: elapsed(start) };
  }

  const token = settings.data.ipinfoToken;
  if (!token) {
    return { ok: false, errorType: "config", message: "IPinfo token is not configured. Add a token and save first.", latencyMs: elapsed(start) };
  }

  try {
    const url      = `https://ipinfo.io/8.8.8.8?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal:  AbortSignal.timeout(6_000),
      cache:   "no-store",
    });

    if (response.status === 401 || response.status === 403) return authError(response.status, elapsed(start));

    if (!response.ok) {
      return networkError(`API returned HTTP ${response.status}`, elapsed(start));
    }

    const data = (await response.json()) as {
      ip?:       string;
      country?:  string;
      city?:     string;
      org?:      string;
      hostname?: string;
      bogon?:    boolean;
    };

    if (data.bogon) {
      return { ok: false, errorType: "empty", message: "API responded but returned a bogon result for 8.8.8.8 (unexpected).", latencyMs: elapsed(start) };
    }

    // Parse org field: "AS15169 Google LLC" → ASN + name
    const [asn, ...orgParts] = (data.org ?? "").split(" ");
    const orgName = orgParts.join(" ") || null;

    return {
      ok:       true,
      latencyMs: elapsed(start),
      fields: [
        { label: "IP tested",  value: data.ip      ?? "8.8.8.8" },
        { label: "Country",    value: data.country ?? null },
        { label: "City",       value: data.city    ?? null },
        { label: "ASN",        value: asn || null },
        { label: "Org",        value: orgName },
        { label: "Hostname",   value: data.hostname ?? null },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return networkError(msg.includes("timeout") ? "Request timed out after 6 s." : msg, elapsed(start));
  }
}

// ── 4. Leadinfo ───────────────────────────────────────────────────────────────

/**
 * Test Leadinfo — requires API key from platform store.
 *
 * Endpoint: GET https://api.leadinfo.com/identify?ip=8.8.8.8
 *           Authorization: Bearer {apiKey}
 *
 * Note: 8.8.8.8 (Google DNS) is a consumer IP — Leadinfo may return 404 (not
 * mapped to a B2B company), which is expected and indicates valid credentials.
 * Shows: company name, domain, industry, country.
 */
export async function testLeadinfoConnectionAction(): Promise<TestConnectionResult> {
  const start    = Date.now();
  const settings = await getPlatformEnrichmentSettings();

  if (!settings.ok) {
    return { ok: false, errorType: "unknown", message: `Could not read settings: ${settings.error}`, latencyMs: elapsed(start) };
  }

  const apiKey = settings.data.leadinfoApiKey;
  if (!apiKey) {
    return { ok: false, errorType: "config", message: "Leadinfo API key is not configured. Add a key and save first.", latencyMs: elapsed(start) };
  }

  try {
    const url      = `https://api.leadinfo.com/identify?ip=${encodeURIComponent("8.8.8.8")}`;
    const response = await fetch(url, {
      headers: {
        Accept:        "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(8_000),
      cache:  "no-store",
    });

    if (response.status === 401 || response.status === 403) return authError(response.status, elapsed(start));

    // 404 = IP is not mapped to a B2B company — this is expected for 8.8.8.8.
    // Credentials are valid; the API simply has no record for this IP.
    if (response.status === 404) {
      return {
        ok:       true,
        latencyMs: elapsed(start),
        fields: [
          { label: "IP tested",  value: "8.8.8.8" },
          { label: "Status",     value: "Connected — 8.8.8.8 (Google DNS) is not mapped to a B2B company, which is expected." },
          { label: "Company",    value: null },
        ],
      };
    }

    if (!response.ok) {
      return networkError(`API returned HTTP ${response.status}`, elapsed(start));
    }

    const data = (await response.json()) as {
      company?:  { name?: string; website?: string; industry?: string; size?: string };
      location?: { country?: string; city?: string };
    };

    return {
      ok:       true,
      latencyMs: elapsed(start),
      fields: [
        { label: "IP tested",  value: "8.8.8.8" },
        { label: "Company",    value: data.company?.name     ?? null },
        { label: "Domain",     value: data.company?.website  ?? null },
        { label: "Industry",   value: data.company?.industry ?? null },
        { label: "Size",       value: data.company?.size     ?? null },
        { label: "Country",    value: data.location?.country ?? null },
        { label: "City",       value: data.location?.city    ?? null },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return networkError(msg.includes("timeout") ? "Request timed out after 8 s." : msg, elapsed(start));
  }
}

// ── 5. MaxMind GeoIP ──────────────────────────────────────────────────────────

/**
 * Test MaxMind GeoIP2 web service — requires account ID + license key.
 *
 * Endpoint: GET https://geoip.maxmind.com/geoip/v2.1/city/8.8.8.8
 *           Authorization: Basic base64(accountId:licenseKey)
 *
 * Note: This tests the MaxMind GeoIP2 Precision Web Service, which requires a
 * paid plan.  Users with only a free GeoLite2 download account will receive
 * HTTP 401 — their credentials are valid for database downloads only, not for
 * the web service.  The local .mmdb pipeline is unaffected.
 *
 * Shows: country ISO code, country name, city, latitude/longitude.
 */
export async function testMaxMindConnectionAction(): Promise<TestConnectionResult> {
  const start    = Date.now();
  const settings = await getPlatformMaxMindSettings();

  if (!settings.ok) {
    return { ok: false, errorType: "unknown", message: `Could not read settings: ${settings.error}`, latencyMs: elapsed(start) };
  }

  const { accountId, licenseKey } = settings.data;

  if (!accountId || !licenseKey) {
    return {
      ok:        false,
      errorType: "config",
      message:   `MaxMind ${!accountId ? "account ID" : "license key"} is not configured. Add both and save first.`,
      latencyMs: elapsed(start),
    };
  }

  try {
    const credentials = Buffer.from(`${accountId}:${licenseKey}`).toString("base64");
    const url         = `https://geoip.maxmind.com/geoip/v2.1/city/8.8.8.8`;

    const response = await fetch(url, {
      headers: {
        Accept:        "application/json",
        Authorization: `Basic ${credentials}`,
      },
      signal: AbortSignal.timeout(8_000),
      cache:  "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      // Distinguish free-account 401 from bad-key 401 using the response body
      let detail = "";
      try {
        const body = (await response.json()) as { code?: string; error?: string };
        detail = body.error ? ` — ${body.error}` : (body.code ? ` (code: ${body.code})` : "");
      } catch { /* ignore parse errors */ }

      return {
        ok:        false,
        errorType: "auth",
        message:   response.status === 401
          ? `Authentication failed${detail}. If using a free GeoLite2 account, note that the Precision Web Service requires a paid plan. The local .mmdb pipeline does not require web service access.`
          : `Access denied (HTTP ${response.status})${detail}.`,
        latencyMs: elapsed(start),
      };
    }

    if (!response.ok) {
      return networkError(`API returned HTTP ${response.status}`, elapsed(start));
    }

    const data = (await response.json()) as {
      country?:  { iso_code?: string; names?: Record<string, string> };
      city?:     { names?: Record<string, string> };
      location?: { latitude?: number; longitude?: number };
    };

    return {
      ok:       true,
      latencyMs: elapsed(start),
      fields: [
        { label: "IP tested",    value: "8.8.8.8" },
        { label: "Country code", value: data.country?.iso_code ?? null },
        { label: "Country",      value: data.country?.names?.en ?? null },
        { label: "City",         value: data.city?.names?.en ?? null },
        { label: "Latitude",     value: data.location?.latitude  != null ? String(data.location.latitude)  : null },
        { label: "Longitude",    value: data.location?.longitude != null ? String(data.location.longitude) : null },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return networkError(msg.includes("timeout") ? "Request timed out after 8 s." : msg, elapsed(start));
  }
}

// ── 6. Reverse Geocode ─────────────────────────────────────────────────────────

/**
 * Test the reverse-geocode provider chain.
 *
 * Uses fixed coordinates 52.3676,4.9041 (Amsterdam city centre, NL) as a
 * stable, well-known test point that all three providers handle reliably.
 *
 * The test resolves the provider chain in priority order:
 *   1. LocationIQ  (when API key is configured)
 *   2. BigDataCloud (no key needed)
 *   3. Nominatim   (no key needed, OSM)
 *
 * Shows: which provider was used, country, region, city, postcode, formatted address.
 */
export async function testReverseGeocodeConnectionAction(): Promise<TestConnectionResult> {
  const start    = Date.now();
  const settings = await getPlatformReverseGeocodeSettings();

  if (!settings.ok) {
    return { ok: false, errorType: "unknown", message: `Could not read settings: ${settings.error}`, latencyMs: elapsed(start) };
  }

  // Fixed test coordinates: Amsterdam, Netherlands
  const LAT = 52.3676;
  const LNG =  4.9041;

  const locationIqApiKey = settings.data.locationIqApiKey;

  // ── Try LocationIQ first (if configured) ────────────────────────────────────
  if (locationIqApiKey) {
    try {
      const url =
        `https://us1.locationiq.com/v1/reverse` +
        `?key=${encodeURIComponent(locationIqApiKey)}` +
        `&lat=${LAT}&lon=${LNG}&format=json&addressdetails=1`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal:  AbortSignal.timeout(5_000),
        cache:   "no-store",
      });

      if (res.status === 401 || res.status === 403) return authError(res.status, elapsed(start));

      if (res.ok) {
        type LiqResponse = {
          display_name?: string;
          address?: {
            country_code?: string;
            state?: string;
            city?: string; town?: string; village?: string;
            municipality?: string; county?: string;
            postcode?: string;
          };
        };
        const data = await res.json() as LiqResponse;
        const addr = data.address;
        return {
          ok:       true,
          latencyMs: elapsed(start),
          fields: [
            { label: "Provider",     value: "LocationIQ" },
            { label: "Test coords",  value: `${LAT}, ${LNG} (Amsterdam)` },
            { label: "Country",      value: addr?.country_code?.toUpperCase() ?? null },
            { label: "Region",       value: addr?.state ?? null },
            { label: "City",         value: addr?.city ?? addr?.town ?? addr?.village ?? null },
            { label: "Municipality", value: addr?.municipality ?? addr?.county ?? null },
            { label: "Postcode",     value: addr?.postcode ?? null },
            { label: "Formatted",    value: data.display_name?.slice(0, 100) ?? null },
          ],
        };
      }
    } catch {
      // Fall through to BigDataCloud
    }
  }

  // ── Try BigDataCloud ─────────────────────────────────────────────────────────
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${LAT}&longitude=${LNG}&localityLanguage=en`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal:  AbortSignal.timeout(5_000),
      cache:   "no-store",
    });

    if (res.ok) {
      type BdcResponse = {
        countryCode?:          string;
        principalSubdivision?: string;
        city?:                 string;
        locality?:             string;
        postcode?:             string;
      };
      const data = await res.json() as BdcResponse;

      if (data.countryCode || data.city || data.locality) {
        return {
          ok:       true,
          latencyMs: elapsed(start),
          fields: [
            { label: "Provider",    value: locationIqApiKey ? "BigDataCloud (LocationIQ fallback)" : "BigDataCloud" },
            { label: "Test coords", value: `${LAT}, ${LNG} (Amsterdam)` },
            { label: "Country",     value: data.countryCode?.toUpperCase() ?? null },
            { label: "Region",      value: data.principalSubdivision ?? null },
            { label: "City",        value: data.city ?? data.locality ?? null },
            { label: "Postcode",    value: data.postcode ?? null },
          ],
        };
      }
    }
  } catch {
    // Fall through to Nominatim
  }

  // ── Try Nominatim ────────────────────────────────────────────────────────────
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${LAT}&lon=${LNG}&format=json&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        Accept:       "application/json",
        "User-Agent": "mister-chameleon-enrichment/1.0",
      },
      signal: AbortSignal.timeout(6_000),
      cache:  "no-store",
    });

    if (res.ok) {
      type NomResponse = {
        display_name?: string;
        address?: {
          country_code?: string;
          state?: string;
          city?: string; town?: string; village?: string;
          municipality?: string; county?: string;
          postcode?: string;
        };
      };
      const data = await res.json() as NomResponse;
      const addr = data.address;

      return {
        ok:       true,
        latencyMs: elapsed(start),
        fields: [
          { label: "Provider",     value: "Nominatim (OSM)" },
          { label: "Test coords",  value: `${LAT}, ${LNG} (Amsterdam)` },
          { label: "Country",      value: addr?.country_code?.toUpperCase() ?? null },
          { label: "Region",       value: addr?.state ?? null },
          { label: "City",         value: addr?.city ?? addr?.town ?? addr?.village ?? null },
          { label: "Municipality", value: addr?.municipality ?? addr?.county ?? null },
          { label: "Postcode",     value: addr?.postcode ?? null },
          { label: "Formatted",    value: data.display_name?.slice(0, 100) ?? null },
        ],
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return networkError(
      `All providers failed. Last error: ${msg.includes("timeout") ? "Nominatim timed out." : msg}`,
      elapsed(start),
    );
  }

  return networkError(
    "All three reverse-geocode providers (LocationIQ, BigDataCloud, Nominatim) returned no usable result.",
    elapsed(start),
  );
}

// ── 7. Open-Meteo Weather ─────────────────────────────────────────────────────

/**
 * Minimal WMO weather interpretation code → human-readable summary.
 * Covers the most common codes; falls back to the raw code string.
 */
function describeWeatherCode(code: number): string {
  if (code === 0)  return "Clear sky";
  if (code === 1)  return "Mainly clear";
  if (code === 2)  return "Partly cloudy";
  if (code === 3)  return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 55)  return "Drizzle";
  if (code >= 56 && code <= 57)  return "Freezing drizzle";
  if (code >= 61 && code <= 65)  return "Rain";
  if (code >= 66 && code <= 67)  return "Freezing rain";
  if (code >= 71 && code <= 75)  return "Snow";
  if (code === 77) return "Snow grains";
  if (code >= 80 && code <= 82)  return "Rain showers";
  if (code >= 85 && code <= 86)  return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code >= 96 && code <= 99)  return "Thunderstorm with hail";
  return `WMO code ${code}`;
}

/**
 * Test the Open-Meteo weather provider — no credentials required.
 *
 * Uses fixed coordinates 52.3676, 4.9041 (Amsterdam city centre, NL) as a
 * stable, well-known test point.
 *
 * Endpoint:
 *   GET https://api.open-meteo.com/v1/forecast
 *   ?latitude=52.3676&longitude=4.9041
 *   &current=temperature_2m,precipitation_probability,rain,wind_speed_10m,cloud_cover,weather_code
 *   &forecast_days=1
 *
 * Shows: provider, test coordinates, temperature, weather code, summary,
 *        precipitation probability, wind speed, cloud cover.
 */
export async function testWeatherConnectionAction(): Promise<TestConnectionResult> {
  const start = Date.now();

  // Fixed test coordinates: Amsterdam, Netherlands
  const LAT = 52.3676;
  const LNG =  4.9041;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${LAT}&longitude=${LNG}` +
      `&current=temperature_2m,precipitation_probability,rain,wind_speed_10m,cloud_cover,weather_code` +
      `&forecast_days=1`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal:  AbortSignal.timeout(8_000),
      cache:   "no-store",
    });

    if (res.status === 401 || res.status === 403) return authError(res.status, elapsed(start));

    if (!res.ok) {
      return networkError(`Open-Meteo returned HTTP ${res.status}`, elapsed(start));
    }

    type OpenMeteoResponse = {
      current?: {
        temperature_2m?:           number;
        precipitation_probability?: number;
        rain?:                     number;
        wind_speed_10m?:           number;
        cloud_cover?:              number;
        weather_code?:             number;
      };
      current_units?: {
        temperature_2m?: string;
        wind_speed_10m?: string;
      };
    };

    const data = await res.json() as OpenMeteoResponse;
    const cur  = data.current;
    const units = data.current_units ?? {};

    if (!cur) {
      return { ok: false, errorType: "empty", message: "Open-Meteo responded but returned no current-conditions block.", latencyMs: elapsed(start) };
    }

    const tempUnit  = units.temperature_2m ?? "°C";
    const speedUnit = units.wind_speed_10m ?? "km/h";
    const code      = cur.weather_code;
    const summary   = code != null ? describeWeatherCode(code) : null;

    return {
      ok:       true,
      latencyMs: elapsed(start),
      fields: [
        { label: "Provider",                   value: "Open-Meteo (free, no API key)" },
        { label: "Test coordinates",            value: `${LAT}, ${LNG} (Amsterdam)` },
        { label: "Weather code",                value: code != null ? String(code) : null },
        { label: "Summary",                     value: summary },
        { label: `Temperature (${tempUnit})`,   value: cur.temperature_2m != null ? String(cur.temperature_2m) : null },
        { label: "Precipitation probability",   value: cur.precipitation_probability != null ? `${cur.precipitation_probability}%` : null },
        { label: `Wind speed (${speedUnit})`,   value: cur.wind_speed_10m != null ? String(cur.wind_speed_10m) : null },
        { label: "Cloud cover",                 value: cur.cloud_cover != null ? `${cur.cloud_cover}%` : null },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return networkError(msg.includes("timeout") ? "Request timed out after 8 s." : msg, elapsed(start));
  }
}

// ── 8. GA4 Analytics History ───────────────────────────────────────────────────

/**
 * Test the GA4 Analytics History integration.
 *
 * Validates:
 *   1. Service account JSON is configured and parseable.
 *   2. Service account can authenticate (OAuth2 JWT exchange succeeds).
 *   3. The configured GA4 property is accessible (getMetadata call).
 *
 * Uses the `testGa4Connection` helper from the enricher module which runs a
 * lightweight `getMetadata` call rather than a full report query, so no
 * visitor ID or custom dimension is required for the test.
 */
export async function testGa4HistoryConnectionAction(): Promise<TestConnectionResult> {
  const start    = Date.now();
  const settings = await getPlatformGa4HistorySettings();

  if (!settings.ok) {
    return {
      ok:        false,
      errorType: "unknown",
      message:   `Could not read GA4 settings: ${settings.error}`,
      latencyMs: elapsed(start),
    };
  }

  const { propertyId, serviceAccountJson } = settings.data;

  if (!serviceAccountJson) {
    return {
      ok:        false,
      errorType: "config",
      message:   "Service account JSON is not configured. Add your service account key and save first.",
      latencyMs: elapsed(start),
    };
  }

  if (!propertyId) {
    return {
      ok:        false,
      errorType: "config",
      message:   "GA4 property ID is not configured. Add the numeric property ID and save first.",
      latencyMs: elapsed(start),
    };
  }

  // Parse service account JSON
  let serviceAccount: { client_email: string; private_key: string; token_uri?: string };
  try {
    const parsed = JSON.parse(serviceAccountJson) as Record<string, unknown>;
    if (!parsed.client_email || !parsed.private_key) {
      return {
        ok:        false,
        errorType: "config",
        message:   "Service account JSON is missing client_email or private_key fields.",
        latencyMs: elapsed(start),
      };
    }
    serviceAccount = {
      client_email: String(parsed.client_email),
      private_key:  String(parsed.private_key),
      ...(parsed.token_uri ? { token_uri: String(parsed.token_uri) } : {}),
    };
  } catch {
    return {
      ok:        false,
      errorType: "config",
      message:   "Service account JSON could not be parsed. Ensure the full JSON key file contents are pasted.",
      latencyMs: elapsed(start),
    };
  }

  const result = await testGa4Connection(propertyId, serviceAccount);

  if (!result.ok) {
    return {
      ok:        false,
      errorType: result.errorType,
      message:   result.message,
      latencyMs: elapsed(start),
    };
  }

  return {
    ok:        true,
    fields:    result.fields,
    latencyMs: elapsed(start),
  };
}
