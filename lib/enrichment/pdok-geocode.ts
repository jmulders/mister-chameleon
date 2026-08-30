/**
 * lib/enrichment/pdok-geocode.ts
 *
 * Minimal PDOK Locatieserver geocoding (free Kadaster/PDOK open data, no key):
 *   • reverse: latitude/longitude → CBS buurtcode (IP-geo path).
 *   • forward: a form-provided postcode / place name → lat/lng centroid, which
 *     then feeds the reverse lookup to get the buurtcode (form-location path).
 *
 * NOTE (verified via a probe): the Locatieserver `free` endpoint returns NO
 * buurtcode for a postcode/place — only a `centroide_ll` ("POINT(lon lat)") plus
 * gemeente/woonplaats codes. So a postcode resolves to a buurt via its centroid:
 * forward (postcode → centroid) then reverse (centroid → buurt). A place name is
 * coarse — its centroid is the town centre, so it lands in a central buurt.
 *
 * ─── Transient-failure robustness ────────────────────────────────────────────
 * PDOK is a free public endpoint that occasionally times out or 5xx's. A single
 * hiccup must NOT poison a whole visitor session with an empty location. So the
 * resolvers distinguish two kinds of "no code":
 *   • "empty" — PDOK responded but there is no buurt for the point/query
 *               (genuine; a legitimate negative that may be cached).
 *   • "error" — timeout / network / 5xx / unparseable (TRANSIENT; the caller
 *               should retry on a later request instead of caching the miss).
 * On top of that:
 *   • one retry on a transient reverse failure (a fresh timeout window), and a
 *     slightly wider default timeout (6s), and
 *   • a process-level POSITIVE cache of coordinate → buurtcode: once a point
 *     resolves, a later PDOK hiccup returns the already-known code instead of
 *     wiping it. Coordinate→buurt is effectively stable (only shifts on the
 *     yearly CBS re-indeling), so this is safe to cache for a long TTL.
 *
 * Pure (fetch-based), unit-testable via an injected fetch. Buurtcode = "BU"+8.
 */

const PDOK_BASE            = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";
const PDOK_REVERSE_ENDPOINT = `${PDOK_BASE}/reverse`;
const PDOK_FREE_ENDPOINT    = `${PDOK_BASE}/free`;

/** Default PDOK timeout. Widened from 4s → 6s: the free endpoint is bursty. */
const DEFAULT_TIMEOUT_MS = 6_000;

/**
 * Outcome of a buurtcode resolution.
 *   ok    — a buurtcode was found (or served from the positive cache).
 *   empty — PDOK answered but there is no buurt for this point/query (genuine).
 *   error — a transient failure (timeout / network / 5xx / unparseable).
 * `code` is non-null only for `ok`. `fromCache` marks a positive-cache hit.
 */
export type GeoResolveStatus = "ok" | "empty" | "error";
export interface GeoResolveResult {
  status:     GeoResolveStatus;
  code:       string | null;
  fromCache?: boolean;
}

// ── Positive coordinate → buurtcode cache ──────────────────────────────────────
//
// Keyed by the coordinate rounded to 4 decimals (~11 m — well inside a buurt).
// A long TTL: the mapping only changes on the yearly CBS re-indeling.
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1_000;
const POSITIVE_MAX     = 5_000; // bound the map on a busy process
const positiveCache = new Map<string, { code: string; expiry: number }>();

/** Test helper: clear the module-level positive coordinate cache between cases. */
export function resetBuurtcodePositiveCache(): void { positiveCache.clear(); }

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function positiveGet(lat: number, lng: number): string | null {
  const hit = positiveCache.get(coordKey(lat, lng));
  if (!hit) return null;
  if (hit.expiry <= Date.now()) { positiveCache.delete(coordKey(lat, lng)); return null; }
  return hit.code;
}

function positiveSet(lat: number, lng: number, code: string): void {
  if (positiveCache.size >= POSITIVE_MAX) {
    // Cheap eviction: drop the oldest inserted key.
    const first = positiveCache.keys().next().value;
    if (first !== undefined) positiveCache.delete(first);
  }
  positiveCache.set(coordKey(lat, lng), { code, expiry: Date.now() + POSITIVE_TTL_MS });
}

/** Normalise a PDOK buurt identifier to a "BU########" code, or null. */
export function normalizeBuurtcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // PDOK returns either a bare code ("BU03630000") or an id like "buurt-BU03630000".
  const m = raw.match(/BU\d{8}/i);
  return m ? m[0].toUpperCase() : null;
}

/**
 * A single PDOK reverse attempt. Classifies the outcome into ok/empty/error so
 * the caller can decide whether to retry (error) or accept a genuine miss (empty).
 */
