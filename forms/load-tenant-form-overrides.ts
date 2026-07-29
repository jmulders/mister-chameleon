/**
 * loadTenantFormOverrides
 *
 * Server-only module that reads per-form configuration overrides from the
 * `tenant_form_overrides` Supabase table and merges them with safe defaults.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   Provides the highest-priority config layer in the form submission pipeline:
 *
 *     form-level override (this)  ← highest priority
 *       → tenant default (tenant_form_settings)
 *       → platform default
 *       → env var fallback
 *       → system hardcoded default
 *
 *   When `overrideEnabled` is false (the default), the returned object has no
 *   effect — the caller should skip applying it and use tenant defaults instead.
 *
 * ─── Fallback behaviour ───────────────────────────────────────────────────────
 *
 *   When no row exists for the (tenant, form) pair, or on any DB error,
 *   DEFAULT_FORM_OVERRIDE_SETTINGS is returned with `overrideEnabled: false`.
 *   This means the form behaves exactly as before this table existed.
 *
 * ─── Caching ──────────────────────────────────────────────────────────────────
 *
 *   Results are not cached beyond the current request lifecycle.
 *   Per-form overrides are admin-edited infrequently but should take effect
 *   immediately — per-request DB reads are acceptable for this low-traffic path.
 */

import "server-only";

import { getDb }                              from "@/data/db";
import { logger }                             from "@/lib/logger";
import type { TenantFormOverrideSettings }    from "@/tenant/types";
import { DEFAULT_FORM_OVERRIDE_SETTINGS }     from "@/tenant/types";

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Load the effective TenantFormOverrideSettings for a specific (tenant, form) pair.
 *
 * Returns DEFAULT_FORM_OVERRIDE_SETTINGS (overrideEnabled: false) when no
 * override has been configured, so callers can safely skip applying it.
 *
 * @param tenantId  The tenant's stable slug (e.g. "mister-chameleon").
 * @param formKey   The registered form key (e.g. "contact", "application").
 */
export async function loadTenantFormOverrides(
  tenantId: string,
  formKey:  string,
): Promise<TenantFormOverrideSettings> {
  if (!tenantId || !formKey) return { ...DEFAULT_FORM_OVERRIDE_SETTINGS };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_form_overrides")
      .select("overrides")
      .eq("tenant_id", tenantId)
      .eq("form_key",  formKey)
      .maybeSingle()) as {
        data:  { overrides: Record<string, unknown> } | null;
        error: { message: string } | null;
      };

    if (result.error) {
      logger.warn("[forms] Failed to load form-level overrides", {
        tenantId,
        formKey,
        error: result.error.message,
      });
      return { ...DEFAULT_FORM_OVERRIDE_SETTINGS };
    }

    if (!result.data) {
      // No row yet — override not configured; use tenant defaults.
      return { ...DEFAULT_FORM_OVERRIDE_SETTINGS };
    }

    return mergeWithDefaults(result.data.overrides);
  } catch (err) {
    logger.warn("[forms] Unexpected error loading form-level overrides", {
      tenantId,
      formKey,
      error: String(err),
    });
    return { ...DEFAULT_FORM_OVERRIDE_SETTINGS };
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function mergeWithDefaults(raw: Record<string, unknown>): TenantFormOverrideSettings {
  return {
    overrideEnabled:
      typeof raw.overrideEnabled === "boolean"
        ? raw.overrideEnabled
        : DEFAULT_FORM_OVERRIDE_SETTINGS.overrideEnabled,

    notifyEnabled:
      typeof raw.notifyEnabled === "boolean"
        ? raw.notifyEnabled
        : DEFAULT_FORM_OVERRIDE_SETTINGS.notifyEnabled,

    confirmEnabled:
      typeof raw.confirmEnabled === "boolean"
        ? raw.confirmEnabled
        : DEFAULT_FORM_OVERRIDE_SETTINGS.confirmEnabled,

    storeEnabled:
      typeof raw.storeEnabled === "boolean"
        ? raw.storeEnabled
        : DEFAULT_FORM_OVERRIDE_SETTINGS.storeEnabled,

    turnstileEnabled:
      typeof raw.turnstileEnabled === "boolean"
        ? raw.turnstileEnabled
        : DEFAULT_FORM_OVERRIDE_SETTINGS.turnstileEnabled,

    customRecipients:
      Array.isArray(raw.customRecipients)
        ? (raw.customRecipients as string[]).filter(
            (v) => typeof v === "string" && v.trim() !== "",
          )
        : DEFAULT_FORM_OVERRIDE_SETTINGS.customRecipients,

    customSubject:
      typeof raw.customSubject === "string" && raw.customSubject.trim() !== ""
        ? raw.customSubject.trim()
        : undefined,

    customSenderName:
      typeof raw.customSenderName === "string" && raw.customSenderName.trim() !== ""
        ? raw.customSenderName.trim()
        : undefined,
  };
}
