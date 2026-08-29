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
 * Pure (fetch-based), unit-testable via an injected fetch. Buurtcode = "BU"+8.
 */

const PDOK_BASE            = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";
const PDOK_REVERSE_ENDPOINT = `${PDOK_BASE}/reverse`;
const PDOK_FREE_ENDPOINT    = `${PDOK_BASE}/free`;

/** Normalise a PDOK buurt identifier to a "BU########" code, or null. */
export function normalizeBuurtcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // PDOK returns either a bare code ("BU03630000") or an id like "buurt-BU03630000".
  const m = raw.match(/BU\d{8}/i);
  return m ? m[0].toUpperCase() : null;
}

/**
 * Reverse geocode lat/lng → CBS buurtcode via PDOK. Returns null on any failure
 * (never throws). `fetchImpl` is injectable for tests.
 */
export async function buurtcodeFromLatLng(
  lat: number,
  lng: number,
  timeoutMs = 4_000,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

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
    if (!res.ok) return null;
    const json = (await res.json()) as {
      response?: { docs?: Array<{ buurtcode?: string; id?: string; weergavenaam?: string }> };
    };
    const doc = json.response?.docs?.[0];
    if (!doc) return null;
    // Prefer an explicit buurtcode field; fall back to parsing the id / name.
    return normalizeBuurtcode(doc.buurtcode ?? doc.id ?? doc.weergavenaam ?? null);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
 * Forward geocode a free-text query (postcode or place) → lat/lng centroid via
 * the PDOK Locatieserver `free` endpoint. Returns null on any failure. `fetchImpl`
 * is injectable for tests.
 */
export async function latLngFromFree(
  query: string,
  timeoutMs = 4_000,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim();
  if (!q) return null;

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({ q, rows: "1", fl: "centroide_ll" });
    const res = await fetchImpl(`${PDOK_FREE_ENDPOINT}?${params.toString()}`, {
      signal:  controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { response?: { docs?: Array<{ centroide_ll?: string }> } };
    return parseCentroidLatLng(json.response?.docs?.[0]?.centroide_ll ?? null);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve a form-provided location (postcode primary, place fallback) to a CBS
 * buurtcode: forward-geocode the query to its centroid, then reverse-geocode the
 * centroid to a buurt. Returns null on any failure (fail-open). Postcode wins
 * over place when both are given.
 */
export async function buurtcodeFromFormLocation(
  postcode: string | null | undefined,
  place: string | null | undefined,
  timeoutMs = 4_000,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const query = (postcode && postcode.trim()) || (place && place.trim()) || null;
  if (!query) return null;
  const ll = await latLngFromFree(query, timeoutMs, fetchImpl);
  if (!ll) return null;
  return buurtcodeFromLatLng(ll.lat, ll.lng, timeoutMs, fetchImpl);
}
