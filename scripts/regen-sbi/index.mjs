#!/usr/bin/env node
/**
 * regen-sbi — regenerate data/sbi-2025.json from a KvK SBI Excel (.xlsx).
 *
 *   node scripts/regen-sbi <path-to-excel>
 *
 * Reads the KvK "Standaard Bedrijfsindeling" Excel and writes a compact
 * { "<sbi-code>": { "nl": "...", "en": "..." } } lookup under a small meta
 * header. Codes are kept as strings so leading zeros survive ("0001").
 *
 * Zero external dependencies: an .xlsx is a ZIP of XML, so this unzips it with
 * the built-in zlib (inflateRaw) and parses the shared-strings + first worksheet
 * by hand. It also accepts a .csv (comma or semicolon separated) as a fallback.
 *
 * Column matching is tolerant (case-insensitive, keyword based): it looks for an
 * SBI-code column, a Dutch title column, and an English title column, and prints
 * the detected mapping so you can eyeball it. See docs/sbi-codes-onderhoud.md.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// ── ZIP reading (central directory → per-entry inflate) ─────────────────────────

function readZipEntries(buf) {
  const EOCD_SIG = 0x06054b50;
  const CD_SIG = 0x02014b50;

  // Find the End Of Central Directory record, scanning back from the tail.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx/.zip (no EOCD record found)");

  const cdCount = buf.readUInt16LE(eocd + 10);
  let o = buf.readUInt32LE(eocd + 16); // central directory offset

  const entries = new Map();
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(o) !== CD_SIG) throw new Error("Corrupt central directory");
    const method = buf.readUInt16LE(o + 10);
    const compSize = buf.readUInt32LE(o + 20);
    const nameLen = buf.readUInt16LE(o + 28);
    const extraLen = buf.readUInt16LE(o + 30);
    const commentLen = buf.readUInt16LE(o + 32);
    const localOff = buf.readUInt32LE(o + 42);
    const name = buf.toString("utf8", o + 46, o + 46 + nameLen);

    // Jump to the local header to find where the data actually starts.
    const lhNameLen = buf.readUInt16LE(localOff + 26);
    const lhExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? comp : zlib.inflateRawSync(comp);
    entries.set(name, data);

    o += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ── XML helpers ─────────────────────────────────────────────────────────────────

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&"); // last, so "&amp;lt;" round-trips correctly
}

/** All <t>…</t> text inside a fragment, concatenated (handles rich-text runs). */
function textOf(fragment) {
  let out = "";
  const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(fragment)) !== null) out += m[1];
  return decodeXmlEntities(out).trim();
}

// ── Shared strings ──────────────────────────────────────────────────────────────

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(textOf(m[1]));
  return out;
}

// ── Worksheet ───────────────────────────────────────────────────────────────────

function colToIndex(ref) {
  // "AB12" → column index (A=0). Ignores the row digits.
  const letters = ref.replace(/[0-9]+/g, "");
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml)) !== null) {
    const cells = [];
    const cellRe = /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      const attrs = cm[1];
      const inner = cm[2] || "";
      const refMatch = attrs.match(/r="([A-Z]+\d+)"/);
      const idx = refMatch ? colToIndex(refMatch[1]) : cells.length;
      const type = (attrs.match(/t="([^"]+)"/) || [])[1];
      let value = "";
      if (type === "s") {
        const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        value = v != null ? (shared[parseInt(v, 10)] ?? "") : "";
      } else if (type === "inlineStr") {
        value = textOf(inner);
      } else {
        const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        value = v != null ? decodeXmlEntities(v).trim() : "";
      }
      cells[idx] = value;
    }
    rows.push(cells);
  }
  return rows;
}

// ── CSV fallback ────────────────────────────────────────────────────────────────

function parseCsv(text) {
  const firstLine = text.split("\n")[0];
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (line === "") continue;
    const cells = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
}

// ── Column detection ────────────────────────────────────────────────────────────

function detectColumns(header) {
  const norm = header.map((h) => (h || "").toString().toLowerCase().trim());
  const findIdx = (pred, fallback) => {
    const i = norm.findIndex(pred);
    return i >= 0 ? i : fallback;
  };
  // SBI code: header mentions "sbi" and "code"; else "code"/"sbi"; else first column.
  const codeIdx = findIdx((h) => h.includes("sbi") && h.includes("code"),
                  findIdx((h) => h === "code" || h.includes("sbi"), 0));
  // English title: "titles en" / "title en" / "english" / a standalone "en".
  const enIdx = findIdx((h) => h.includes("titles en") || h.includes("title en") ||
                              h.includes("english") || /\ben\b/.test(h), -1);
  // Dutch title: "titel" / "omschrijving" (but not the EN column).
  const nlIdx = findIdx((h, i) => i !== enIdx && (h.includes("titel") || h.includes("omschrijving")), -1);
  return { codeIdx, nlIdx, enIdx };
}

// ── Main ────────────────────────────────────────────────────────────────────────

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/regen-sbi <path-to-excel-or-csv>");
    process.exit(1);
  }
  const buf = fs.readFileSync(input);

  let rows;
  if (input.toLowerCase().endsWith(".csv")) {
    rows = parseCsv(buf.toString("utf8"));
  } else {
    const entries = readZipEntries(buf);
    const shared = parseSharedStrings(
      (entries.get("xl/sharedStrings.xml") || Buffer.alloc(0)).toString("utf8"),
    );
    const sheetName = [...entries.keys()]
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort()[0];
    if (!sheetName) throw new Error("No worksheet found in the .xlsx");
    rows = parseSheet(entries.get(sheetName).toString("utf8"), shared);
  }

  if (rows.length < 2) throw new Error("Sheet has no data rows");

  const { codeIdx, nlIdx, enIdx } = detectColumns(rows[0]);
  console.log("Detected columns →", {
    code: rows[0][codeIdx], nl: rows[0][nlIdx], en: rows[0][enIdx],
  });
  if (codeIdx < 0 || nlIdx < 0 || enIdx < 0) {
    throw new Error(`Could not map columns. Header row: ${JSON.stringify(rows[0])}`);
  }

  const codes = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawCode = (row[codeIdx] || "").toString().trim();
    if (!rawCode) continue;
    // Keep the code as a string exactly as given (leading zeros preserved).
    const nl = (row[nlIdx] || "").toString().trim();
    const en = (row[enIdx] || "").toString().trim();
    if (!nl && !en) continue;
    codes[rawCode] = { nl, en };
  }

  const count = Object.keys(codes).length;
  if (count === 0) throw new Error("No SBI codes extracted — check the column mapping");

  // Sort keys numerically (shortest-then-lexically) for a stable, reviewable diff.
  const sorted = {};
  for (const k of Object.keys(codes).sort((a, b) => (a.length - b.length) || a.localeCompare(b))) {
    sorted[k] = codes[k];
  }

  // Write the FLAT { "<code>": { en, nl } } shape that data/sbi-2025.json uses and
  // lib/enrichment/sbi-2025.ts consumes. Version + date live in the runbook
  // (docs/sbi-codes-onderhoud.md), not in the data file.
  const outPath = path.join(import.meta.dirname, "..", "..", "data", "sbi-2025.json");
  fs.writeFileSync(outPath, JSON.stringify(sorted) + "\n", "utf8");
  console.log(`Wrote ${count} SBI codes → ${path.relative(process.cwd(), outPath)}`);
  const spot = sorted["73110"];
  if (spot) console.log(`Spot-check 73110 → nl="${spot.nl}" / en="${spot.en}"`);
}

main();
