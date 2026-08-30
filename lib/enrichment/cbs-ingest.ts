/**
 * lib/enrichment/cbs-ingest.ts
 *
 * LAZY per-buurt fetch + mapping for the CBS StatLine buurt statistics table
 * (cbs_area_stats).
 *
 * ─── Why lazy, not bulk ───────────────────────────────────────────────────────
 *
 * CBS OData v3 (dataset 85984NED) cannot be bulk-paginated: $skip caps at 500,
 * $orderby is ignored, a compound $filter (and) is ignored, an unbounded page
 * returns 500, and there is no @odata.nextLink. The ONLY query shape that works
 * is a single-predicate equality — proven:
 *
 *   TypedDataSet?$filter=WijkenEnBuurten eq 'BU16800000'&$format=json  → exactly 1 row
 *
 * So we fetch ONE buurt at a time, on demand, from the location enricher stage
 * (cache-miss path) and cache the result in cbs_area_stats.
 *
 * Source: CBS StatLine "Kerncijfers wijken en buurten" OData, dataset 85984NED
 * (configurable, bumped yearly).
 *   fields: https://opendata.cbs.nl/ODataApi/odata/85984NED/DataProperties
 *
 * ─── Field mapping (keys + units verified against 85984NED) ───────────────────
 *   income      GemiddeldInkomenPerInwoner_78   (Double, "x 1 000 euro" → ×1000)
 *   income band k_40PersonenMetLaagsteInkomen_79 / k_20PersonenMetHoogsteInkomen_80
 *               (Double, %, 0–100)
 *   business    BedrijfsvestigingenTotaal_95    (Long, count)
 *   urbanity    MateVanStedelijkheid_120        (official CBS stedelijkheidsklasse
 *               1=zeer sterk stedelijk .. 5=niet stedelijk; density fallback)
 *   density     Bevolkingsdichtheid_34          (Long, inhabitants/km2)
 *   inhabitants AantalInwoners_5                (Long, business-share denominator)
 *   bonus (raw) Omgevingsadressendichtheid_121, MeestVoorkomendePostcode_118
 *
 * CBS suppresses small-count cells: a numeric field may be null or a sentinel.
 * Suppressed / non-finite / negative values map to NULL (never 0), so a
 * suppressed attribute is simply absent rather than a misleading zero.
 *
 * Pure I/O via an injected fetch + client so it stays testable.
 */

const ODATA_BASE = "https://opendata.cbs.nl/ODataApi/odata";
export const DEFAULT_CBS_DATASET = "85984NED";

/**
 * CBS property → source keys. First present key wins. Confirm against the chosen
 * dataset's DataProperties; unknown properties yield null (row keeps its raw
 * payload for correction without a re-fetch).
 */
export const CBS_FIELD_MAP = {
  areaCode:      ["WijkenEnBuurten", "Codering_3", "Codering"],
  avgIncome:     ["GemiddeldInkomenPerInwoner_78", "GemiddeldInkomenPerInwoner"],
  lowIncomePct:  ["k_40PersonenMetLaagsteInkomen_79", "k_40PersonenMetLaagsteInkomen"],
  highIncomePct: ["k_20PersonenMetHoogsteInkomen_80", "k_20PersonenMetHoogsteInkomen"],
  businessTotal: ["BedrijfsvestigingenTotaal_95", "BedrijfsvestigingenTotaal"],
  density:       ["Bevolkingsdichtheid_34", "Bevolkingsdichtheid"],
  inhabitants:   ["AantalInwoners_5", "AantalInwoners"],
  // Official CBS stedelijkheidsklasse (1 = zeer sterk stedelijk .. 5 = niet stedelijk).
  urbanityClass: ["MateVanStedelijkheid_120", "MateVanStedelijkheid"],
  // D5 Fase 0 — energy / solar / WOZ (units verified live via DataProperties).
  avgGas:         ["GemiddeldAardgasverbruik_55"],           // m³
  avgElectricity: ["GemiddeldeElektriciteitslevering_53"],   // kWh
  solarPct:       ["WoningenMetZonnestroom_59"],             // %
  avgWozK:        ["GemiddeldeWOZWaardeVanWoningen_39"],      // "x 1 000 euro" → ×1000
} as const;

