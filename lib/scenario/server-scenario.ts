/**
 * Server-side scenario override utilities  —  lib/scenario/server-scenario.ts
 *
 * Reads the `mc_scenario` cookie (written by the client-side ScenarioControlPanel
 * via `scenario-store.syncCookie`) and applies the overrides across ALL layers of
 * the effective context before it enters the rule-evaluation pipeline.
 *
 * ─── Cookie flow ─────────────────────────────────────────────────────────────
 *
 *   Client:  ScenarioControlPanel activates a preset / manual overrides.
 *            → activateScenario() → save() → syncCookie() writes mc_scenario.
 *
 *   Server:  On the next navigation / page refresh, the cookie is sent with the
 *            HTTP request.  page.tsx calls parseScenarioCookie(), then applies
 *            overrides in two passes:
 *
 *              1. applyScenarioToHistory()        — before buildDecisionContext
 *                 Patches behavioral/journey fields in VisitorHistory so
 *                 buildDecisionContext receives the effective history.
 *
 *              2. applyScenarioToDecisionContext() — after buildDecisionContext
 *                 Patches request, enrichment, and interest fields directly
 *                 on the assembled RuleEvaluationContext so the rule engine,
 *                 experiments, AI, and debug all see the effective values.
 *
 * ─── Override coverage ───────────────────────────────────────────────────────
 *
 *   Pass 1 (applyScenarioToHistory):
 *     • journey.funnelStage, intentScore, frictionScore, confidence, page flags
 *     • history.pageViewCount, hasClickedCta
 *
 *   Pass 2 (applyScenarioToDecisionContext):
 *     • Request:          visitType, source, device, utmSource/Medium/Campaign
 *     • Network/IP:       ipAddress (stored in context for display and rules)
 *     • Enrichment batch: enrichmentPatch (raw Partial<EnrichmentOutput>)
 *     • Enrichment — Geo: city, region, countryCode, latitude, longitude
 *     • Enrichment — Net: networkOrg, ipVersion, isCloudProvider
 *     • Enrichment — Co.: companyName, companyDomain, companyIndustry, companySize
 *     • Enrichment — Ads: adCampaign, adAdGroup, adKeyword
 *     • Enrichment — CRM: crmMatched, crmLifecycleStage, crmDealStage, crmSegment
 *     • Enrichment — ABM: targetAccountMatched, targetAccountTier
 *     • Enrichment — Wthr: weatherCode, temperatureNow, isRaining, windSpeed
 *     • Interest:         interestPrimary, interestSecondary, interestConfidence
 *     • Time:             currentHour, dayOfWeek, isWeekend, month, dateKey,
 *                         timeOfDay, seasonalEvent
 *                         → derived context is recomputed after time overrides
 *                           so daySegment, isWorkHours, season, isHoliday all
 *                           reflect the overridden values automatically.
 *
 * ─── Safety contract ─────────────────────────────────────────────────────────
 *
 *   • parseScenarioCookie returns null on any parse / validation failure —
 *     the pipeline falls back to real data silently.
 *   • Both apply functions return new objects — never mutate the original.
 *   • No network calls, no DB writes — pure transformations only.
 *   • This module has no "use client" — safe to import from Server Components.
 */

import type { VisitorHistory } from "@/context/visitor-history";
import { emptyHistory } from "@/context/visitor-history";
import type { ScenarioOverrides } from "@/components/scenario/scenario-store";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { applyScenarioOverride } from "@/components/scenario/apply-scenario-override";
import { computeDerivedContext } from "@/context/derived-context";
import { emptyJourneyState } from "@/lib/journey/types";

// ── Cookie name (must match SCENARIO_COOKIE in scenario-store.ts) ─────────────

export const SCENARIO_COOKIE_NAME = "mc_scenario";

// ── Cookie parser ─────────────────────────────────────────────────────────────

/**
 * Parses the `mc_scenario` cookie value from a raw HTTP `Cookie:` header string.
 *
 * Returns `null` when:
 *   - The cookie header is absent or empty.
 *   - The cookie is not present in the header.
 *   - The cookie value is not valid URI-encoded JSON.
 *   - The JSON does not parse to a plain object.
 *
 * Never throws.
 */
