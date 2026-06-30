/**
 * Admin — Tenant Workspace › Integrations
 *
 * The primary place to configure all integration settings for this tenant.
 * Accessible at /admin/tenants/[tenantId]/integrations.
 *
 * ─── Two-layer model ──────────────────────────────────────────────────────────
 *
 *   Platform layer  (/admin/platform/integrations)
 *   ────────────────────────────────────────────────────────────────────────────
 *   Stores secrets (API keys, write tokens, access tokens) and infrastructure
 *   defaults that apply across all tenants.  Contains NO tenant-specific usage
 *   config — only the credentials and optional defaults that the tenant layer
 *   reads at runtime.
 *
 *   Tenant layer  (this page)
 *   ────────────────────────────────────────────────────────────────────────────
 *   The authoritative place for ALL integration usage and configuration:
 *
 *     CMS         — which provider, per-tenant config overrides (projectId, etc.)
 *     CRM         — enable/disable HubSpot enrichment for this tenant
 *     AI          — mode (disabled/shadow/live), provider, model, threshold
 *     Enrichment  — enable/disable MaxMind geo enrichment for this tenant
 *     Domains     — Vercel project mapping for this tenant's domain provisioning
 *
 * ─── Secret resolution ────────────────────────────────────────────────────────
 *
 *   Secrets are NEVER stored or displayed here.  This page reads platform
 *   availability flags (boolean) to show whether the underlying credential
 *   exists.  At runtime, secrets are resolved by the respective providers
 *   using the priority chain:
 *
 *     Tenant-level value → Platform store value → Environment variable
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   This server component passes only non-secret fields to the client component.
 *   Secret values (writeToken, AI apiKey, etc.) in the stored TenantSettings are
 *   stripped before reaching the client — they are preserved server-side by
 *   saveTenantIntegrationsAction via re-read-merge-write.
 */

import Link                         from "next/link";
import { notFound }                  from "next/navigation";
import { getTenantById }             from "@/tenant/server";
import { normalizeTenant }           from "@/tenant/normalize";
import { getPlatformSettingsAction } from "@/app/admin/platform/settings/actions";
import { getCrmPlatformSettingsAction } from "@/app/admin/platform/crm/actions";
import {
  getCmsPlatformSettingsAction,
  getCmsStoryblokSettingsAction,
  getCmsStatamicSettingsAction,
} from "@/app/admin/platform/cms/actions";
import { TenantIntegrationsClient }  from "./_components/TenantIntegrationsClient";

