/**
 * scripts/netbeheer-ingest.ts
 *
 * Resumable, throttled BULK ingest of pc6_energy_stats from the grid operators'
 * (netbeheerder) small-consumption open-data CSV. Same shape as the CBS backfill:
 * a script/admin job, NOT the request path.
 *
 * The download URL changes every year, so it is NEVER hardcoded — pass it per
 * netbeheerder as an argument (or a JSON config file).
 *
 * Usage:
 *   npm run netbeheer:ingest -- --source liander=https://…/klein_liander_2024.csv \
 *                               --source stedin=https://…/kv_stedin_2024.csv \
 *                               --source enexis=https://…/enexis_kv_2024.csv \
 *                               --year 2024 --peildatum 2024-01-01
 *   npm run netbeheer:ingest -- --config scripts/netbeheer-sources.json   # [{netbeheerder,url}]
 *   npm run netbeheer:ingest -- --reset                                   # ignore progress
 *
 * Resumability: completed netbeheerders are written to
 * .netbeheer-ingest-progress.json; a re-run skips them. Upsert is idempotent on
 * (netbeheerder, postcode_van, postcode_tot), so a re-run is always safe.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import * as fs     from "fs";
import * as path   from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { parseNetbeheerCsv, pivotNetbeheerRows } from "../lib/enrichment/netbeheer-ingest";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_KEY  = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const PROGRESS  = path.resolve(process.cwd(), ".netbeheer-ingest-progress.json");
const PAUSE_MS  = Number(process.env["NETBEHEER_PAUSE_MS"] ?? 200);       // between upsert batches
const FETCH_TIMEOUT_MS = Number(process.env["NETBEHEER_FETCH_TIMEOUT_MS"] ?? 120_000);
const BATCH     = 500;

interface Source { netbeheerder: string; url: string; }

// ── Arg parsing ─────────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): { sources: Source[]; year: number | null; peildatum: string | null; reset: boolean } {
  const sources: Source[] = [];
  let year: number | null = null;
  let peildatum: string | null = null;
  let reset = false;
  const single: { netbeheerder?: string; url?: string } = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => argv[++i] ?? "";
    if (a === "--reset") reset = true;
    else if (a === "--year")        year = Number(next()) || null;
    else if (a === "--peildatum")   peildatum = next() || null;
    else if (a === "--netbeheerder") single.netbeheerder = next();
    else if (a === "--url")          single.url = next();
    else if (a === "--source") {
      const [nb, ...rest] = next().split("=");
      const url = rest.join("=");
      if (nb && url) sources.push({ netbeheerder: nb.trim().toLowerCase(), url: url.trim() });
    } else if (a === "--config") {
      const cfg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), next()), "utf8")) as Source[];
      for (const s of cfg) if (s.netbeheerder && s.url) sources.push({ netbeheerder: s.netbeheerder.trim().toLowerCase(), url: s.url.trim() });
    }
  }
  if (single.netbeheerder && single.url) sources.push({ netbeheerder: single.netbeheerder.trim().toLowerCase(), url: single.url.trim() });
  return { sources, year, peildatum, reset };
}

function loadDone(reset: boolean): Set<string> {
  if (reset) return new Set();
  try { return new Set(JSON.parse(fs.readFileSync(PROGRESS, "utf8")) as string[]); }
  catch { return new Set(); }
}
function saveDone(done: Set<string>): void {
  fs.writeFileSync(PROGRESS, JSON.stringify([...done], null, 2));
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function download(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertBatch(rows: Record<string, unknown>[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({ ...r, refreshed_at: new Date().toISOString() }));
    const { error } = await client
      .from("pc6_energy_stats")
      .upsert(batch, { onConflict: "netbeheerder,postcode_van,postcode_tot" });
    if (error) throw new Error(`pc6_energy_stats upsert failed: ${error.message}`);
    written += batch.length;
    if (PAUSE_MS > 0) await sleep(PAUSE_MS);
  }
  return written;
}

async function main(): Promise<void> {
  const { sources, year, peildatum, reset } = parseArgs(process.argv.slice(2));
  if (sources.length === 0) {
    console.error("❌  No sources. Pass --source <netbeheerder>=<url> (repeatable) or --config <file.json>.");
    process.exit(1);
  }

  console.log(`🔌  netbeheer-ingest — ${sources.length} source(s), year=${year ?? "—"}, peildatum=${peildatum ?? "—"}`);
  const done = loadDone(reset);
  let totalRows = 0;

  for (const src of sources) {
    if (done.has(src.netbeheerder)) { console.log(`  ⏭  ${src.netbeheerder} — already done (resume)`); continue; }
    process.stdout.write(`  ⏳  ${src.netbeheerder} … downloading`);
    try {
      const text = await download(src.url);
      const raw  = parseNetbeheerCsv(text);
      const rows = pivotNetbeheerRows(raw, src.netbeheerder, { sourceYear: year, peildatum });
      process.stdout.write(` — parsed ${raw.length}, pivoted ${rows.length} — upserting`);
      const written = await upsertBatch(rows as unknown as Record<string, unknown>[]);
      totalRows += written;
      done.add(src.netbeheerder);
      saveDone(done);
      console.log(` ✅  ${written} rows`);
    } catch (err) {
      console.log(` ❌  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n[netbeheer-ingest] done — ${done.size} netbeheerder(s), ${totalRows} rows upserted.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
