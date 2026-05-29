/**
 * Decision Explainability
 *
 * Converts a DecisionTrace into human-readable explanation strings,
 * one per content slot (hero, proof, cta) plus an overall summary.
 *
 * Designed for use in:
 *   • Admin debug views  (/admin/tenants/[tenantId]/ai)
 *   • Homepage diagnostics panel (app/page.tsx dev overlay)
 *   • Operator tooling / logs enrichment
 *
 * Never called in the rendering hot path — purely for observability.
 * Wraps all logic in try/catch: a missing or malformed trace never
 * crashes the component that calls buildExplanation().
 *
 * ─── Per-slot logic ───────────────────────────────────────────────────────────
 *
 *   1. If an A/B experiment overrode this specific slot → experiment label
 *   2. Else if the overall path was "ai"         → AI label with confidence
 *   3. Else if the overall path was "rules"      → rule label with priority
 *   4. Else (fallback or experiment, unoverridden slot) → default label
 *
 * ─── Examples ─────────────────────────────────────────────────────────────────
 *
 *   Hero:  "Hero chosen by rule 'Returning CTA visitors' (priority 10)"
 *   Proof: "Proof chosen by experiment 'proof_q2_test' (bucket 1 → proof_social_proof_v2)"
 *   CTA:   "CTA chosen by AI — Claude (confidence 82%, live mode)"
 *   Hero:  "Hero served as default variant — no rule matched, AI disabled or below threshold"
 */

import type {
  DecisionTrace,
  DecisionPath,
  RuleMatchInfo,
  ExperimentAppliedInfo,
  AiTraceInfo,
} from "./trace";
import type { SlotDecisionTrace } from "./ai-selector";
import type { CoreSlotId }        from "./slot-selection-mode";
import { slotModeLabel }           from "./slot-selection-mode";

// ── Public types ──────────────────────────────────────────────────────────────

