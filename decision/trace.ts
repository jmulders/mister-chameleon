/**
 * Decision Trace
 *
 * Models the explainability surface for a single homepage experience selection.
 * Captures which decision path was taken, what matched, and a safe context snapshot.
 *
 * ─── Decision paths ───────────────────────────────────────────────────────────
 *
 *   "rules"       — A stored or hardcoded rule matched first.
 *   "experiment"  — An A/B experiment overrode one or more slots.
 *   "ai"          — The AI provider's plan passed the confidence policy (live mode).
 *   "fallback"    — No rule matched, no experiment was active, no AI; default plan served.
 *
 * ─── Provider chain access ────────────────────────────────────────────────────
 *
 *   buildDecisionTrace() walks the provider chain using instanceof checks:
 *
 *     AiDecisionProvider         → reads lastDecisionMeta, follows .fallbackProvider
 *     ExperimentDecisionProvider → reads lastAppliedPlanExperiment, follows .innerProvider
 *     RulesDecisionProvider      → reads lastMatchedRuleInfo
 *
 *   Each concrete provider stores its last-call state as public properties,
 *   populated synchronously before getHomepagePlan() returns.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   buildDecisionTrace() wraps the entire construction in try/catch.
 *   If any provider state is missing or an unexpected error occurs, a minimal
 *   fallback DecisionTrace is returned — the homepage never crashes.
 *
 * ─── No secrets ───────────────────────────────────────────────────────────────
 *
 *   TraceContextSnapshot excludes raw IPs, auth tokens, full user-agent strings,
 *   and any field not already visible in the dev diagnostics panel.
 */

import type { DecisionProvider }  from "./providers/decision-provider";
import type { DecisionInput, ExperiencePlan } from "./types";
import { AiDecisionProvider, type AiDecisionMeta } from "./providers/ai-decision-provider";
import { ExperimentDecisionProvider }            from "./providers/experiment-decision-provider";
import { RulesDecisionProvider }                 from "./providers/rules-decision-provider";
import type { SlotDecisionTrace }                from "./ai-selector";
import type { CoreSlotId }                       from "./slot-selection-mode";
import type { FieldFillTrace }                   from "@/ai/field-fill/types";
import type { ResolvedAiPolicy }                 from "@/ai/policy/types";

// ── Public types ──────────────────────────────────────────────────────────────

/** Which path through the decision engine produced this experience. */
export type DecisionPath = "rules" | "experiment" | "ai" | "fallback";

/** The rule that matched, when path === "rules". */
export interface RuleMatchInfo {
  ruleId:    string;
  ruleLabel: string;
  priority:  number;
}

/** One experiment assignment applied to the plan. */
export interface ExperimentAppliedInfo {
  experimentId:   string;
  experimentName: string;
  slot:           string;
  bucket:         number;
  variantKey:     string;
}

/** Metadata about the AI layer, when path === "ai" or AI ran in shadow mode. */
export interface AiTraceInfo {
  providerName:   string;
  aiMode:         "shadow" | "live";
  confidence:     number | undefined;
  fallbackReason: string | null;
}

/**
 * Safe, redacted snapshot of the DecisionContext used for this request.
 * No raw IPs, no auth tokens, no full user-agent strings.
 */
export interface TraceContextSnapshot {
  source:            string | null;
  device:            string | null;
  visitType:         string | null;
  utmSource:         string | null;
  utmCampaign:       string | null;
  referrerDomain:    string | null;
  pageViewCount:     number;
  hasClickedCta:     boolean;
  countryCode:       string | null;
  companyName:       string | null;
  companyIndustry:   string | null;
  crmMatched:        boolean | null;
  crmLifecycleStage: string | null;
  tenantId:          string | null;
  pathname:          string | null;

  // ── Journey / behavioral fields ─────────────────────────────────────────────
  /** Visitor's current funnel stage derived from behavioral events. */
  journeyFunnelStage:      string | null;
  /** Intent score (0–100) computed from weighted behavioral events. */
  journeyIntentScore:      number | null;
  /** Engagement score (0–100) representing depth of site interaction. */
  journeyEngagementScore:  number | null;
  /** Comma-separated list of matched sequence pattern slugs, or null. */
  journeyMatchedSequences: string | null;
  /**
   * The behavioral scenario that fired, if any.
   * Derived from matchedRule.ruleId when it starts with "behavioral_".
   * null when the winning rule was not a behavioral scenario rule.
   */
  matchedBehavioralScenario: string | null;
}