/**
 * Business establishments per SBI sector group (unit "aantal") → an English slug.
 * The DOMINANT sector = the group with the most establishments; we store the slug,
 * not eight separate fields.
 */
const SECTOR_FIELDS: readonly (readonly [string, string])[] = [
  ["ALandbouwBosbouwEnVisserij_96",           "agriculture"],
  ["BFNijverheidEnEnergie_97",                "industry_energy"],
  ["GIHandelEnHoreca_98",                     "trade_hospitality"],
  ["HJVervoerInformatieEnCommunicatie_99",    "transport_ict"],
  ["KLFinancieleDienstenOnroerendGoed_100",   "financial_realestate"],
  ["MNZakelijkeDienstverlening_101",          "business_services"],
  ["OQOverheidOnderwijsEnZorg_102",           "government_education_health"],
  ["RUCultuurRecreatieOverigeDiensten_103",   "culture_recreation_other"],
];

/**
 * Columns fetched via $select — the mapped columns plus two bonus signals stored
 * in `raw`: Omgevingsadressendichtheid_121 (address density) and
 * MeestVoorkomendePostcode_118 (the buurt's most common PC4). Narrowing the
 * response keeps the per-buurt fetch small and fast.
 */
const SELECT_COLUMNS = [
  "WijkenEnBuurten",
  "AantalInwoners_5",
  "Bevolkingsdichtheid_34",
  "GemiddeldInkomenPerInwoner_78",
  "k_40PersonenMetLaagsteInkomen_79",
  "k_20PersonenMetHoogsteInkomen_80",
  "BedrijfsvestigingenTotaal_95",
  "MateVanStedelijkheid_120",
  "Omgevingsadressendichtheid_121",
  "MeestVoorkomendePostcode_118",
  // D5 Fase 0 — energy / solar / WOZ + the eight SBI sector counts.
  "GemiddeldAardgasverbruik_55",
  "GemiddeldeElektriciteitslevering_53",
  "WoningenMetZonnestroom_59",
  "GemiddeldeWOZWaardeVanWoningen_39",
  "ALandbouwBosbouwEnVisserij_96",
  "BFNijverheidEnEnergie_97",
  "GIHandelEnHoreca_98",
  "HJVervoerInformatieEnCommunicatie_99",
  "KLFinancieleDienstenOnroerendGoed_100",
  "MNZakelijkeDienstverlening_101",
  "OQOverheidOnderwijsEnZorg_102",
  "RUCultuurRecreatieOverigeDiensten_103",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function firstField(raw: Row, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (raw[k] != null && String(raw[k]).trim() !== "") return raw[k];
  }
  return null;
}

/** Parse a CBS numeric cell → number, treating suppressed/sentinel/negative as null. */
function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v.trim()) : typeof v === "number" ? v : NaN;
  // CBS suppression sentinels are negative or non-finite; treat as absent.
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Normalise a CBS buurtcode ("BU########"), stripping CBS's space padding. */
export function normalizeAreaCode(raw: unknown): string | null {
  if (raw == null) return null;
  const m = String(raw).match(/BU\d{8}/i);
  return m ? m[0].toUpperCase() : null;
}

/**
 * Income band from the CBS low/high income-share percentiles.
 *
 * The two CBS fields have DIFFERENT national baselines: k_40 is the share in the
 * lowest-income 40% (national baseline ≈ 40), k_20 is the share in the highest-
 * income 20% (national baseline ≈ 20). Comparing the raw percentages against each
 * other therefore labels an average buurt (~40 / ~20) "low" every time. Instead
 * we measure each field's OVER/UNDER-representation vs its own baseline and
 * compare the deviations. Falls back to null only when both are suppressed.
 */
