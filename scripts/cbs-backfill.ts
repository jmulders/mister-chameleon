/**
 * scripts/cbs-backfill.ts
 *
 * Resumable, throttled backfill of public.cbs_area_stats from CBS StatLine
 * (dataset 85984NED by default). Proactively fills the buurt table so the
 * lazy per-request fetch (cbs-location enricher) mostly hits the cache.
 *
 * Usage:
 *   npm run cbs:backfill                # all prefixes (resumes from progress file)
 *   npm run cbs:backfill -- --reset     # ignore progress and start over
 *   CBS_DATASET=85984NED CBS_YEAR=2024 npm run cbs:backfill
 *
 * Resumability: completed top-level prefixes are written to
 * .cbs-backfill-progress.json; a re-run skips them. Upsert is idempotent, so a
 * re-run is always safe.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import * as fs     from "fs";
import * as path   from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { backfillCbs, DEFAULT_BACKFILL_PREFIXES } from "../lib/enrichment/cbs-backfill";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_KEY  = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const DATASET   = process.env["CBS_DATASET"]?.trim() || "85984NED";
const YEAR      = Number(process.env["CBS_YEAR"] ?? new Date().getUTCFullYear());
const RESET     = process.argv.includes("--reset");
const PROGRESS  = path.resolve(process.cwd(), ".cbs-backfill-progress.json");
const PAUSE_MS  = Number(process.env["CBS_PAUSE_MS"] ?? 750); // 500–1000ms recommended

const client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function loadDone(): Set<string> {
  if (RESET) return new Set();
  try { return new Set(JSON.parse(fs.readFileSync(PROGRESS, "utf8")) as string[]); }
  catch { return new Set(); }
}
function saveDone(done: Set<string>): void {
  fs.writeFileSync(PROGRESS, JSON.stringify([...done], null, 2));
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function upsert(rows: Record<string, unknown>[]): Promise<number> {
  const BATCH = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((m) => ({ ...m, refreshed_at: new Date().toISOString() }));
    const { error } = await client.from("cbs_area_stats").upsert(batch, { onConflict: "area_code" });
    if (error) throw new Error(`cbs_area_stats upsert failed: ${error.message}`);
    written += batch.length;
  }
  return written;
}

async function main(): Promise<void> {
  const done = loadDone();
  const prefixes = DEFAULT_BACKFILL_PREFIXES.filter((p) => !done.has(p));
  console.log(`[cbs-backfill] dataset=${DATASET} year=${YEAR} remaining prefixes=${prefixes.length}/${DEFAULT_BACKFILL_PREFIXES.length}`);

  const totals = await backfillCbs({
    datasetId:  DATASET,
    sourceYear: YEAR,
    prefixes,
    upsert,
    pause: () => sleep(PAUSE_MS),
    onBucket: ({ prefix, fetched, upserted, split }) =>
      console.log(`  ${prefix.padEnd(10)} fetched=${fetched} upserted=${upserted}${split ? " (split)" : ""}`),
    onPrefixDone: (prefix) => { done.add(prefix); saveDone(done); },
  });

  console.log(`[cbs-backfill] done — buckets=${totals.buckets} fetched=${totals.fetched} upserted=${totals.upserted}`);
}

main().catch((err) => { console.error("[cbs-backfill] failed:", err); process.exit(1); });