/**
 * Full explainability record for a single homepage experience selection.
 *
 * Produced by buildDecisionTrace() and attached to ComposedHomepageExperience.
 * Suitable for dev diagnostics, admin debug pages, and operator tooling.
 */
export interface DecisionTrace {
  /** Which decision path produced this experience. */
  path: DecisionPath;

  /**
   * Human-readable summary of why this experience was served.
   * Derived from ExperiencePlan.reason (may include rule IDs / experiment IDs).
   */
  reason: string;

  /** The variant keys resolved for this request. */
  heroKey:  string;
  proofKey: string;
  ctaKey:   string;

  /** True when the CMS fallback plan was used (primary variants were unavailable). */
  usedCmsFallback: boolean;

  /**
   * Populated when path === "rules".
   * null when no rule matched or the rules layer was not in the chain.
   */
  matchedRule: RuleMatchInfo | null;

  /**
   * Populated when the experiment layer ran.
   *   null  — experiment layer was not in the chain (or not yet called).
   *   []    — experiment layer ran but no experiments applied.
   *   [...] — one or more experiment slots were overridden.
   */
  appliedExperiments: ExperimentAppliedInfo[] | null;

  /**
   * AI layer metadata.
   * Populated when the AI layer ran (shadow or live mode).
   * null when AI is disabled or context was too sparse to call the model.
   */
  ai: AiTraceInfo | null;

  /** Safe context snapshot showing the signals used for this decision. */
  context: TraceContextSnapshot;

  /**
   * Per-slot decision traces for the three core slots (hero / proof / cta).
   *
   * Populated when AiDecisionProvider.lastSlotAssembly is available — i.e.
   * when the per-slot mode registry is configured and the AI layer ran.
   * null when AI is disabled, context was too sparse, or no registry is set
   * (full backward compatibility: existing tenants without slot configs see null).
   *
   * Each entry records the mode, chosen key, AI-proposed key, candidate counts,
   * and override reason for that slot — enabling the admin debug panel to show
   * exactly how each slot key was selected.
   */
  perSlot: Record<CoreSlotId, SlotDecisionTrace> | null;

  /**
   * Per-slot AI field fill traces (Phase 2).
   *
   * Populated after the field fill pass completes in composeHomepageExperience().
   * null when field fill is not configured or not run for any slot.
   *
   * Each entry records whether AI was used, which fields were modified,
   * the original and final values, and the confidence score — enabling the
   * admin debug panel to show exactly what AI changed and why.
   */
  fieldFill: Partial<Record<"hero" | "proof" | "cta", FieldFillTrace>> | null;

  /**
   * AI governance policy debug info (Phase 3).
   *
   * Per-phase, per-slot resolved policy snapshot.  Shows the effective mode,
   * threshold, and which resolution tier supplied each value.
   *
   * Populated by composeHomepageExperience() when aiPolicies option is present.
   * null when no policy resolution was performed (backward compat).
   *
   * Structure:
   *   aiGovernance.selection.[hero|proof|cta] — resolved selection policy
   *   aiGovernance.fieldFill.[hero|proof|cta]  — resolved field fill policy
   */
  aiGovernance: {
    selection: Record<"hero" | "proof" | "cta", ResolvedAiPolicy>;
    fieldFill:  Record<"hero" | "proof" | "cta", ResolvedAiPolicy>;
  } | null;

  /** Unix timestamp (ms) when the trace was built. */
  resolvedAt: number;

  /** Wall-clock time from composition start to trace build, in milliseconds. */
  durationMs: number;
}

// ── Public builder ────────────────────────────────────────────────────────────

/**
 * Walk the provider chain and build a DecisionTrace from last-call state.
 *
 * Call this AFTER getHomepagePlan() has returned — all provider state
 * properties are guaranteed to be populated at that point.
 *
 * Wraps the entire build in try/catch. Returns a minimal fallback trace on
 * any error so the homepage never crashes due to diagnostics code.
 *
 * @param decisionProvider  Top of the chain (may be AI, experiment, or rules).
 * @param plan              The ExperiencePlan that was resolved.
 * @param usedCmsFallback   Whether the CMS fallback path was taken.
 * @param input             The DecisionInput (may be a wider type at runtime).
 * @param startedAt         Unix timestamp (ms) when composition started.
 */
