/**
 * lib/cron/daily-run-store.ts
 *
 * Where the outcome of the last daily cron run is kept: one row in
 * `platform_settings`, replaced on every run. The system page in the platform
 * admin reads it back.
 */

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";
import type { DailyRunRecord } from "./daily-run";

export const DAILY_RUN_KEY = "cron_daily_last_run";

/** Does this look like a run record? A row somebody edited by hand may not. */
export function isDailyRunRecord(value: unknown): value is DailyRunRecord {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v["startedAt"] === "string"
    && typeof v["finishedAt"] === "string"
    && typeof v["ok"] === "boolean"
    && Array.isArray(v["results"]);
}

/** Write the run down. Never throws: a cron that ran must not fail on its diary. */
export async function saveDailyRun(record: DailyRunRecord): Promise<boolean> {
  try {
    // platform_settings Insert resolves to never in the hand-authored Database
    // type (same pattern as platform-store.ts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getDb() as any)
      .from("platform_settings")
      .upsert(
        { key: DAILY_RUN_KEY, value: record, updated_at: record.finishedAt },
        { onConflict: "key" },
      ) as { error: { message: string } | null };
    if (error) {
      logger.warn("[cron/daily] could not record the run", { error: error.message });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn("[cron/daily] could not record the run", { error: String(err) });
    return false;
  }
}

/** The last recorded run, or null when there is none or it cannot be read. */
export async function readDailyRun(): Promise<DailyRunRecord | null> {
  try {
    const { data, error } = await getDb()
      .from("platform_settings")
      .select("value")
      .eq("key", DAILY_RUN_KEY)
      .maybeSingle() as { data: { value: unknown } | null; error: { message: string } | null };
    if (error || !data) return null;
    return isDailyRunRecord(data.value) ? data.value : null;
  } catch {
    return null;
  }
}