export function deriveIncomeBand(lowPct: number | null, highPct: number | null): string | null {
  if (lowPct == null && highPct == null) return null;
  const lowDev  = (lowPct  ?? 40) - 40; // >0 = more low-income than national
  const highDev = (highPct ?? 20) - 20; // >0 = more high-income than national
  const MARGIN = 4; // percentage points
  if (highDev > lowDev + MARGIN) return "high";
  if (lowDev  > highDev + MARGIN) return "low";
  return "mid";
}

/**
 * FALLBACK urbanity band from population density (inhabitants/km2), used only
 * when the official CBS class (MateVanStedelijkheid_120) is suppressed/absent.
 * 1 = most dense, 5 = least dense — same direction as the official class.
 */
export function deriveUrbanityProxy(density: number | null): number | null {
  if (density == null) return null;
  if (density >= 5_000) return 1;
  if (density >= 2_500) return 2;
  if (density >= 1_000) return 3;
  if (density >= 500)   return 4;
  return 5;
}

/**
 * Urbanity class: the official CBS MateVanStedelijkheid (1..5) when present,
 * else the density-derived fallback. CBS suppresses this as null or 0, so a
 * 0/out-of-range value falls through to the density band.
 */
export function resolveUrbanity(urbanityRaw: number | null, density: number | null): number | null {
  if (urbanityRaw != null && urbanityRaw >= 1 && urbanityRaw <= 5) return Math.round(urbanityRaw);
  return deriveUrbanityProxy(density);
}

/**
 * Dominant business sector = the SBI group with the most establishments in the
 * buurt → its slug. Suppressed cells (null/sentinel/negative) count as absent;
 * returns null when every sector is suppressed/zero.
 */
export function deriveDominantSector(raw: Row): string | null {
  let bestSlug: string | null = null;
  let bestCount = 0;
  for (const [key, slug] of SECTOR_FIELDS) {
    const n = toNum(raw[key]);
    if (n != null && n > bestCount) { bestCount = n; bestSlug = slug; }
  }
  return bestSlug;
}

/** Map one raw CBS OData buurt row to a cbs_area_stats upsert row, or null. */
export function mapCbsRow(raw: Row, sourceYear: number, dataset: string) {
  const areaCode = normalizeAreaCode(firstField(raw, CBS_FIELD_MAP.areaCode));
  if (!areaCode) return null; // skip GM/WK aggregates + unparseable rows

  // GemiddeldInkomenPerInwoner_78 is a Double in units of "x 1 000 euro"
  // (verified via DataProperties) — multiply to store actual euros. Suppressed
  // (<2 500 persons) → null.
  const avgIncomeK  = toNum(firstField(raw, CBS_FIELD_MAP.avgIncome));
  const avgIncome   = avgIncomeK != null ? Math.round(avgIncomeK * 1000) : null;
  // k_40/k_20 are percentages (0–100, 1 decimal); suppressed (<100 persons) → null.
  const lowPct      = toNum(firstField(raw, CBS_FIELD_MAP.lowIncomePct));
  const highPct     = toNum(firstField(raw, CBS_FIELD_MAP.highIncomePct));
  const business    = toNum(firstField(raw, CBS_FIELD_MAP.businessTotal));
  const density     = toNum(firstField(raw, CBS_FIELD_MAP.density));
  const inhabitants = toNum(firstField(raw, CBS_FIELD_MAP.inhabitants));
  const urbanityRaw = toNum(firstField(raw, CBS_FIELD_MAP.urbanityClass));

  // Business share ≈ establishments per inhabitant. Column is numeric(6,4), so
  // cap at its range; suppressed inputs → null (not 0).
  const businessShare = business != null && inhabitants && inhabitants > 0
    ? Math.min(99.9999, Math.max(0, business / inhabitants))
    : null;

  // D5 Fase 0 — energy / solar / WOZ / dominant sector. Suppressed → null (never 0),
  // exactly like the existing mapping.
  const avgGas   = toNum(firstField(raw, CBS_FIELD_MAP.avgGas));           // m³
  const avgElec  = toNum(firstField(raw, CBS_FIELD_MAP.avgElectricity));   // kWh
  const solarPct = toNum(firstField(raw, CBS_FIELD_MAP.solarPct));         // %
  const wozK     = toNum(firstField(raw, CBS_FIELD_MAP.avgWozK));          // "x 1 000 euro"
  const avgWoz   = wozK != null ? Math.round(wozK * 1000) : null;          // → euro

  return {
    area_code:          areaCode,
    avg_income:         avgIncome,
    low_income_pct:     lowPct,
    high_income_pct:    highPct,
    income_band:        deriveIncomeBand(lowPct, highPct),
    business_total:     business != null ? Math.round(business) : null,
    population_density: density != null ? Math.round(density) : null,
    // Official CBS stedelijkheidsklasse, density fallback when suppressed.
    urbanity_proxy:     resolveUrbanity(urbanityRaw, density),
    inhabitants:        inhabitants != null ? Math.round(inhabitants) : null,
    business_share:     businessShare,
    // D5 Fase 0 — energy / solar / WOZ / dominant sector.
    location_avg_gas_usage:            avgGas   != null ? Math.round(avgGas)  : null,
    location_avg_electricity_usage:    avgElec  != null ? Math.round(avgElec) : null,
    location_solar_pct:                solarPct,
    location_avg_woz_value:            avgWoz,
    location_dominant_business_sector: deriveDominantSector(raw),
    source_year:        sourceYear,
    source_dataset:     dataset,
    raw,
  };
}

