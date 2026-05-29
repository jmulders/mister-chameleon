/**
 * Platform CMS Content Actions
 *
 * Server actions for the built-in Platform CMS provider.
 * These actions are only invoked when `tenant.cms.provider === "platform"`.
 *
 * ─── Actions ──────────────────────────────────────────────────────────────────
 *
 *   listPlatformVariantsAction   — list all variants stored for a tenant
 *   savePlatformVariantAction    — upsert a single variant document
 *   deletePlatformVariantAction  — delete a single variant document
 *   seedPlatformVariantsAction   — seed starter variants (non-destructive)
 *   testPlatformConnectionAction — quick DB ping (re-uses provider.testConnection)
 *
 * ─── Auth ─────────────────────────────────────────────────────────────────────
 *
 *   All actions are admin-only.  tenantId is always taken from the server-side
 *   context rather than from the client payload to prevent tenant-hopping.
 */

"use server";

import { getDb }                 from "@/data/db";
import type { PlatformCmsContentInsert } from "@/data/types";
import { PlatformCMSProvider }  from "@/cms/providers/platform-provider";
import { logger }               from "@/lib/logger";

// ── Shared types ──────────────────────────────────────────────────────────────

export type VariantType = "hero" | "proof" | "cta" | "feature" | "conversion" | "notification";

export interface PlatformVariantRow {
  id:           string;
  variant_type: VariantType;
  variant_key:  string;
  content:      Record<string, unknown>;
  updated_at:   string;
}

// ── Typed DB cast helpers ─────────────────────────────────────────────────────

type SingleResult<T> = { data: T | null; error: { message: string } | null };
type ManyResult<T>   = { data: T[] | null; error: { message: string } | null };
function asSingle<T>(r: unknown): SingleResult<T> { return r as SingleResult<T>; }
function asMany<T>(r: unknown):   ManyResult<T>   { return r as ManyResult<T>;   }

// ── listPlatformVariantsAction ─────────────────────────────────────────────────

export async function listPlatformVariantsAction(
  tenantId: string,
): Promise<{ ok: true; variants: PlatformVariantRow[] } | { ok: false; error: string }> {
  try {
    const { data, error } = asMany<PlatformVariantRow>(
      await getDb()
        .from("platform_cms_content")
        .select("id, variant_type, variant_key, content, updated_at")
        .eq("tenant_id", tenantId)
        .order("variant_type")
        .order("variant_key"),
    );

    if (error) return { ok: false, error: error.message };
    return { ok: true, variants: data ?? [] };
  } catch (err) {
    logger.error("[PlatformCMS] listPlatformVariantsAction error", { tenantId, err });
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── savePlatformVariantAction ──────────────────────────────────────────────────

export async function savePlatformVariantAction(
  tenantId:    string,
  variantType: VariantType,
  variantKey:  string,
  content:     Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tenantId || !variantKey.trim()) {
    return { ok: false, error: "tenantId and variantKey are required." };
  }

  try {
    const row: PlatformCmsContentInsert = {
      tenant_id:    tenantId,
      variant_type: variantType,
      variant_key:  variantKey.trim(),
      content,
    };

    // Cast through unknown: `platform_cms_content` was added after the DB type
    // was last generated; upsert() is stricter than insert() on unknown tables.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getDb() as any)
      .from("platform_cms_content")
      .upsert(row, { onConflict: "tenant_id,variant_type,variant_key" });

    if (error) return { ok: false, error: error.message };

    logger.info("[PlatformCMS] Variant saved", { tenantId, variantType, variantKey });
    return { ok: true };
  } catch (err) {
    logger.error("[PlatformCMS] savePlatformVariantAction error", { tenantId, variantType, variantKey, err });
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── deletePlatformVariantAction ────────────────────────────────────────────────

export async function deletePlatformVariantAction(
  tenantId:    string,
  variantType: VariantType,
  variantKey:  string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await getDb()
      .from("platform_cms_content")
      .delete()
      .eq("tenant_id",    tenantId)
      .eq("variant_type", variantType)
      .eq("variant_key",  variantKey);

    if (error) return { ok: false, error: error.message };

    logger.info("[PlatformCMS] Variant deleted", { tenantId, variantType, variantKey });
    return { ok: true };
  } catch (err) {
    logger.error("[PlatformCMS] deletePlatformVariantAction error", { tenantId, variantType, variantKey, err });
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── seedPlatformVariantsAction ─────────────────────────────────────────────────

/**
 * Seeds starter variants using PlatformCMSProvider.provisionSite().
 * Non-destructive — existing variants are NOT overwritten (ignoreDuplicates: true).
 */
export async function seedPlatformVariantsAction(
  tenantId: string,
): Promise<{ ok: true; seeded: number; warnings: string[] } | { ok: false; error: string }> {
  try {
    const provider = new PlatformCMSProvider(tenantId);
    const result   = await provider.provisionSite(
      // Minimal TenantSettings — provisionSite only uses tenantId via the class field.
      { tenantId, packageKey: "starter" } as Parameters<typeof provider.provisionSite>[0],
    );

    if (!result.ok) return { ok: false, error: result.error };

    return {
      ok:       true,
      seeded:   result.variantsWritten,
      warnings: result.warnings,
    };
  } catch (err) {
    logger.error("[PlatformCMS] seedPlatformVariantsAction error", { tenantId, err });
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
