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
 *
 * ─── Runtime reads: allowUnknownVariantKeys ───────────────────────────────────
 *
 *   Per-request read paths do NOT fetch the CMS catalogue (that would put a CMS
 *   round trip on every pageview). They pass `{ allowUnknownVariantKeys: true }`
 *   so a hero / proof / cta key outside the platform allow-list does not reject
 *   the whole config. Those keys were validated with the catalogue at save time.
 */

import { getDb }                from "@/data/db";
import { unstable_cache }       from "next/cache";
import {
  validateStoredConfig,
  type ExtraAllowedKeys,
  type StoredRulesConfig,
  type ValidateStoredConfigOptions,
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
 *
 * ─── Multi-tenant safety (defense in depth) ───────────────────────────────────
 *
 *   The cache is keyed per tenant (tenantId is a keyPart AND the invalidation
 *   tag is tenant-scoped), so two tenants can never share a cache entry by
 *   construction. But a cross-tenant leak is the worst possible bug here — it is
 *   silent and throws no error — so we do not rely on the key alone. The cached
 *   read also returns the row's own stored `key`, and we assert it matches the
 *   tenant we were asked about BEFORE returning. If a cache entry were ever
 *   mis-keyed, this turns "tenant A sees tenant B's rules" into a safe null
 *   (→ default experience) plus a loud log, instead of a leak nobody notices.
 */
function readRawTenantConfig(tenantId: string): Promise<Record<string, unknown> | null> {
  const expectedKey = tenantRulesConfigKey(tenantId);

  return unstable_cache(
    async () => {
      try {
        const { data, error } = asSingle<{ config: Record<string, unknown>; key: string }>(
          await getDb()
            .from("rules_config")
            .select("config, key")
            .eq("key", expectedKey)
            .maybeSingle(),
        );
        if (error || !data) return null;
        // Carry the row's own key through the cache boundary so the caller can
        // verify tenant ownership even on a cache hit.
        return { config: data.config, key: data.key };
      } catch {
        return null;
      }
    },
    ["rules-config", tenantId],
    { tags: [tenantRulesCacheTag(tenantId)], revalidate: 120 },
  )().then((row) => {
    if (!row) return null;

    // Ownership guard: never hand back a row whose stored key does not belong to
    // the tenant we were asked about. Under normal operation this is always
    // true; if it is ever false, the cache mis-served another tenant's entry and
    // we refuse to return it.
    if (row.key !== expectedKey) {
      // eslint-disable-next-line no-console
      console.error(
        `[load-tenant-rules] cross-tenant cache key mismatch: asked for "${expectedKey}", ` +
          `cache returned "${row.key}". Serving default (no rules) for safety.`,
      );
      return null;
    }

    return row.config as Record<string, unknown>;
  });
}

/**
 * Validate a raw stored config and return it typed, or null when it fails.
 * Pure (no I/O); the validation half of loadTenantRulesConfig.
 */
export function parseStoredTenantRulesConfig(
  raw:        unknown,
  extraKeys?: ExtraAllowedKeys,
  options?:   ValidateStoredConfigOptions,
): StoredRulesConfig | null {
  if (!raw) return null;
  const errors = validateStoredConfig(raw, extraKeys, options);
  if (errors.length > 0) return null;
  return raw as StoredRulesConfig;
}

/**
 * @param options  Pass `{ allowUnknownVariantKeys: true }` on RUNTIME READS and
 *                 admin read-modify-write paths. The hero / proof / cta keys of
 *                 a saved config may be CMS variants that were validated against
 *                 the CMS catalogue at save time; without that catalogue a strict
 *                 read rejects the whole config and returns null, which made the
 *                 request paths serve the platform's runtime-rules.json (and
 *                 ignore the tenant's rulesEnabled=false) and made admin writes
 *                 lose the existing flag/rules. Structure stays strictly checked.
 */
export async function loadTenantRulesConfig(
  tenantId:   string,
  extraKeys?: { heroKeys: string[]; proofKeys: string[]; ctaKeys: string[] },
  options?:   ValidateStoredConfigOptions,
): Promise<StoredRulesConfig | null> {
  if (!tenantId) return null;

  const raw = await readRawTenantConfig(tenantId);
  if (!raw) return null;

  return parseStoredTenantRulesConfig(raw, extraKeys, options);
}