export function buildDecisionTrace(
  decisionProvider: DecisionProvider,
  plan:             ExperiencePlan,
  usedCmsFallback:  boolean,
  input:            DecisionInput,
  startedAt:        number,
): DecisionTrace {
  try {
    return buildTraceInner(decisionProvider, plan, usedCmsFallback, input, startedAt);
  } catch {
    // Trace construction failed — return a minimal safe trace so the homepage
    // always renders regardless of diagnostics errors.
    const now = Date.now();
    return {
      path:               "fallback",
      reason:             plan.reason ?? "(trace error — see server logs)",
      heroKey:            plan.heroKey,
      proofKey:           plan.proofKey,
      ctaKey:             plan.ctaKey,
      usedCmsFallback,
      matchedRule:        null,
      appliedExperiments: null,
      ai:                 null,
      perSlot:            null,
      fieldFill:          null,
      aiGovernance:       null,
      context:            buildContextSnapshot(input, null),
      resolvedAt:         now,
      durationMs:         now - startedAt,
    };
  }
}

// ── Inner builder (may throw — wrapped by buildDecisionTrace) ─────────────────

function buildTraceInner(
  decisionProvider: DecisionProvider,
  plan:             ExperiencePlan,
  usedCmsFallback:  boolean,
  input:            DecisionInput,
  startedAt:        number,
): DecisionTrace {
  const { rulesProvider, experimentProvider, aiProvider } =
    walkProviderChain(decisionProvider);

  // ── Extract per-slot assembly (Phase 1) ────────────────────────────────────
  const perSlot = aiProvider?.lastSlotAssembly?.perSlot ?? null;

  // ── Extract AI metadata ─────────────────────────────────────────────────────
  const aiMeta: AiDecisionMeta | null = aiProvider?.lastDecisionMeta ?? null;

  const ai: AiTraceInfo | null = aiMeta
    ? {
        providerName:   aiMeta.providerName,
        aiMode:         aiMeta.aiMode,
        confidence:     aiMeta.aiConfidence,
        fallbackReason: aiMeta.fallbackReason,
      }
    : null;

  // ── Extract experiment assignments ──────────────────────────────────────────
  //
  // Plan-based experiments expose lastAppliedPlanExperiment (single record).
  // We map it into ExperimentAppliedInfo[] for backward-compatible trace output.
  // slot="plan" signals that it was a plan-level override (not a single slot).
  const rawPlanExp = experimentProvider?.lastAppliedPlanExperiment;

  const appliedExperiments: ExperimentAppliedInfo[] | null =
    rawPlanExp === undefined
      ? null                         // provider not in chain
      : rawPlanExp === null
        ? []                         // provider ran; no experiment matched
        : [{
            experimentId:   rawPlanExp.experimentId,
            experimentName: rawPlanExp.experimentName,
            slot:           "plan",
            bucket:         rawPlanExp.bucket,
            variantKey:     rawPlanExp.isChallenger ? "challenger" : "control",
          }];

  // ── Extract matched rule ────────────────────────────────────────────────────
  const rawRule = rulesProvider?.lastMatchedRuleInfo ?? null;

  const matchedRule: RuleMatchInfo | null = rawRule
    ? { ruleId: rawRule.ruleId, ruleLabel: rawRule.ruleLabel, priority: rawRule.priority }
    : null;

  // ── Determine decision path ─────────────────────────────────────────────────
  const path = decidePath(aiMeta, appliedExperiments, matchedRule);

  // ── Build context snapshot ──────────────────────────────────────────────────
  const context = buildContextSnapshot(input, matchedRule?.ruleId ?? null);

  const resolvedAt = Date.now();

  return {
    path,
    reason:             plan.reason ?? "(no reason)",
    heroKey:            plan.heroKey,
    proofKey:           plan.proofKey,
    ctaKey:             plan.ctaKey,
    usedCmsFallback,
    matchedRule,
    appliedExperiments,
    ai,
    perSlot,
    fieldFill:          null,          // populated by composeHomepageExperience() after field fill runs
    aiGovernance:       null,          // populated by composeHomepageExperience() after policy resolution
    context,
    resolvedAt,
    durationMs: resolvedAt - startedAt,
  };
}

// ── Provider chain walker ─────────────────────────────────────────────────────

interface ProviderChainResult {
  rulesProvider:      RulesDecisionProvider      | null;
  experimentProvider: ExperimentDecisionProvider | null;
  aiProvider:         AiDecisionProvider         | null;
}

