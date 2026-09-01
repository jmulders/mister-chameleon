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
  // D5 Fase 0 (vervolg) — demografie / wonen / opleiding / welvaart / mobiliteit.
  householdsTotal:        ["HuishoudensTotaal_29"],           // household-share denominator
  householdsWithChildren: ["HuishoudensMetKinderen_32"],
  singlePersonHouseholds: ["Eenpersoonshuishoudens_30"],
  avgHouseholdSize:       ["GemiddeldeHuishoudensgrootte_33"],// raw ratio
  age0_15:   ["k_0Tot15Jaar_8"],
  age15_25:  ["k_15Tot25Jaar_9"],
  age25_45:  ["k_25Tot45Jaar_10"],
  age45_65:  ["k_45Tot65Jaar_11"],
  age65Plus: ["k_65JaarOfOuder_12"],
  married:   ["Gehuwd_14"],
  unmarried: ["Ongehuwd_13"],
  divorced:  ["Gescheiden_15"],
  widowed:   ["Verweduwd_16"],
  pctSingleFamily:  ["PercentageEengezinswoning_40"],         // bron al %
  pctMultiFamily:   ["PercentageMeergezinswoning_45"],
  pctDetached:      ["PercentageVrijstaandeWoningEengezins_44"],
  pctOwnerOccupied: ["Koopwoningen_47"],                      // bron al %
  pctRental:        ["HuurwoningenTotaal_48"],
  pctSocialHousing: ["InBezitWoningcorporatie_49"],
  eduLow:    ["BasisonderwijsVmboMbo1_67"],
  eduMid:    ["HavoVwoMbo24_68"],
  eduHigh:   ["HboWo_69"],
  medianWealthK:       ["MediaanVermogenVanParticuliereHuish_86"], // "x 1 000 euro" → ×1000
  avgIncomePerEarnerK: ["GemiddeldInkomenPerInkomensontvanger_77"],// "x 1 000 euro" → ×1000
  povertyPct:          ["PersonenInArmoede_81"],              // bron al %
  carsPerHousehold:    ["PersonenautoSPerHuishouden_107"],    // raw ratio
  carsTotal:           ["PersonenautoSTotaal_104"],
  carsOther:           ["PersonenautoSOverigeBrandstof_106"],
  avgElecFeedback:     ["GemiddeldeElektriciteitsteruglevering_54"], // kWh (solar feed-in)
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
  // D5 Fase 0 (vervolg) — demografie / wonen / opleiding / welvaart / mobiliteit.
  "HuishoudensTotaal_29",
  "HuishoudensMetKinderen_32",
  "Eenpersoonshuishoudens_30",
  "GemiddeldeHuishoudensgrootte_33",
  "k_0Tot15Jaar_8",
  "k_15Tot25Jaar_9",
  "k_25Tot45Jaar_10",
  "k_45Tot65Jaar_11",
  "k_65JaarOfOuder_12",
  "Gehuwd_14",
  "Ongehuwd_13",
  "Gescheiden_15",
  "Verweduwd_16",
  "PercentageEengezinswoning_40",
  "PercentageMeergezinswoning_45",
  "PercentageVrijstaandeWoningEengezins_44",
  "Koopwoningen_47",
  "HuurwoningenTotaal_48",
  "InBezitWoningcorporatie_49",
  "BasisonderwijsVmboMbo1_67",
  "HavoVwoMbo24_68",
  "HboWo_69",
  "MediaanVermogenVanParticuliereHuish_86",
  "GemiddeldInkomenPerInkomensontvanger_77",
  "PersonenInArmoede_81",
  "PersonenautoSPerHuishouden_107",
  "PersonenautoSTotaal_104",
  "PersonenautoSOverigeBrandstof_106",
  "GemiddeldeElektriciteitsteruglevering_54",
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

