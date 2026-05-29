/**
 * Tenant Search Settings Actions
 *
 * Server actions for reading/writing per-tenant Meilisearch configuration
 * from the `tenant_search_settings` Supabase table, and triggering reindex
 * runs via the Meilisearch indexer.
 *
 * ─── Table ─────────────────────────────────────────────────────────────────────
 *
 *   tenant_search_settings
 *     tenant_id  text PRIMARY KEY
 *     config     jsonb NOT NULL DEFAULT '{}'
 *     updated_at timestamptz NOT NULL DEFAULT now()
 *
 *   Migration SQL (run once):
 *   ──────────────────────────────────────────────────────────────────────────
 *   CREATE TABLE IF NOT EXISTS public.tenant_search_settings (
 *     tenant_id   text PRIMARY KEY,
 *     config      jsonb NOT NULL DEFAULT '{}',
 *     updated_at  timestamptz NOT NULL DEFAULT now()
 *   );
 *   ──────────────────────────────────────────────────────────────────────────
 *
 * ─── Secret handling ───────────────────────────────────────────────────────────
 *
 *   The Meilisearch API key is stored encrypted (AES-256-GCM, same as SMTP
 *   password and Resend key) using lib/email-crypto.ts with EMAIL_ENCRYPTION_KEY.
 *   Clients NEVER receive the plaintext key — only a boolean `hasApiKey` flag.
 *   The "preserve existing" pattern (empty string = keep) is used for the key
 *   field so replacing/cancelling works identically to email transport UI.
 *
 * ─── Access control ────────────────────────────────────────────────────────────
 *
 *   All actions are called from /admin/tenants/[tenantId]/search which is
 *   protected by the tenant admin layout (assertTenantAccess).
 */

"use server";

import { revalidatePath }                   from "next/cache";
import { getDb }                            from "@/data/db";
import { logger }                           from "@/lib/logger";
import { encryptSecret, hasStoredSecret }   from "@/lib/email-crypto";
import { indexTenant }                      from "@/search/indexing/meilisearch-indexer";
import {
  decryptSecret,
}                                           from "@/lib/email-crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Client-safe types (no plaintext secrets)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search settings returned to the client — secrets replaced with boolean flags.
 */
export interface SafeSearchConfig {
  provider:        "none" | "meilisearch";
  meilisearchHost: string;
  indexPrefix:     string;
  hasApiKey:       boolean;
  lastIndexedAt:   string | null;
  lastIndexStats:  { docCount: number; errorCount: number } | null;
}

/**
 * Form data submitted by the client to save search settings.
 * `meilisearchApiKey` is empty string = "keep existing key".
 */
export interface SearchSettingsFormInput {
  provider:          "none" | "meilisearch";
  meilisearchHost:   string;
  indexPrefix:       string;
  meilisearchApiKey: string;   // empty = preserve existing
}

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

export async function getTenantSearchSettingsAction(tenantId: string): Promise<
  | { ok: true;  config: SafeSearchConfig }
  | { ok: false; error: string }
> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_search_settings")
      .select("config")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { config: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    if (result.error) {
      if (isTableMissingError(result.error)) {
        return {
          ok:    false,
          error: "TABLE_NOT_FOUND: Run the pending database migration to create tenant_search_settings.",
        };
      }
      return { ok: false, error: result.error.message };
    }

    if (!result.data) {
      return { ok: true, config: defaultSafeConfig() };
    }

    return { ok: true, config: toSafeConfig(result.data.config) };
  } catch (err) {
    logger.error("[search-actions] Failed to read search settings", {
      tenantId, error: String(err),
    });
    return { ok: false, error: "Failed to read search settings" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

export async function saveTenantSearchSettingsAction(
  tenantId: string,
  input:    SearchSettingsFormInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };

  const provider: "none" | "meilisearch" =
    input.provider === "meilisearch" ? "meilisearch" : "none";

  try {
    // Load existing row to preserve the stored API key when input is empty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = (await (getDb() as any)
      .from("tenant_search_settings")
      .select("config")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { config: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    const prev = existing.data?.config ?? {};

    const config: Record<string, unknown> = {
      provider,
      meilisearchHost: input.meilisearchHost.trim() || undefined,
      indexPrefix:     input.indexPrefix.trim()     || undefined,
      // Preserve existing stats/timestamps
      lastIndexedAt:  prev.lastIndexedAt  ?? undefined,
      lastIndexStats: prev.lastIndexStats ?? undefined,
    };

    // Secret: only overwrite if a new key was supplied
    const newKey = input.meilisearchApiKey.trim();
    config.meilisearchApiKey = newKey
      ? encryptSecret(newKey)
      : (prev.meilisearchApiKey ?? undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = (await (getDb() as any)
      .from("tenant_search_settings")
      .upsert(
        {
          tenant_id:  tenantId,
          config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      )) as { error: { message: string } | null };

    if (error) {
      logger.error("[search-actions] Failed to save search settings", {
        tenantId, error: error.message,
      });
      return { ok: false, error: `Failed to save: ${error.message}` };
    }

    revalidatePath(`/admin/tenants/${tenantId}/search`);
    return { ok: true };
  } catch (err) {
    logger.error("[search-actions] Unexpected error saving search settings", {
      tenantId, error: String(err),
    });
    return { ok: false, error: "Failed to save search settings" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reindex
// ─────────────────────────────────────────────────────────────────────────────

export async function reindexTenantSearchAction(tenantId: string): Promise<
  | { ok: true;  docCount: number; errorCount: number; indexedAt: string }
  | { ok: false; error: string }
> {
  if (!tenantId) return { ok: false, error: "tenantId is required" };

  // ── Load config from DB ──────────────────────────────────────────────────
  let rawConfig: Record<string, unknown>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_search_settings")
      .select("config")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { config: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    if (result.error || !result.data) {
      return { ok: false, error: "No search settings configured for this tenant." };
    }
    rawConfig = result.data.config;
  } catch (err) {
    return { ok: false, error: `Failed to load settings: ${String(err)}` };
  }

  if (rawConfig.provider !== "meilisearch") {
    return { ok: false, error: "Search provider is not set to Meilisearch." };
  }

  const host = typeof rawConfig.meilisearchHost === "string" ? rawConfig.meilisearchHost.trim() : "";
  if (!host) {
    return { ok: false, error: "Meilisearch host is not configured." };
  }

  // Decrypt API key
  const storedKey = typeof rawConfig.meilisearchApiKey === "string" ? rawConfig.meilisearchApiKey : "";
  if (!storedKey || !hasStoredSecret(storedKey)) {
    return { ok: false, error: "Meilisearch API key is not configured." };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(storedKey);
  } catch {
    return { ok: false, error: "Failed to decrypt Meilisearch API key." };
  }

  const indexPrefix = typeof rawConfig.indexPrefix === "string" ? rawConfig.indexPrefix.trim() : "";
  const indexName   = `${indexPrefix}${tenantId}`;

  // ── Run indexer ──────────────────────────────────────────────────────────
  let indexResult: { docCount: number; errorCount: number; indexedAt: string };
  try {
    indexResult = await indexTenant({ host, apiKey, indexName }, tenantId);
  } catch (err) {
    logger.error("[search-actions] Reindex failed", { tenantId, error: String(err) });
    return { ok: false, error: `Reindex failed: ${String(err)}` };
  }

  // ── Persist stats back to DB ─────────────────────────────────────────────
  const updatedConfig = {
    ...rawConfig,
    lastIndexedAt: indexResult.indexedAt,
    lastIndexStats: {
      docCount:   indexResult.docCount,
      errorCount: indexResult.errorCount,
    },
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getDb() as any)
      .from("tenant_search_settings")
      .upsert(
        {
          tenant_id:  tenantId,
          config:     updatedConfig,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      );
  } catch (err) {
    // Non-fatal: reindex succeeded even if stats write fails
    logger.warn("[search-actions] Failed to persist reindex stats", {
      tenantId, error: String(err),
    });
  }

  revalidatePath(`/admin/tenants/${tenantId}/search`);
  return {
    ok:         true,
    docCount:   indexResult.docCount,
    errorCount: indexResult.errorCount,
    indexedAt:  indexResult.indexedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function isTableMissingError(error: { message: string; code?: string }): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("undefined_table") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    error.code === "42P01"
  );
}

function defaultSafeConfig(): SafeSearchConfig {
  return {
    provider:        "none",
    meilisearchHost: "",
    indexPrefix:     "",
    hasApiKey:       false,
    lastIndexedAt:   null,
    lastIndexStats:  null,
  };
}

function toSafeConfig(raw: Record<string, unknown>): SafeSearchConfig {
  const provider: "none" | "meilisearch" =
    raw.provider === "meilisearch" ? "meilisearch" : "none";

  const lastIndexStats =
    raw.lastIndexStats &&
    typeof (raw.lastIndexStats as Record<string, unknown>).docCount === "number"
      ? {
          docCount:   (raw.lastIndexStats as Record<string, unknown>).docCount as number,
          errorCount: (raw.lastIndexStats as Record<string, unknown>).errorCount as number ?? 0,
        }
      : null;

  return {
    provider,
    meilisearchHost: typeof raw.meilisearchHost === "string" ? raw.meilisearchHost : "",
    indexPrefix:     typeof raw.indexPrefix     === "string" ? raw.indexPrefix     : "",
    hasApiKey:       hasStoredSecret(typeof raw.meilisearchApiKey === "string" ? raw.meilisearchApiKey : null),
    lastIndexedAt:   typeof raw.lastIndexedAt   === "string" ? raw.lastIndexedAt   : null,
    lastIndexStats,
  };
}
