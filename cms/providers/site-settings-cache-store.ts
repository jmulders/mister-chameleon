/**
 * Durable site-settings cache (Supabase-backed)
 *
 * Persists the last-known-good resolved SiteSettingsData (header/footer/nav/logo)
 * per tenant + locale, so the public site chrome has a fallback that survives:
 *   • cold serverless lambdas (in-memory Map starts empty)
 *   • Next Data Cache resets (e.g. a cache-key bump on deploy)
 *   • a transiently slow / restarting CMS instance
 *
 * Written when a COMPLETE fetch differs from what this instance last wrote;
 * read only on the degraded path in cached-cms-provider. This is what stops the
 * "navigation flip-flop" where the nav + logo fall back to the Statamic starter
 * defaults.
 */

import "server-only";
import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";
import type { SiteSettingsData } from "@/cms/types";

const TABLE = "tenant_site_settings_cache";
const key   = (tenantId: string | null) => tenantId ?? "_";

/** Read the persisted last-known-good site settings, or null when absent. */
export async function readPersistedSiteSettings(
  tenantId: string | null,
  locale: string,
): Promise<SiteSettingsData | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (getDb() as any)
      .from(TABLE)
      .select("settings")
      .eq("tenant_id", key(tenantId))
      .eq("locale", locale)
      .maybeSingle()) as {
        data: { settings: SiteSettingsData } | null;
        error: { message: string } | null;
      };
    if (error || !data) return null;
    return data.settings ?? null;
  } catch (err) {
    logger.warn("[site-settings-cache] read failed", { error: String(err) });
    return null;
  }
}

// ── Write guard ───────────────────────────────────────────────────────────────
//
// The caller runs on every page render and used to write the whole settings
// object each time. Measured on production from 27 May to 13 Nov 2026: 21,036
// writes for 26,537 page views, 575 seconds of database time and 171 MB of
// write-ahead log, almost all of it rewriting a row with the content it
// already had.
//
// The row is a fallback for a cold start. It only needs a write when the
// content changed, so this instance remembers what it wrote last.

/** A changed version is written at most this often per tenant + locale. */
export const PERSIST_CHANGED_EVERY_MS = 60_000;

interface LastWrite {
  serialized: string;
  at:         number;
}

const lastWritten = new Map<string, LastWrite>();

/**
 * True when `serialized` is worth writing: this instance has not written for
 * this key yet, or the content changed and the last write is at least
 * PERSIST_CHANGED_EVERY_MS ago. The interval bounds two versions that keep
 * alternating (an editor saving while an older copy is still cached).
 */
export function shouldPersistSiteSettings(cacheKey: string, serialized: string, nowMs: number): boolean {
  const last = lastWritten.get(cacheKey);
  if (!last) return true;
  if (last.serialized === serialized) return false;
  return nowMs - last.at >= PERSIST_CHANGED_EVERY_MS;
}

/** Forget what this instance wrote. For tests. */
export function resetSiteSettingsWriteGuard(): void {
  lastWritten.clear();
}

export interface SiteSettingsCacheRow {
  tenant_id:  string;
  locale:     string;
  settings:   SiteSettingsData;
  updated_at: string;
}

/** Writes one row and reports a database error instead of throwing it. */
export type SiteSettingsCacheWriter =
  (row: SiteSettingsCacheRow) => Promise<{ error: { message: string } | null }>;

const writeToDatabase: SiteSettingsCacheWriter = async (row) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = (await (getDb() as any)
    .from(TABLE)
    .upsert(row, { onConflict: "tenant_id,locale" })) as { error: { message: string } | null };
  return { error };
};

/**
 * Upsert the last-known-good site settings when they changed. Best-effort,
 * never throws. `write` and `nowMs` exist for tests.
 */
export async function persistSiteSettings(
  tenantId: string | null,
  locale: string,
  settings: SiteSettingsData,
  write: SiteSettingsCacheWriter = writeToDatabase,
  nowMs: number = Date.now(),
): Promise<void> {
  const cacheKey = `${key(tenantId)}:${locale}`;

  let serialized: string;
  try {
    serialized = JSON.stringify(settings);
  } catch {
    return; // not serialisable, so it could not be stored either
  }
  if (!shouldPersistSiteSettings(cacheKey, serialized, nowMs)) return;

  // Claim the write before awaiting, so renders that run at the same moment do
  // not all write the same row.
  const previous = lastWritten.get(cacheKey);
  lastWritten.set(cacheKey, { serialized, at: nowMs });

  try {
    const { error } = await write({
      tenant_id:  key(tenantId),
      locale,
      settings,
      updated_at: new Date(nowMs).toISOString(),
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    // Give the claim back so the next render tries again.
    if (previous) lastWritten.set(cacheKey, previous);
    else lastWritten.delete(cacheKey);
    logger.warn("[site-settings-cache] write failed", { error: String(err) });
  }
}