export function parseScenarioCookie(cookieHeader: string | null | undefined): ScenarioOverrides | null {
  if (!cookieHeader) return null;

  // Match `mc_scenario=<value>` anywhere in the cookie string.
  const match = cookieHeader.match(/(?:^|;\s*)mc_scenario=([^;]+)/);
  if (!match?.[1]) return null;

  try {
    const decoded = decodeURIComponent(match[1].trim());
    const parsed = JSON.parse(decoded) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    if (Object.keys(parsed).length === 0) return null;

    return parsed as ScenarioOverrides;
  } catch {
    return null;
  }
}

// ── Pass 1: History applier ───────────────────────────────────────────────────

/**
 * Applies scenario overrides to a `VisitorHistory` and returns a new
 * "effective" history ready for buildDecisionContext.
 *
 * Covers: funnelStage, intentScore, frictionScore, confidence, page flags,
 * hasStartedForm (via formStartCount), matchedSequences, hasClickedCta,
 * isCustomer, planTier, pageViewCount.
 *
 * The original `history` is never mutated.
 */
export function applyScenarioToHistory(
  history:   VisitorHistory,
  overrides: ScenarioOverrides,
): VisitorHistory {
  const realJourney      = history.journey ?? emptyJourneyState();
  const effectiveJourney = applyScenarioOverride(realJourney, overrides);

  return {
    ...history,
    journey:      effectiveJourney,
    hasClickedCta: overrides.hasClickedCta ?? history.hasClickedCta,
    pageViewCount: overrides.pageViewCount !== undefined
      ? overrides.pageViewCount
      : history.pageViewCount,
  };
}

// ── Pass 2: Decision context applier ─────────────────────────────────────────

/**
 * Applies scenario overrides to a fully-assembled `RuleEvaluationContext`
 * (the output of `buildDecisionContext`) and returns a new effective context.
 *
 * This is Pass 2 — it covers ALL layers that buildDecisionContext assembles
 * from the HTTP request, CDN headers, and external enrichment APIs.
 *
 * Precedence within enrichment:
 *   1. Real enrichment output from buildDecisionContext (base)
 *   2. enrichmentPatch (batch result from enricher re-run) — merged on top
 *   3. Individual field overrides (city, companyName, etc.) — highest priority
 *
 * The original context is never mutated.
 * Returns the input unchanged when no relevant override fields are set.
 */
