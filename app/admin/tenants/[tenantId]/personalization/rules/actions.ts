/**
 * Tenant-scoped Rules Actions
 *
 * Thin wrappers around the shared rules_config table that scope every read and
 * write to a per-tenant key ("homepage_<tenantId>") instead of the global
 * "homepage" key used by the dashboard editor.
 *
 * ─── Storage key convention ───────────────────────────────────────────────────
 *
 *   Global (legacy dashboard):  key = "homepage"
 *   Per-tenant (admin workspace): key = "homepage_<tenantId>"
 *
 *   No schema change is required — the existing `rules_config` table stores
 *   arbitrary text keys.  The per-tenant keys are simply namespaced by tenant
 *   slug and never collide with the global key.
 *
 * ─── Safety model ────────────────────────────────────────────────────────────
 *
 *   All writes go through validateStoredConfig() — same whitelist validation as
 *   the global actions.  The tenantId param is validated to be a non-empty
 *   string before any DB access.
 */

"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  type StoredRulesConfig,
  validateStoredConfig,
  SEED_RULES_CONFIG,
} from "@/decision/rules/stored-rule";
import { loadTenantRulesConfig, tenantRulesConfigKey, tenantRulesCacheTag } from "@/decision/rules/load-tenant-rules";
import { generatePresetRulesConfig, mergePresetRules } from "@/decision/rules/generate-preset-rules";
import { getDb } from "@/data/db";
import { fetchVariantCatalogue } from "@/decision/rules/fetch-variant-catalogue";

// ── Typed query helpers ────────────────────────────────────────────────────────
//
// The hand-authored Database type lacks the PostgrestVersion discriminant that
// the Supabase v2 client requires, so both .select() (returns never) and
// .upsert() (expects never) fail in strict mode.  Cast through unknown to
// give TypeScript the shapes it needs without any unsafe coercion at runtime.

type SingleResult<T> = { data: T | null; error: { message: string } | null };
function asSingle<T>(result: unknown): SingleResult<T> { return result as SingleResult<T>; }

// ── Key helper ─────────────────────────────────────────────────────────────────

/** Returns the rules_config table key for a given tenant. */
function tenantRulesKey(tenantId: string): string {
  return `homepage_${tenantId}`;
}

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * Load the rules configuration for a specific tenant.
 * Falls back to SEED_RULES_CONFIG when no row exists yet so the editor always
 * has something sensible to display on first load.
 *
 * Validation uses the same CMS variant extraKeys as the save path so that
 * configs containing CMS-sourced variant keys (e.g. Sanity heroVariant docs)
 * pass validation on read just as they did on write.
 */
