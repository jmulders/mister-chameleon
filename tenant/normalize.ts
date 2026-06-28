/**
 * normalizeTenant
 *
 * Fills in safe defaults for any TenantSettings fields that may be absent
 * due to partial or legacy JSONB rows in the database.  Call this once at
 * the server → component boundary so every downstream consumer can assume
 * a fully-populated object.
 *
 * Rules:
 *   packageKey  — falls back through legacy "package" field then "pro"
 *   features    — all flags default to false
 *   ai          — mode defaults to "disabled"
 *   cms         — provider defaults to "mock"
 *   crm         — enabled/useCrmEnrichment default to false
 *   enrichment  — enabled/useGeoEnrichment/useIpinfoLite/useOpenKvK/useLeadinfo/useIpCompanyEnrichment/useSeasonalEvents default to false; testIpEnabled defaults to false; testIpAddress passed through
 *   domains     — vercelProjectId defaults to absent
 *   design      — theme defaults to "default"
 *   blocks      — context/content default to empty arrays
 *
 * Usage:
 *   const tenant = normalizeTenant(await getTenantById(id));
 *   if (!tenant) notFound();
 *   // tenant is now guaranteed to have all nested fields
 */

import type { TenantSettings } from "@/tenant/server";
import type { PackageKey } from "@/tenant";

export function normalizeTenant(raw: TenantSettings): TenantSettings {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any;

  const packageKey: PackageKey =
    (r.packageKey ?? r.package ?? "pro") as PackageKey;

  return {
    ...raw,
    packageKey,
    features: {
      experiments: r.features?.experiments ?? false,
      ai:          r.features?.ai          ?? false,
      analytics:   r.features?.analytics   ?? false,
    },
    ai: {
      ...r.ai,
      mode: r.ai?.mode ?? "disabled",
    },
    cms: {
      ...r.cms,
      provider: r.cms?.provider ?? "mock",
    },
    crm: {
      enabled:          r.crm?.enabled          ?? false,
      useCrmEnrichment: r.crm?.useCrmEnrichment ?? false,
    },
    enrichment: {
      enabled:                r.enrichment?.enabled                ?? false,
      useGeoEnrichment:       r.enrichment?.useGeoEnrichment       ?? false,
      useIpinfoLite:          r.enrichment?.useIpinfoLite          ?? false,
      useOpenKvK:             r.enrichment?.useOpenKvK             ?? false,
      useLeadinfo:            r.enrichment?.useLeadinfo            ?? false,
      useIpCompanyEnrichment: r.enrichment?.useIpCompanyEnrichment ?? false,
      useSeasonalEvents:      r.enrichment?.useSeasonalEvents      ?? false,
      // Test IP override — persisted per tenant; pass through without clobbering.
      testIpEnabled:          r.enrichment?.testIpEnabled          ?? false,
      ...(r.enrichment?.testIpAddress !== undefined
        ? { testIpAddress: r.enrichment.testIpAddress }
        : {}),
    },
    domains: {
      ...r.domains,
    },
    ...(r.leadinfo !== undefined
      ? {
          leadinfo: {
            enabled:         r.leadinfo.enabled         ?? false,
            siteToken:       r.leadinfo.siteToken,
            pushToDataLayer: r.leadinfo.pushToDataLayer  ?? false,
            storeInContext:  r.leadinfo.storeInContext   ?? true,
          },
        }
      : {}),
    ...(r.gtm !== undefined
      ? { gtm: { containerId: r.gtm.containerId } }
      : {}),
    design: {
      ...r.design,
      theme: r.design?.theme ?? "default",
    },
    blocks: {
      context: r.blocks?.context ?? [],
      content: r.blocks?.content ?? [],
    },
    // Experiments settings — absent means enabled (preserve legacy behaviour).
    experiments: {
      enabled: r.experiments?.enabled ?? true,
    },
  };
}
