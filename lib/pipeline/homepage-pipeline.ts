/**
 * Homepage Decision Pipeline
 *
 * Extracts the full server-side pipeline that was previously inlined inside
 * app/(site)/page.tsx so it can be shared between the homepage renderer and
 * the /demo debug page (and any future tenant-facing debug surface).
 *
 * ── What lives here ───────────────────────────────────────────────────────────
 *
 *   • Tenant resolution                  • Staged enrichment pipeline
 *   • Visitor history + scenario patch   • Decision context build
 *   • AI / rules / experiment providers  • Experience composition
 *   • Confidence gating                  • Debug snapshots (context, journey,
 *   • CMS provider + home page fetch       enrichment, billing, GA4, Leadinfo)
 *   • Page config assembly               • Cache stats
 *
 * ── What does NOT live here ───────────────────────────────────────────────────
 *
 *   • logServedVariants           — analytics side-effect, stays in page.tsx
 *   • upsertSession               — DB write, stays in page.tsx
 *   • recordPersonalizedSession   — billing side-effect, stays in page.tsx
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   import { runHomepagePipeline } from "@/lib/pipeline/homepage-pipeline";
 *
 *   // Inside a Next.js server component:
 *   const result = await runHomepagePipeline({ params });
 */

import "server-only";

import { headers, cookies, draftMode }     from "next/headers";
import { isSupportedLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/locale";
import { fetchVisitorHistory }             from "@/context/fetch-visitor-history";
import { RulesDecisionProvider, ExperimentDecisionProvider } from "@/decision";
import { loadTenantRulesConfig }           from "@/decision/rules/load-tenant-rules";
import { fetchVariantCatalogue }           from "@/decision/rules/fetch-variant-catalogue";
import type { DecisionProvider }           from "@/decision/providers/decision-provider";
import { buildDecisionContext }            from "@/decision/context/build-decision-context";
import type { EnrichmentDebugInfo }        from "@/decision/context/build-decision-context";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createCMSProvider, createPreviewCMSProvider } from "@/cms";
import { composeHomepageExperience }       from "@/experience";
import type { CmsFallbackKeys }            from "@/experience";
import { applyConfidenceGating }           from "@/decision/apply-confidence-gating";
import { emptyJourneyState }              from "@/lib/journey/types";
import { DEFAULT_HOMEPAGE_PLAN }          from "@/decision/rules/homepage-rules";
import { resolveSession }                  from "@/data/session";
import { fetchRecentJourneyEvents }        from "@/lib/journey/fetch-journey-state";
import { buildFullContextSnapshot }        from "@/context/debug-snapshot";
import { LEADINFO_COOKIE }                 from "@/context/leadinfo-context";
import type { LeadinfoDebugInfo, Ga4HistoryDebugInfo } from "@/components/blocks/EnrichmentDebugPanel";
import {
  parseScenarioCookie,
  applyScenarioToHistory,
  applyScenarioToDecisionContext,
} from "@/lib/scenario/server-scenario";
import { evaluateAudienceSegments } from "@/audience-segments/evaluate";
import { applyAudienceSegments }    from "@/decision/decision-context";
import { getDemoScenarioPlan, getSegmentDemoPlan } from "@/lib/demo/demo-scenario-plans";
import { getTenantAiRuntimeConfig }        from "@/ai/config";
import { createAiProvider }                from "@/ai/providers/create-ai-provider";
import { AiDecisionProvider }             from "@/decision/providers/ai-decision-provider";
import type { AiDecisionMeta }             from "@/decision/providers/ai-decision-provider";
import { ShadowAiDecisionProvider }        from "@/decision/providers/shadow-ai-decision-provider";
import { DEFAULT_CONFIDENCE_POLICY }       from "@/decision/ai-confidence-policy";
import { logger }                          from "@/lib/logger";
import {
  getTenantById,
  getActiveTenantWithDevOverride,
  resolveThemeForTenant,
  resolvedThemeToCSS,
  getEnabledContextBlocks,
  filterSectionsByTenant,
  getTenantFeatures,
  getTenantPipelineStages,
} from "@/tenant/server";
import { THEME_SESSION_COOKIE }            from "@/lib/theme-session";
import { isThemePresetKey }                from "@/design-system/theme/presets";
import type { ThemePresetKey }             from "@/design-system/theme/presets";
import { buildCompanyCrmChain }            from "@/enrichment";
import {
  getPlatformEnrichmentSettings,
  getPlatformCrmSettings,
  getPlatformOpenKvKSettings,
  getPlatformReverseGeocodeSettings,
  getPlatformWeatherSettings,
  getPlatformGa4HistorySettings,
  getPlatformHolidaySettings,
} from "@/platform/platform-store";
import { buildHomepagePageConfig }         from "@/page-config/assemblers/homepage";
import {
  getCmsCacheStats,
  CMS_CACHE_ENABLED,
  CMS_CACHE_TTL_MS,
} from "@/cache/cms-cache";
import {
  getDecisionPlanMeta,
  DECISION_CACHE_ENABLED,
  DECISION_CACHE_TTL_MS,
} from "@/cache/decision-cache";
import {
  SESSION_TTL_MS,
  SESSION_STALE_GRACE_MS,
} from "@/enrichment/session-enrichment-cache";
import { SANITY_REVALIDATE_SECONDS }       from "@/cms/providers/sanity-client";
import { resolveContextBlockVariant }      from "@/page-config/block-variants";

