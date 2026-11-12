/**
 * Durable host → tenant resolution cache (Supabase-backed)
 *
 * Persists the last-known-good resolved TenantSettings per public host, so the
 * request tenant resolver has a durable fallback that survives:
 *   • cold serverless lambdas (the in-memory lastGoodTenantByHost starts empty)
 *   • Next Data Cache resets (revalidateTag(TENANT_RENDER_CACHE_TAG) fires on
 *     every tenant save — which the user does constantly while editing design)
 *   • a transiently slow / restarting database
 *
 * Written on every SUCCESSFUL store-based domain match; read only on the
 * degraded path in get-active-tenant, BEFORE falling back to FALLBACK_TENANT.
 * A host → tenant mapping is stable, so the persisted value is always correct.
 *
 * This is the tenant-resolution twin of cms/providers/site-settings-cache-store:
 * together they stop the "navigation flip-flop" between the real site and the
 * platform-default (mister-chameleon) nav.
 */

import "server-only";
import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";
import type { TenantSettings } from "@/tenant/types";

const TABLE = "tenant_host_resolution_cache";
const norm  = (host: string) => host.toLowerCase().trim();

/** Read the persisted last-known-good tenant settings for a host, or null. */
export async function readPersistedHostTenant(
  host: string,
): Promise<TenantSettings | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (getDb() as any)
      .from(TABLE)
      .select("settings")
      .eq("host", norm(host))
      .maybeSingle()) as {
        data: { settings: TenantSettings } | null;
        error: { message: string } | null;
      };
    if (error || !data) return null;
    return data.settings ?? null;
  } catch (err) {
    logger.warn("[host-resolution-cache] read failed", { error: String(err) });
    return null;
  }
}

/** When each host was last written by this instance. */
const lastPersistedAt = new Map<string, number>();
const PERSIST_EVERY_MS = 60_000;

/**
 * Upsert the last-known-good tenant settings for a host. Best-effort, never throws.
 *
 * At most once a minute per host and instance. The caller runs on every tenant
 * resolution, about nine times in one page render, and each call used to write
 * the tenant's whole settings object. The row is a fallback for a cold start,
 * so a copy that is a minute old serves it just as well.
 */
export async function persistHostTenant(
  host: string,
  settings: TenantSettings,
): Promise<void> {
  const key = norm(host);
  const now = Date.now();
  const last = lastPersistedAt.get(key);
  if (last !== undefined && now - last < PERSIST_EVERY_MS) return;
  lastPersistedAt.set(key, now);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getDb() as any)
      .from(TABLE)
      .upsert(
        { host: norm(host), settings, updated_at: new Date().toISOString() },
        { onConflict: "host" },
      );
  } catch (err) {
    lastPersistedAt.delete(key); // let the next call try again
    logger.warn("[host-resolution-cache] write failed", { error: String(err) });
  }
}
