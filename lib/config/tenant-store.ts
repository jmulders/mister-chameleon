/**
 * Config Tenant Store
 *
 * Server-only module that reads and writes domain-specific configuration slices
 * from the existing `tenant_settings` table.
 *
 * ─── Storage model ────────────────────────────────────────────────────────────
 *
 *   The `tenant_settings` table stores one row per tenant:
 *
 *     tenant_settings { tenant_id: text PK, settings: jsonb }
 *
 *   The `settings` column holds a full `TenantSettings` object, including domain
 *   sub-keys like `.ai`, `.crm`, `.enrichment`, etc.
 *
 *   This module reads *just the domain slice* — e.g. `settings.ai` — without
 *   loading or parsing the entire TenantSettings graph.  This keeps resolver
 *   functions lean and avoids loading unrelated secrets or large objects.
 *
 * ─── Why not use tenant/tenant-store.ts? ─────────────────────────────────────
 *
 *   `tenant/tenant-store.ts` loads, validates, and normalises the full
 *   TenantSettings object — including package enforcement.  That's appropriate
 *   for the CMS/config management layer, but overly heavy for config resolvers
 *   that only need to know "does this tenant have AI configured?".
 *
 *   This module provides a lightweight, type-safe alternative for resolvers.
 *
 * ─── Domain key registry ──────────────────────────────────────────────────────
 *
 *   Supported keys mirror the fields of `TenantSettings`:
 *     "ai"          → TenantAiSettings
 *     "crm"         → TenantCrmSettings
 *     "enrichment"  → TenantEnrichmentSettings
 *     "cms"         → TenantCmsSettings  (rare — handled by cms resolvers)
 *
 *   Email transport and form settings have their own dedicated tables
 *   (`tenant_email_transport`, `tenant_form_settings`) and are NOT in this store.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   The domain slices accessed through this module do not contain secrets
 *   (API keys, passwords).  Per-tenant secrets for email transport are in
 *   `tenant_email_transport` with AES-256-GCM encryption.
 *   Per-tenant AI API key overrides ARE in `tenant_settings.settings.ai`
 *   (liveProvider.apiKey / shadowProvider.apiKey).  Callers must not pass
 *   these values to the client.
 */

import "server-only";

import { getDb }    from "@/data/db";
import { logger }   from "@/lib/logger";
import type {
  TenantAiSettings,
  TenantCrmSettings,
  TenantEnrichmentSettings,
} from "@/tenant/types";

// ─────────────────────────────────────────────────────────────────────────────
// Domain key → type mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps `tenant_settings.settings` sub-keys to their TypeScript types.
 * Only domains managed via this config store are listed here.
 *
 * Email transport (tenant_email_transport) and form settings
 * (tenant_form_settings) have dedicated tables and loaders.
 */
export interface TenantConfigDomains {
  ai:          TenantAiSettings;
  crm:         TenantCrmSettings;
  enrichment:  TenantEnrichmentSettings;
}

export type TenantConfigDomainKey = keyof TenantConfigDomains;

// ─────────────────────────────────────────────────────────────────────────────
// getTenantDomainConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads a single domain slice from `tenant_settings.settings.{key}`.
 *
 * Returns `null` when:
 *   - `tenantId` is empty
 *   - no `tenant_settings` row exists for this tenant
 *   - the domain key is absent from the settings object
 *   - a DB error occurs (logged; falls back gracefully)
 *
 * @param tenantId   Tenant slug, e.g. "acme".
 * @param domainKey  The settings sub-key to read, e.g. "ai".
 */
export async function getTenantDomainConfig<K extends TenantConfigDomainKey>(
  tenantId: string,
  domainKey: K,
): Promise<Partial<TenantConfigDomains[K]> | null> {
  if (!tenantId) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { settings: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    if (result.error) {
      logger.warn(`[config/tenant-store] Failed to load tenant settings for domain "${domainKey}"`, {
        tenantId,
        domainKey,
        error: result.error.message,
      });
      return null;
    }

    if (!result.data) return null;

    const domainValue = result.data.settings[domainKey];
    if (!domainValue || typeof domainValue !== "object") return null;

    return domainValue as Partial<TenantConfigDomains[K]>;
  } catch (err) {
    logger.warn(`[config/tenant-store] Unexpected error loading tenant domain config "${domainKey}"`, {
      tenantId,
      domainKey,
      error: String(err),
    });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// setTenantDomainConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Writes (merges) a domain slice into `tenant_settings.settings.{key}`.
 *
 * This is a surgical update: only the specified domain key is written.
 * All other settings fields in the existing row are preserved.
 *
 * If no row exists for the tenant, one is created with only this domain key set.
 *
 * ⚠️  This bypasses the package-enforcement layer in `tenant/tenant-store.ts`.
 *     Only use this for admin-level, internally-controlled config writes.
 *     For writes that must respect package limits, use `saveTenant()` instead.
 *
 * @param tenantId   Tenant slug, e.g. "acme".
 * @param domainKey  The settings sub-key to update, e.g. "crm".
 * @param value      The new domain config value.
 *
 * @returns `{ ok: true }` on success; `{ ok: false; error: string }` on failure.
 */
export async function setTenantDomainConfig<K extends TenantConfigDomainKey>(
  tenantId: string,
  domainKey: K,
  value: TenantConfigDomains[K],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId) {
    return { ok: false, error: "tenantId is required" };
  }

  try {
    // Read existing settings to merge (preserve other domains).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readResult = (await (getDb() as any)
      .from("tenant_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as {
        data: { settings: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    if (readResult.error) {
      return { ok: false, error: readResult.error.message };
    }

    const existing: Record<string, unknown> = readResult.data?.settings ?? {};
    const merged = { ...existing, [domainKey]: value };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertResult = (await (getDb() as any)
      .from("tenant_settings")
      .upsert(
        { tenant_id: tenantId, settings: merged },
        { onConflict: "tenant_id" },
      )) as { error: { message: string } | null };

    if (upsertResult.error) {
      return { ok: false, error: upsertResult.error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[config/tenant-store] Failed to save tenant domain config "${domainKey}"`, {
      tenantId,
      domainKey,
      error: message,
    });
    return { ok: false, error: message };
  }
}