export async function getTenantRulesAction(tenantId: string): Promise<{
  ok:     true;
  config: StoredRulesConfig;
} | {
  ok:    false;
  error: string;
}> {
  if (!tenantId) {
    return { ok: false, error: "tenantId must be a non-empty string" };
  }

  const key = tenantRulesKey(tenantId);

  // Fetch DB row and CMS catalogue in parallel — the catalogue is needed so
  // that the read-side validation accepts the same variant keys as the write.
  const [result, catalogue] = await Promise.all([
    asSingle<{ config: Record<string, unknown> }>(
      getDb()
        .from("rules_config")
        .select("config")
        .eq("key", key)
        .maybeSingle(),
    ),
    fetchVariantCatalogue(tenantId),
  ]);

  const { data, error } = result;

  if (error) {
    const message = error.message;
    console.error(`[tenant-rules-actions] Failed to read rules for "${tenantId}":`, message);
    return { ok: false, error: `Failed to read rules: ${message}` };
  }

  if (!data) {
    // No row yet — return seed so the editor shows defaults on first visit.
    return { ok: true, config: SEED_RULES_CONFIG };
  }

  // Use the same extraKeys as the save path for consistent validation.
  const extraKeys = {
    heroKeys:  catalogue.hero.filter((e) => e.source !== "platform").map((e) => e.key),
    proofKeys: catalogue.proof.filter((e) => e.source !== "platform").map((e) => e.key),
    ctaKeys:   catalogue.cta.filter((e) => e.source !== "platform").map((e) => e.key),
  };

  const raw = data.config as unknown;
  const errors = validateStoredConfig(raw, extraKeys);

  if (errors.length > 0) {
    // Row is corrupt — return seed so the editor can recover.
    console.warn(
      `[tenant-rules-actions] rules_config row for "${tenantId}" failed validation; using seed:`,
      errors,
    );
    return { ok: true, config: SEED_RULES_CONFIG };
  }

  return { ok: true, config: raw as StoredRulesConfig };
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Validate and persist a rules configuration for a specific tenant.
 *
 * The `updatedAt` timestamp is always stamped server-side.
 * Returns `{ ok: true }` on success, or `{ ok: false, error }` on failure.
 */
export async function saveTenantRulesAction(
  tenantId: string,
  config:   unknown,
): Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: string[] }> {
  if (!tenantId) {
    return { ok: false, error: "tenantId must be a non-empty string" };
  }

  // Fetch CMS variant keys so the validator accepts CMS-created variants.
  const catalogue = await fetchVariantCatalogue(tenantId);
  const extraKeys = {
    heroKeys:  catalogue.hero.filter((e) => e.source !== "platform").map((e) => e.key),
    proofKeys: catalogue.proof.filter((e) => e.source !== "platform").map((e) => e.key),
    ctaKeys:   catalogue.cta.filter((e) => e.source !== "platform").map((e) => e.key),
  };

  // Validate first — reject anything that doesn't pass the whitelist checks.
  const errors = validateStoredConfig(config, extraKeys);
  if (errors.length > 0) {
    const messages = errors.map((e) =>
      e.ruleId ? `[${e.ruleId}] ${e.field}: ${e.message}` : `${e.field}: ${e.message}`,
    );
    return {
      ok:          false,
      error:       `Validation failed (${errors.length} error${errors.length === 1 ? "" : "s"}).`,
      fieldErrors: messages,
    };
  }

  // Preserve rulesEnabled from the existing DB config when the incoming config
  // doesn't include it (e.g. when the RulesEditor saves without knowing about
  // the global toggle — which is managed separately via GlobalRulesToggle).
  const incoming = config as StoredRulesConfig;
  let preservedRulesEnabled: boolean | undefined = incoming.rulesEnabled;

  if (preservedRulesEnabled === undefined) {
    const existing = await loadTenantRulesConfig(tenantId);
    if (existing?.rulesEnabled !== undefined) {
      preservedRulesEnabled = existing.rulesEnabled;
    }
  }

  // Stamp updatedAt server-side.
  const toWrite: StoredRulesConfig = {
    ...incoming,
    ...(preservedRulesEnabled !== undefined ? { rulesEnabled: preservedRulesEnabled } : {}),
    updatedAt: new Date().toISOString(),
  };

  const key = tenantRulesKey(tenantId);

  // TS2769: the hand-authored Database type resolves the Insert row to `never`;
  // same suppression used in app/dashboard/rules/actions.ts for the same table.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (getDb() as any)
    .from("rules_config")
    .upsert(
      {
        key,
        config:     toWrite as unknown as Record<string, unknown>,
        updated_at: toWrite.updatedAt,
      },
      { onConflict: "key" },
    ) as { error: { message: string } | null };

  if (error) {
    const message = (error as { message: string }).message;
    console.error(`[tenant-rules-actions] Failed to write rules for "${tenantId}":`, message);
    return { ok: false, error: `Failed to save rules: ${message}` };
  }

  revalidatePath(`/admin/tenants/${tenantId}/personalization/rules`);
  revalidateTag(tenantRulesCacheTag(tenantId), {});
  return { ok: true };
}

// ── Toggle global rules enabled ───────────────────────────────────────────────

