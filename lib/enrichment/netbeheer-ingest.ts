/**
 * lib/enrichment/netbeheer-ingest.ts
 *
 * Parse + pivot for the Dutch grid operators' (netbeheerder) small-consumption
 * ("kleinverbruik") open-data CSV → per-PC6 energy rows for pc6_energy_stats.
 * Same lazy-store shape as the CBS backfill; the runner (scripts/netbeheer-
 * ingest.ts) supplies the download, pacing and Supabase upsert.
 *
 * ─── Bronformaat (geverifieerd) ───────────────────────────────────────────────
 * Jaarlijks CSV per netbeheerder. Kolommen o.a.: POSTCODE_VAN, POSTCODE_TOT (PC6,
 * 4 cijfers + 2 letters, zonder spatie), PRODUCTSOORT ("ELK"/"GAS"),
 * SJA_GEMIDDELD (gem. jaarafname — kWh bij ELK, m³ bij GAS), LEVERINGSRICHTING_PERC
 * (% netto-afname; lager = meer teruglevering/zon), AANSLUITINGEN_AANTAL,
 * SLIMME_METER_PERC. Formaat: TAB-gescheiden, tekst tussen ", decimaal-KOMMA,
 * UTF-8 BOM. Peildatum 1 jan; min. 10 aansluitingen per regel (anders een
 * samengevoegde postcode-reeks VAN != TOT).
 *
 * ⚠ Alleen KLEINVERBRUIK (huishoudens + klein-zakelijk). Grootverbruik zit er niet in.
 *
 * Puur (geen I/O) → unit-testbaar.
 */

export interface NetbeheerRawRow {
  postcodeVan:          string;
  postcodeTot:          string;
  productsoort:         string;              // "ELK" | "GAS" | …
  sjaGemiddeld:         number | null;       // kWh (ELK) / m³ (GAS)
  leveringsrichtingPct: number | null;       // % netto-afname
  aansluitingen:        number | null;
  slimmeMeterPct:       number | null;
}

export interface Pc6EnergyRow {
  netbeheerder:        string;
  postcode_van:        string;
  postcode_tot:        string;
  avg_gas_m3:          number | null;
  avg_elk_kwh:         number | null;
  solar_feedback_pct:  number | null;
  connections_count:   number | null;
  smart_meter_pct:     number | null;
  source_year:         number | null;
  peildatum:           string | null;        // ISO date (YYYY-MM-DD) or null
}

/** Strip surrounding double-quotes and trim. */
function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).trim();
  return t;
}

/** Candidate field separators, in tie-break preference order. */
const DELIMITERS = ["\t", ";", ","] as const;

/**
 * Autodetect the field separator from the header line: the candidate that occurs
 * most often OUTSIDE quotes. Netbeheerders differ (tab / ; / ,); header names
 * carry no separators, so a count on the header is reliable. Ties prefer tab, ;, ,.
 */
export function detectDelimiter(headerLine: string): string {
  let best = "\t", bestN = -1;
  for (const d of DELIMITERS) {
    let n = 0, inQ = false;
    for (const c of headerLine) {
      if (c === '"') inQ = !inQ;
      else if (c === d && !inQ) n++;
    }
    if (n > bestN) { bestN = n; best = d; }
  }
  return best;
}

/**
 * Split one line on `delim`, respecting double-quoted fields (so a decimal-comma
 * inside a quoted value is not treated as a comma separator). Quotes are kept and
 * stripped later by unquote().
 */