export default async function TenantIntegrationsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  // ── Load tenant + platform availability in parallel ──────────────────────
  const [
    rawTenant,
    platformResult,
    crmResult,
    sanityResult,
    storyblokResult,
    statamicResult,
  ] = await Promise.all([
    getTenantById(tenantId),
    getPlatformSettingsAction(),
    getCrmPlatformSettingsAction(),
    getCmsPlatformSettingsAction(),
    getCmsStoryblokSettingsAction(),
    getCmsStatamicSettingsAction(),
  ]);

  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);

  // ── Platform availability flags (no secrets cross the boundary) ───────────

  // CMS: any provider with a credential is "available"
  const platformCmsAvailable =
    (sanityResult.ok    && (!!sanityResult.projectId   || sanityResult.hasWriteToken)) ||
    (storyblokResult.ok && storyblokResult.hasAccessToken)                              ||
    (statamicResult.ok  && (!!statamicResult.baseUrl   || statamicResult.hasApiKey));

  const platformCrmAvailable =
    crmResult.ok && crmResult.hasAccessToken;

  const platformAiAvailable =
    platformResult.ok &&
    (platformResult.ai.hasAnthropicKey || platformResult.ai.hasOpenaiKey);

  const platformEnrichmentAvailable =
    platformResult.ok && platformResult.maxmind.hasLicenseKey;

  const platformDomainsAvailable =
    platformResult.ok && platformResult.vercel.hasApiToken;

  // ── Prop shapes — no secrets ───────────────────────────────────────────────

  const cmsProp = {
    provider:         tenant.cms?.provider         ?? "mock",
    projectId:        tenant.cms?.projectId        ?? "",
    dataset:          tenant.cms?.dataset          ?? "",
    storyblokRegion:  tenant.cms?.storyblokRegion  ?? "",
    storyblokVersion: tenant.cms?.storyblokVersion ?? "",
    statamicBaseUrl:  tenant.cms?.statamicBaseUrl  ?? "",
    // Boolean indicator only — the token value never crosses the boundary.
    hasWriteToken:    Boolean(tenant.cms?.writeToken),
  };

  const crmProp = {
    enabled:          tenant.crm?.enabled          ?? false,
    useCrmEnrichment: tenant.crm?.useCrmEnrichment ?? false,
  };

  const aiProp = {
    mode:                tenant.ai?.mode                ?? "disabled",
    confidenceThreshold: tenant.ai?.confidenceThreshold != null
                           ? String(tenant.ai.confidenceThreshold)
                           : "",
    // API keys are stripped — blank on the client side, preserved server-side.
    liveProvider: {
      name:  (tenant.ai?.liveProvider?.name  ?? "") as import("@/tenant/types").TenantAiProviderName | "",
      model: tenant.ai?.liveProvider?.model  ?? "",
    },
    shadowProvider: {
      name:  (tenant.ai?.shadowProvider?.name  ?? "") as import("@/tenant/types").TenantAiProviderName | "",
      model: tenant.ai?.shadowProvider?.model  ?? "",
    },
  };

  const enrichmentProp = {
    enabled:                tenant.enrichment?.enabled                ?? false,
    useGeoEnrichment:       tenant.enrichment?.useGeoEnrichment       ?? false,
    useIpinfoLite:          tenant.enrichment?.useIpinfoLite          ?? false,
    useOpenKvK:             tenant.enrichment?.useOpenKvK             ?? false,
    useLeadinfo:            tenant.enrichment?.useLeadinfo            ?? false,
    useIpCompanyEnrichment: tenant.enrichment?.useIpCompanyEnrichment ?? false,
    useSeasonalEvents:      tenant.enrichment?.useSeasonalEvents      ?? false,
    testIpEnabled:          tenant.enrichment?.testIpEnabled          ?? false,
    testIpAddress:          tenant.enrichment?.testIpAddress          ?? "",
    firmographicFreshnessDays: tenant.enrichment?.firmographicFreshnessDays ?? 30,
    leadScoreHotThreshold:     tenant.enrichment?.leadScoreHotThreshold ?? 60,
    personalizationHoldoutPct: tenant.enrichment?.personalizationHoldoutPct ?? 0,
  };

  const domainsProp = {
    vercelProjectId:   tenant.domains?.vercelProjectId ?? "",
    primaryDomain:     tenant.primaryDomain ?? "",
    additionalDomains: (tenant.additionalDomains ?? []).join("\n"),
  };

  // ── Leadinfo — all fields are non-secret; pass through directly ─────────────
  //
  //   siteToken is a public, non-secret identifier (Leadinfo embeds it in the
  //   browser-facing JS snippet), so it is safe to pass to the client component.

  const leadinfoProp = {
    enabled:         tenant.leadinfo?.enabled         ?? false,
    siteToken:       tenant.leadinfo?.siteToken        ?? "",
    pushToDataLayer: tenant.leadinfo?.pushToDataLayer  ?? false,
    storeInContext:  tenant.leadinfo?.storeInContext    ?? true,
  };

  const gtmProp = {
    containerId: tenant.gtm?.containerId ?? "",
  };

  // ── GA4 — strip server-only secrets before crossing the boundary ───────────
  //
  //   apiSecret and serviceAccountJson are SERVER ONLY — they must never be
  //   passed to the client component.  We pass boolean presence flags instead
  //   so the UI can show "configured ✓" without echoing the secret back.

  const ga4Prop = {
    tracking: {
      enabled:            tenant.ga4?.tracking?.enabled            ?? false,
      measurementId:      tenant.ga4?.tracking?.measurementId      ?? "",
      sendMode:           (tenant.ga4?.tracking?.sendMode          ?? "off") as "off" | "client" | "server",
      visitorIdParamName: tenant.ga4?.tracking?.visitorIdParamName ?? "",
      // Secret presence flag only — value is never passed to the client.
      hasApiSecret:       Boolean(tenant.ga4?.tracking?.apiSecret),
    },
    history: {
      enabled:             tenant.ga4?.history?.enabled             ?? false,
      propertyId:          tenant.ga4?.history?.propertyId          ?? "",
      visitorIdDimension:  tenant.ga4?.history?.visitorIdDimension  ?? "",
      lookbackDays:        tenant.ga4?.history?.lookbackDays        ?? 90,
      cacheTtlMinutes:     tenant.ga4?.history?.cacheTtlMinutes     ?? 30,
      // Secret presence flag only — value is never passed to the client.
      hasServiceAccount:   Boolean(tenant.ga4?.history?.serviceAccountJson),
    },
  };

  return (
    <div className="p-8 max-w-2xl space-y-5">
      <div>

        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Integrations</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Configure which integrations are active for{" "}
            <code className="font-mono text-xs">{tenantId}</code> and any
            per-tenant provider settings.
          </p>
        </div>

        {/* Layering note */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          <strong>Secrets and API keys</strong> belong in{" "}
          <Link
            href="/admin/platform/integrations"
            className="font-medium underline hover:text-blue-900"
          >
            Platform → Integrations
          </Link>
          . This page controls what is active and configured for this tenant only.
        </div>

        {/* Calendar booking — dedicated sub-page */}
        <Link
          href={`/admin/tenants/${tenantId}/integrations/calendar`}
          className="block rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-400"
        >
          <span className="text-sm font-medium text-neutral-900">Calendar booking →</span>
          <span className="block text-xs text-neutral-500">
            Let visitors book appointments into this tenant&apos;s own Google Calendar.
          </span>
        </Link>

        {/* Full integrations client */}
        <TenantIntegrationsClient
          tenantId={tenantId}
          cms={cmsProp}
          crm={crmProp}
          ai={aiProp}
          enrichment={enrichmentProp}
          domains={domainsProp}
          leadinfo={leadinfoProp}
          gtm={gtmProp}
          ga4={ga4Prop}
          platformCmsAvailable={platformCmsAvailable}
          platformCrmAvailable={platformCrmAvailable}
          platformAiAvailable={platformAiAvailable}
          platformEnrichmentAvailable={platformEnrichmentAvailable}
          platformDomainsAvailable={platformDomainsAvailable}
        />

      </div>
    </div>
  );
}
