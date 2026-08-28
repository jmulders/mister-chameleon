/**
 * lib/enrichment/pdok-geocode.ts
 *
 * Minimal PDOK Locatieserver reverse geocode: latitude/longitude → CBS buurtcode.
 * Free Kadaster/PDOK open data, no API key.
 *
 * Used by the CBS location enricher to resolve the neighbourhood (buurt) the
 * visitor's IP-derived coordinates fall in, which is then joined against
 * cbs_area_stats. Pure (fetch-based), so it stays unit-testable via an injected
 * fetch.
 *
 * A CBS buurtcode looks like "BU03630000" (the "BU" prefix + 8 digits).
 */

const PDOK_REVERSE_ENDPOINT = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse";

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
