/**
 * Enrichment Config Resolver
 *
 * Resolves the effective IP enrichment configuration for a tenant using the
 * standard four-layer model:
 *
 *   tenant   → tenant_settings.settings.enrichment (TenantEnrichmentSettings)
 *   platform → platform_settings["enrichment"]     (PlatformEnrichmentSettings)
 *   env      → CLEARBIT_SECRET_KEY / IPINFO_TOKEN / LEADINFO_API_KEY
 *   system   → { enabled: false } (safe default — enrichment off until configured)
 *
 * Returns a `DomainResolution<ResolvedEnrichmentConfig>` with the merged config
 * and source metadata for admin UX and diagnostics.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   `clearbitSecretKey`, `ipinfoToken`, and `leadinfoApiKey` are SERVER ONLY.
 *   Never pass `resolution.config` across a server→client boundary.
 */

import "server-only";

import { getTenantDomainConfig }             from "@/lib/config/tenant-store";
import { getPlatformEnrichmentSettings }     from "@/platform/platform-store";
import { serverEnv }                         from "@/lib/env";
import { layeredResolve }                    from "@/lib/config/resolver";
import type { DomainResolution }             from "@/lib/config/types";
import type { PlatformEnrichmentSettings }   from "@/platform/platform-store";

// ─────────────────────────────────────────────────────────────────────────────
// ResolvedEnrichmentConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fully-resolved enrichment configuration for a tenant.
 *
 * SERVER ONLY — contains API keys.
 */
export interface ResolvedEnrichmentConfig {
  /**
   * Master switch for the enrichment pipeline for this tenant.
   * False by default.
   */
  enabled: boolean;

  /**
   * Whether MaxMind/IPinfo geo enrichment should run for this tenant.
   * Requires `enabled = true`.
   */
  useGeoEnrichment: boolean;

  /**
   * Clearbit Reveal secret key for IP-to-company lookup.
   * SERVER ONLY.
   */
  clearbitSecretKey?: string;

  /**
   * IPinfo API token for ASN / network-org enrichment.
   * SERVER ONLY.
   */
  ipinfoToken?: string;

  /**
   * Leadinfo API key.
   * SERVER ONLY.
   */
  leadinfoApiKey?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveEnrichmentConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the effective enrichment configuration for `tenantId`.
 *
 * @param tenantId  Tenant slug, e.g. "acme".
 */
export async function resolveEnrichmentConfig(
  tenantId: string,
): Promise<DomainResolution<ResolvedEnrichmentConfig>> {
  const [tenantEnrichment, platformResult] = await Promise.all([
    getTenantDomainConfig(tenantId, "enrichment"),
    getPlatformEnrichmentSettings(),
  ]);

  const platformEnrichment: PlatformEnrichmentSettings | null =
    platformResult.ok ? platformResult.data : null;

  // ── Env layer ─────────────────────────────────────────────────────────────
  const clearbitKey  = serverEnv.enrichment.clearbitSecretKey;
  const ipinfoToken  = serverEnv.enrichment.ipinfoToken;
  const leadinfoKey  = serverEnv.enrichment.leadinfoApiKey;
  const envLayer: Partial<ResolvedEnrichmentConfig> | null =
    clearbitKey || ipinfoToken || leadinfoKey
      ? {
          clearbitSecretKey: clearbitKey,
          ipinfoToken:       ipinfoToken,
          leadinfoApiKey:    leadinfoKey,
        }
      : null;

  // ── Platform layer ────────────────────────────────────────────────────────
  const platformLayer: Partial<ResolvedEnrichmentConfig> | null = platformEnrichment
    ? {
        clearbitSecretKey: platformEnrichment.clearbitSecretKey,
        ipinfoToken:       platformEnrichment.ipinfoToken,
        leadinfoApiKey:    platformEnrichment.leadinfoApiKey,
      }
    : null;

  // ── Tenant layer ──────────────────────────────────────────────────────────
  const tenantLayer: Partial<ResolvedEnrichmentConfig> | null =
    tenantEnrichment && Object.keys(tenantEnrichment).length > 0
      ? {
          enabled:          tenantEnrichment.enabled,
          useGeoEnrichment: tenantEnrichment.useGeoEnrichment,
        }
      : null;

  const baseline: ResolvedEnrichmentConfig = {
    enabled:          false,
    useGeoEnrichment: false,
  };

  return layeredResolve<ResolvedEnrichmentConfig>(
    {
      system:   { enabled: false, useGeoEnrichment: false },
      env:      envLayer,
      platform: platformLayer,
      tenant:   tenantLayer,
    },
    baseline,
  );
}
