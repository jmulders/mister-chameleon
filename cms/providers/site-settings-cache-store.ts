/**
 * Durable site-settings cache (Supabase-backed)
 *
 * Persists the last-known-good resolved SiteSettingsData (header/footer/nav/logo)
 * per tenant + locale, so the public site chrome has a fallback that survives:
 *   • cold serverless lambdas (in-memory Map starts empty)
 *   • Next Data Cache resets (e.g. a cache-key bump on deploy)
 *   • a transiently slow / restarting CMS instance
 *
 * Written on every COMPLETE fetch; read only on the degraded path in
 * cached-cms-provider. This is what stops the "navigation flip-flop" where the
 * nav + logo fall back to the Statamic starter defaults.
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

/** Upsert the last-known-good site settings. Best-effort, never throws. */
export async function persistSiteSettings(
  tenantId: string | null,
  locale: string,
  settings: SiteSettingsData,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getDb() as any)
      .from(TABLE)
      .upsert(
        { tenant_id: key(tenantId), locale, settings, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,locale" },
      );
  } catch (err) {
    logger.warn("[site-settings-cache] write failed", { error: String(err) });
  }
}