/**
 * Practical row cap CBS OData returns for a single narrowed `startswith` bucket.
 * When a bucket hits this, the backfill splits the prefix one digit deeper.
 */
export const CBS_BUCKET_CAP = 10_000;

/**
 * Fetch all rows whose WijkenEnBuurten starts with `prefix` (e.g. "BU03"), via
 * the only bulk-ish shape CBS honours: a single `startswith` predicate + $select.
 * Used by the resumable backfill (NOT the request path). Throws on a non-OK
 * response so the backfill can react (split / retry).
 */
export async function fetchCbsPrefix(
  datasetId: string,
  prefix: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Row[]> {
  const base   = `${ODATA_BASE}/${encodeURIComponent(datasetId)}/TypedDataSet`;
  const filter = encodeURIComponent(`startswith(WijkenEnBuurten,'${prefix}')`);
  const select = encodeURIComponent(SELECT_COLUMNS.join(","));
  const url    = `${base}?$filter=${filter}&$select=${select}&$format=json`;
  const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CBS OData HTTP ${res.status} for prefix ${prefix}`);
  const json = (await res.json()) as { value?: Row[] };
  return Array.isArray(json.value) ? json.value : [];
}

/** Result of a single-buurt CBS fetch. */
export type CbsFetchResult =
  | { status: "found"; raw: Row }
  | { status: "empty" }               // buurtcode not in the dataset (e.g. recoding)
  | { status: "error" };              // transient (HTTP / timeout) — do not cache

/**
 * Fetch ONE buurt's row from CBS OData v3 by exact buurtcode. This is the only
 * query shape CBS honours (single-predicate `eq`). Narrowed with $select and a
 * short timeout; fail-open (returns "error" on any failure, never throws).
 */
export async function fetchCbsArea(
  datasetId: string,
  buurtcode: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5_000,
): Promise<CbsFetchResult> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const base   = `${ODATA_BASE}/${encodeURIComponent(datasetId)}/TypedDataSet`;
    const filter = encodeURIComponent(`WijkenEnBuurten eq '${buurtcode}'`);
    const select = encodeURIComponent(SELECT_COLUMNS.join(","));
    const url    = `${base}?$filter=${filter}&$select=${select}&$format=json`;

    const res = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return { status: "error" };
    const json = (await res.json()) as { value?: Row[] };
    const row  = Array.isArray(json.value) ? json.value[0] : undefined;
    return row ? { status: "found", raw: row } : { status: "empty" };
  } catch {
    return { status: "error" };
  } finally {
    clearTimeout(timeout);
  }
}
