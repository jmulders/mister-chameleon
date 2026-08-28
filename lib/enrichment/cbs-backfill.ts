/**
 * lib/enrichment/cbs-backfill.ts
 *
 * Optional, resumable, throttled BACKFILL of cbs_area_stats — proactively fills
 * the buurt table so the lazy per-request fetch (cbs-location stage) mostly hits
 * the cache. This is a script/admin job, NOT the request path and NOT the 60s
 * cron.
 *
 * Strategy (the only bulk-ish shape CBS OData v3 honours): fetch by a single
 * `startswith(WijkenEnBuurten,'BU{prefix}')` predicate + $select, per gemeente
 * prefix bucket "BU00".."BU19" (2-digit). Each bucket is well under CBS's ~10k
 * cap. If a bucket ever hits the cap, it splits one digit deeper ("BU03" →
 * "BU030".."BU039") — adaptively, to arbitrary depth. Upsert is idempotent
 * (onConflict area_code), so re-running is safe; the runner persists which
 * top-level prefixes are done for resumability.
 *
 * Core logic is pure (injected fetch/upsert/pause) so it is unit-testable; the
 * runner (scripts/cbs-backfill.ts) supplies the real Supabase upsert, pacing,
 * and progress file.
 */

import {
  fetchCbsPrefix, mapCbsRow, CBS_BUCKET_CAP, DEFAULT_CBS_DATASET,
} from "./cbs-ingest";

/** Default top-level gemeente prefixes: BU00 .. BU19. */
export const DEFAULT_BACKFILL_PREFIXES: string[] =
  Array.from({ length: 20 }, (_, i) => `BU${String(i).padStart(2, "0")}`);

/** Max buurtcode digit depth (BU + 8 digits) — the split recursion bound. */
const MAX_PREFIX_DIGITS = 8;

export interface BackfillDeps {
  /** Fetch rows for a prefix (default: CBS OData). */
  fetchPrefix?: (datasetId: string, prefix: string) => Promise<Record<string, unknown>[]>;
  /** Upsert mapped rows into cbs_area_stats; returns how many were written. */
  upsert: (rows: Record<string, unknown>[]) => Promise<number>;
  /** Throttle between CBS calls (default: no-op). */
  pause?: () => Promise<void>;
  /** Per-bucket callback for logging / progress. */
  onBucket?: (info: { prefix: string; fetched: number; upserted: number; split: boolean }) => void;
}

export interface BackfillOptions extends BackfillDeps {
  datasetId?:  string;
  sourceYear?: number;
  /** Top-level prefixes to process (default BU00..BU19). Pass a subset to resume. */
  prefixes?:   string[];
}

export interface BackfillTotals { fetched: number; upserted: number; buckets: number; }

const digitsOf = (prefix: string): number => prefix.replace(/^BU/, "").length;

/**
 * Process one prefix bucket, splitting one digit deeper when it hits the cap.
 * Returns the fetched/upserted totals for the whole subtree.
 */
export async function backfillPrefix(
  prefix: string,
  opts: BackfillOptions,
): Promise<BackfillTotals> {
  const datasetId  = opts.datasetId ?? DEFAULT_CBS_DATASET;
  const sourceYear = opts.sourceYear ?? 0;
  const fetchPrefix = opts.fetchPrefix ?? ((ds, p) => fetchCbsPrefix(ds, p));
  const pause = opts.pause ?? (async () => {});

  const rows = await fetchPrefix(datasetId, prefix);

  // Cap hit and we can still narrow → split one digit deeper.
  if (rows.length >= CBS_BUCKET_CAP && digitsOf(prefix) < MAX_PREFIX_DIGITS) {
    opts.onBucket?.({ prefix, fetched: rows.length, upserted: 0, split: true });
    let totals: BackfillTotals = { fetched: 0, upserted: 0, buckets: 0 };
    for (let d = 0; d <= 9; d++) {
      await pause();
      const sub = await backfillPrefix(`${prefix}${d}`, opts);
      totals = {
        fetched:  totals.fetched  + sub.fetched,
        upserted: totals.upserted + sub.upserted,
        buckets:  totals.buckets  + sub.buckets,
      };
    }
    return totals;
  }

  const mapped = rows
    .map((r) => mapCbsRow(r, sourceYear, datasetId))
    .filter((r): r is NonNullable<typeof r> => r != null);
  const upserted = mapped.length > 0 ? await opts.upsert(mapped) : 0;
  opts.onBucket?.({ prefix, fetched: rows.length, upserted, split: false });
  return { fetched: rows.length, upserted, buckets: 1 };
}

/**
 * Backfill all (or a resumed subset of) top-level prefixes. `onPrefixDone` fires
 * after each top-level prefix so the runner can persist progress.
 */
export async function backfillCbs(
  opts: BackfillOptions & { onPrefixDone?: (prefix: string) => void },
): Promise<BackfillTotals> {
  const prefixes = opts.prefixes ?? DEFAULT_BACKFILL_PREFIXES;
  const pause = opts.pause ?? (async () => {});
  let totals: BackfillTotals = { fetched: 0, upserted: 0, buckets: 0 };

  for (const prefix of prefixes) {
    await pause();
    const sub = await backfillPrefix(prefix, opts);
    totals = {
      fetched:  totals.fetched  + sub.fetched,
      upserted: totals.upserted + sub.upserted,
      buckets:  totals.buckets  + sub.buckets,
    };
    opts.onPrefixDone?.(prefix);
  }
  return totals;
}
