/**
 * Shared staged-enricher chain builder.
 *
 * Both the platform-hosted homepage pipeline and the JS-snippet decide route
 * need the *identical* firmographic enrichment chain (IP→company, IPinfo, cloud
 * detection, OpenKvK, Leadinfo, HubSpot, GA4 history, weather, reverse-geo,
 * seasonal). Constructing it in one place guarantees a Statamic snippet visit
 * enriches exactly like a platform-hosted visit — no silent drift between the
 * two call sites.
 *
 * This resolves the platform settings + the tenant's pipeline-stage overrides,
 * then hands them to `buildCompanyCrmChain`. It does NOT gate on consent: the
 * caller decides whether to pass the returned chain to `buildDecisionContext`
 * (only when `consent.enrichment` is granted).
 */

import {
  getPlatformEnrichmentSettings,
  getPlatformCrmSettings,
  getPlatformOpenKvKSettings,
  getPlatformReverseGeocodeSettings,
  getPlatformWeatherSettings,
  getPlatformGa4HistorySettings,
  getPlatformHolidaySettings,
  getPlatformMaxMindSettings,
} from "@/platform/platform-store";
import { getTenantPipelineStages } from "@/tenant/server";
import { buildCompanyCrmChain, type StagedEnricher } from "@/enrichment";
import type { TenantSettings } from "@/tenant/types";

function parseServiceAccount(
  json: string | null | undefined,
): { client_email: string; private_key: string; token_uri?: string } | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (typeof parsed.client_email === "string" && typeof parsed.private_key === "string") {
      return {
        client_email: parsed.client_email,
        private_key:  parsed.private_key,
        ...(typeof parsed.token_uri === "string" ? { token_uri: parsed.token_uri } : {}),
      };
    }
  } catch { /* invalid JSON */ }
  return null;
}

/**
 * Resolve platform settings + tenant pipeline-stage overrides and build the
 * full staged-enricher chain for a tenant. Loads its inputs internally, so it
 * can be called in parallel (e.g. `Promise.all([history, buildTenantStagedEnrichers(...)])`).
 */
