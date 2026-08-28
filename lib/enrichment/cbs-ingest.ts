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
 * ─── Field mapping (keys verified against 85984NED) ───────────────────────────
 *   income      GemiddeldInkomenPerInwoner_78
 *   income band k_40PersonenMetLaagsteInkomen_79 / k_20PersonenMetHoogsteInkomen_80
 *   business    BedrijfsvestigingenTotaal_95
 *   density     Bevolkingsdichtheid_34  → urbanity PROXY (density-derived, NOT the
 *               official CBS stedelijkheidsklasse)
 *   inhabitants AantalInwoners_5 (business-share denominator)
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
  areaCode:     ["WijkenEnBuurten", "Codering_3", "Codering"],
  avgIncome:    ["GemiddeldInkomenPerInwoner_78", "GemiddeldInkomenPerInwoner"],
  lowIncomePct: ["k_40PersonenMetLaagsteInkomen_79", "k_40PersonenMetLaagsteInkomen"],
  highIncomePct:["k_20PersonenMetHoogsteInkomen_80", "k_20PersonenMetHoogsteInkomen"],
  businessTotal:["BedrijfsvestigingenTotaal_95", "BedrijfsvestigingenTotaal"],
  density:      ["Bevolkingsdichtheid_34", "Bevolkingsdichtheid"],
  inhabitants:  ["AantalInwoners_5", "AantalInwoners"],
} as const;

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
 * Urbanity PROXY from population density (inhabitants/km2). 1 = most dense,
 * 5 = least dense. Density-derived heuristic — NOT the official CBS
 * stedelijkheidsklasse (which uses omgevingsadressendichtheid).
 */
export function deriveUrbanityProxy(density: number | null): number | null {
  if (density == null) return null;
  if (density >= 5_000) return 1;
  if (density >= 2_500) return 2;
  if (density >= 1_000) return 3;
  if (density >= 500)   return 4;
  return 5;
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
    urbanity_proxy:     deriveUrbanityProxy(density),
    inhabitants:        inhabitants != null ? Math.round(inhabitants) : null,
    business_share:     businessShare,
    source_year:        sourceYear,
    source_dataset:     dataset,
    raw,
  };
}

/**
 * Fetch all buurt rows of a CBS OData dataset, following @odata.nextLink. The
 * server-side $filter keeps only WijkenEnBuurten starting with "BU".
 */
export async function fetchCbsRows(
  datasetId: string,
  fetchImpl: typeof fetch = fetch,
  maxPages = 300,
): Promise<Row[]> {
  const rows: Row[] = [];
  const filter = "$filter=" + encodeURIComponent("startswith(WijkenEnBuurten,'BU')");
  let url: string | null = `${ODATA_BASE}/${encodeURIComponent(datasetId)}/TypedDataSet?${filter}`;
  let pages = 0;
  while (url && pages < maxPages) {
    const res: Response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`CBS OData HTTP ${res.status} for ${datasetId}`);
    const json = (await res.json()) as { value?: Row[]; "odata.nextLink"?: string; "@odata.nextLink"?: string };
    if (Array.isArray(json.value)) rows.push(...json.value);
    url = json["@odata.nextLink"] ?? json["odata.nextLink"] ?? null;
    pages++;
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
