/**
 * Netbeheerder PC6 energy (Fase 2) — parser/pivot/derive + range lookup + the
 * lazy enricher stage. Pure units + the enricher over an injected lookup (no DB).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  parseNetbeheerCsv, pivotNetbeheerRows, parseDutchNumber, normalizePc6,
  pc6InRange, deriveSolarFeedbackPct, normalizeProductsoort,
  type NetbeheerRawRow,
} from "../../lib/enrichment/netbeheer-ingest.ts";
import { createNetbeheerEnergyEnricher } from "../../enrichment/providers/netbeheer-energy.ts";
import type { EnricherInput, EnrichmentOutput } from "../../enrichment/types.ts";
import type { Pc6Energy } from "../../enrichment/pc6-energy-store.ts";

// Build a source CSV: UTF-8 BOM, TAB-separated, quoted text, decimal comma.
const HEADER = ["POSTCODE_VAN","POSTCODE_TOT","PRODUCTSOORT","SJA_GEMIDDELD","LEVERINGSRICHTING_PERC","AANSLUITINGEN_AANTAL","SLIMME_METER_PERC"];
const q = (cells: string[]) => cells.map((c) => `"${c}"`).join("\t");
const csv = (rows: string[][]) => "﻿" + [q(HEADER), ...rows.map(q)].join("\r\n");

// ── parseDutchNumber ──────────────────────────────────────────────────────────

describe("parseDutchNumber", () => {
  it("decimal COMMA convention", () => {
    assert.equal(parseDutchNumber("82,5"), 82.5);
    assert.equal(parseDutchNumber('"12,5"'), 12.5);     // still-quoted
    assert.equal(parseDutchNumber("1.234,5"), 1234.5);  // dot thousands + comma decimal
  });
  it("decimal POINT convention (not stripped as thousands)", () => {
    assert.equal(parseDutchNumber("71.74"), 71.74);     // the Liander bug: was 7174
    assert.equal(parseDutchNumber("7.174"), 7.174);     // only dot → decimal point
    assert.equal(parseDutchNumber("1,234.5"), 1234.5);  // comma thousands + point decimal
  });
  it("plain ints and junk", () => {
    assert.equal(parseDutchNumber("2900"), 2900);
    assert.equal(parseDutchNumber(""), null);
    assert.equal(parseDutchNumber("x"), null);
    assert.equal(parseDutchNumber(null), null);
  });
});

describe("normalizeProductsoort", () => {
  it("maps electricity variants → ELK", () => {
    assert.equal(normalizeProductsoort("ELK"), "ELK");
    assert.equal(normalizeProductsoort("e"), "ELK");
    assert.equal(normalizeProductsoort("Elektriciteit"), "ELK");
    assert.equal(normalizeProductsoort('"ELK   "'), "ELK"); // quoted + padded (real Liander)
  });
  it("maps gas variants → GAS, unknown → ''", () => {
    assert.equal(normalizeProductsoort("GAS"), "GAS");
    assert.equal(normalizeProductsoort("g"), "GAS");
    assert.equal(normalizeProductsoort("warmte"), "");
    assert.equal(normalizeProductsoort(null), "");
  });
});

// ── normalizePc6 / pc6InRange ─────────────────────────────────────────────────

describe("normalizePc6", () => {
  it("normalises spaces + case, rejects non-PC6", () => {
    assert.equal(normalizePc6("3011 ad"), "3011AD");
    assert.equal(normalizePc6('"1234AB"'), "1234AB");
    assert.equal(normalizePc6("1234"), null);
    assert.equal(normalizePc6("12345A"), null);
    assert.equal(normalizePc6(null), null);
  });
});

describe("pc6InRange (incl. merged range)", () => {
  it("matches an exact row and an inclusive merged range", () => {
    assert.equal(pc6InRange("3011AD", "3011AD", "3011AD"), true);   // exact
    assert.equal(pc6InRange("9999ZY", "9999ZX", "9999ZZ"), true);   // inside merged
    assert.equal(pc6InRange("9999ZX", "9999ZX", "9999ZZ"), true);   // lower bound
    assert.equal(pc6InRange("9999ZZ", "9999ZX", "9999ZZ"), true);   // upper bound
    assert.equal(pc6InRange("9999ZW", "9999ZX", "9999ZZ"), false);  // below
    assert.equal(pc6InRange("9999AA", "9999ZX", "9999ZZ"), false);  // above start's letters
  });
});

// ── deriveSolarFeedbackPct ────────────────────────────────────────────────────

describe("deriveSolarFeedbackPct", () => {
  it("computes 100 − pct, clamped to 0–100, null-safe", () => {
    assert.equal(deriveSolarFeedbackPct(82.5), 17.5);
    assert.equal(deriveSolarFeedbackPct(0), 100);
    assert.equal(deriveSolarFeedbackPct(120), 0);    // clamp low
    assert.equal(deriveSolarFeedbackPct(-5), 100);   // clamp high
    assert.equal(deriveSolarFeedbackPct(null), null);
  });
});

// ── parseNetbeheerCsv ─────────────────────────────────────────────────────────

describe("parseNetbeheerCsv", () => {
  it("parses BOM/tab/quote/comma and drops invalid PC6 rows", () => {
    const text = csv([
      ["3011AD","3011AD","ELK","2900","82,5","25","90,0"],
      ["3011AD","3011AD","GAS","1200","","24","88,0"],
      ["GARBAGE","3011AD","ELK","1000","10","5","50"], // invalid POSTCODE_VAN → dropped
    ]);
    const rows = parseNetbeheerCsv(text);
    assert.equal(rows.length, 2);
    const elk = rows.find((r) => r.productsoort === "ELK")!;
    assert.equal(elk.postcodeVan, "3011AD");
    assert.equal(elk.sjaGemiddeld, 2900);
    assert.equal(elk.leveringsrichtingPct, 82.5);
    assert.equal(elk.aansluitingen, 25);
    const gas = rows.find((r) => r.productsoort === "GAS")!;
    assert.equal(gas.sjaGemiddeld, 1200);
    assert.equal(gas.leveringsrichtingPct, null); // empty cell → null
  });

  it("returns [] on an empty or header-only file", () => {
    assert.deepEqual(parseNetbeheerCsv(""), []);
    assert.deepEqual(parseNetbeheerCsv("﻿" + q(HEADER)), []);
  });

  it("handles a semicolon file with SJV/SJI alias, E/G productsoort and decimal-point %", () => {
    // Mirrors the real Liander shape: no BOM, semicolon-delimited, decimal POINT.
    const text = [
      "NETBEHEERDER;POSTCODE_VAN;POSTCODE_TOT;PRODUCTSOORT;SJV_GEMIDDELD;LEVERINGSRICHTING_PERC;AANSLUITINGEN_AANTAL;SLIMME_METER_PERC",
      "Liander;3011AD;3011AD;E;2900;82.50;25;71.74",
      "Liander;3011AD;3011AD;G;1200;;24;70.10",
    ].join("\n");
    const rows = parseNetbeheerCsv(text);
    assert.equal(rows.length, 2);
    const elk = rows.find((r) => r.productsoort === "ELK")!;   // "E" normalised
    assert.equal(elk.sjaGemiddeld, 2900);                       // SJV_GEMIDDELD alias
    assert.equal(elk.slimmeMeterPct, 71.74);                    // decimal point, not 7174
    assert.equal(elk.leveringsrichtingPct, 82.5);
    const gas = rows.find((r) => r.productsoort === "GAS")!;    // "G" normalised
    assert.equal(gas.sjaGemiddeld, 1200);
  });

  it("picks up the SJI_GEMIDDELD alias (teruglever files)", () => {
    const text = [
      "POSTCODE_VAN;POSTCODE_TOT;PRODUCTSOORT;SJI_GEMIDDELD;AANSLUITINGEN_AANTAL",
      "1011AC;1011DE;ELK;1077;67",
    ].join("\n");
    const rows = parseNetbeheerCsv(text);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.sjaGemiddeld, 1077);
  });
});

// ── pivotNetbeheerRows ────────────────────────────────────────────────────────

describe("pivotNetbeheerRows", () => {
  const raw: NetbeheerRawRow[] = [
    { postcodeVan:"3011AD", postcodeTot:"3011AD", productsoort:"ELK", sjaGemiddeld:2900, leveringsrichtingPct:82.5, aansluitingen:25, slimmeMeterPct:90 },
    { postcodeVan:"3011AD", postcodeTot:"3011AD", productsoort:"GAS", sjaGemiddeld:1200, leveringsrichtingPct:null, aansluitingen:24, slimmeMeterPct:88 },
    { postcodeVan:"9999ZX", postcodeTot:"9999ZZ", productsoort:"ELK", sjaGemiddeld:3100, leveringsrichtingPct:70,   aansluitingen:12, slimmeMeterPct:95 },
    { postcodeVan:"1000AA", postcodeTot:"1000AA", productsoort:"GAS", sjaGemiddeld:800,  leveringsrichtingPct:null, aansluitingen:15, slimmeMeterPct:70 },
  ];
  const rows = pivotNetbeheerRows(raw, "liander", { sourceYear: 2024, peildatum: "2024-01-01" });

  it("merges ELK+GAS into one row per postcode range, connections = max", () => {
    const r = rows.find((x) => x.postcode_van === "3011AD")!;
    assert.equal(r.avg_elk_kwh, 2900);
    assert.equal(r.avg_gas_m3, 1200);
    assert.equal(r.solar_feedback_pct, 17.5);   // 100 − 82.5
    assert.equal(r.connections_count, 25);       // max(25, 24)
    assert.equal(r.smart_meter_pct, 90);         // ELK preferred
    assert.equal(r.netbeheerder, "liander");
    assert.equal(r.source_year, 2024);
    assert.equal(r.peildatum, "2024-01-01");
  });

  it("keeps an ELK-only merged range (gas null) and a GAS-only row (elk/solar null)", () => {
    const merged = rows.find((x) => x.postcode_van === "9999ZX")!;
    assert.equal(merged.avg_elk_kwh, 3100);
    assert.equal(merged.avg_gas_m3, null);
    assert.equal(merged.solar_feedback_pct, 30);

    const gasOnly = rows.find((x) => x.postcode_van === "1000AA")!;
    assert.equal(gasOnly.avg_gas_m3, 800);
    assert.equal(gasOnly.avg_elk_kwh, null);
    assert.equal(gasOnly.solar_feedback_pct, null); // no ELK → no solar
    assert.equal(gasOnly.smart_meter_pct, 70);      // falls back to GAS
  });
});

// ── enricher stage ────────────────────────────────────────────────────────────

const input = (postcode: string | null): EnricherInput =>
  ({ formLocation: postcode ? { postcode, place: null } : null } as EnricherInput);
const acc = (): Partial<EnrichmentOutput> => ({});

describe("createNetbeheerEnergyEnricher", () => {
  const stats: Pc6Energy = { netbeheerder:"liander", avgGasM3:1200, avgElkKwh:2900, solarPct:17.5, smartMeterPct:90 };

  it("shouldRun only when a valid PC6 postcode is present", () => {
    const s = createNetbeheerEnergyEnricher({ lookup: async () => null });
    assert.equal(s.shouldRun!(input("3011AD"), acc()), true);
    assert.equal(s.shouldRun!(input("3011 ad"), acc()), true); // normalised
    assert.equal(s.shouldRun!(input("1234"), acc()), false);   // not a PC6
    assert.equal(s.shouldRun!(input(null), acc()), false);
  });

  it("sets the four PC6 fields on a hit", async () => {
    const s = createNetbeheerEnergyEnricher({ lookup: async () => stats });
    const out = await s.enricher(input("3011AD"), acc());
    assert.equal(out.locationPc6AvgGasM3, 1200);
    assert.equal(out.locationPc6AvgElkKwh, 2900);
    assert.equal(out.locationPc6SolarPct, 17.5);
    assert.equal(out.locationPc6SmartMeterPct, 90);
  });

  it("is fail-open: a miss (null) adds no fields and does not throw", async () => {
    const s = createNetbeheerEnergyEnricher({ lookup: async () => null });
    const out = await s.enricher(input("3011AD"), acc());
    assert.equal(out.locationPc6AvgElkKwh, undefined);
    assert.equal(out.locationPc6AvgGasM3, undefined);
  });

  it("passes the normalised PC6 to the lookup", async () => {
    let seen: string | null = null;
    const s = createNetbeheerEnergyEnricher({ lookup: async (pc6) => { seen = pc6; return null; } });
    await s.enricher(input("3011 ad"), acc());
    assert.equal(seen, "3011AD");
  });
});
