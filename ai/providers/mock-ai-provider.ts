/**
 * AI Providers — Mock AI Provider
 *
 * A deterministic, zero-latency-overhead provider that returns pre-defined
 * plans based on the visitor's traffic source.  No external API calls are made.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   1. Development / local preview
 *      Run the full AI decision pipeline (including ai_decision_logs writes)
 *      without needing real API keys.
 *
 *   2. Shadow mode evaluation baseline
 *      Use as the shadow provider in early deployments to verify that the
 *      logging and dashboard infrastructure works before substituting a real
 *      model.
 *
 *   3. Integration testing
 *      Tests can assert on the well-known outputs without mocking HTTP.
 *
 * ─── Determinism guarantee ────────────────────────────────────────────────────
 *
 *   The mock always maps:
 *
 *     source = "google"   →  hero_google_problem / proof_cases   / cta_guide
 *     source = "linkedin" →  hero_linkedin_vision / proof_vision  / cta_platform
 *     source = "direct"
 *     source = "unknown"  →  hero_direct_brand   / proof_platform / cta_meeting
 *     (all other)
 *
 *   These choices intentionally mirror the top-priority rules in
 *   decision/rules/stored-rule.ts so operators can verify that mock outputs
 *   agree with the rules engine and that plans_match = true in the dashboard.
 *
 * ─── Simulated metadata ───────────────────────────────────────────────────────
 *
 *   latencyMs  — set to 0 (no real work is done).
 *   confidence — set to a fixed high value (0.92) to reflect that the mock
 *                is "certain" about its deterministic output.
 *   modelId    — "mock-deterministic-v1" (stable, loggable identifier).
 *
 * ─── Prompt builder integration ──────────────────────────────────────────────
 *
 *   suggest() calls buildHomepagePrompt() and includes the generated prompts
 *   in rawReasoning so the output captures what a real model would receive.
 *   This lets operators verify prompt quality in the AI dashboard even before
 *   a real model is wired in.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Construct via createAiProvider() rather than directly — the factory handles
 *   the disabled / mock / real routing.
 *
 *   import { MockAiProvider } from "@/ai/providers/mock-ai-provider";
 *   const provider = new MockAiProvider();
 *   const result   = await provider.suggest(input);
 */

import type { DecisionInput, ExperiencePlan, HeroVariantKey, ProofVariantKey, CTAVariantKey } from "@/decision/types";
import type { VariantCandidate } from "@/ai/variant-meta";
import { buildHomepagePrompt } from "@/ai/prompt-builder";
import { filterAiReady, platformOnlyCandidates } from "@/ai/resolve-variant-candidates";
import type { AiProvider, AiProviderResult } from "./base-provider";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOCK_MODEL_ID   = "mock-deterministic-v1" as const;
const MOCK_PROVIDER   = "mock"                  as const;

/**
 * Fixed confidence reported by the mock.
 *
 * High (0.92) because the mock's choices are deterministic and correct for
 * their respective sources — there is no genuine uncertainty.
 * Real models will report lower values when signals are ambiguous.
 */
const MOCK_CONFIDENCE = 0.92 as const;

// ── Source → plan mapping ─────────────────────────────────────────────────────

/**
 * Deterministic plan for each traffic source.
 *
 * Intentionally mirrors the highest-priority rules in stored-rule.ts so that
 * mock suggestions agree with the rules engine and plans_match = true in the
 * AI dashboard during early shadow-mode evaluation.
 */
const SOURCE_PLANS: Record<
  string,
  { heroKey: HeroVariantKey; proofKey: ProofVariantKey; ctaKey: CTAVariantKey; reason: string }
> = {
  google: {
    heroKey:  "hero_google_problem",
    proofKey: "proof_cases",
    ctaKey:   "cta_guide",
    reason:
      "Google traffic indicates search/problem intent. " +
      "Problem-framed hero + case-study proof + educational guide CTA matches the visitor's evaluation mindset.",
  },
  linkedin: {
    heroKey:  "hero_linkedin_vision",
    proofKey: "proof_vision",
    ctaKey:   "cta_platform",
    reason:
      "LinkedIn traffic indicates thought-leadership/social intent. " +
      "Vision-led hero + analyst-quote proof + product CTA matches the visitor's exploratory, future-oriented posture.",
  },
};

/** Fallback plan for direct, unknown, and any unrecognised source. */
const DEFAULT_PLAN: {
  heroKey: HeroVariantKey;
  proofKey: ProofVariantKey;
  ctaKey: CTAVariantKey;
  reason: string;
} = {
  heroKey:  "hero_direct_brand",
  proofKey: "proof_platform",
  ctaKey:   "cta_meeting",
  reason:
    "Direct or unattributed traffic — defaulting to brand-led experience. " +
    "Platform-scale proof builds credibility; meeting CTA suits a relationship-first approach.",
};

