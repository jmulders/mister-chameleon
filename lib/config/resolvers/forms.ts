/**
 * Forms Config Resolver
 *
 * Resolves the effective form settings for a tenant using the layered model.
 *
 * Unlike other domains, forms do not have a platform-level "platform_settings"
 * equivalent — the platform's contribution is limited to:
 *   - The default backoffice notification address (from platform email settings)
 *   - Environment variable fallbacks (BACKOFFICE_EMAIL)
 *
 * Resolution layers:
 *   tenant   → tenant_form_settings table (TenantFormSettings)
 *   platform → platform_settings.email.backofficeEmail (for notification fallback)
 *   env      → BACKOFFICE_EMAIL
 *   system   → DEFAULT_TENANT_FORM_SETTINGS
 *
 * Returns a `DomainResolution<ResolvedFormsConfig>`.
 *
 * ─── Notification recipient resolution ────────────────────────────────────────
 *
 *   The effective list of notification recipients is:
 *     1. Tenant's `notificationRecipients` (if non-empty)
 *     2. Platform backoffice email (`platform_settings.email.backofficeEmail`)
 *     3. `BACKOFFICE_EMAIL` env var
 *     4. No recipient — notification silently skipped
 *
 *   This resolver surfaces the effective recipient(s) in `effectiveRecipients`
 *   and `recipientSource` so admin UIs can show precise status without
 *   re-implementing the fallback chain.
 */

import "server-only";

import { loadTenantFormSettings }        from "@/forms/load-tenant-form-settings";
import { getPlatformEmailSettings }      from "@/platform/platform-store";
import { serverEnv }                     from "@/lib/env";
import { layeredResolve }                from "@/lib/config/resolver";
import type { DomainResolution }         from "@/lib/config/types";
import type { ConfigSource }             from "@/lib/config/types";
import type { TenantFormSettings }       from "@/tenant/types";
import { DEFAULT_TENANT_FORM_SETTINGS }  from "@/tenant/types";

// ─────────────────────────────────────────────────────────────────────────────
// ResolvedFormsConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fully-resolved form configuration for a tenant.
 *
 * Extends `TenantFormSettings` with derived fields that are computed after
 * resolving all layers.
 */
export interface ResolvedFormsConfig extends TenantFormSettings {
  /**
   * The effective backoffice notification recipients after all fallbacks.
   * Empty array means notifications cannot be sent (no recipient configured).
   */
  effectiveRecipients: string[];

  /**
   * Which layer provided the effective recipients.
   * - "tenant"   — tenant's notificationRecipients is non-empty
   * - "platform" — platform backoffice email is set
   * - "env"      — BACKOFFICE_EMAIL env var is set
   * - "none"     — no recipients found anywhere
   */
  recipientSource: ConfigSource;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveFormsConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the effective form configuration for `tenantId`.
 *
 * @param tenantId  Tenant slug, e.g. "acme".
 */
export async function resolveFormsConfig(
  tenantId: string,
): Promise<DomainResolution<ResolvedFormsConfig>> {
  // Load in parallel — tenant form settings + platform email for backoffice fallback.
  const [tenantSettings, platformEmailResult] = await Promise.all([
    loadTenantFormSettings(tenantId),
    getPlatformEmailSettings(),
  ]);

  const platformBackoffice: string | undefined =
    platformEmailResult.ok ? platformEmailResult.data.backofficeEmail : undefined;

  const envBackoffice: string | undefined = serverEnv.email.backofficeEmail;

  // ── Determine effective recipients ────────────────────────────────────────
  let effectiveRecipients: string[] = [];
  let recipientSource: ConfigSource = "none";

  if (tenantSettings.notificationRecipients.length > 0) {
    effectiveRecipients = tenantSettings.notificationRecipients;
    recipientSource     = "tenant";
  } else if (platformBackoffice) {
    effectiveRecipients = [platformBackoffice];
    recipientSource     = "platform";
  } else if (envBackoffice) {
    effectiveRecipients = [envBackoffice];
    recipientSource     = "env";
  }

  // ── System layer (baseline defaults) ─────────────────────────────────────
  const systemLayer: Partial<ResolvedFormsConfig> = {
    storeSubmissions:       DEFAULT_TENANT_FORM_SETTINGS.storeSubmissions,
    notificationRecipients: DEFAULT_TENANT_FORM_SETTINGS.notificationRecipients,
    sendConfirmationEmails: DEFAULT_TENANT_FORM_SETTINGS.sendConfirmationEmails,
    effectiveRecipients:    [],
    recipientSource:        "none",
  };

  // ── Tenant layer ──────────────────────────────────────────────────────────
  const tenantLayer: Partial<ResolvedFormsConfig> = {
    storeSubmissions:       tenantSettings.storeSubmissions,
    notificationRecipients: tenantSettings.notificationRecipients,
    sendConfirmationEmails: tenantSettings.sendConfirmationEmails,
    webhookUrl:             tenantSettings.webhookUrl,
    hubspotEnabled:         tenantSettings.hubspotEnabled,
    successMessage:         tenantSettings.successMessage,
    successRedirectUrl:     tenantSettings.successRedirectUrl,
    effectiveRecipients,
    recipientSource,
  };

  const baseline: ResolvedFormsConfig = {
    ...DEFAULT_TENANT_FORM_SETTINGS,
    effectiveRecipients: [],
    recipientSource:     "none",
  };

  return layeredResolve<ResolvedFormsConfig>(
    {
      system: systemLayer,
      tenant: tenantLayer,
    },
    baseline,
  );
}