// ── GA4 service account helper ────────────────────────────────────────────────

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

// ── Pipeline input ────────────────────────────────────────────────────────────

export interface HomepagePipelineInput {
  /** Next.js searchParams (from PageProps) */
  params: Record<string, string | string[] | undefined>;
}

// ── Pipeline result ───────────────────────────────────────────────────────────
//
// The return type is inferred from the return statement below (the object
// literal) to avoid having to keep two parallel type definitions in sync.
// Consumers can use `Awaited<ReturnType<typeof runHomepagePipeline>>` if they
// need the type explicitly.

// ── Main export ───────────────────────────────────────────────────────────────

export async function runHomepagePipeline({ params }: HomepagePipelineInput) {
  const h             = await headers();
  const cookieHeader  = h.get("cookie");
  const cookieStore   = await cookies();
  const localeRaw     = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale        = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;

  // Build a synthetic Request so buildDecisionContext can extract UTM params,
  // user-agent, referer, etc. exactly as it would for a real page visit.
  const url = new URL("http://localhost:3000");
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") url.searchParams.set(key, value);
  }
  const request = new Request(url.toString(), {
    headers: new Headers({
      "user-agent": h.get("user-agent") ?? "",
      referer:      h.get("referer") ?? "",
      cookie:       cookieHeader ?? "",
    }),
  });

  const { sessionId } = resolveSession(cookieHeader);

  // ── Tenant resolution ─────────────────────────────────────────────────────
  const { tenantConfig, devTenantOverride, devOverrideSource } =
    await getActiveTenantWithDevOverride(params, "homepage");

  // ── Parallel DB kicks ─────────────────────────────────────────────────────
  const historyPromise = fetchVisitorHistory(sessionId, tenantConfig.tenantId);

  const platformSettingsPromise = Promise.all([
    getPlatformEnrichmentSettings(),
    getPlatformCrmSettings(),
    getPlatformOpenKvKSettings(),
    getPlatformReverseGeocodeSettings(),
    getPlatformWeatherSettings(),
    getPlatformGa4HistorySettings(),
    getPlatformHolidaySettings(),
  ] as const);

  const pipelineStagesPromise = getTenantPipelineStages(tenantConfig.tenantId);

  const tenantRulesConfigPromise = (async () => {
    try {
      const catalogue = await fetchVariantCatalogue(tenantConfig.tenantId);
      const extraKeys = {
        heroKeys:  catalogue.hero.filter((e) => e.source !== "platform").map((e) => e.key),
        proofKeys: catalogue.proof.filter((e) => e.source !== "platform").map((e) => e.key),
        ctaKeys:   catalogue.cta.filter((e) => e.source !== "platform").map((e) => e.key),
      };
      return await loadTenantRulesConfig(tenantConfig.tenantId, extraKeys);
    } catch {
      return null;
    }
  })();

  const tenant = await getTenantById(tenantConfig.tenantId);

  // ── Debug visibility ──────────────────────────────────────────────────────
  const debugOverlayEnabled =
    tenant?.debug?.showDebugOverlay === true &&
    tenant.debug.debugLevel !== "off";
  const debugLevel = debugOverlayEnabled
    ? (tenant!.debug!.debugLevel ?? "full") as "summary" | "full"
    : "off" as const;

  // ── Decision provider stack ───────────────────────────────────────────────
  const tenantRulesConfig   = await tenantRulesConfigPromise;
  const experimentsEnabled  = tenant?.experiments?.enabled ?? true;

  // Dev-only: ?_expBucket=1 forces the challenger bucket so experiments can be
  // verified without relying on random session hashing.  No-op in production.
  const devForceBucket =
    process.env.NODE_ENV !== "production" && params._expBucket === "1" ? 1 : undefined;

  const baseDecisionProvider = new ExperimentDecisionProvider(
    new RulesDecisionProvider(tenantRulesConfig ?? undefined),
    sessionId,
    experimentsEnabled,
    tenantConfig.tenantId,
    devForceBucket,
  );

  const aiConfig = getTenantAiRuntimeConfig(tenant);
  const aiPolicy = {
    ...DEFAULT_CONFIDENCE_POLICY,
    minConfidence: aiConfig.confidenceThreshold,
  };

  let decisionProvider: DecisionProvider = baseDecisionProvider;

  if (aiConfig.mode === "shadow") {
    try {
      const aiProvider = createAiProvider(aiConfig.shadowProvider);
      decisionProvider = new ShadowAiDecisionProvider(
        baseDecisionProvider,
        aiProvider,
        sessionId,
        aiPolicy,
        tenantConfig.tenantId,
      );
    } catch (err) {
      logger.warn("[pipeline] Failed to construct ShadowAiDecisionProvider; using base", {
        sessionId, tenantId: tenantConfig.tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else if (aiConfig.mode === "live") {
    try {
      const aiProvider = createAiProvider(aiConfig.liveProvider);
      decisionProvider = new AiDecisionProvider(
        baseDecisionProvider,
        aiProvider,
        sessionId,
        aiPolicy,
        false,
        tenantConfig.tenantId,
      );
    } catch (err) {
      logger.warn("[pipeline] Failed to construct AiDecisionProvider; using base", {
        sessionId, tenantId: tenantConfig.tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── CMS provider ──────────────────────────────────────────────────────────
  const { isEnabled: isPreview } = await draftMode();
  const cmsProvider = isPreview
    ? createPreviewCMSProvider(tenant?.cms, tenantConfig.tenantId, locale)
    : createCMSProvider(tenant?.cms, tenantConfig.tenantId, locale);

  const homePagePromise = cmsProvider.getPageBySlug("home", locale);

  // ── Await parallel results ────────────────────────────────────────────────
  const [
    history,
    [
      platformEnrichmentResult,
      platformCrmResult,
      platformOpenKvKResult,
      platformReverseGeocodeResult,
      platformWeatherResult,
      platformGa4HistoryResult,
      platformHolidayResult,
    ],
    tenantPipelineStages,
  ] = await Promise.all([historyPromise, platformSettingsPromise, pipelineStagesPromise]);

  const pipelineStageCfg = new Map(
    tenantPipelineStages.map((s) => [s.stageKey, s]),
  );
  const pipelineEnabled = (stageKey: string, fallback: boolean): boolean =>
    pipelineStageCfg.has(stageKey) ? Boolean(pipelineStageCfg.get(stageKey)?.enabled) : fallback;

  // ── Scenario override — pass 1: history ──────────────────────────────────
  const realHistory       = history;
  const scenarioOverrides = parseScenarioCookie(cookieHeader);
  const effectiveHistory  = scenarioOverrides
    ? applyScenarioToHistory(history, scenarioOverrides)
    : history;

  // ── Platform settings extraction ──────────────────────────────────────────
  const platformEnrichment     = platformEnrichmentResult.ok     ? platformEnrichmentResult.data     : {};
  const platformCrm            = platformCrmResult.ok            ? platformCrmResult.data            : {};
  const platformOpenKvK        = platformOpenKvKResult.ok        ? platformOpenKvKResult.data        : {};
  const platformReverseGeocode = platformReverseGeocodeResult.ok ? platformReverseGeocodeResult.data : {};
  const platformWeather        = platformWeatherResult.ok        ? platformWeatherResult.data        : {};
  const platformGa4History     = platformGa4HistoryResult.ok     ? platformGa4HistoryResult.data     : {};
  const platformHolidays       = platformHolidayResult.ok        ? platformHolidayResult.data        : {};

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
  const stagedEnrichers = buildCompanyCrmChain({
    maxmindDbPath:               process.env.MAXMIND_DB_PATH?.trim() || undefined,
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
    ovioApiKey:                  (platformEnrichment as { ovioApiKey?: string }).ovioApiKey || undefined,
    leadinfoApiKey:              (platformEnrichment as { leadinfoApiKey?: string }).leadinfoApiKey || undefined,
    enableLeadinfo:              pipelineEnabled("leadinfo",
                                   tenant?.leadinfo?.enabled ?? false),
    hubspotAccessToken:          (platformCrm as { accessToken?: string }).accessToken || undefined,
    enableHubSpot:               pipelineEnabled("hubspot",
                                   tenant?.crm?.useCrmEnrichment ?? false),
    enableGa4History:            pipelineEnabled("ga4",
                                   tenant?.ga4?.history?.enabled ?? false),
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

  // ── Billing client ────────────────────────────────────────────────────────
  const billingClient = (() => {
    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) {
      logger.warn("[pipeline] billingClient not created — SUPABASE env vars missing; billing disabled");
      return null;
    }
    return createSupabaseClient(url, key, { auth: { persistSession: false } });
  })();

  // ── Decision context ──────────────────────────────────────────────────────
  let debugInfo: EnrichmentDebugInfo | null = null;

  const rawInput = await buildDecisionContext({
    request,
    history:           effectiveHistory,
    tenantId:          tenantConfig.tenantId,
    templateKey:       "homepage",
    pageType:          "homepage",
    onDebugInfo:       (info) => { debugInfo = info; },
    ipOverrideEnabled: tenant?.enrichment?.testIpEnabled  ?? false,
    ipOverride:        tenant?.enrichment?.testIpAddress  ?? null,
    sessionId,
    stagedEnrichers,
    timezone:          tenant?.timezone ?? null,
    billingClient,
  });

  // ── Scenario override — pass 2: request/enrichment fields ────────────────
  const postScenarioInput = scenarioOverrides
    ? applyScenarioToDecisionContext(rawInput, scenarioOverrides)
    : rawInput;

  // ── Audience segment evaluation ───────────────────────────────────────────
  //
  // Must run AFTER all scenario overrides so that segment criteria are
  // evaluated against the fully-patched context (correct interest scores,
  // enrichment, journey state, etc.).
  //
  // When the scenario explicitly overrides audienceSegmentIds, skip the DB
  // evaluation entirely — the override value is already baked in by
  // applyScenarioToDecisionContext above.
  const input = scenarioOverrides?.audienceSegmentIds !== undefined
    ? postScenarioInput  // already set by applyScenarioToDecisionContext
    : applyAudienceSegments(
        postScenarioInput as unknown as import("@/decision/decision-context").DecisionContext,
        await evaluateAudienceSegments(postScenarioInput, tenantConfig.tenantId),
      ) as typeof postScenarioInput;

  // ── CMS home page ─────────────────────────────────────────────────────────
  const homePage = await homePagePromise;

  const cmsFallbackKeys: CmsFallbackKeys | undefined = homePage?.contextConfig
    ? {
        heroKey:  homePage.contextConfig.hero?.fallbackVariantKey,
        proofKey: homePage.contextConfig.proof?.fallbackVariantKey,
        ctaKey:   homePage.contextConfig.cta?.fallbackVariantKey,
      }
    : undefined;

  // ── Debug snapshot ────────────────────────────────────────────────────────
  const capturedDebugInfo = debugInfo as EnrichmentDebugInfo | null;
  const contextSnapshot = debugLevel === "full"
    ? buildFullContextSnapshot(input, {
        enrichmentTrace:   capturedDebugInfo?.enrichmentTrace,
        scenarioOverrides: scenarioOverrides ?? null,
        rawCtx:            scenarioOverrides ? rawInput : undefined,
      })
    : null;

  const journeyDebugEvents = debugLevel === "full"
    ? await fetchRecentJourneyEvents(sessionId, tenantConfig.tenantId, 20)
    : [];

  // ── Leadinfo debug info ───────────────────────────────────────────────────
  const isLeadinfoSimulation = params["_sim"] === "downstream";
  const enrichmentAny        = (input as unknown as { enrichment?: Record<string, unknown> }).enrichment;
  const liCookiePresent      = cookieHeader ? cookieHeader.includes(`${LEADINFO_COOKIE}=`) : false;

  const leadinfoDebugInfo: LeadinfoDebugInfo = {
    configured:      (tenant?.leadinfo?.enabled === true) && !!tenant?.leadinfo?.siteToken,
    cookiePresent:   liCookiePresent,
    matched:         (enrichmentAny?.leadinfoMatched as boolean | null) ?? null,
    companyName:     (enrichmentAny?.leadinfoCompanyName  as string | null) ?? null,
    companyDomain:   (enrichmentAny?.leadinfoCompanyDomain as string | null) ?? null,
    companyCountry:  (enrichmentAny?.leadinfoCompanyCountry as string | null) ?? null,
    pushToDataLayer: tenant?.leadinfo?.pushToDataLayer ?? false,
    storeInContext:  tenant?.leadinfo?.storeInContext  ?? true,
    dataSource:      liCookiePresent ? "real-browser" : "absent",
    simulationMode:  isLeadinfoSimulation ? "leadinfo_downstream" : undefined,
  };

  // ── GA4 history debug info ────────────────────────────────────────────────
  const ga4IsConfigured =
    tenant?.ga4?.history?.enabled === true &&
    !!tenant?.ga4?.history?.propertyId &&
    !!tenant?.ga4?.history?.serviceAccountJson;

  const ga4DimensionName = "customUser:" + (tenant?.ga4?.history?.visitorIdDimension ?? "visitor_id");

  let ga4HistoryDebugInfo: Ga4HistoryDebugInfo;

  if (!ga4IsConfigured) {
    ga4HistoryDebugInfo = {
      configured: false, visitorId: sessionId, dimensionName: ga4DimensionName,
      stageStatus: "not-configured", durationMs: 0,
    };
  } else if (capturedDebugInfo?.enrichmentSource === "session-cache") {
    ga4HistoryDebugInfo = {
      configured: true, visitorId: sessionId, dimensionName: ga4DimensionName,
      stageStatus: "session-cache", durationMs: 0,
    };
  } else {
    const ga4Stage =
      (capturedDebugInfo?.stageTrace ?? []).find((s) => s.label === "GA4 History") ?? null;

    if (!ga4Stage) {
      ga4HistoryDebugInfo = {
        configured: true, visitorId: sessionId, dimensionName: ga4DimensionName,
        stageStatus: "not-configured", durationMs: 0,
      };
    } else if (ga4Stage.skipped) {
      ga4HistoryDebugInfo = {
        configured: true, visitorId: sessionId, dimensionName: ga4DimensionName,
        stageStatus: "skipped", skipReason: ga4Stage.skipReason, durationMs: ga4Stage.durationMs,
      };
    } else if (ga4Stage.error) {
      ga4HistoryDebugInfo = {
        configured: true, visitorId: sessionId, dimensionName: ga4DimensionName,
        stageStatus: "error", error: ga4Stage.error, durationMs: ga4Stage.durationMs,
      };
    } else if (ga4Stage.output.gaHistorySource === "ga4") {
      ga4HistoryDebugInfo = {
        configured:            true,
        visitorId:             sessionId,
        dimensionName:         ga4DimensionName,
        stageStatus:           "ran-with-data",
        durationMs:            ga4Stage.durationMs,
        rowsReturned:          ga4Stage.output.gaRowsReturned ?? undefined,
        gaCurrentCity:         ga4Stage.output.gaCurrentCity ?? null,
        gaCurrentRegion:       ga4Stage.output.gaCurrentRegion ?? null,
        gaCurrentCountry:      ga4Stage.output.gaCurrentCountry ?? null,
        gaCurrentChannelGroup: ga4Stage.output.gaCurrentChannelGroup ?? null,
        gaLastKnownCity:       ga4Stage.output.gaLastKnownCity ?? null,
        gaLastKnownRegion:     ga4Stage.output.gaLastKnownRegion ?? null,
        gaLastKnownCountry:    ga4Stage.output.gaLastKnownCountry ?? null,
        gaLastChannelGroup:    ga4Stage.output.gaLastChannelGroup ?? null,
      };
    } else {
      ga4HistoryDebugInfo = {
        configured: true, visitorId: sessionId, dimensionName: ga4DimensionName,
        stageStatus: "ran-empty", durationMs: ga4Stage.durationMs, rowsReturned: 0,
      };
    }
  }

  // ── Demo scenario bypass ──────────────────────────────────────────────────
  //
  // When the Scenario Control Panel activates a preset, it stores `_scenarioKey`
  // in the mc_scenario cookie.  If the key maps to a known demo plan, we bypass
  // the rule engine and directly supply the hardcoded variant keys.
  //
  // This ensures visible content changes when switching scenarios regardless of
  // whether the tenant has any rules configured — which is the correct behaviour
  // for demo / sales sessions where rule setup hasn't been completed yet.
  //
  // The context overrides (funnelStage, intentScore, etc.) still apply via
  // applyScenarioToHistory / applyScenarioToDecisionContext above — the debug
  // panel will reflect the effective context correctly.
  const demoPlan = getDemoScenarioPlan(scenarioOverrides?._scenarioKey)
    ?? getSegmentDemoPlan(scenarioOverrides?.audienceSegmentIds);
  const effectiveDecisionProvider: DecisionProvider = demoPlan
    ? { getHomepagePlan: async () => demoPlan }
    : decisionProvider;

  if (demoPlan) {
    logger.debug("[pipeline] Demo scenario bypass active", {
      tenantId:    tenantConfig.tenantId,
      scenarioKey: scenarioOverrides?._scenarioKey,
      segmentIds:  scenarioOverrides?.audienceSegmentIds,
      heroKey:     demoPlan.heroKey,
      ctaKey:      demoPlan.ctaKey,
    });
  }

  // ── Experience composition ────────────────────────────────────────────────
  const composed = await composeHomepageExperience(
    input,
    effectiveDecisionProvider,
    cmsProvider,
    cmsFallbackKeys,
  );

  const { experience } = composed;

  // ── Confidence gating ─────────────────────────────────────────────────────
  //
  // Gating is BYPASSED when a scenario override is active.  The scenario
  // control exists specifically to preview what different visitor segments
  // would see — gating that down to the fallback plan defeats the purpose
  // and is why variants appeared not to change when switching scenarios.
  //
  // Gating is also BYPASSED when a plan experiment is running in challenger
  // mode.  Experiments deliberately test on randomised traffic regardless of
  // confidence score — gating the challenger back to the default plan would
  // make experiments invisible and unverifiable.
  //
  // Real visitor sessions with no active experiment challenger are always gated.
  const appliedExperiment = baseDecisionProvider.lastAppliedPlanExperiment;
  const experimentChallenger = appliedExperiment?.isChallenger ?? false;

  const journeyForGating = effectiveHistory.journey ?? emptyJourneyState();
  const defaultPlan = {
    heroKey:  DEFAULT_HOMEPAGE_PLAN.heroKey,   // "hero_direct_brand"
    proofKey: DEFAULT_HOMEPAGE_PLAN.proofKey,  // "proof_platform"
    ctaKey:   DEFAULT_HOMEPAGE_PLAN.ctaKey,    // "cta_meeting"
  };
  const { plan: gatedPlan, gating: adaptiveGating, anySlotGated, gatingSummary } =
    (scenarioOverrides || experimentChallenger)
      ? {
          plan:          experience.plan,
          gating:        { cta: true, proof: true, hero: true, theme: true, blockedReasons: [] },
          anySlotGated:  false,
          gatingSummary: experimentChallenger
            ? "Plan experiment challenger active — confidence gating bypassed."
            : "Scenario mode active — confidence gating bypassed.",
        }
      : applyConfidenceGating(experience.plan, journeyForGating, defaultPlan);

  if (anySlotGated) {
    // Save the pre-gating keys so we know which slots actually changed.
    const prePlan = experience.plan;
    experience.plan = gatedPlan;

    // The composer fetched CMS content for the original plan keys BEFORE gating
    // ran.  Now that gating has replaced one or more keys, we must re-fetch the
    // CMS content for those slots — otherwise the page renders the old content
    // even though experience.plan now points to the fallback keys.
    const heroChanged  = gatedPlan.heroKey  !== prePlan.heroKey;
    const proofChanged = gatedPlan.proofKey !== prePlan.proofKey;
    const ctaChanged   = gatedPlan.ctaKey   !== prePlan.ctaKey;

    if (heroChanged || proofChanged || ctaChanged) {
      const [newHero, newProof, newCta] = await Promise.all([
        heroChanged  ? cmsProvider.getHeroVariant(gatedPlan.heroKey)   : Promise.resolve(null),
        proofChanged ? cmsProvider.getProofVariant(gatedPlan.proofKey) : Promise.resolve(null),
        ctaChanged   ? cmsProvider.getCTAVariant(gatedPlan.ctaKey)     : Promise.resolve(null),
      ]);
      if (newHero)  experience.hero  = newHero;
      if (newProof) experience.proof = newProof;
      if (newCta)   experience.cta   = newCta;
    }
  }

  // ── AI metadata ───────────────────────────────────────────────────────────
  const aiMeta: AiDecisionMeta | null =
    decisionProvider instanceof AiDecisionProvider ? decisionProvider.lastDecisionMeta : null;

  const aiPromptPayload: { userPrompt: string; signalCount: number } | null =
    decisionProvider instanceof AiDecisionProvider ? decisionProvider.lastPromptPayload : null;

  // ── Tenant features ───────────────────────────────────────────────────────
  const tenantFeatures = getTenantFeatures(tenant);

  // ── CMS sections + block gating ───────────────────────────────────────────
  const homeSections       = homePage?.sections ?? [];
  const enabledContextBlocks = getEnabledContextBlocks(tenant);
  const filteredSections     = filterSectionsByTenant(homeSections, tenant);

// ── Theme ─────────────────────────────────────────────────────────────────
  const _mcThemeCookieRe = new RegExp(`(?:^|;\\s*)${THEME_SESSION_COOKIE}=([^;]+)`);
  const _mcThemeRaw      = cookieHeader
    ? _mcThemeCookieRe.exec(cookieHeader)?.[1] ?? null
    : null;
  const activeThemeKey: ThemePresetKey | null =
    _mcThemeRaw && isThemePresetKey(_mcThemeRaw) ? (_mcThemeRaw as ThemePresetKey) : null;

  const resolvedTheme     = resolveThemeForTenant(tenant, activeThemeKey);
  const themeOverrideCount = Object.keys(
    resolvedThemeToCSS(resolvedTheme) ? resolvedTheme.vars : {},
  ).length;

  // ── Cache metadata ────────────────────────────────────────────────────────
  const cmsCacheStats    = getCmsCacheStats();
  const decisionPlanMeta = getDecisionPlanMeta(sessionId);
  const isDev            = process.env.NODE_ENV === "development";

  // ── Page config (used by homepage TemplateRenderer) ───────────────────────
  const { pageConfig, contextData } = buildHomepagePageConfig(
    experience,
    filteredSections,
    enabledContextBlocks,
    homePage
      ? { title: homePage.title, seoTitle: homePage.seoTitle, seoDescription: homePage.seoDescription }
      : undefined,
  );

  // ── Return all computed data ───────────────────────────────────────────────
  return {
    // Request / session
    sessionId,
    // Experiment
    appliedExperiment,
    experimentChallenger,
    locale,
    hostHeader: h.get("host"),
    isDev,

    // Tenant
    tenantConfig,
    devTenantOverride,
    devOverrideSource,
    tenant,
    tenantFeatures,

    // Debug visibility
    debugOverlayEnabled,
    debugLevel,

    // History / scenario
    history,
    realHistory,
    effectiveHistory,
    scenarioOverrides,

    // Decision context
    input,      // effective (post-scenario)
    rawInput,   // pre-scenario (for debug diff)

    // Experience
    experience,
    composed,
    gatedPlan,
    adaptiveGating,
    anySlotGated,
    gatingSummary,

    // AI
    aiConfig,
    aiMeta,
    aiPromptPayload,

    // CMS
    homePage,
    cmsFallbackKeys,
    filteredSections,
    enabledContextBlocks,

    // Debug data
    capturedDebugInfo,
    contextSnapshot,
    journeyDebugEvents,
    leadinfoDebugInfo,
    ga4HistoryDebugInfo,
    billingClient,

    // Theme
    resolvedTheme,
    themeOverrideCount,
    activeThemeKey,

    // Cache
    cmsCacheStats,
    decisionPlanMeta,

    // Visibility helpers (re-exported for debug panels)
    CMS_CACHE_ENABLED,
    CMS_CACHE_TTL_MS,
    DECISION_CACHE_ENABLED,
    DECISION_CACHE_TTL_MS,
    SESSION_TTL_MS,
    SESSION_STALE_GRACE_MS,
    SANITY_REVALIDATE_SECONDS,

    // Page config (homepage only)
    pageConfig,
    contextData,

    // For resolveContextBlockVariant display in debug
    resolveContextBlockVariant,
  };
}

/** Convenience type — use to annotate the result anywhere you need it */
export type HomepagePipelineResult = Awaited<ReturnType<typeof runHomepagePipeline>>;
