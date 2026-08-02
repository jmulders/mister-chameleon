/**
 * Load Tenant Rules
 *
 * Shared utility that reads a tenant's rules configuration from the
 * `rules_config` Supabase table.  Used by:
 *
 *   • app/(site)/page.tsx — supplies DB-backed config to RulesDecisionProvider
 *   • tenant rules actions.ts — re-used as the authoritative read path
 *
 * ─── Storage key convention ────────────────────────────────────────────────────
 *
 *   Per-tenant:  key = "homepage_<tenantId>"
 *   Global:      key = "homepage"   (legacy dashboard — not read here)
 *
 * ─── Fallback behaviour ───────────────────────────────────────────────────────
 *
 *   Returns null when:
 *     • No row exists for this tenant yet (first visit before the admin saves).
 *     • The stored config fails schema validation.
 *     • Any DB error occurs.
 *
 *   The caller decides what to do with null — typically fall back to
 *   SEED_RULES_CONFIG or the file-based runtime-rules.json.
 *
 * ─── extraKeys ────────────────────────────────────────────────────────────────
 *
 *   Pass `extraKeys` (CMS-sourced variant keys from fetchVariantCatalogue) so
 *   that rules containing CMS-defined variant keys pass validation on read —
 *   symmetric with the write path in saveTenantRulesAction.
 *
 *   When omitted, only platform-defined ALLOWED_*_KEYS are accepted.
 */

import { getDb }                from "@/data/db";
import { unstable_cache }       from "next/cache";
import {
  validateStoredConfig,
  type StoredRulesConfig,
}                               from "./stored-rule";

// ── Key helpers ──────────────────────────────────────────────────────────────────

export function tenantRulesConfigKey(tenantId: string): string {
  return `homepage_${tenantId}`;
}

/**
 * Cache tag for a tenant's rules config. The decide endpoint runs once per
 * pageview, so without a cache every pageview was a DB read. This tag lets the
 * raw config be cached and invalidated the instant a rule is saved (the save
 * actions call revalidateTag with this), so reads stay off the database on the
 * hot path without ever serving stale rules after an edit.
 */
export function tenantRulesCacheTag(tenantId: string): string {
  return `rules-config:${tenantId}`;
}

// ── Typed DB cast helper ────────────────────────────────────────────────────────
//
// The hand-authored Database type resolves the select result to `never` due to
// missing PostgrestVersion discriminant; cast through unknown to get the shape
// we need without unsafe coercion at runtime.

type SingleResult<T> = { data: T | null; error: { message: string } | null };
function asSingle<T>(result: unknown): SingleResult<T> { return result as SingleResult<T>; }

// ── Loader ─────────────────────────────────────────────────────────────────────

/**
 * Load the stored rules configuration for a specific tenant.
 *
 * Returns the validated StoredRulesConfig, or null when no config exists or
 * the stored data fails validation.  Never throws.
 *
 * @param tenantId  The tenant whose rules row to read.
 * @param extraKeys Optional CMS-sourced variant keys (from fetchVariantCatalogue).
 *                  When provided, the validator accepts these keys in addition to
 *                  the platform-defined ALLOWED_*_KEYS — matching the write path
 *                  in saveTenantRulesAction so CMS variants don't fail validation.
 */
/**
 * Cached raw read of the tenant's rules_config row (the DB part only).
 * Validation runs OUTSIDE the cache because it depends on the caller's extraKeys
 * and is cheap CPU with no I/O. Keyed per tenant, tagged for instant
 * invalidation on save, with a short TTL backstop for direct DB edits.
 */
function readRawTenantConfig(tenantId: string): Promise<Record<string, unknown> | null> {
  return unstable_cache(
    async () => {
      try {
        const { data, error } = asSingle<{ config: Record<string, unknown> }>(
          await getDb()
            .from("rules_config")
            .select("config")
            .eq("key", tenantRulesConfigKey(tenantId))
            .maybeSingle(),
        );
        if (error || !data) return null;
        return data.config as Record<string, unknown>;
      } catch {
        return null;
      }
    },
    ["rules-config", tenantId],
    { tags: [tenantRulesCacheTag(tenantId)], revalidate: 120 },
  )();
}

export async function loadTenantRulesConfig(
  tenantId: string,
  extraKeys?: { heroKeys: string[]; proofKeys: string[]; ctaKeys: string[] },
): Promise<StoredRulesConfig | null> {
  if (!tenantId) return null;

  const raw = await readRawTenantConfig(tenantId);
  if (!raw) return null;

  const errors = validateStoredConfig(raw as unknown, extraKeys);
  if (errors.length > 0) return null;

  return raw as unknown as StoredRulesConfig;
}
