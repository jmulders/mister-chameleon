/**
 * Self-Service Store — per-tenant self-service mode flag.
 *
 * When ON, a tenant (or admin) opts into self-service authoring features
 * (e.g. writing their own variant copy) rather than the agency-led default.
 * Default is OFF: the platform is agency-led unless a tenant explicitly turns
 * this on. Other features can gate on `isSelfServiceEnabled(tenantId)`.
 *
 * Storage: reuses the generic per-tenant `rules_config` key/value table under
 * "self_service_<tenantId>" — no migration needed. Never throws; a missing row
 * means OFF.
 */

import "server-only";

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

function selfServiceKey(tenantId: string): string {
  return `self_service_${tenantId}`;
}

type SingleResult<T> = { data: T | null; error: { message: string } | null };
function asSingle<T>(result: unknown): SingleResult<T> { return result as SingleResult<T>; }

/** Read the self-service flag for a tenant. Defaults to false. Never throws. */
export async function isSelfServiceEnabled(tenantId: string): Promise<boolean> {
  if (!tenantId) return false;
  try {
    const { data, error } = asSingle<{ config: { enabled?: boolean } }>(
      await getDb()
        .from("rules_config")
        .select("config")
        .eq("key", selfServiceKey(tenantId))
        .maybeSingle(),
    );
    if (error || !data?.config) return false;
    return data.config.enabled === true;
  } catch (err) {
    logger.warn("[self-service] read failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Set the self-service flag for a tenant. Never throws (returns ok/error). */
export async function setSelfServiceEnabled(
  tenantId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "tenantId must be a non-empty string" };
  try {
    const updatedAt = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getDb() as any)
      .from("rules_config")
      .upsert(
        { key: selfServiceKey(tenantId), config: { enabled, updatedAt }, updated_at: updatedAt },
        { onConflict: "key" },
      ) as { error: { message: string } | null };
    if (error) return { ok: false, error: `Failed to save self-service flag: ${error.message}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Failed to save self-service flag: ${err instanceof Error ? err.message : String(err)}` };
  }
}