/** Per-slot explanation strings for a single homepage decision. */
export interface SlotExplanations {
  /** Human-readable label for the overall decision path. */
  pathLabel: string;
  /** One-line summary of why this experience was served. */
  summary: string;
  /** Explanation for the hero slot. */
  hero: string;
  /** Explanation for the proof slot. */
  proof: string;
  /** Explanation for the CTA slot. */
  cta: string;
  /**
   * Explanation of why the pricing section is shown with this emphasis level.
   * e.g. "Pricing suppressed — customer in onboarding (rule_saas_customer_onboarding)"
   */
  pricing: string;
  /**
   * Explanation of which CTA mode is active for pricing sections.
   * e.g. "Pricing CTA mode: trial — visitor is trial-ready (rule_saas_home_trial_ready)"
   */
  pricingCtaMode: string;
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Optional plan-level context for pricing explanations.
 *
 * Pass these from ExperiencePlan when building explanations — the trace does
 * not carry pricingEmphasis/pricingCtaMode directly.
 */
export interface PlanPricingContext {
  pricingEmphasis?: "hidden" | "teaser" | "standard" | "emphasized";
  pricingCtaMode?:  "trial" | "demo" | "onboarding" | "expansion" | "none";
}

/**
 * Build human-readable per-slot explanations from a DecisionTrace.
 *
 * Never throws — all fields default to safe fallback strings if the trace
 * is malformed or an unexpected error occurs during construction.
 *
 * @param trace   The decision trace produced by buildDecisionTrace().
 * @param plan    Optional plan pricing context from ExperiencePlan. When absent,
 *                pricing explanations reference the rule label only.
 */
export function buildExplanation(
  trace: DecisionTrace,
  plan?: PlanPricingContext,
): SlotExplanations {
  try {
    return buildExplanationInner(trace, plan);
  } catch {
    return {
      pathLabel:      trace.path ?? "unknown",
      summary:        trace.reason || "(explanation unavailable)",
      hero:           `Hero served as ${trace.heroKey  ?? "unknown"}`,
      proof:          `Proof served as ${trace.proofKey ?? "unknown"}`,
      cta:            `CTA served as ${trace.ctaKey   ?? "unknown"}`,
      pricing:        "(pricing explanation unavailable)",
      pricingCtaMode: "(CTA mode explanation unavailable)",
    };
  }
}

// ── Path label lookup ─────────────────────────────────────────────────────────

const PATH_LABELS: Record<DecisionPath, string> = {
  rules:      "Rule match",
  experiment: "A/B experiment",
  ai:         "AI decision",
  fallback:   "Default fallback",
};

function resolvePathLabel(path: DecisionPath): string {
  return PATH_LABELS[path] ?? path;
}

// ── Overall summary ───────────────────────────────────────────────────────────

function buildSummary(trace: DecisionTrace): string {
  const { path, matchedRule, appliedExperiments, ai } = trace;

  switch (path) {
    case "rules":
      return matchedRule
        ? `Rule "${matchedRule.ruleLabel}" matched (priority ${matchedRule.priority})`
        : "A rule matched (details unavailable)";

    case "experiment": {
      const count = appliedExperiments?.length ?? 0;
      if (count === 0) return "Experiment layer ran but no slots were overridden";
      const names = [...new Set(appliedExperiments!.map((e) => e.experimentName))];
      if (count === 1) return `Experiment "${names[0]}" assigned`;
      return `${count} experiment slots overridden (${names.join(", ")})`;
    }

    case "ai":
      if (!ai) return "AI decision (details unavailable)";
      return ai.confidence !== undefined
        ? `AI decision by ${ai.providerName} (confidence ${formatPct(ai.confidence)}, ${ai.aiMode} mode)`
        : `AI decision by ${ai.providerName} (${ai.aiMode} mode)`;

    case "fallback":
      return "Default variants served — no rule matched, no experiment active, AI disabled or below confidence threshold";

    default:
      return trace.reason || "(unknown decision path)";
  }
}

// ── Per-slot explanation ──────────────────────────────────────────────────────

type SlotDisplayName = "Hero" | "Proof" | "CTA";
type SlotKey        = "hero" | "proof" | "cta";

const SLOT_KEY_MAP: Record<SlotDisplayName, SlotKey> = {
  Hero:  "hero",
  Proof: "proof",
  CTA:   "cta",
};

/**
 * Build the explanation string for a single content slot.
 *
 * Priority:
 *   1. Slot-specific experiment override
 *   2. Overall path (ai / rules / experiment baseline / fallback)
 */
function explainSlot(
  displayName: SlotDisplayName,
  variantKey:  string,
  trace:       DecisionTrace,
): string {
  const slotKey = SLOT_KEY_MAP[displayName];

  // 1. Did an experiment specifically override this slot?
  const slotExperiment: ExperimentAppliedInfo | undefined =
    trace.appliedExperiments?.find((e) => e.slot === slotKey);

  if (slotExperiment) {
    return (
      `${displayName} chosen by experiment "${slotExperiment.experimentName}"` +
      ` (bucket ${slotExperiment.bucket} → ${variantKey})`
    );
  }

  // 2. No slot experiment — derive explanation from the overall decision path.
  switch (trace.path) {
    case "rules":
      return trace.matchedRule
        ? `${displayName} chosen by rule "${trace.matchedRule.ruleLabel}" (priority ${trace.matchedRule.priority})`
        : `${displayName} chosen by a matched rule`;

    case "experiment":
      // Experiment path, but this particular slot wasn't overridden.
      return `${displayName} served as default (no experiment override for this slot)`;

    case "ai": {
      if (!trace.ai) return `${displayName} chosen by AI`;
      const confPart = trace.ai.confidence !== undefined
        ? `, confidence ${formatPct(trace.ai.confidence)}`
        : "";
      return `${displayName} chosen by AI — ${trace.ai.providerName} (${trace.ai.aiMode} mode${confPart})`;
    }

    case "fallback":
    default:
      return `${displayName} served as default variant — no rule matched, AI disabled or below threshold`;
  }
}

// ── Pricing explanation ───────────────────────────────────────────────────────

const PRICING_EMPHASIS_LABELS: Record<string, string> = {
  hidden:     "Pricing suppressed (hidden)",
  teaser:     "Pricing shown as teaser only",
  standard:   "Pricing shown at standard weight",
  emphasized: "Pricing emphasized — strong intent signal",
};

const PRICING_CTA_MODE_LABELS: Record<string, string> = {
  trial:      "trial — Starter free-trial CTA emphasized",
  demo:       "demo — Plan demo CTA active",
  onboarding: "onboarding — Acquisition CTA suppressed, onboarding CTA shown",
  expansion:  "expansion — Upgrade / enrichment CTA active",
  none:       "none — All pricing CTAs suppressed",
};

function explainPricing(
  trace:  DecisionTrace,
  plan?:  PlanPricingContext,
): string {
  const emphasis = plan?.pricingEmphasis;
  const ruleRef  = trace.matchedRule
    ? ` (${trace.matchedRule.ruleLabel}, priority ${trace.matchedRule.priority})`
    : trace.path === "fallback" ? " (default plan — no rule matched)" : "";

  if (!emphasis) {
    return `Pricing: standard weight${ruleRef}`;
  }

  const label = PRICING_EMPHASIS_LABELS[emphasis] ?? `Pricing emphasis: ${emphasis}`;
  return `${label}${ruleRef}`;
}

function explainPricingCtaMode(
  trace:  DecisionTrace,
  plan?:  PlanPricingContext,
): string {
  const mode    = plan?.pricingCtaMode;
  const ruleRef = trace.matchedRule
    ? ` — rule: ${trace.matchedRule.ruleLabel} (priority ${trace.matchedRule.priority})`
    : trace.path === "fallback" ? " — default plan (no rule matched)" : "";

  if (!mode) {
    return `Pricing CTA mode: demo (default)${ruleRef}`;
  }

  const label = PRICING_CTA_MODE_LABELS[mode] ?? `mode: ${mode}`;
  return `Pricing CTA ${label}${ruleRef}`;
}

// ── Inner builder ─────────────────────────────────────────────────────────────

function buildExplanationInner(
  trace: DecisionTrace,
  plan?: PlanPricingContext,
): SlotExplanations {
  return {
    pathLabel:      resolvePathLabel(trace.path),
    summary:        buildSummary(trace),
    hero:           explainSlot("Hero",  trace.heroKey,  trace),
    proof:          explainSlot("Proof", trace.proofKey, trace),
    cta:            explainSlot("CTA",   trace.ctaKey,   trace),
    pricing:        explainPricing(trace, plan),
    pricingCtaMode: explainPricingCtaMode(trace, plan),
  };
}

// ── Per-slot candidate detail (Phase 1) ───────────────────────────────────────

/**
 * Detailed explanation for a single slot from a SlotDecisionTrace.
 *
 * Returned by buildSlotExplanation() and surfaced in the admin debug panel to
 * show operators exactly how each variant key was chosen.
 */
export interface SlotDetail {
  /** Slot identifier, e.g. "hero". */
  slotId: CoreSlotId;
  /** Human-readable mode label. */
  modeLabel: string;
  /** The final variant key that was served. */
  chosenKey: string;
  /** How it was sourced — "static" | "rules" | "ai" | "fallback". */
  source: string;
  /** The key the AI proposed (may differ from chosenKey). null when AI not called. */
  aiProposedKey: string | null;
  /** How many aiReady candidates existed for this slot. */
  candidateCount: number;
  /** How many passed context eligibility gates. */
  eligibleCount: number;
  /**
   * One-line explanation of why the chosen key was selected.
   * Examples:
   *   "AI chose hero_consideration (82% confidence) from 6 eligible candidates"
   *   "Rules-only mode active — hero_direct_brand from rules plan (AI proposed hero_consideration)"
   *   "Static key hero_default locked by operator"
   */
  explanation: string;
}

/**
 * Build a detailed explanation for a single core slot from its SlotDecisionTrace.
 *
 * @param trace   The slot-level decision trace from DecisionTrace.perSlot.
 * @param aiInfo  The global AI info from DecisionTrace.ai (for confidence display).
 */
export function buildSlotExplanation(
  trace:  SlotDecisionTrace,
  aiInfo: AiTraceInfo | null,
): SlotDetail {
  const modeLabel = slotModeLabel(trace.mode);
  const confidencePart = aiInfo?.confidence !== undefined
    ? ` (${formatPct(aiInfo.confidence)} confidence)`
    : "";

  let explanation: string;
  switch (trace.source) {
    case "ai":
      explanation =
        `AI chose ${trace.chosenKey}${confidencePart}` +
        ` from ${trace.eligibleCount} eligible / ${trace.candidateCount} candidates`;
      break;

    case "rules":
      if (trace.mode === "rules-only" && trace.aiProposedKey) {
        explanation =
          `Rules-only mode — ${trace.chosenKey} from rules plan` +
          ` (AI proposed ${trace.aiProposedKey})`;
      } else if (trace.overriddenBy === "ai_not_used") {
        explanation =
          `AI-assisted, but AI not used — ${trace.chosenKey} from rules plan`;
      } else {
        explanation = `${trace.chosenKey} from rules plan`;
      }
      break;

    case "static":
      explanation = `Static key ${trace.chosenKey} locked by operator`;
      break;

    case "fallback":
      explanation =
        `Static mode — staticKey absent, fell back to rules key ${trace.chosenKey}`;
      break;

    default:
      explanation = `${trace.chosenKey} (source: ${trace.source})`;
  }

  return {
    slotId:         trace.slotId,
    modeLabel,
    chosenKey:      trace.chosenKey,
    source:         trace.source,
    aiProposedKey:  trace.aiProposedKey,
    candidateCount: trace.candidateCount,
    eligibleCount:  trace.eligibleCount,
    explanation,
  };
}

/**
 * Build SlotDetail entries for all three core slots from DecisionTrace.perSlot.
 *
 * Returns null when perSlot is null (AI disabled, context sparse, or no slot
 * registry configured — all backward-compatible cases).
 *
 * @param trace  The full DecisionTrace (with perSlot populated by Phase 1).
 */
export function buildAllSlotDetails(
  trace: DecisionTrace,
): Record<CoreSlotId, SlotDetail> | null {
  if (!trace.perSlot) return null;

  const slots: CoreSlotId[] = ["hero", "proof", "cta"];
  const result = {} as Record<CoreSlotId, SlotDetail>;
  for (const slotId of slots) {
    result[slotId] = buildSlotExplanation(trace.perSlot[slotId], trace.ai);
  }
  return result;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

// ── Provider string helpers (for log-based admin views) ───────────────────────

/**
 * Derive a human-readable decision path label from a `live_provider` string
 * stored in ai_decision_logs.
 *
 * This is used by the admin Decisions page which works with persisted log rows
 * rather than live DecisionTrace objects.
 *
 *   "rules"              → "Rule match"
 *   "ai:claude"          → "AI decision"
 *   "experiment:..."     → "A/B experiment"
 *   "fallback"           → "Default fallback"
 *   anything else        → the raw provider string
 */
export function liveProviderToPathLabel(liveProvider: string): string {
  if (liveProvider === "rules")             return "Rule match";
  if (liveProvider.startsWith("ai:"))       return "AI decision";
  if (liveProvider.startsWith("experiment")) return "A/B experiment";
  if (liveProvider === "fallback")          return "Default fallback";
  return liveProvider;
}

/**
 * Derive a short human-readable verdict explanation from a policy verdict string.
 *
 *   "USE_AI"                   → "AI plan accepted"
 *   "FALLBACK_LOW_CONFIDENCE"  → "Rejected — confidence too low"
 *   "FALLBACK_CONTEXT_SPARSE"  → "Skipped — too few context signals"
 *   "FALLBACK_MISSING_FIELDS"  → "Skipped — required fields missing"
 *   "FALLBACK_INVALID_KEYS"    → "Rejected — invalid variant keys"
 *   undefined / null           → "—"
 */
export function verdictToExplanation(verdict: string | undefined | null): string {
  if (!verdict) return "—";
  switch (verdict) {
    case "USE_AI":                   return "AI plan accepted";
    case "FALLBACK_LOW_CONFIDENCE":  return "Rejected — confidence too low";
    case "FALLBACK_CONTEXT_SPARSE":  return "Skipped — too few context signals";
    case "FALLBACK_MISSING_FIELDS":  return "Skipped — required fields missing";
    case "FALLBACK_INVALID_KEYS":    return "Rejected — invalid variant keys returned";
    default:                         return verdict;
  }
}