/** Round a raw numeric to `d` decimals, null-safe. */
function roundTo(v: number | null, d: number): number | null {
  if (v == null) return null;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/**
 * A buurt-comparable percentage share = num / denom × 100, rounded to 1 decimal.
 * Null when the numerator OR the denominator is null or ≤ 0 — no division by zero,
 * no misleading 0 for a suppressed cell.
 */
export function pctShare(num: number | null, denom: number | null): number | null {
  if (num == null || denom == null || denom <= 0) return null;
  return roundTo((num / denom) * 100, 1);
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

  // ── D5 Fase 0 (vervolg) — demografie / wonen / opleiding / welvaart / mobiliteit ──
  // Shares = pct of a denominator (households or inhabitants), 1 decimal; already-
  // percentage source fields pass through toNum unchanged. Suppressed / null-denom → null.
  const householdsTotal = toNum(firstField(raw, CBS_FIELD_MAP.householdsTotal));
  const eduLow  = toNum(firstField(raw, CBS_FIELD_MAP.eduLow));
  const eduMid  = toNum(firstField(raw, CBS_FIELD_MAP.eduMid));
  const eduHigh = toNum(firstField(raw, CBS_FIELD_MAP.eduHigh));
  const eduSum  = (eduLow ?? 0) + (eduMid ?? 0) + (eduHigh ?? 0);
  const eduDenom = eduSum > 0 ? eduSum : null;
  const carsTotal = toNum(firstField(raw, CBS_FIELD_MAP.carsTotal));
  const carsOther = toNum(firstField(raw, CBS_FIELD_MAP.carsOther));
  const medianWealthK       = toNum(firstField(raw, CBS_FIELD_MAP.medianWealthK));
  const avgIncomePerEarnerK = toNum(firstField(raw, CBS_FIELD_MAP.avgIncomePerEarnerK));
  const avgElecFeedback     = toNum(firstField(raw, CBS_FIELD_MAP.avgElecFeedback));

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
    // Household composition (denominator HuishoudensTotaal_29).
    location_pct_households_with_children: pctShare(toNum(firstField(raw, CBS_FIELD_MAP.householdsWithChildren)), householdsTotal),
    location_pct_single_person_households: pctShare(toNum(firstField(raw, CBS_FIELD_MAP.singlePersonHouseholds)), householdsTotal),
    location_avg_household_size:           roundTo(toNum(firstField(raw, CBS_FIELD_MAP.avgHouseholdSize)), 2),
    // Age bands (denominator AantalInwoners_5).
    location_pct_age_0_15:    pctShare(toNum(firstField(raw, CBS_FIELD_MAP.age0_15)),   inhabitants),
    location_pct_age_15_25:   pctShare(toNum(firstField(raw, CBS_FIELD_MAP.age15_25)),  inhabitants),
    location_pct_age_25_45:   pctShare(toNum(firstField(raw, CBS_FIELD_MAP.age25_45)),  inhabitants),
    location_pct_age_45_65:   pctShare(toNum(firstField(raw, CBS_FIELD_MAP.age45_65)),  inhabitants),
    location_pct_age_65_plus: pctShare(toNum(firstField(raw, CBS_FIELD_MAP.age65Plus)), inhabitants),
    // Marital status (denominator AantalInwoners_5).
    location_pct_married:   pctShare(toNum(firstField(raw, CBS_FIELD_MAP.married)),   inhabitants),
    location_pct_unmarried: pctShare(toNum(firstField(raw, CBS_FIELD_MAP.unmarried)), inhabitants),
    location_pct_divorced:  pctShare(toNum(firstField(raw, CBS_FIELD_MAP.divorced)),  inhabitants),
    location_pct_widowed:   pctShare(toNum(firstField(raw, CBS_FIELD_MAP.widowed)),   inhabitants),
    // Housing type + ownership (source already percentages → pass through).
    location_pct_single_family_homes: toNum(firstField(raw, CBS_FIELD_MAP.pctSingleFamily)),
    location_pct_multi_family_homes:  toNum(firstField(raw, CBS_FIELD_MAP.pctMultiFamily)),
    location_pct_detached_homes:      toNum(firstField(raw, CBS_FIELD_MAP.pctDetached)),
    location_pct_owner_occupied:      toNum(firstField(raw, CBS_FIELD_MAP.pctOwnerOccupied)),
    location_pct_rental:              toNum(firstField(raw, CBS_FIELD_MAP.pctRental)),
    location_pct_social_housing:      toNum(firstField(raw, CBS_FIELD_MAP.pctSocialHousing)),
    // Education (denominator = sum of the three levels).
    location_pct_higher_educated: pctShare(eduHigh, eduDenom),
    location_pct_lower_educated:  pctShare(eduLow,  eduDenom),
    // Wealth (amounts in "x 1 000 euro" → euro; poverty already %).
    location_median_household_wealth: medianWealthK       != null ? Math.round(medianWealthK * 1000)       : null,
    location_avg_income_per_earner:   avgIncomePerEarnerK != null ? Math.round(avgIncomePerEarnerK * 1000) : null,
    location_poverty_pct:             toNum(firstField(raw, CBS_FIELD_MAP.povertyPct)),
    // Mobility.
    location_cars_per_household:  roundTo(toNum(firstField(raw, CBS_FIELD_MAP.carsPerHousehold)), 2),
    location_pct_non_petrol_cars: pctShare(carsOther, carsTotal),
    // Energy (extra) — electricity feed-in (kWh), a directer solar signal.
    location_avg_electricity_feedback: avgElecFeedback != null ? Math.round(avgElecFeedback) : null,
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
