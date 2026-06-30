/**
 * Personalization Test Fixtures
 *
 * Shared helpers for the golden scenario test suite.
 *
 * ─── Design ───────────────────────────────────────────────────────────────────
 *
 *   buildJourney()   — creates a JourneyState from raw field overrides,
 *                      recomputing real BehaviorConfidence so tests use the
 *                      same confidence model as production.
 *
 *   buildDecisionInput() — wraps a JourneyState into a full DecisionInput with
 *                      safe defaults for source/device/visitType.
 *                      history.fromDatabase is intentionally false so named
 *                      conditions (returning_cta_clicked, high_engagement) do
 *                      not interfere with behavioral-rule isolation tests.
 *                      Pass { fromDatabase: true } in contextOverrides.history
 *                      when testing named conditions explicitly.
 *
 *   RULES_CONFIG     — loads runtime-rules.json once at module init, shared
 *                      across all provider instances.
 *
 *   DEFAULT_PLAN     — the defaultPlan from runtime-rules.json; used as the
 *                      `defaults` argument for applyConfidenceGating().
 */

import { readFileSync } from "fs";
import { join }         from "path";

import {
  emptyJourneyState,
  type JourneyState,
} from "@/lib/journey/types";
import { computeBehaviorConfidence } from "@/lib/journey/compute-confidence";
import { emptyHistory, type VisitorHistory } from "@/context/visitor-history";
import { buildDecisionInput as _buildDecisionInput } from "@/decision/types";
import type { DecisionInput, ExperiencePlan } from "@/decision/types";
import type { VisitorContext }  from "@/context/types";
import type { StoredRulesConfig } from "@/decision/rules/stored-rule";

// ── Runtime rules config ──────────────────────────────────────────────────────

/**
 * Loaded once from decision/rules/runtime-rules.json.
 * Passed directly to RulesDecisionProvider to avoid file-read variability.
 */
export const RULES_CONFIG: StoredRulesConfig = JSON.parse(
  readFileSync(
    join(process.cwd(), "tests", "personalization", "saas-rules.fixture.json"),
    "utf8",
  ),
) as StoredRulesConfig;

/**
 * The default plan from runtime-rules.json.
 * Used as the `defaults` argument for applyConfidenceGating().
 */
export const DEFAULT_PLAN: Pick<ExperiencePlan, "heroKey" | "proofKey" | "ctaKey"> = {
  heroKey:  RULES_CONFIG.defaultPlan.heroKey  as ExperiencePlan["heroKey"],
  proofKey: RULES_CONFIG.defaultPlan.proofKey as ExperiencePlan["proofKey"],
  ctaKey:   RULES_CONFIG.defaultPlan.ctaKey   as ExperiencePlan["ctaKey"],
};

// ── Baseline context ──────────────────────────────────────────────────────────

/**
 * Minimal safe VisitorContext for test isolation.
 *
 * Uses direct/desktop/new so no traffic-source rules (LinkedIn, Google) or
 * named conditions (returning_cta_clicked) fire unexpectedly.
 */
export const BASE_CONTEXT: VisitorContext = {
  source:          "direct",
  device:          "desktop",
  visitType:       "new",
  rawReferrer:     null,
  referrerDomain:  null,
  utmSource:       null,
  utmMedium:       null,
  utmCampaign:     null,
  utmContent:      null,
  utmTerm:         null,
  userAgent:       null,
  resolvedAt:      0,
};

/**
 * Minimal VisitorHistory for test isolation.
 *
 * fromDatabase=false ensures named conditions (returning_cta_clicked,
 * high_engagement) always evaluate to false — these require fromDatabase=true
 * to guard against DB-error false-positives.  Tests that explicitly cover
 * named conditions must override fromDatabase.
 */
export const BASE_HISTORY: VisitorHistory = {
  ...emptyHistory(),
  fromDatabase: false,
};

// ── Journey builder ───────────────────────────────────────────────────────────

/**
 * Creates a JourneyState from raw field overrides.
 *
 * Starts from emptyJourneyState(), merges the supplied overrides, then
 * recomputes BehaviorConfidence from the merged raw fields using the
 * production confidence model.
 *
 * This gives deterministic confidence values (the same ones the rule engine
 * and gating layer use at runtime) without synthetic band injection.
 *
 * @example
 * const j = buildJourney({
 *   funnelStage:    "high_intent",
 *   intentScore:    80,
 *   hasVisitedPricing: true,
 * });
 * assert.strictEqual(j.confidence.band, "high");
 */
export function buildJourney(
  overrides: Partial<Omit<JourneyState, "confidence">>,
): JourneyState {
  const base       = { ...emptyJourneyState(), ...overrides };
  const confidence = computeBehaviorConfidence(base);
  return { ...base, confidence };
}

// ── DecisionInput builder ─────────────────────────────────────────────────────

/**
 * Builds a full DecisionInput for rule-engine tests.
 *
 * @param journey         JourneyState (use buildJourney() or a preset).
 * @param contextOverrides Override specific VisitorContext fields (e.g. utmSource).
 * @param historyOverrides Override specific VisitorHistory fields (e.g. pageViewCount
 *                         for named-condition tests).
 */
export function buildInput(
  journey:          JourneyState,
  contextOverrides: Partial<VisitorContext>  = {},
  historyOverrides: Partial<VisitorHistory>  = {},
): DecisionInput {
  const history: VisitorHistory = {
    ...BASE_HISTORY,
    ...historyOverrides,
    journey,
  };
  const context: VisitorContext = {
    ...BASE_CONTEXT,
    resolvedAt: Date.now(),
    ...contextOverrides,
  };
  return _buildDecisionInput(context, history);
}
