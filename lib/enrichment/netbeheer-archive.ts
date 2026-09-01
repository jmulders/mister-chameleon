/**
 * lib/enrichment/netbeheer-archive.ts
 *
 * INGEST-ONLY source loading + archive extraction for the netbeheerder feeds.
 * Imported ONLY by scripts/netbeheer-ingest.ts (and its test) — NEVER by the
 * request path — so the zip dependency stays out of the runtime bundle.
 *
 * In de praktijk komt de open data niet als kant-en-klare directe CSV-URL:
 *   • Enexis levert op aanvraag per e-mail (geen URL) → lokaal bestand.
 *   • Liander / Stedin distribueren gezipte bestanden via JS-downloadpagina's.
 * Vandaar: bron mag een URL of een lokaal pad zijn, en de bytes mogen een ZIP,
 * een .gz of een kale CSV zijn (gedetecteerd op magic bytes, niet op extensie —
 * e-mailbijlagen hebben soms rare namen).
 */

import { readFile } from "fs/promises";
import * as path from "path";
import { unzipSync, gunzipSync, strFromU8 } from "fflate";

const DEFAULT_FETCH_TIMEOUT_MS = 120_000;

/**
 * Load a source's raw bytes. `source` starting with http(s) is fetched; anything
 * else is read from disk (resolved relative to the cwd). So the workflow can be:
 * download the files locally (Enexis mail, Liander/Stedin download) → ingest them.
 */
export async function loadSourceBytes(source: string, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<Buffer> {
  if (/^https?:\/\//i.test(source)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(source, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${source}`);
      return Buffer.from(await res.arrayBuffer());
    } finally {
      clearTimeout(timeout);
    }
  }
  return readFile(path.resolve(process.cwd(), source));
}

/** ZIP local-file-header magic: PK\x03\x04. */
export function isZip(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

/** gzip magic: \x1f\x8b. */
export function isGzip(buf: Uint8Array): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

/**
 * Extract the CSV text blob(s) from raw source bytes. Detects the container on
 * magic bytes:
 *   • ZIP  → every .csv entry, decoded (a netbeheerder may ship ELK and GAS in
 *            separate CSVs; pivotNetbeheerRows merges them by postcode afterwards).
 *   • gzip → the single decoded member.
 *   • else → the bytes as one UTF-8 CSV (current behaviour).
 * The UTF-8 BOM (if any) is left intact — parseNetbeheerCsv strips it.
 */
export function extractCsvTexts(buf: Buffer): string[] {
  const bytes = new Uint8Array(buf);
  if (isZip(bytes)) {
    const files = unzipSync(bytes);
    return Object.keys(files)
      .filter((name) => name.toLowerCase().endsWith(".csv"))
      .sort()                                   // deterministic order
      .map((name) => strFromU8(files[name]!));
  }
  if (isGzip(bytes)) {
    return [strFromU8(gunzipSync(bytes))];
  }
  return [buf.toString("utf8")];
}