function splitDelimited(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; cur += c; }
    else if (c === delim && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Parse a number that may use EITHER Dutch (decimal-comma) OR point notation —
 * netbeheerders differ. The decimal separator is GUESSED, not assumed, so a
 * decimal point (e.g. "71.74") is no longer wrecked into "7174":
 *   • both "." and "," present → the LAST one is the decimal, the other thousands
 *     ("1.234,5" → 1234.5 · "1,234.5" → 1234.5);
 *   • only "," → decimal comma ("12,5" → 12.5);
 *   • only "." → decimal point, NOT stripped ("71.74" → 71.74 · "2900" → 2900).
 * Empty / non-numeric → null.
 */
export function parseDutchNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = unquote(String(raw));
  if (!s) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: the rightmost is the decimal separator, the other is grouping.
    normalized = lastComma > lastDot
      ? s.replace(/\./g, "").replace(",", ".")   // comma is decimal
      : s.replace(/,/g, "");                      // dot is decimal
  } else if (lastComma >= 0) {
    normalized = s.replace(",", ".");             // only comma → decimal comma
  } else {
    normalized = s;                                // only dot (or neither) → decimal point, keep as-is
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map a raw PRODUCTSOORT value to a canonical fuel: "ELK" | "GAS" | "" (unknown).
 * Netbeheerders differ: ELK / E / ELEKTRICITEIT → ELK; GAS / G → GAS. Case-insensitive.
 */
export function normalizeProductsoort(raw: string | undefined | null): "ELK" | "GAS" | "" {
  const v = unquote(String(raw ?? "")).toUpperCase();
  if (v === "ELK" || v === "E" || v === "ELEKTRICITEIT") return "ELK";
  if (v === "GAS" || v === "G") return "GAS";
  return "";
}

/** Header aliases per field — netbeheerders name columns slightly differently. */
const COLUMN_ALIASES = {
  postcodeVan:  ["POSTCODE_VAN"],
  postcodeTot:  ["POSTCODE_TOT"],
  productsoort: ["PRODUCTSOORT"],
  // SJA (verbruik std) / SJV (verbruik) / SJI (invoeding/teruglevering) — same slot.
  sja:          ["SJA_GEMIDDELD", "SJV_GEMIDDELD", "SJI_GEMIDDELD"],
  leveringsrichting: ["LEVERINGSRICHTING_PERC"],
  aansluitingen: ["AANSLUITINGEN_AANTAL"],
  slimmeMeter:  ["SLIMME_METER_PERC"],
} as const;

/** Normalise a PC6 ("1234 ab" → "1234AB"). Returns null when it isn't a valid PC6. */
export function normalizePc6(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const s = unquote(String(raw)).replace(/\s+/g, "").toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(s) ? s : null;
}

/** True when `pc6` falls inside the (inclusive) postcode range [van, tot]. */
export function pc6InRange(pc6: string, van: string, tot: string): boolean {
  const p = pc6.toUpperCase();
  return van.toUpperCase() <= p && p <= tot.toUpperCase();
}

/** solar_feedback_pct = 100 − LEVERINGSRICHTING_PERC, geclamped 0–100. */
export function deriveSolarFeedbackPct(leveringsrichtingPct: number | null): number | null {
  if (leveringsrichtingPct == null) return null;
  return Math.min(100, Math.max(0, 100 - leveringsrichtingPct));
}

/**
 * Parse the raw CSV text into rows. Handles the UTF-8 BOM, quoted text fields and
 * both decimal conventions (point / comma). Rows without a valid PC6 pair are dropped.
 *
 * Robust to netbeheerder differences:
 *   • the separator is autodetected per file (tab / ; / ,), quote-aware;
 *   • columns are matched by HEADER NAME with ALIASES (e.g. SJA/SJV/SJI_GEMIDDELD),
 *     not by index, so column order and naming differences are handled;
 *   • PRODUCTSOORT is normalised to canonical ELK/GAS (ELK/E/ELEKTRICITEIT, GAS/G).
 */
export function parseNetbeheerCsv(text: string): NetbeheerRawRow[] {
  const clean = text.replace(/^﻿/, "");                 // drop UTF-8 BOM
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delim = detectDelimiter(lines[0]!);
  const header = splitDelimited(lines[0]!, delim).map((h) => unquote(h).toUpperCase());
  /** First header index matching any of the field's aliases, else -1. */
  const idxOf = (names: readonly string[]): number => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const iVan   = idxOf(COLUMN_ALIASES.postcodeVan);
  const iTot   = idxOf(COLUMN_ALIASES.postcodeTot);
  const iProd  = idxOf(COLUMN_ALIASES.productsoort);
  const iSja   = idxOf(COLUMN_ALIASES.sja);
  const iLev   = idxOf(COLUMN_ALIASES.leveringsrichting);
  const iAansl = idxOf(COLUMN_ALIASES.aansluitingen);
  const iSmart = idxOf(COLUMN_ALIASES.slimmeMeter);
  if (iVan < 0 || iTot < 0 || iProd < 0) return [];

  const out: NetbeheerRawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitDelimited(lines[i]!, delim);
    const van = normalizePc6(cells[iVan]);
    const tot = normalizePc6(cells[iTot]);
    if (!van || !tot) continue;
    out.push({
      postcodeVan:          van,
      postcodeTot:          tot,
      productsoort:         normalizeProductsoort(cells[iProd]),
      sjaGemiddeld:         iSja   >= 0 ? parseDutchNumber(cells[iSja])   : null,
      leveringsrichtingPct: iLev   >= 0 ? parseDutchNumber(cells[iLev])   : null,
      aansluitingen:        iAansl >= 0 ? parseDutchNumber(cells[iAansl]) : null,
      slimmeMeterPct:       iSmart >= 0 ? parseDutchNumber(cells[iSmart]) : null,
    });
  }
  return out;
}

const maxOrNull = (a: number | null, b: number | null): number | null =>
  a == null ? b : b == null ? a : Math.max(a, b);

/**
 * Pivot the ELK + GAS raw rows into one Pc6EnergyRow per (postcode_van,
 * postcode_tot). ELK carries kWh + solar-feedback + smart-meter; GAS carries m³.
 * Connections = the max of the two product legs.
 */
export function pivotNetbeheerRows(
  rows:         NetbeheerRawRow[],
  netbeheerder: string,
  opts:         { sourceYear?: number | null; peildatum?: string | null } = {},
): Pc6EnergyRow[] {
  const groups = new Map<string, { van: string; tot: string; elk?: NetbeheerRawRow; gas?: NetbeheerRawRow }>();
  for (const r of rows) {
    const key = `${r.postcodeVan}|${r.postcodeTot}`;
    const g = groups.get(key) ?? { van: r.postcodeVan, tot: r.postcodeTot };
    if (r.productsoort === "ELK") g.elk = r;
    else if (r.productsoort === "GAS") g.gas = r;
    groups.set(key, g);
  }

  const result: Pc6EnergyRow[] = [];
  for (const g of groups.values()) {
    const elk = g.elk, gas = g.gas;
    result.push({
      netbeheerder,
      postcode_van:       g.van,
      postcode_tot:       g.tot,
      avg_elk_kwh:        elk?.sjaGemiddeld ?? null,
      avg_gas_m3:         gas?.sjaGemiddeld ?? null,
      solar_feedback_pct: deriveSolarFeedbackPct(elk?.leveringsrichtingPct ?? null),
      connections_count:  (() => {
        const m = maxOrNull(elk?.aansluitingen ?? null, gas?.aansluitingen ?? null);
        return m == null ? null : Math.round(m);
      })(),
      smart_meter_pct:    elk?.slimmeMeterPct ?? gas?.slimmeMeterPct ?? null,
      source_year:        opts.sourceYear ?? null,
      peildatum:          opts.peildatum ?? null,
    });
  }
  return result;
}