/**
 * Set the tenant-level rules master switch (rulesEnabled).
 *
 * Reads the current config, flips rulesEnabled, and writes back.
 * When no config row exists yet, creates one from seed with the new flag.
 */
export async function setTenantRulesEnabledAction(
  tenantId: string,
  enabled:  boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) {
    return { ok: false, error: "tenantId must be a non-empty string" };
  }

  // Load existing config (or fall back to seed).
  const existing = await loadTenantRulesConfig(tenantId) ?? {
    ...SEED_RULES_CONFIG,
    updatedAt: new Date().toISOString(),
  };

  const toWrite: StoredRulesConfig = {
    ...existing,
    rulesEnabled: enabled,
    updatedAt:    new Date().toISOString(),
  };

  const key = tenantRulesKey(tenantId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (getDb() as any)
    .from("rules_config")
    .upsert(
      {
        key,
        config:     toWrite as unknown as Record<string, unknown>,
        updated_at: toWrite.updatedAt,
      },
      { onConflict: "key" },
    ) as { error: { message: string } | null };

  if (error) {
    return { ok: false, error: `Failed to update rules enabled flag: ${(error as { message: string }).message}` };
  }

  revalidatePath(`/admin/tenants/${tenantId}/personalization/rules`);
  revalidateTag(tenantRulesCacheTag(tenantId), {});
  return { ok: true };
}

// ── Reset ──────────────────────────────────────────────────────────────────────

/**
 * Reset a tenant's rules configuration to the seed (code-defined) defaults.
 * Overwrites the tenant's row in rules_config with SEED_RULES_CONFIG.
 */
export async function resetTenantRulesAction(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) {
    return { ok: false, error: "tenantId must be a non-empty string" };
  }

  const seed: StoredRulesConfig = {
    ...SEED_RULES_CONFIG,
    updatedAt: new Date().toISOString(),
  };

  const key = tenantRulesKey(tenantId);

  // TS2769: same suppression as saveTenantRulesAction — Database Insert = never.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (getDb() as any)
    .from("rules_config")
    .upsert(
      {
        key,
        config:     seed as unknown as Record<string, unknown>,
        updated_at: seed.updatedAt,
      },
      { onConflict: "key" },
    ) as { error: { message: string } | null };

  if (error) {
    return { ok: false, error: `Failed to reset rules: ${(error as { message: string }).message}` };
  }

  revalidatePath(`/admin/tenants/${tenantId}/personalization/rules`);
  revalidateTag(tenantRulesCacheTag(tenantId), {});
  return { ok: true };
}

// ── Seed preset rules ─────────────────────────────────────────────────────────

/**
 * Seed all 19 scenario preset rules into a tenant's rules_config.
 *
 * Merges with any existing config: tenant-authored rules (source="tenant") are
 * preserved untouched.  Blueprint-sourced preset rules are refreshed.  New
 * preset rules that don't yet exist are added.
 *
 * Safe to call on tenants that already have a config — it will not wipe
 * anything the tenant has customised.
 */
export async function seedPresetRulesAction(
  tenantId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!tenantId) {
    return { ok: false, error: "tenantId must be a non-empty string" };
  }

  try {
    const generated = generatePresetRulesConfig(tenantId);
    const existing  = await loadTenantRulesConfig(tenantId);

    const configToWrite = existing
      ? mergePresetRules(existing, generated)
      : generated;

    const key = tenantRulesConfigKey(tenantId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getDb() as any)
      .from("rules_config")
      .upsert(
        {
          key,
          config:     configToWrite as unknown as Record<string, unknown>,
          updated_at: configToWrite.updatedAt,
        },
        { onConflict: "key" },
      ) as { error: { message: string } | null };

    if (error) {
      return { ok: false, error: `Failed to seed preset rules: ${error.message}` };
    }

    revalidatePath(`/admin/tenants/${tenantId}/personalization/rules`);
    return { ok: true, count: configToWrite.rules.length };
  } catch (err) {
    return {
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
