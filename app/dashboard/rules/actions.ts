/**
 * Rules Editor Server Actions — Supabase-backed
 *
 * Supabase implementation of the rules configuration store.
 * Replaces the original fs/promises + JSON file backend so the platform
 * runs safely on Vercel and any other serverless environment with a
 * read-only filesystem.
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 *
 *   Config is persisted in the `rules_config` Supabase table under the
 *   key "homepage".
 *
 *   SQL schema:
 *     supabase/migrations/20240101000010_create_rules_config.sql
 *
 * ─── Safety model ──────────────────────────────────────────────────────────────
 *
 *   All writes are validated through validateStoredConfig() before touching
 *   the database.  This ensures:
 *
 *   - Only known variant keys are accepted (no free-text injection).
 *   - Condition fields and values are checked against explicit allow-lists.
 *   - Priority values are unique integers.
 *   - Required fields are present and non-empty.
 *
 * ─── Phase 3 note ──────────────────────────────────────────────────────────────
 *
 *   The RulesDecisionProvider currently reads from the hard-coded HOMEPAGE_RULES
 *   constant.  In the next phase it can be updated to call getRulesAction() at
 *   startup (or per-request with caching) and compile the stored rules.
 */

"use server";

import {
  type StoredRulesConfig,
  validateStoredConfig,
  SEED_RULES_CONFIG,
} from "@/decision/rules/stored-rule";
import { getDb } from "@/data/db";
import { fetchVariantCatalogue } from "@/decision/rules/fetch-variant-catalogue";
import { getActiveTenant }       from "@/tenant/server";

// ── Typed query helper ─────────────────────────────────────────────────────────
//
// Same workaround as data/repositories — the hand-authored Database type lacks
// the PostgrestVersion discriminant, causing .select() to return never in strict
// mode.  Cast the result to the known Row shape immediately after the query.

type SingleResult<T> = { data: T | null; error: { message: string } | null };
function asSingle<T>(result: unknown): SingleResult<T> { return result as SingleResult<T>; }

// ── Config key ─────────────────────────────────────────────────────────────────

/** The `rules_config.key` value used for the homepage rules. */
const HOMEPAGE_KEY = "homepage";

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * Read the current rules configuration from the database.
 * Falls back to SEED_RULES_CONFIG if no row exists yet,
 * so the editor always has something sensible to display on first load.
 */
export async function getRulesAction(): Promise<{
  ok:     true;
  config: StoredRulesConfig;
} | {
  ok:    false;
  error: string;
}> {
  const { data, error } = asSingle<{ config: Record<string, unknown> }>(
    await getDb()
      .from("rules_config")
      .select("config")
      .eq("key", HOMEPAGE_KEY)
      .maybeSingle(),
  );

  if (error) {
    const message = error.message;
    console.error("[rules-actions] Failed to read rules config:", message);
    return { ok: false, error: `Failed to read rules: ${message}` };
  }

  if (!data) {
    // No row yet — return seed so the editor can show defaults on first visit.
    return { ok: true, config: SEED_RULES_CONFIG };
  }

  const raw = data.config as unknown;
  const errors = validateStoredConfig(raw);

  if (errors.length > 0) {
    // Row is corrupt — return seed so the editor can recover.
    console.warn("[rules-actions] rules_config row failed validation; using seed:", errors);
    return { ok: true, config: SEED_RULES_CONFIG };
  }

  return { ok: true, config: raw as StoredRulesConfig };
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Validate and persist a new rules configuration to the database.
 *
 * The `updatedAt` timestamp is always set server-side (never trusted from the client).
 * Returns `{ ok: true }` on success, or `{ ok: false, error }` on validation/DB failure.
 */
export async function saveRulesAction(
  config: unknown,
): Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: string[] }> {
  // Resolve the active tenant so we can fetch CMS variant keys for validation.
  let tenantId: string | undefined;
  try {
    const tenant = await getActiveTenant();
    tenantId = tenant.tenantId;
  } catch {
    // Non-fatal: proceed without CMS variant scoping.
  }

  const catalogue = await fetchVariantCatalogue(tenantId ?? null);
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

  // Stamp updatedAt server-side.
  const toWrite: StoredRulesConfig = {
    ...(config as StoredRulesConfig),
    updatedAt: new Date().toISOString(),
  };

  const { error } = await getDb()
    .from("rules_config")
    .upsert(
      {
        key:        HOMEPAGE_KEY,
        config:     toWrite as unknown as Record<string, unknown>,
        updated_at: toWrite.updatedAt,
      },
      { onConflict: "key" },
    );

  if (error) {
    const message = error.message;
    console.error("[rules-actions] Failed to write rules config:", message);
    return { ok: false, error: `Failed to save rules: ${message}` };
  }

  return { ok: true };
}

// ── Reset ──────────────────────────────────────────────────────────────────────

/**
 * Reset the rules configuration to the seed (code-defined) defaults.
 * Overwrites the database row with SEED_RULES_CONFIG.
 */
export async function resetRulesAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const seed: StoredRulesConfig = {
    ...SEED_RULES_CONFIG,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await getDb()
    .from("rules_config")
    .upsert(
      {
        key:        HOMEPAGE_KEY,
        config:     seed as unknown as Record<string, unknown>,
        updated_at: seed.updatedAt,
      },
      { onConflict: "key" },
    );

  if (error) {
    return { ok: false, error: `Failed to reset rules: ${error.message}` };
  }

  return { ok: true };
}