export function applyScenarioToDecisionContext(
  ctx:       RuleEvaluationContext,
  overrides: ScenarioOverrides,
): RuleEvaluationContext {
  // ── Fast-path detection ───────────────────────────────────────────────────
  const hasRequestOverrides =
    overrides.visitType   !== undefined ||
    overrides.source      !== undefined ||
    overrides.device      !== undefined ||
    overrides.utmSource   !== undefined ||
    overrides.utmMedium   !== undefined ||
    overrides.utmCampaign !== undefined;

  const hasIpOverride = overrides.ipAddress !== undefined;

  const hasEnrichmentBatch = overrides.enrichmentPatch !== undefined &&
    Object.keys(overrides.enrichmentPatch).length > 0;

  const hasEnrichmentOverrides =
    // Geo
    overrides.city            !== undefined ||
    overrides.region          !== undefined ||
    overrides.countryCode     !== undefined ||
    overrides.latitude        !== undefined ||
    overrides.longitude       !== undefined ||
    // Network
    overrides.networkOrg      !== undefined ||
    overrides.ipVersion       !== undefined ||
    overrides.isCloudProvider !== undefined ||
    // Company
    overrides.companyName     !== undefined ||
    overrides.companyDomain   !== undefined ||
    overrides.companyIndustry !== undefined ||
    overrides.companySize     !== undefined ||
    // Ads
    overrides.adCampaign      !== undefined ||
    overrides.adAdGroup       !== undefined ||
    overrides.adKeyword       !== undefined ||
    // CRM
    overrides.crmMatched        !== undefined ||
    overrides.crmLifecycleStage !== undefined ||
    overrides.crmDealStage      !== undefined ||
    overrides.crmSegment        !== undefined ||
    // ABM
    overrides.targetAccountMatched !== undefined ||
    overrides.targetAccountTier    !== undefined ||
    // Weather
    overrides.weatherCode      !== undefined ||
    overrides.temperatureNow   !== undefined ||
    overrides.isRaining        !== undefined ||
    overrides.windSpeed        !== undefined;

  const hasInterestOverrides =
    overrides.interestPrimary    !== undefined ||
    overrides.interestSecondary  !== undefined ||
    overrides.interestConfidence !== undefined;

  // Time overrides — applied directly to the top-level ctx fields.
  // When any time field changes, derived context MUST be recomputed so
  // daySegment, isWorkHours, season, and isHoliday all stay consistent.
  const hasTimeOverrides =
    overrides.currentHour   !== undefined ||
    overrides.dayOfWeek     !== undefined ||
    overrides.isWeekend     !== undefined ||
    overrides.month         !== undefined ||
    overrides.dateKey       !== undefined ||
    overrides.timeOfDay     !== undefined ||
    overrides.seasonalEvent !== undefined;

  // Audience segment IDs override — bypasses runtime DB evaluation entirely.
  const hasSegmentOverride = overrides.audienceSegmentIds !== undefined;

  if (
    !hasRequestOverrides &&
    !hasIpOverride &&
    !hasEnrichmentBatch &&
    !hasEnrichmentOverrides &&
    !hasInterestOverrides &&
    !hasTimeOverrides &&
    !hasSegmentOverride
  ) {
    return ctx;
  }

  let effective: RuleEvaluationContext = { ...ctx };

  // ── 1. Request / session fields ───────────────────────────────────────────
  if (overrides.visitType   !== undefined) effective = { ...effective, visitType:   overrides.visitType };
  if (overrides.source      !== undefined) effective = { ...effective, source:      overrides.source };
  if (overrides.device      !== undefined) effective = { ...effective, device:      overrides.device };
  if (overrides.utmSource   !== undefined) effective = { ...effective, utmSource:   overrides.utmSource };
  if (overrides.utmMedium   !== undefined) effective = { ...effective, utmMedium:   overrides.utmMedium };
  if (overrides.utmCampaign !== undefined) effective = { ...effective, utmCampaign: overrides.utmCampaign };

  // ── 1b. IP address override ────────────────────────────────────────────────
  // Stored as a top-level field on the context for debug display and rule access.
  // Does NOT automatically re-run enrichment — use the enricher re-run action for
  // a full geo/company lookup against the new IP.
  if (hasIpOverride) {
    effective = {
      ...effective,
      ipAddress: overrides.ipAddress,
    } as unknown as RuleEvaluationContext;
  }

  // ── 2. Enrichment fields (batch + individual) ─────────────────────────────
  if (hasEnrichmentBatch || hasEnrichmentOverrides) {
    const baseEnrichment = ctx.enrichment ?? {};

    // Step 1: merge enrichmentPatch (lower priority than individual fields)
    const afterBatch = hasEnrichmentBatch
      ? { ...baseEnrichment, ...(overrides.enrichmentPatch as Record<string, unknown>) }
      : { ...baseEnrichment };

    // Step 2: merge individual field overrides (highest priority)
    const merged = {
      ...afterBatch,
      // Geo
      ...(overrides.city            !== undefined ? { city:            overrides.city            } : {}),
      ...(overrides.region          !== undefined ? { region:          overrides.region          } : {}),
      ...(overrides.countryCode     !== undefined ? { countryCode:     overrides.countryCode     } : {}),
      ...(overrides.latitude        !== undefined ? { latitude:        overrides.latitude        } : {}),
      ...(overrides.longitude       !== undefined ? { longitude:       overrides.longitude       } : {}),
      // Network
      ...(overrides.networkOrg      !== undefined ? { networkOrg:      overrides.networkOrg      } : {}),
      ...(overrides.ipVersion       !== undefined ? { ipVersion:       overrides.ipVersion       } : {}),
      ...(overrides.isCloudProvider !== undefined ? { isCloudProvider: overrides.isCloudProvider } : {}),
      // Company
      ...(overrides.companyName     !== undefined ? { companyName:     overrides.companyName     } : {}),
      ...(overrides.companyDomain   !== undefined ? { companyDomain:   overrides.companyDomain   } : {}),
      ...(overrides.companyIndustry !== undefined ? { companyIndustry: overrides.companyIndustry } : {}),
      ...(overrides.companySize     !== undefined ? { companySize:     overrides.companySize     } : {}),
      // Ads
      ...(overrides.adCampaign      !== undefined ? { adCampaign:      overrides.adCampaign      } : {}),
      ...(overrides.adAdGroup       !== undefined ? { adAdGroup:       overrides.adAdGroup       } : {}),
      ...(overrides.adKeyword       !== undefined ? { adKeyword:       overrides.adKeyword       } : {}),
      // CRM
      ...(overrides.crmMatched        !== undefined ? { crmMatched:        overrides.crmMatched        } : {}),
      ...(overrides.crmLifecycleStage !== undefined ? { crmLifecycleStage: overrides.crmLifecycleStage } : {}),
      ...(overrides.crmDealStage      !== undefined ? { crmDealStage:      overrides.crmDealStage      } : {}),
      ...(overrides.crmSegment        !== undefined ? { crmSegment:        overrides.crmSegment        } : {}),
      // ABM
      ...(overrides.targetAccountMatched !== undefined ? { targetAccountMatched: overrides.targetAccountMatched } : {}),
      ...(overrides.targetAccountTier    !== undefined ? { targetAccountTier:    overrides.targetAccountTier    } : {}),
      // Weather
      ...(overrides.weatherCode    !== undefined ? { weatherCode:    overrides.weatherCode    } : {}),
      ...(overrides.temperatureNow !== undefined ? { temperatureNow: overrides.temperatureNow } : {}),
      ...(overrides.isRaining      !== undefined ? { isRaining:      overrides.isRaining      } : {}),
      ...(overrides.windSpeed      !== undefined ? { windSpeed:      overrides.windSpeed      } : {}),
    };

    effective = { ...effective, enrichment: merged };
  }

  // ── 3. Interest context ───────────────────────────────────────────────────
  if (hasInterestOverrides) {
    const baseInterest = ctx.interestContext ?? {
      interestPrimary:    "",
      interestSecondary:  "",
      interestConfidence: 0,
      perProfile:         {},
    };
    effective = {
      ...effective,
      interestContext: {
        ...baseInterest,
        ...(overrides.interestPrimary    !== undefined ? { interestPrimary:    overrides.interestPrimary    } : {}),
        ...(overrides.interestSecondary  !== undefined ? { interestSecondary:  overrides.interestSecondary  } : {}),
        ...(overrides.interestConfidence !== undefined ? { interestConfidence: overrides.interestConfidence } : {}),
      },
    };
  }

  // ── 3b. Journey / behavioral fields ──────────────────────────────────────────
  //
  // Journey fields (funnelStage, intentScore, etc.) are resolved from
  // ctx.history.journey by field-registry resolvers.  Pass 1
  // (applyScenarioToHistory) handles this for the full decision pipeline, but
  // the theme evaluator in layout.tsx builds a minimal themeCtx with
  // emptyHistory() and calls only this Pass-2 function — so journey overrides
  // are never applied there.
  //
  // Fix: when any journey-related field is present in the overrides, also patch
  // effective.history via applyScenarioToHistory so that rule resolvers that
  // read ctx.history.journey (e.g. "journey.funnelStage") see the correct value.
  //
  // This is a pure transformation — the original context is never mutated.
  const hasJourneyOverrides =
    overrides.funnelStage           !== undefined ||
    overrides.intentScore           !== undefined ||
    overrides.engagementScore       !== undefined ||
    overrides.confidenceBand        !== undefined ||
    overrides.overallConfidence     !== undefined ||
    overrides.frictionScore         !== undefined ||
    overrides.sequenceScore         !== undefined ||
    overrides.hasVisitedPricing     !== undefined ||
    overrides.hasVisitedAbout       !== undefined ||
    overrides.hasVisitedCases       !== undefined ||
    overrides.hasVisitedContact     !== undefined ||
    overrides.hasClickedCta         !== undefined ||
    overrides.hasStartedForm        !== undefined ||
    overrides.hasSubmittedForm      !== undefined ||
    overrides.matchedSequences      !== undefined ||
    overrides.isCustomer            !== undefined ||
    overrides.planTier              !== undefined ||
    overrides.shortTermIntentScore  !== undefined ||
    overrides.longTermAffinityScore !== undefined ||
    overrides.pageViewCount         !== undefined;

  if (hasJourneyOverrides) {
    const patchedHistory = applyScenarioToHistory(effective.history ?? emptyHistory(), overrides);
    effective = { ...effective, history: patchedHistory };
  }

  // ── 4. Time / temporal context ────────────────────────────────────────────
  //
  // Time fields live at the TOP LEVEL of RuleEvaluationContext (spread from
  // buildTimeContext()).  Apply overrides directly to the context object.
  //
  // After patching, ALWAYS recompute derived context so daySegment, isWorkHours,
  // season, and isHoliday remain internally consistent with the overridden values.
  //
  // ─── timeOfDay → currentHour auto-sync ──────────────────────────────────────
  //
  //   computeDerivedContext derives daySegment from ctx.currentHour (an integer,
  //   0-23), NOT from ctx.timeOfDay (a string bucket like "afternoon").
  //   If Scenario Control overrides timeOfDay without also overriding currentHour,
  //   daySegment is computed from the real wall-clock hour and stays "stuck" at
  //   the current time of day.
  //
  //   Fix: when timeOfDay is overridden without an explicit currentHour override,
  //   auto-derive a canonical representative hour for that bucket:
  //     morning       →  9   (09:00 — solidly in "midday" boundary is 9-12)
  //     afternoon     → 14   (14:00 — solidly in "afternoon" 13-17)
  //     evening       → 19   (19:00 — solidly in "evening" 18-21)
  //     night         → 23   (23:00 — solidly in "night" 22-23)
  //     early-morning →  3   (03:00 — solidly in "early-morning" 0-5)
  //     midday        → 11   (11:00 — solidly in "midday" 9-12)
  //
  //   This keeps daySegment, isWorkHours, and all derived fields consistent with
  //   whatever timeOfDay bucket the scenario selects.
  if (hasTimeOverrides) {
    const ctxAny = effective as unknown as Record<string, unknown>;

    // Apply each time override if present.
    if (overrides.currentHour   !== undefined) ctxAny["currentHour"]   = overrides.currentHour;
    if (overrides.dayOfWeek     !== undefined) ctxAny["dayOfWeek"]     = overrides.dayOfWeek;
    if (overrides.isWeekend     !== undefined) ctxAny["isWeekend"]     = overrides.isWeekend;
    if (overrides.month         !== undefined) ctxAny["month"]         = overrides.month;
    if (overrides.dateKey       !== undefined) ctxAny["dateKey"]       = overrides.dateKey;
    if (overrides.timeOfDay     !== undefined) ctxAny["timeOfDay"]     = overrides.timeOfDay;
    if (overrides.seasonalEvent !== undefined) ctxAny["seasonalEvent"] = overrides.seasonalEvent;

    // Auto-sync currentHour from timeOfDay bucket when timeOfDay is overridden
    // but currentHour is not.  Keeps computeDerivedContext consistent.
    if (overrides.timeOfDay !== undefined && overrides.currentHour === undefined) {
      const canonicalHour: Record<string, number> = {
        "early-morning": 3,
        "morning":        9,
        "midday":        11,
        "afternoon":     14,
        "evening":       19,
        "night":         23,
      };
      const synced = overrides.timeOfDay ? canonicalHour[overrides.timeOfDay] : undefined;
      if (synced !== undefined) {
        ctxAny["currentHour"] = synced;
      }
    }

    effective = ctxAny as unknown as RuleEvaluationContext;

    // Recompute derived context so downstream consumers (rules, AI, debug panel)
    // see consistent daySegment / isWorkHours / season / isHoliday values.
    const updatedDerived = computeDerivedContext(effective);
    effective = {
      ...effective,
      derived: updatedDerived,
    } as unknown as RuleEvaluationContext;
  }

  // ── 5. Audience segment IDs override ─────────────────────────────────────
  //
  // Bypasses the runtime evaluateAudienceSegments() DB call entirely.
  // The pipeline checks scenarioOverrides.audienceSegmentIds !== undefined
  // before calling evaluateAudienceSegments, so this value is used as-is.
  if (hasSegmentOverride) {
    effective = {
      ...effective,
      audienceSegmentIds: overrides.audienceSegmentIds ?? null,
    } as unknown as RuleEvaluationContext;
  }

  // ── 6. Custom attribute overrides ────────────────────────────────────────
  //
  // Merge scenario-supplied domain attributes onto ctx.customAttributes so a
  // demo can flip e.g. massa / categorie / occasion and watch AttributeConditions
  // react on the real rule path. Merged over any real page-supplied attributes.
  if (overrides.customAttributes && Object.keys(overrides.customAttributes).length > 0) {
    effective = {
      ...effective,
      customAttributes: {
        ...(effective.customAttributes ?? {}),
        ...overrides.customAttributes,
      },
    } as unknown as RuleEvaluationContext;
  }

  return effective;
}
