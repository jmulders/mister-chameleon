/**
 * CRM Config Resolver
 *
 * Resolves the effective CRM configuration for a tenant using the
 * standard four-layer model:
 *
 *   tenant   → tenant_settings.settings.crm (TenantCrmSettings)
 *   platform → platform_settings["crm"]     (PlatformCrmSettings)
 *   env      → HUBSPOT_ACCESS_TOKEN
 *   system   → { enabled: false } (safe default — CRM off until configured)
 *
 * Returns a `DomainResolution<ResolvedCrmConfig>` with the merged config
 * and source metadata for admin UX and diagnostics.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   `accessToken` is SERVER ONLY.
 *   Never pass `resolution.config` across a server→client boundary.
 */

import "server-only";

import { getTenantDomainConfig }         from "@/lib/config/tenant-store";
import { getPlatformCrmSettings }        from "@/platform/platform-store";
// HUBSPOT_ACCESS_TOKEN is not yet part of serverEnv.
// It is read via process.env directly in the env-layer section below.
import { layeredResolve }                from "@/lib/config/resolver";
import type { DomainResolution }         from "@/lib/config/types";
import type { PlatformCrmSettings }      from "@/platform/platform-store";

// ─────────────────────────────────────────────────────────────────────────────
// ResolvedCrmConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fully-resolved CRM configuration for a tenant.
 *
 * SERVER ONLY — contains access tokens.
 */
export interface ResolvedCrmConfig {
  /**
   * Whether CRM integration is enabled for this tenant.
   * False by default until both a platform access token and tenant enablement
   * are present.
   */
  enabled: boolean;

  /**
   * Whether CRM-derived fields should be included in the enrichment payload.
   * Requires `enabled = true`.
   */
  useCrmEnrichment: boolean;

  /**
   * CRM provider name.
   * Currently only "hubspot" is implemented.
   */
  provider?: "hubspot";

  /**
   * HubSpot Private App access token.
   * SERVER ONLY.
   */
  accessToken?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveCrmConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the effective CRM configuration for `tenantId`.
 *
 * @param tenantId  Tenant slug, e.g. "acme".
 */
export async function resolveCrmConfig(
  tenantId: string,
): Promise<DomainResolution<ResolvedCrmConfig>> {
  const [tenantCrm, platformResult] = await Promise.all([
    getTenantDomainConfig(tenantId, "crm"),
    getPlatformCrmSettings(),
  ]);

  const platformCrm: PlatformCrmSettings | null =
    platformResult.ok ? platformResult.data : null;

  // ── Env layer ─────────────────────────────────────────────────────────────
  // HUBSPOT_ACCESS_TOKEN is not yet part of serverEnv — read directly.
  const envToken = process.env.HUBSPOT_ACCESS_TOKEN || undefined;
  const envLayer: Partial<ResolvedCrmConfig> | null = envToken
    ? { provider: "hubspot", accessToken: envToken }
    : null;

  // ── Platform layer ────────────────────────────────────────────────────────
  const platformLayer: Partial<ResolvedCrmConfig> | null = platformCrm
    ? {
        provider:    platformCrm.provider,
        accessToken: platformCrm.accessToken,
      }
    : null;

  // ── Tenant layer ──────────────────────────────────────────────────────────
  const tenantLayer: Partial<ResolvedCrmConfig> | null =
    tenantCrm && Object.keys(tenantCrm).length > 0
      ? {
          enabled:          tenantCrm.enabled,
          useCrmEnrichment: tenantCrm.useCrmEnrichment,
        }
      : null;

  const baseline: ResolvedCrmConfig = {
    enabled:          false,
    useCrmEnrichment: false,
  };

  return layeredResolve<ResolvedCrmConfig>(
    {
      system:   { enabled: false, useCrmEnrichment: false },
      env:      envLayer,
      platform: platformLayer,
      tenant:   tenantLayer,
    },
    baseline,
  );
}
