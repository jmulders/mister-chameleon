/**
 * lib/enrichment/cbs-ingest.ts
 *
 * Ingestion for the CBS StatLine buurt (neighbourhood) statistics table
 * (cbs_area_stats).
 *
 * Source: CBS StatLine "Kerncijfers wijken en buurten" OData, dataset 85984NED
 * (configurable, bumped yearly). We ingest only buurt rows
 * (WijkenEnBuurten starts with "BU"), skipping the GM (gemeente) and WK (wijk)
 * aggregate rows.
 *
 *   data:   https://opendata.cbs.nl/ODataApi/odata/85984NED/TypedDataSet
 *           $filter=startswith(WijkenEnBuurten,'BU')
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
} as const;

/**
 * Columns fetched via $select — the mapped columns plus two bonus signals stored
 * in `raw`: Omgevingsadressendichtheid_121 (address density) and
 * MeestVoorkomendePostcode_118 (the buurt's most common PC4). Keeping the page
 * narrow is what keeps a full run inside the cron's maxDuration.
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
] as const;

export interface CbsIngestResult {
  ingested: number;
  skipped:  number;
  note?:    string;
}

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
 * Income band from the CBS low/high income-share percentiles (distribution-
 * relative, so no absolute-threshold guesswork). Falls back to null when both
 * percentiles are suppressed.
 */
export function deriveIncomeBand(lowPct: number | null, highPct: number | null): string | null {
  if (lowPct == null && highPct == null) return null;
  const low  = lowPct  ?? 0;
  const high = highPct ?? 0;
  const MARGIN = 5; // percentage points
  if (high > low + MARGIN) return "high";
  if (low > high + MARGIN) return "low";
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
    source_year:        sourceYear,
    source_dataset:     dataset,
    raw,
  };
}

/** Default page size for the $top/$skip loop. */
export const CBS_PAGE_SIZE = 2000;

/**
 * Fetch all buurt rows of a CBS OData v3 dataset.
 *
 * CBS OData v3 returns HTTP 500 on an UNBOUNDED page for a wide dataset like
 * 85984NED (121 columns), so we ALWAYS drive pagination with an explicit
 * $top + $skip loop (proven: no $top → 500; $top=1000 → 200). $select trims the
 * page to the mapped columns (+ two bonus signals) so each page is small and the
 * whole run stays inside the cron budget. Server-side $filter keeps only
 * WijkenEnBuurten starting with "BU". We stop when a page returns fewer than
 * $top rows.
 */
export async function fetchCbsRows(
  datasetId: string,
  fetchImpl: typeof fetch = fetch,
  pageSize = CBS_PAGE_SIZE,
  maxPages = 300,
): Promise<Row[]> {
  const rows: Row[] = [];
  const base   = `${ODATA_BASE}/${encodeURIComponent(datasetId)}/TypedDataSet`;
  const filter = encodeURIComponent("startswith(WijkenEnBuurten,'BU')");
  const select = encodeURIComponent(SELECT_COLUMNS.join(","));

  let skip = 0;
  for (let pages = 0; pages < maxPages; pages++) {
    const url = `${base}?$filter=${filter}&$select=${select}&$top=${pageSize}&$skip=${skip}`;
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`CBS OData HTTP ${res.status} for ${datasetId} (skip=${skip})`);
    const json = (await res.json()) as { value?: Row[] };
    const page = Array.isArray(json.value) ? json.value : [];
    rows.push(...page);
    if (page.length < pageSize) break; // last page
    skip += pageSize;
  }
  return rows;
}

/**
 * Ingest CBS buurt statistics into cbs_area_stats. No-op (with a note) when no
 * datasetId is configured.
 */
export async function ingestCbsAreaStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  opts: { datasetId?: string | null; sourceYear?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<CbsIngestResult> {
  const datasetId  = opts.datasetId?.trim();
  const sourceYear = opts.sourceYear ?? 0;
  if (!datasetId) {
    return { ingested: 0, skipped: 0, note: "no CBS datasetId configured (platform cbs_location settings)" };
  }

  const raws = await fetchCbsRows(datasetId, fetchImpl);
  const mapped = raws.map((r) => mapCbsRow(r, sourceYear, datasetId)).filter((r): r is NonNullable<typeof r> => r != null);
  const skipped = raws.length - mapped.length;

  const BATCH = 500;
  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH).map((m) => ({ ...m, refreshed_at: new Date().toISOString() }));
    const { error } = await client.from("cbs_area_stats").upsert(batch, { onConflict: "area_code" });
    if (error) throw new Error(`cbs_area_stats upsert failed: ${error.message}`);
  }

  return { ingested: mapped.length, skipped };
}