async function reverseOnce(
  lat: number,
  lng: number,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<GeoResolveResult> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({
      lat:  String(lat),
      lon:  String(lng),
      type: "buurt",
      rows: "1",
      // PDOK's /reverse omits `buurtcode` by default and its default `id` is an
      // opaque hash (buu-<hex>), so without an explicit field list the CBS code
      // is never present and resolution silently returns null. Request buurtcode.
      fl:   "id,buurtcode,weergavenaam",
    });
    const res = await fetchImpl(`${PDOK_REVERSE_ENDPOINT}?${params.toString()}`, {
      signal:  controller.signal,
      headers: { Accept: "application/json" },
    });
    // 5xx is transient (retry-worthy); any other non-ok is a hard error we do
    // not retry, but it is still not a genuine "no buurt here" — treat as error.
    if (!res.ok) return { status: "error", code: null };
    const json = (await res.json()) as {
      response?: { docs?: Array<{ buurtcode?: string; id?: string; weergavenaam?: string }> };
    };
    const doc = json.response?.docs?.[0];
    if (!doc) return { status: "empty", code: null }; // PDOK answered: no buurt.
    const code = normalizeBuurtcode(doc.buurtcode ?? doc.id ?? doc.weergavenaam ?? null);
    return code ? { status: "ok", code } : { status: "empty", code: null };
  } catch {
    // Abort (timeout) / network / JSON parse → transient.
    return { status: "error", code: null };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reverse geocode lat/lng → CBS buurtcode, returning a classified result.
 * Never throws. Consults the positive coordinate cache first (so a later PDOK
 * hiccup does not wipe an already-known code), retries ONCE on a transient
 * failure, and falls back to the positive cache when both attempts are transient.
 * `fetchImpl` is injectable for tests.
 */
export async function resolveBuurtcodeFromLatLng(
  lat: number,
  lng: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<GeoResolveResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: "empty", code: null };

  const cached = positiveGet(lat, lng);
  if (cached) return { status: "ok", code: cached, fromCache: true };

  let result = await reverseOnce(lat, lng, timeoutMs, fetchImpl);
  if (result.status === "error") {
    // One retry with a fresh timeout window — covers a single transient blip.
    result = await reverseOnce(lat, lng, timeoutMs, fetchImpl);
  }

  if (result.status === "ok" && result.code) {
    positiveSet(lat, lng, result.code);
    return result;
  }
  // Both attempts failed transiently: return any known code rather than a miss.
  if (result.status === "error") {
    const fallback = positiveGet(lat, lng);
    if (fallback) return { status: "ok", code: fallback, fromCache: true };
  }
  return result;
}

/**
 * Reverse geocode lat/lng → CBS buurtcode, or null on any failure. Thin
 * backward-compatible wrapper over {@link resolveBuurtcodeFromLatLng}.
 */
export async function buurtcodeFromLatLng(
  lat: number,
  lng: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  return (await resolveBuurtcodeFromLatLng(lat, lng, timeoutMs, fetchImpl)).code;
}

/** Parse a PDOK "POINT(lon lat)" WKT string to { lat, lng }, or null. */
export function parseCentroidLatLng(wkt: string | null | undefined): { lat: number; lng: number } | null {
  if (!wkt) return null;
  const m = wkt.match(/POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/**
 * Forward geocode a free-text query (postcode or place) → a classified centroid
 * result. `status` is "error" on a transient PDOK failure and "empty" when PDOK
 * answered with no match. `fetchImpl` is injectable for tests.
 */
export async function resolveLatLngFromFree(
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
  opts?: { woonplaatsOnly?: boolean },
): Promise<{ status: GeoResolveStatus; ll: { lat: number; lng: number } | null }> {
  const q = query.trim();
  if (!q) return { status: "empty", ll: null };

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // A bare PLACE name ("Veenendaal") without a postcode is ambiguous: the default
    // free-text ranking can return a street/address top-match (or nothing) instead
    // of the town. Pin it to the woonplaats record so we always get the town
    // centroid. Postcode queries are precise and must NOT be filtered this way.
    const params = new URLSearchParams({ q, rows: "1", fl: "centroide_ll" });
    if (opts?.woonplaatsOnly) params.set("fq", "type:woonplaats");
    const res = await fetchImpl(`${PDOK_FREE_ENDPOINT}?${params.toString()}`, {
      signal:  controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { status: "error", ll: null };
    const json = (await res.json()) as { response?: { docs?: Array<{ centroide_ll?: string }> } };
    const ll = parseCentroidLatLng(json.response?.docs?.[0]?.centroide_ll ?? null);
    return ll ? { status: "ok", ll } : { status: "empty", ll: null };
  } catch {
    return { status: "error", ll: null };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Forward geocode a free-text query (postcode or place) → lat/lng centroid, or
 * null on any failure. Thin backward-compatible wrapper.
 */
export async function latLngFromFree(
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lat: number; lng: number } | null> {
  return (await resolveLatLngFromFree(query, timeoutMs, fetchImpl)).ll;
}

/**
 * Resolve a form-provided location (postcode primary, place fallback) to a CBS
 * buurtcode, returning a classified result. Forward-geocode the query to its
 * centroid, then reverse-geocode the centroid to a buurt. A transient failure at
 * either step surfaces as `status:"error"` so the caller retries later instead of
 * caching the miss. Postcode wins over place when both are given.
 */
export async function resolveBuurtcodeFromFormLocation(
  postcode: string | null | undefined,
  place: string | null | undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<GeoResolveResult> {
  // Postcode is precise (forward it as-is); a bare place name is pinned to the
  // woonplaats centroid so it can't resolve to a street/address top-match.
  const pc    = postcode && postcode.trim();
  const place2 = place && place.trim();
  const query = pc || place2 || null;
  if (!query) return { status: "empty", code: null };
  const fwd = await resolveLatLngFromFree(
    query, timeoutMs, fetchImpl,
    pc ? undefined : { woonplaatsOnly: true },
  );
  if (!fwd.ll) return { status: fwd.status === "error" ? "error" : "empty", code: null };
  return resolveBuurtcodeFromLatLng(fwd.ll.lat, fwd.ll.lng, timeoutMs, fetchImpl);
}

/**
 * Resolve a form-provided location to a CBS buurtcode, or null on any failure.
 * Thin backward-compatible wrapper over {@link resolveBuurtcodeFromFormLocation}.
 */
export async function buurtcodeFromFormLocation(
  postcode: string | null | undefined,
  place: string | null | undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  return (await resolveBuurtcodeFromFormLocation(postcode, place, timeoutMs, fetchImpl)).code;
}