/**
 * Walk the provider chain via instanceof checks and extract each concrete layer.
 *
 * Expected chain order: AiDecisionProvider → ExperimentDecisionProvider → RulesDecisionProvider
 * Some layers may be absent (e.g. AI disabled, experiments not wired).
 *
 * Stops at the first unrecognised provider type to prevent infinite loops.
 */
function walkProviderChain(provider: DecisionProvider): ProviderChainResult {
  let rulesProvider:      RulesDecisionProvider      | null = null;
  let experimentProvider: ExperimentDecisionProvider | null = null;
  let aiProvider:         AiDecisionProvider         | null = null;

  let current: DecisionProvider | null = provider;

  while (current !== null) {
    if (current instanceof AiDecisionProvider && aiProvider === null) {
      aiProvider = current;
      current = current.fallbackProvider;
    } else if (current instanceof ExperimentDecisionProvider && experimentProvider === null) {
      experimentProvider = current;
      current = current.innerProvider;
    } else if (current instanceof RulesDecisionProvider && rulesProvider === null) {
      rulesProvider = current;
      current = null; // leaf node — always terminates the chain
    } else {
      // Unknown provider type or already captured — stop to prevent infinite loop
      current = null;
    }
  }

  return { rulesProvider, experimentProvider, aiProvider };
}

// ── Path decision ─────────────────────────────────────────────────────────────

function decidePath(
  aiMeta:             AiDecisionMeta | null,
  appliedExperiments: ExperimentAppliedInfo[] | null,
  matchedRule:        RuleMatchInfo | null,
): DecisionPath {
  // AI used in live mode and passed the confidence policy → "ai"
  if (aiMeta?.aiUsed) return "ai";

  // At least one experiment slot was overridden → "experiment"
  if (appliedExperiments && appliedExperiments.length > 0) return "experiment";

  // A rule matched → "rules"
  if (matchedRule) return "rules";

  // No rule, no experiment, no AI → "fallback" (default plan was served)
  return "fallback";
}

// ── Context snapshot ──────────────────────────────────────────────────────────

/**
 * Extract a safe, redacted context snapshot from the request input.
 *
 * Casts to a wider type to read enrichment / page-level fields when present.
 * All fields default to null / 0 / false — never undefined.
 */
function buildContextSnapshot(input: DecisionInput, matchedRuleId?: string | null): TraceContextSnapshot {
  // At runtime this is always a RuleEvaluationContext (superset of DecisionInput)
  // which carries enrichment, tenantId, pathname, etc.  Cast safely.
  const ctx = input as DecisionInput & {
    enrichment?: Record<string, unknown>;
    tenantId?:   string | null;
    pathname?:   string | null;
  };

  const enrichment = ctx.enrichment ?? {};

  // ── Journey fields ──────────────────────────────────────────────────────────
  const journey = input.history.journey;
  const journeyFunnelStage      = journey?.funnelStage          ?? null;
  const journeyIntentScore      = journey?.intentScore           ?? null;
  const journeyEngagementScore  = journey?.engagementScore       ?? null;
  const rawSeqs                 = journey?.matchedSequences;
  const journeyMatchedSequences =
    Array.isArray(rawSeqs) && rawSeqs.length > 0 ? rawSeqs.join(",") : null;

  // Derive matched behavioral scenario from the rule ID (if rule ran)
  const matchedBehavioralScenario =
    typeof matchedRuleId === "string" && matchedRuleId.startsWith("behavioral_")
      ? matchedRuleId
      : null;

  return {
    source:            (input.source            as string | null) ?? null,
    device:            (input.device            as string | null) ?? null,
    visitType:         (input.visitType         as string | null) ?? null,
    utmSource:         input.utmSource          ?? null,
    utmCampaign:       input.utmCampaign        ?? null,
    referrerDomain:    input.referrerDomain      ?? null,
    pageViewCount:     input.history.pageViewCount,
    hasClickedCta:     input.history.hasClickedCta,
    countryCode:       (enrichment.countryCode       as string  | null) ?? null,
    companyName:       (enrichment.companyName       as string  | null) ?? null,
    companyIndustry:   (enrichment.companyIndustry   as string  | null) ?? null,
    crmMatched:        (enrichment.crmMatched        as boolean | null) ?? null,
    crmLifecycleStage: (enrichment.crmLifecycleStage as string  | null) ?? null,
    tenantId:          ctx.tenantId ?? null,
    pathname:          ctx.pathname ?? null,
    journeyFunnelStage,
    journeyIntentScore,
    journeyEngagementScore,
    journeyMatchedSequences,
    matchedBehavioralScenario,
  };
}
