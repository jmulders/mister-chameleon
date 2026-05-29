/**
 * loadTenantFormSettings
 *
 * Server-only module that reads tenant-level form configuration from the
 * `tenant_form_settings` Supabase table and merges it with the hard-coded
 * defaults.
 *
 * ─── Why a separate loader? ───────────────────────────────────────────────────
 *
 *   The form submission API route (`/api/forms/[formKey]`) runs in a serverless
 *   environment — it cannot import the static TenantConfig (which lives in
 *   mister-chameleon-config.ts) because that would couple every form submission
 *   to the platform's compile-time tenant registry.
 *
 *   By storing form settings in the DB and loading them at request time, admins
 *   can update recipients, toggle storage, and configure webhooks without a
 *   redeployment.
 *
 * ─── Fallback behaviour ────────────────────────────────────────────────────────
 *
 *   When no row exists for the tenant (first-time setup, or DB error), the
 *   DEFAULT_TENANT_FORM_SETTINGS are returned — the same behaviour as before
 *   this system existed (store + notify + confirm; no webhook).
 *
 * ─── Caching ──────────────────────────────────────────────────────────────────
 *
 *   Results are NOT cached beyond the current request lifecycle (no `cache`).
 *   Form settings are admin-edited infrequently but need to take effect
 *   immediately — ISR would add latency; per-request reads are acceptable for
 *   a low-traffic admin-controlled path.
 */

import "server-only";

import { getDb }                        from "@/data/db";
import { logger }                       from "@/lib/logger";
import type { TenantFormSettings }      from "@/tenant/types";
import { DEFAULT_TENANT_FORM_SETTINGS } from "@/tenant/types";

// ── DB row type ───────────────────────────────────────────────────────────────

interface TenantFormSettingsRow {
  tenant_id:  string;
  settings:   Record<string, unknown>;
  updated_at: string;
}

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Load the effective TenantFormSettings for a tenant.
 *
 * Returns the stored settings merged over DEFAULT_TENANT_FORM_SETTINGS so that
 * any missing fields always have a safe value.
 *
 * @param tenantId  The tenant's stable slug (e.g. "mister-chameleon").
 */
export async function loadTenantFormSettings(
  tenantId: string,
): Promise<TenantFormSettings> {
  if (!tenantId) return { ...DEFAULT_TENANT_FORM_SETTINGS };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (getDb() as any)
      .from("tenant_form_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle()) as { data: { settings: Record<string, unknown> } | null; error: { message: string } | null };

    if (result.error) {
      logger.warn("[forms] Failed to load tenant form settings", {
        tenantId,
        error: result.error.message,
      });
      return { ...DEFAULT_TENANT_FORM_SETTINGS };
    }

    if (!result.data) {
      // No row yet — return defaults (tenant hasn't customised their settings).
      return { ...DEFAULT_TENANT_FORM_SETTINGS };
    }

    // Merge stored values over defaults so new fields added to the interface
    // don't break tenants who haven't re-saved since the field was introduced.
    return mergeWithDefaults(result.data.settings);
  } catch (err) {
    logger.warn("[forms] Unexpected error loading tenant form settings", {
      tenantId,
      error: String(err),
    });
    return { ...DEFAULT_TENANT_FORM_SETTINGS };
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function mergeWithDefaults(raw: Record<string, unknown>): TenantFormSettings {
  return {
    storeSubmissions:
      typeof raw.storeSubmissions === "boolean"
        ? raw.storeSubmissions
        : DEFAULT_TENANT_FORM_SETTINGS.storeSubmissions,

    notificationRecipients:
      Array.isArray(raw.notificationRecipients)
        ? (raw.notificationRecipients as string[]).filter(
            (v) => typeof v === "string" && v.trim() !== "",
          )
        : DEFAULT_TENANT_FORM_SETTINGS.notificationRecipients,

    sendConfirmationEmails:
      typeof raw.sendConfirmationEmails === "boolean"
        ? raw.sendConfirmationEmails
        : DEFAULT_TENANT_FORM_SETTINGS.sendConfirmationEmails,

    webhookUrl:
      typeof raw.webhookUrl === "string" && raw.webhookUrl.trim() !== ""
        ? raw.webhookUrl.trim()
        : undefined,

    hubspotEnabled:
      typeof raw.hubspotEnabled === "boolean" ? raw.hubspotEnabled : false,

    successMessage:
      typeof raw.successMessage === "string" && raw.successMessage.trim() !== ""
        ? raw.successMessage.trim()
        : undefined,

    successRedirectUrl:
      typeof raw.successRedirectUrl === "string" && raw.successRedirectUrl.trim() !== ""
        ? raw.successRedirectUrl.trim()
        : undefined,
  };
}
