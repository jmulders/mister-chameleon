/**
 * Netbeheer ingest — source loading + archive extraction + delimiter autodetect.
 * Exercises the inname-laag: local files, ZIP/gzip (magic-byte) extraction with
 * multiple CSV entries, delimiter autodetection (tab / ; / ,), and that the
 * existing parse → pivot behaves identically afterwards.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir }        from "node:os";
import { join }          from "node:path";
import { zipSync, gzipSync, strToU8 } from "fflate";

import {
  loadSourceBytes, isZip, isGzip, extractCsvTexts,
} from "../../lib/enrichment/netbeheer-archive.ts";
import {
  parseNetbeheerCsv, pivotNetbeheerRows, detectDelimiter,
} from "../../lib/enrichment/netbeheer-ingest.ts";

const BOM = "﻿";
const HEADER = ["POSTCODE_VAN","POSTCODE_TOT","PRODUCTSOORT","SJA_GEMIDDELD","LEVERINGSRICHTING_PERC","AANSLUITINGEN_AANTAL","SLIMME_METER_PERC"];

// A tab CSV (unquoted), a semicolon CSV (unquoted), a comma CSV (quoted, so the
// decimal-comma inside a value must NOT split).
const tabCsv = BOM + HEADER.join("\t") + "\n" + ["3011AD","3011AD","ELK","2900","82,5","25","90"].join("\t") + "\n";
const semiCsv = BOM + HEADER.join(";") + "\n" + ["3011AD","3011AD","ELK","2900","82,5","25","90"].join(";") + "\n";
const commaCsv = BOM + HEADER.map((h) => `"${h}"`).join(",") + "\n" +
  ["3011AD","3011AD","GAS","1200","","24","88,0"].map((c) => `"${c}"`).join(",") + "\n";

// ── delimiter autodetect ──────────────────────────────────────────────────────

describe("detectDelimiter", () => {
  it("detects tab / semicolon / comma from the header", () => {
    assert.equal(detectDelimiter(HEADER.join("\t")), "\t");
    assert.equal(detectDelimiter(HEADER.join(";")), ";");
    assert.equal(detectDelimiter(HEADER.map((h) => `"${h}"`).join(",")), ",");
  });
});

describe("parseNetbeheerCsv — delimiter-robust", () => {
  it("parses tab, semicolon and comma (quoted decimal-comma) identically", () => {
    for (const [name, csv] of [["tab", tabCsv], ["semi", semiCsv]] as const) {
      const rows = parseNetbeheerCsv(csv);
      assert.equal(rows.length, 1, name);
      assert.equal(rows[0]!.sjaGemiddeld, 2900, name);
      assert.equal(rows[0]!.leveringsrichtingPct, 82.5, name);
    }
    const gas = parseNetbeheerCsv(commaCsv);
    assert.equal(gas.length, 1);
    assert.equal(gas[0]!.productsoort, "GAS");
    assert.equal(gas[0]!.sjaGemiddeld, 1200);
    assert.equal(gas[0]!.slimmeMeterPct, 88);      // "88,0" inside quotes, comma-delimited → not split
    assert.equal(gas[0]!.leveringsrichtingPct, null);
  });
});

// ── magic-byte detection ──────────────────────────────────────────────────────

describe("isZip / isGzip", () => {
  it("detects containers on magic bytes, not extension", () => {
    const zip = zipSync({ "x.csv": strToU8(tabCsv) });
    const gz  = gzipSync(strToU8(tabCsv));
    assert.equal(isZip(zip), true);
    assert.equal(isGzip(zip), false);
    assert.equal(isGzip(gz), true);
    assert.equal(isZip(gz), false);
    assert.equal(isZip(new Uint8Array([1, 2, 3])), false);
  });
});

// ── extractCsvTexts ───────────────────────────────────────────────────────────

describe("extractCsvTexts", () => {
  it("returns a plain CSV buffer as one text", () => {
    const texts = extractCsvTexts(Buffer.from(tabCsv, "utf8"));
    assert.equal(texts.length, 1);
    assert.equal(parseNetbeheerCsv(texts[0]!).length, 1);
  });

  it("decodes a gzip member", () => {
    const gz = Buffer.from(gzipSync(strToU8(tabCsv)));
    const texts = extractCsvTexts(gz);
    assert.equal(texts.length, 1);
    assert.equal(parseNetbeheerCsv(texts[0]!).length, 1);
  });

  it("extracts every .csv entry from a ZIP (ignoring non-csv), sorted", () => {
    const zip = Buffer.from(zipSync({
      "b_gas.csv":  strToU8(commaCsv),
      "a_elk.csv":  strToU8(semiCsv),
      "readme.txt": strToU8("ignore me"),
    }));
    const texts = extractCsvTexts(zip);
    assert.equal(texts.length, 2);                 // only the two .csv entries
    // sorted by name → a_elk.csv first (ELK), then b_gas.csv (GAS)
    assert.equal(parseNetbeheerCsv(texts[0]!)[0]!.productsoort, "ELK");
    assert.equal(parseNetbeheerCsv(texts[1]!)[0]!.productsoort, "GAS");
  });
});

// ── loadSourceBytes — local path ──────────────────────────────────────────────

describe("loadSourceBytes — local file", () => {
  it("reads a local path (non-URL) from disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nb-ingest-"));
    const file = join(dir, "liander.csv");
    try {
      writeFileSync(file, tabCsv, "utf8");
      const bytes = await loadSourceBytes(file);
      assert.equal(bytes.toString("utf8"), tabCsv);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── end-to-end: ZIP of separate ELK + GAS CSVs → pivot merges by postcode ─────

describe("ingest pipeline — ZIP with separate ELK/GAS CSVs", () => {
  it("extract → parse each → pivot merges ELK+GAS on the same postcode", () => {
    const zip = Buffer.from(zipSync({
      "elk.csv": strToU8(semiCsv),   // ELK, semicolon
      "gas.csv": strToU8(commaCsv),  // GAS, comma + quoted decimal-comma
    }));
    const raw = extractCsvTexts(zip).flatMap((t) => parseNetbeheerCsv(t));
    assert.equal(raw.length, 2);
    const rows = pivotNetbeheerRows(raw, "liander", { sourceYear: 2024, peildatum: "2024-01-01" });
    assert.equal(rows.length, 1);                  // merged into one postcode row
    const r = rows[0]!;
    assert.equal(r.avg_elk_kwh, 2900);
    assert.equal(r.avg_gas_m3, 1200);
    assert.equal(r.solar_feedback_pct, 17.5);      // 100 − 82.5
    assert.equal(r.connections_count, 25);         // max(25, 24)
    assert.equal(r.smart_meter_pct, 90);           // ELK preferred
  });
});
