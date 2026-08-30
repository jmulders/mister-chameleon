/**
 * lib/enrichment/bag-ingest.ts
 *
 * BAG (Basisregistratie Adressen en Gebouwen, Kadaster) per-address lookup:
 * postcode + house number → building year (pand), use + area (verblijfsobject).
 * Free API, requires a key (X-Api-Key). Same lazy-cache shape as the CBS enricher.
 *
 * Endpoint (v2, exact match):
 *   GET .../lvbag/individuelebevragingen/v2/adressenuitgebreid
 *       ?postcode=3011AD&huisnummer=1&exacteMatch=true
 *   headers: X-Api-Key, Accept: application/hal+json, Accept-Crs: epsg:28992
 *
 * Response (HAL+JSON): _embedded.adressen[0] carries `oorspronkelijkBouwjaar`
 * (pand build year, may be an array), `gebruiksdoelen` (array), `oppervlakte` (m²).
 * The parser is defensive — the live shape can only be confirmed with a real key.
 * Pure (fetch injectable), unit-testable.
 */

const BAG_ENDPOINT = "https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/adressenuitgebreid";
const DEFAULT_TIMEOUT_MS = 6_000;

export interface BagAddress {
  buildYear:   number | null;
  buildingUse: string | null;
  areaM2:      number | null;
}
export type BagFetchStatus = "found" | "empty" | "error";
export interface BagFetchResult {
  status: BagFetchStatus;
  data?:  BagAddress;
}

/** Resolve the platform BAG API key (env fallback). Empty → the enricher no-ops. */
export function resolveBagApiKey(): string | null {
  const k = process.env.BAG_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

function firstOf(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}
function toIntOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Parse a BAG `adressenuitgebreid` response body → the building facts, or null when
 * no address is present. Defensive against shape drift (array vs scalar fields).
 */
export function parseBagAddress(json: unknown): BagAddress | null {
  const root = json as { _embedded?: { adressen?: unknown[] } } | undefined;
  const adr = root?._embedded?.adressen?.[0] as Record<string, unknown> | undefined;
  if (!adr) return null;

  const buildYear = toIntOrNull(firstOf(adr.oorspronkelijkBouwjaar));
  const useRaw    = firstOf(adr.gebruiksdoelen ?? adr.gebruiksdoel);
  const buildingUse = typeof useRaw === "string" && useRaw.trim() ? useRaw.trim() : null;
  const areaM2    = toIntOrNull(adr.oppervlakte);

  if (buildYear == null && buildingUse == null && areaM2 == null) return null;
  return { buildYear, buildingUse, areaM2 };
}

/**
 * Fetch BAG building facts for a postcode + house number. Classified result:
 * "error" = timeout/network/5xx (transient), "empty" = no address / 404, "found".
 * Never throws. `fetchImpl` is injectable for tests.
 */
export async function fetchBagAddress(
  postcode:    string,
  houseNumber: string,
  apiKey:      string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<BagFetchResult> {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  const hn = houseNumber.trim();
  if (!/^\d{4}[A-Z]{2}$/.test(pc) || !/^\d{1,5}$/.test(hn) || !apiKey) return { status: "empty" };

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${BAG_ENDPOINT}?postcode=${encodeURIComponent(pc)}&huisnummer=${encodeURIComponent(hn)}&exacteMatch=true`;
    const res = await fetchImpl(url, {
      signal:  controller.signal,
      headers: { "X-Api-Key": apiKey, Accept: "application/hal+json", "Accept-Crs": "epsg:28992" },
    });
    if (res.status === 404) return { status: "empty" };
    if (!res.ok) return { status: "error" };
    const parsed = parseBagAddress(await res.json());
    return parsed ? { status: "found", data: parsed } : { status: "empty" };
  } catch {
    return { status: "error" }; // timeout / network / parse → transient
  } finally {
    clearTimeout(timeout);
  }
}