export async function buildTenantStagedEnrichers(
  tenant: TenantSettings | null | undefined,
  tenantId: string,
): Promise<StagedEnricher[]> {
  const [
    [
      platformEnrichmentResult,
      platformCrmResult,
      platformOpenKvKResult,
      platformReverseGeocodeResult,
      platformWeatherResult,
      platformGa4HistoryResult,
      platformHolidayResult,
      platformMaxMindResult,
    ],
    tenantPipelineStages,
  ] = await Promise.all([
    Promise.all([
      getPlatformEnrichmentSettings(),
      getPlatformCrmSettings(),
      getPlatformOpenKvKSettings(),
      getPlatformReverseGeocodeSettings(),
      getPlatformWeatherSettings(),
      getPlatformGa4HistorySettings(),
      getPlatformHolidaySettings(),
      getPlatformMaxMindSettings(),
    ] as const),
    getTenantPipelineStages(tenantId),
  ]);

  const pipelineStageCfg = new Map(
    tenantPipelineStages.map((s) => [s.stageKey, s]),
  );
  const pipelineEnabled = (stageKey: string, fallback: boolean): boolean =>
    pipelineStageCfg.has(stageKey) ? Boolean(pipelineStageCfg.get(stageKey)?.enabled) : fallback;

  // ── Platform settings extraction ──────────────────────────────────────────
  const platformEnrichment     = platformEnrichmentResult.ok     ? platformEnrichmentResult.data     : {};
  const platformCrm            = platformCrmResult.ok            ? platformCrmResult.data            : {};
  const platformOpenKvK        = platformOpenKvKResult.ok        ? platformOpenKvKResult.data        : {};
  const platformReverseGeocode = platformReverseGeocodeResult.ok ? platformReverseGeocodeResult.data : {};
  const platformWeather        = platformWeatherResult.ok        ? platformWeatherResult.data        : {};
  const platformGa4History     = platformGa4HistoryResult.ok     ? platformGa4HistoryResult.data     : {};
  const platformHolidays       = platformHolidayResult.ok        ? platformHolidayResult.data        : {};
  const platformMaxMind        = platformMaxMindResult.ok        ? platformMaxMindResult.data        : {};

  // ── GA4 credential resolution ─────────────────────────────────────────────
  const ga4ServiceAccount =
    parseServiceAccount(tenant?.ga4?.history?.serviceAccountJson) ??
    parseServiceAccount((platformGa4History as { serviceAccountJson?: string }).serviceAccountJson);

  const ga4PropertyId =
    tenant?.ga4?.history?.propertyId?.trim() ||
    (platformGa4History as { propertyId?: string }).propertyId?.trim() ||
    undefined;

  const ga4VisitorIdDimension =
    tenant?.ga4?.history?.visitorIdDimension?.trim() ||
    (platformGa4History as { visitorIdDimension?: string }).visitorIdDimension?.trim() ||
    "visitor_id";

  const ga4LookbackDays =
    tenant?.ga4?.history?.lookbackDays ??
    (platformGa4History as { lookbackDays?: number }).lookbackDays;

  const ga4CacheTtlMs =
    ((tenant?.ga4?.history?.cacheTtlMinutes ??
      (platformGa4History as { cacheTtlMinutes?: number }).cacheTtlMinutes ??
      30)) * 60_000;

  // ── Staged enrichment pipeline ────────────────────────────────────────────
  const _mmAccountId  = (platformMaxMind as { accountId?: string }).accountId?.trim();
  const _mmLicenseKey = (platformMaxMind as { licenseKey?: string }).licenseKey?.trim();

  return buildCompanyCrmChain({
    maxmindDbPath:               process.env.MAXMIND_DB_PATH?.trim() || undefined,
    maxmindWebService:           _mmAccountId && _mmLicenseKey
                                   ? { accountId: _mmAccountId, licenseKey: _mmLicenseKey }
                                   : undefined,
    ipinfoToken:                 (platformEnrichment as { ipinfoToken?: string }).ipinfoToken || undefined,
    enableReverseGeocode:        pipelineEnabled("reverse-geo",
                                   (platformReverseGeocode as { enabled?: boolean }).enabled ?? false),
    reverseGeocodeLocationIqKey: (platformReverseGeocode as { locationIqApiKey?: string }).locationIqApiKey || undefined,
    reverseGeocodeCacheTtlMs:    ((platformReverseGeocode as { cacheTtlHours?: number }).cacheTtlHours ?? 6) * 3_600_000,
    enableWeather:               pipelineEnabled("weather",
                                   (platformWeather as { enabled?: boolean }).enabled ?? false),
    weatherCacheTtlMs:           ((platformWeather as { cacheTtlHours?: number }).cacheTtlHours ?? 1) * 3_600_000,
    enableOpenKvK:               pipelineEnabled("openkvk",
                                   tenant?.enrichment?.useOpenKvK ?? false),
    openKvKMode:                 (platformOpenKvK as { mode?: "off" | "nl-only" | "always" }).mode,
    openKvKConfidenceThreshold:  (platformOpenKvK as { confidenceThreshold?: number }).confidenceThreshold,
    openKvKMatchingStrategy:     (platformOpenKvK as { matchingStrategy?: "networkOrg" | "companyName" | "networkDomain" }).matchingStrategy,
    kvkApiKey:                   (platformEnrichment as { kvkApiKey?: string }).kvkApiKey || undefined,
    ovioApiKey:                  (platformEnrichment as { ovioApiKey?: string }).ovioApiKey || undefined,
    leadinfoApiKey:              (platformEnrichment as { leadinfoApiKey?: string }).leadinfoApiKey || undefined,
    // Server-side Leadinfo (reverse-IP company identification) is tenant-gated
    // via enrichment.useLeadinfo and needs a platform Leadinfo key. It shares the
    // platform-wide IP→company cache. NOTE: verify the identify endpoint actually
    // returns companies for your key (Platform → Integrations → Enrichment → Test
    // Leadinfo) before relying on it — it is a paid, per-match lookup. Separately,
    // `tenant.leadinfo.enabled` drives the client-side ping.js dashboard tracking.
    enableLeadinfo:              pipelineEnabled("leadinfo",
                                   tenant?.enrichment?.useLeadinfo ?? false),
    hubspotAccessToken:          (platformCrm as { accessToken?: string }).accessToken || undefined,
    enableHubSpot:               pipelineEnabled("hubspot",
                                   tenant?.crm?.useCrmEnrichment ?? false),
    // Only run GA4 history when it's enabled AND fully credentialed. Without a
    // service account + property ID the GA4 query has nothing to authenticate
    // with and stalls until it times out (~4s) on every request — so gate it on
    // the credentials being present to avoid that dead weight in the hot path.
    enableGa4History:            pipelineEnabled("ga4",
                                   tenant?.ga4?.history?.enabled ?? false)
                                 && !!ga4ServiceAccount && !!ga4PropertyId,
    ga4PropertyId,
    ga4ServiceAccount:           ga4ServiceAccount ?? undefined,
    ga4VisitorIdDimension,
    ga4LookbackDays,
    ga4CacheTtlMs,
    enableSeasonalEvents:        pipelineEnabled("seasonal",
                                   tenant?.enrichment?.useSeasonalEvents ?? true),
    holidayAllowedCountries:     (platformHolidays as { countriesFilter?: string }).countriesFilter || undefined,
    isDev:                       process.env.NODE_ENV === "development",
    stageConfig: tenantPipelineStages.length > 0 ? tenantPipelineStages : undefined,
  });
}