// ── MockAiProvider ────────────────────────────────────────────────────────────

/**
 * A deterministic mock implementation of AiProvider.
 *
 * Returns a pre-defined plan based on visitor source with no external API call.
 * Populates rawReasoning with the prompt that would have been sent so the
 * AI dashboard can display meaningful debug information from day one.
 *
 * @see the module-level JSDoc for the full source → plan mapping.
 */
export class MockAiProvider implements AiProvider {
  readonly providerName = MOCK_PROVIDER;
  readonly modelId      = MOCK_MODEL_ID;

  async suggest(input: DecisionInput): Promise<AiProviderResult> {
    // Build the prompt — exercises the prompt builder and captures what a
    // real model would receive.  Included in rawReasoning for observability.
    const { systemPrompt, userPrompt, metadata } = buildHomepagePrompt(input);

    // Resolve the aiReady candidate pools — used to validate that the mock's
    // chosen keys are actually available in this tenant's configuration.
    const candidates = input.variantCandidates ?? platformOnlyCandidates();
    const heroReady  = filterAiReady(candidates.hero);
    const proofReady = filterAiReady(candidates.proof);
    const ctaReady   = filterAiReady(candidates.cta);

    // Resolve the deterministic plan for this visitor's source, then validate
    // that each chosen key is present in the aiReady pool.  Fall back to the
    // first available candidate per slot if the preferred key is not present.
    const planTemplate = SOURCE_PLANS[input.source] ?? DEFAULT_PLAN;

    const heroKey  = pickKey(heroReady,  planTemplate.heroKey)  as HeroVariantKey;
    const proofKey = pickKey(proofReady, planTemplate.proofKey) as ProofVariantKey;
    const ctaKey   = pickKey(ctaReady,   planTemplate.ctaKey)   as CTAVariantKey;

    const fallbackNote =
      heroKey  !== planTemplate.heroKey  ||
      proofKey !== planTemplate.proofKey ||
      ctaKey   !== planTemplate.ctaKey
        ? `\nNote: one or more preferred keys were not aiReady — fell back to first available.`
        : "";

    // Construct the full ExperiencePlan (satisfies the decision/types shape).
    const plan: ExperiencePlan = {
      heroKey,
      proofKey,
      ctaKey,
      reason: planTemplate.reason,
    };

    // Build a short summary of which signals were present so the rawReasoning
    // field gives operators useful context in the AI dashboard.
    const signalSummary = buildSignalSummary(input, metadata.signalCount);

    const candidateSummary =
      `aiReady candidates — hero: ${heroReady.length}, proof: ${proofReady.length}, cta: ${ctaReady.length}`;

    return {
      ok: true,
      output: {
        plan,
        confidence:    MOCK_CONFIDENCE,
        modelId:       MOCK_MODEL_ID,
        latencyMs:     0,
        // rawReasoning captures both the prompt and the mock's decision path so
        // operators see meaningful data in the dashboard without a real API call.
        rawReasoning:
          `[MOCK PROVIDER — no real model called]\n\n` +
          `Signal summary: ${signalSummary}\n` +
          `${candidateSummary}${fallbackNote}\n\n` +
          `Selected plan: source="${input.source}" → ${plan.heroKey} / ${plan.proofKey} / ${plan.ctaKey}\n\n` +
          `--- System prompt (would have been sent) ---\n` +
          `${systemPrompt}\n\n` +
          `--- User prompt (would have been sent) ---\n` +
          `${userPrompt}`,
      },
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns `preferred` if it exists in the aiReady candidate list, otherwise
 * returns the key of the first available candidate.
 *
 * Ensures the mock never emits a key that the AI prompt would reject —
 * respects the aiReady gating that applies to real models.
 */
function pickKey(candidates: VariantCandidate[], preferred: string): string {
  if (candidates.some((c) => c.key === preferred)) return preferred;
  // Preferred key not aiReady for this tenant — use first available
  return candidates[0]?.key ?? preferred;
}

/**
 * Builds a one-line human-readable summary of the visitor's signals.
 * Included in rawReasoning for dashboard observability.
 */
function buildSignalSummary(input: DecisionInput, signalCount: number): string {
  const parts: string[] = [
    `source=${input.source}`,
    `device=${input.device}`,
    `visitType=${input.visitType}`,
  ];

  if (input.utmSource !== null)        parts.push(`utm_source=${input.utmSource}`);
  if (input.utmCampaign !== null)      parts.push(`utm_campaign=${input.utmCampaign}`);
  if (input.referrerDomain !== null)   parts.push(`referrer=${input.referrerDomain}`);
  if (input.history.fromDatabase)      parts.push(`pageViews=${input.history.pageViewCount}`);
  if (input.history.hasClickedCta)     parts.push("hasClickedCta=true");

  return `${parts.join(", ")} (${signalCount} meaningful signal${signalCount === 1 ? "" : "s"})`;
}
