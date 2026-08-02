/**
 * Retention Policy Store — per-tenant post-termination deletion window.
 *
 * After a tenant cancels, their personal data (visitor profiles etc.) must be
 * deleted within an agreed window. The AVG default is 30 days; a tenant can
 * agree a different window, effective from a given date (so a change is
 * auditable and doesn't silently apply retroactively).
 *
 * This is a governance record, not an automated deletion trigger: it captures
 * the agreed term so the DPA can reference it and an operator can honour it.
 * (Live profiles already auto-expire on a rolling 90-day window regardless.)
 *
 * Storage: reuses the generic per-tenant `rules_config` key/value table under
 * the key "retention_<tenantId>" — no migration needed. Reads/writes never
 * throw; a missing row yields the 30-day default.
 */

import "server-only";

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

/** AVG-aligned default deletion window after termination, in days. */
export const DEFAULT_POST_TERMINATION_DELETION_DAYS = 30;
/** Guardrails on the configurable window. */
export const MIN_DELETION_DAYS = 1;
export const MAX_DELETION_DAYS = 3650; // 10 years

export interface RetentionPolicy {
  /** Days after termination within which personal data is deleted. */
  postTerminationDeletionDays: number;
  /** ISO date from which this term takes effect; null = applies immediately. */
  effectiveFrom: string | null;
  /** Last update timestamp (ISO), or null when never set (using the default). */
  updatedAt: string | null;
}

function retentionKey(tenantId: string): string {
  return `retention_${tenantId}`;
}

function defaultPolicy(): RetentionPolicy {
  return {
    postTerminationDeletionDays: DEFAULT_POST_TERMINATION_DELETION_DAYS,
    effectiveFrom: null,
    updatedAt: null,
  };
}

type SingleResult<T> = { data: T | null; error: { message: string } | null };
function asSingle<T>(result: unknown): SingleResult<T> { return result as SingleResult<T>; }

/**
 * Read the retention policy for a tenant. Returns the 30-day default when no
 * policy has been set. Never throws.
 */
export async function getRetentionPolicy(tenantId: string): Promise<RetentionPolicy> {
  if (!tenantId) return defaultPolicy();

  try {
    const { data, error } = asSingle<{ config: Partial<RetentionPolicy> }>(
      await getDb()
        .from("rules_config")
        .select("config")
        .eq("key", retentionKey(tenantId))
        .maybeSingle(),
    );
    if (error || !data?.config) return defaultPolicy();

    const cfg = data.config;
    const days = Number(cfg.postTerminationDeletionDays);
    return {
      postTerminationDeletionDays:
        Number.isFinite(days) && days >= MIN_DELETION_DAYS && days <= MAX_DELETION_DAYS
          ? Math.round(days)
          : DEFAULT_POST_TERMINATION_DELETION_DAYS,
      effectiveFrom: typeof cfg.effectiveFrom === "string" ? cfg.effectiveFrom : null,
      updatedAt: typeof cfg.updatedAt === "string" ? cfg.updatedAt : null,
    };
  } catch (err) {
    logger.warn("[retention] getRetentionPolicy failed", {
      tenantId, err: err instanceof Error ? err.message : String(err),
    });
    return defaultPolicy();
  }
}

/**
 * Write the retention policy for a tenant. Validates the window against the
 * guardrails. Returns ok/error, never throws.
 */
export async function setRetentionPolicy(
  tenantId: string,
  input: { postTerminationDeletionDays: number; effectiveFrom: string | null },
): Promise<{ ok: true; policy: RetentionPolicy } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "tenantId must be a non-empty string" };

  const days = Math.round(Number(input.postTerminationDeletionDays));
  if (!Number.isFinite(days) || days < MIN_DELETION_DAYS || days > MAX_DELETION_DAYS) {
    return { ok: false, error: `Deletion window must be between ${MIN_DELETION_DAYS} and ${MAX_DELETION_DAYS} days.` };
  }

  // effectiveFrom, when present, must be a valid ISO date.
  let effectiveFrom: string | null = null;
  if (input.effectiveFrom) {
    const d = new Date(input.effectiveFrom);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "effectiveFrom must be a valid date." };
    effectiveFrom = d.toISOString().slice(0, 10); // store as YYYY-MM-DD
  }

  const policy: RetentionPolicy = {
    postTerminationDeletionDays: days,
    effectiveFrom,
    updatedAt: new Date().toISOString(),
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getDb() as any)
      .from("rules_config")
      .upsert(
        { key: retentionKey(tenantId), config: policy, updated_at: policy.updatedAt },
        { onConflict: "key" },
      ) as { error: { message: string } | null };

    if (error) return { ok: false, error: `Failed to save retention policy: ${error.message}` };
    return { ok: true, policy };
  } catch (err) {
    return { ok: false, error: `Failed to save retention policy: ${err instanceof Error ? err.message : String(err)}` };
  }
}
