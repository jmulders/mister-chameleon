/**
 * Golden Scenario Tests — End-to-End Personalization Pipeline
 *
 * Tests the full pipeline: journey state → rule engine → confidence gating.
 *
 * ─── Scenarios ────────────────────────────────────────────────────────────────
 *
 *   A  New Visitor        — awareness stage, low confidence, default SaaS experience
 *   B  High Intent        — ready to buy, strong signals, intent hero + proof
 *   C  High Friction      — noise suppresses confidence, intent rule fires but gated
 *   D  Returning Visitor  — medium confidence, intent rule, proof+cta survive
 *   E  Post-Conversion    — form submitted, very_high, customer onboarding unlocked
 *   F  Customer Expansion — existing customer revisiting pricing, expansion CTA
 *   G  Churn Risk         — low activity + friction, intent rule suppressed to defaults
 *
 * ─── Assertions per scenario ─────────────────────────────────────────────────
 *
 *   ✓ confidence band
 *   ✓ matched rule ID
 *   ✓ final plan keys after confidence gating
 *   ✓ anySlotGated flag
 *
 * ─── Why "golden"? ───────────────────────────────────────────────────────────
 *
 *   These scenarios form the reference set for release readiness:
 *   if any of these fail, the personalization engine has regressed.
 *   Run via `npm run test:personalization` or `npm run test:release-check`.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { RulesDecisionProvider } from "@/decision/providers/rules-decision-provider";
import { applyConfidenceGating } from "@/decision/apply-confidence-gating";
import { buildJourney, buildInput, RULES_CONFIG, DEFAULT_PLAN } from "./_fixtures";

function makeProvider() {
  return new RulesDecisionProvider(RULES_CONFIG);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Runs the full pipeline for a journey state:
 *   1. getHomepagePlan() → raw rule plan
 *   2. applyConfidenceGating() → gated plan
 *
 * Returns the gated plan, anySlotGated flag, and the matched rule ID.
 */
async function runPipeline(journey: ReturnType<typeof buildJourney>, contextOverrides = {}) {
  const input    = buildInput(journey, contextOverrides);
  const provider = makeProvider();
  const rawPlan  = await provider.getHomepagePlan(input);

  const { plan, anySlotGated, gating } = applyConfidenceGating(rawPlan, journey, DEFAULT_PLAN);

  return {
    plan,
    anySlotGated,
    gating,
    matchedRuleId: provider.lastMatchedRuleInfo?.ruleId ?? null,
    rawPlan,
  };
}

// ── Scenario A: New Visitor ───────────────────────────────────────────────────

describe("Scenario A — New Visitor", () => {
  /**
   * First-time visitor, zero behavioral signals, awareness funnelStage.
   *
   * Expected:
   *   rule    = rule_saas_home_awareness (priority 50)
   *   band    = low
   *   gating  = hero/proof/cta all match defaultPlan (no change); theme stripped
   *   plan    = hero_saas_default + proof_saas_default + cta_saas_default
   *   anySlotGated = true (theme stripped even though slots match defaults)
   */
  it("matches rule_saas_home_awareness", async () => {
    const j   = buildJourney({ funnelStage: "awareness" });
    const out = await runPipeline(j);
    assert.strictEqual(out.matchedRuleId, "rule_saas_home_awareness");
  });

  it("band is low", () => {
    const j = buildJourney({ funnelStage: "awareness" });
    assert.strictEqual(j.confidence.band, "low");
  });

  it("plan keys match defaults (rule plan == defaultPlan for hero/proof/cta)", async () => {
    const j   = buildJourney({ funnelStage: "awareness" });
    const out = await runPipeline(j);
    assert.strictEqual(out.plan.heroKey,  DEFAULT_PLAN.heroKey,  "hero must be default");
    assert.strictEqual(out.plan.proofKey, DEFAULT_PLAN.proofKey, "proof must be default");
    assert.strictEqual(out.plan.ctaKey,   DEFAULT_PLAN.ctaKey,   "cta must be default");
    assert.strictEqual(out.plan.themeKey, undefined,             "theme stripped at low confidence");
    assert.strictEqual(out.anySlotGated,  true,                  "anySlotGated=true (theme stripped)");
  });
});

// ── Scenario B: High Intent ───────────────────────────────────────────────────

describe("Scenario B — High Intent", () => {
  /**
   * Visitor with strong buying signals: visited pricing, clicked CTA,
   * high intentScore, funnelStage=high_intent.
   * trial_ready excluded because funnelStage=high_intent.
   *
   * Expected:
   *   rule    = rule_saas_home_intent (priority 25, funnelStage=high_intent)
   *   band    = high
   *   gating  = hero + proof + cta allowed; theme stripped
   *   plan    = hero_saas_intent + proof_saas_intent + cta_saas_demo
   */
  function makeHighIntentJourney() {
    return buildJourney({
      funnelStage:           "high_intent",
      intentScore:           80,
      shortTermIntentScore:  60,
      longTermAffinityScore: 20,
      hasVisitedPricing:     true,
      hasVisitedAbout:       true,
      hasVisitedCases:       true,
      hasVisitedContact:     true,
      hasClickedCta:         true,
      formStartCount:        1,
      pageViewCount:         5,
      ctaClickCount:         2,
      signalDiversityScore:  0.5,
      uniqueSignalCount:     5,
      funnelStageConfidence: 0.85,
      matchedSequences:      ["homepage_product_pricing"],
    });
  }

  it("matches rule_saas_home_intent (funnelStage=high_intent, trial_ready excluded)", async () => {
    const out = await runPipeline(makeHighIntentJourney());
    assert.strictEqual(out.matchedRuleId, "rule_saas_home_intent");
  });

  it("band is high or very_high", () => {
    const j = makeHighIntentJourney();
    assert.ok(
      j.confidence.band === "high" || j.confidence.band === "very_high",
      `expected high or very_high, got ${j.confidence.band}`,
    );
  });

  it("hero_saas_intent, proof_saas_intent and cta_saas_demo survive gating", async () => {
    const out = await runPipeline(makeHighIntentJourney());
    assert.strictEqual(out.plan.heroKey,  "hero_saas_intent",  "hero_saas_intent must survive at high confidence");
    assert.strictEqual(out.plan.proofKey, "proof_saas_intent", "proof_saas_intent must survive at high confidence");
    assert.strictEqual(out.plan.ctaKey,   "cta_saas_demo",     "cta_saas_demo must survive at high confidence");
  });

  it("theme is stripped at high band", async () => {
    const j   = makeHighIntentJourney();
    const out = await runPipeline(j);
    if (j.confidence.band === "high") {
      assert.strictEqual(out.plan.themeKey, undefined, "theme stripped at high band");
      assert.strictEqual(out.anySlotGated,  true,      "anySlotGated=true when theme stripped");
    }
  });
});

// ── Scenario C: High Friction ─────────────────────────────────────────────────

describe("Scenario C — High Friction", () => {
  /**
   * Pricing visit with low signal diversity and high friction.
   * trial_ready: intentScore=40 < 50 → doesn't fire.
   * rule_saas_home_intent fires (hasVisitedPricing=true) but band=low → all gated.
   *
   * Expected:
   *   rule    = rule_saas_home_intent (hasVisitedPricing=true)
   *   band    = low (frictionScore=75 suppresses)
   *   gating  = all slots blocked → full defaults
   *   plan    = hero_saas_default + proof_saas_default + cta_saas_default
   */
  function makeHighFrictionJourney() {
    return buildJourney({
      funnelStage:           "consideration",
      intentScore:           40,
      shortTermIntentScore:  35,
      frictionScore:         75,
      hasVisitedPricing:     true,
      signalDiversityScore:  0.1,
      uniqueSignalCount:     1,
      pageViewCount:         1,
      funnelStageConfidence: 0.55,
      matchedSequences:      [],
    });
  }

  it("matches rule_saas_home_intent (hasVisitedPricing=true, intentScore<50 → not trial_ready)", async () => {
    const out = await runPipeline(makeHighFrictionJourney());
    assert.strictEqual(out.matchedRuleId, "rule_saas_home_intent");
  });

  it("friction suppresses confidence to low band", () => {
    const j = makeHighFrictionJourney();
    assert.strictEqual(j.confidence.band, "low",
      `frictionScore=75 should suppress to low, got ${j.confidence.band} (overall=${j.confidence.overallConfidence})`);
  });

  it("all slots blocked — fall back to defaults", async () => {
    const out = await runPipeline(makeHighFrictionJourney());
    assert.strictEqual(out.plan.heroKey,  DEFAULT_PLAN.heroKey,  "hero must fall back to default");
    assert.strictEqual(out.plan.proofKey, DEFAULT_PLAN.proofKey, "proof must fall back to default");
    assert.strictEqual(out.plan.ctaKey,   DEFAULT_PLAN.ctaKey,   "cta must fall back to default");
    assert.strictEqual(out.anySlotGated,  true);
  });

  it("theme is stripped", async () => {
    const out = await runPipeline(makeHighFrictionJourney());
    assert.strictEqual(out.plan.themeKey, undefined);
  });
});

// ── Scenario D: Returning Visitor ─────────────────────────────────────────────

describe("Scenario D — Returning Visitor", () => {
  /**
   * Multi-session visitor with pricing intent, moderate intentScore.
   * trial_ready: intentScore=45 < 50 → doesn't fire.
   * rule_saas_home_intent fires (funnelStage=intent OR hasVisitedPricing=true).
   *
   * Expected:
   *   rule    = rule_saas_home_intent (priority 25)
   *   band    = medium
   *   gating  = proof + cta allowed; hero blocked (→ default); theme stripped
   *   plan    = hero_saas_default + proof_saas_intent + cta_saas_demo
   */
  function makeReturningJourney() {
    return buildJourney({
      funnelStage:           "intent",
      intentScore:           45,
      shortTermIntentScore:  25,
      longTermAffinityScore: 40,
      hasVisitedPricing:     true,
      hasVisitedAbout:       true,
      hasVisitedCases:       true,
      pageViewCount:         3,
      signalDiversityScore:  0.3,
      uniqueSignalCount:     3,
      funnelStageConfidence: 0.70,
      matchedSequences:      ["services_to_case"],
    });
  }

  it("matches rule_saas_home_intent (intentScore=45 < 50 → trial_ready excluded)", async () => {
    const out = await runPipeline(makeReturningJourney());
    assert.strictEqual(out.matchedRuleId, "rule_saas_home_intent");
  });

  it("band is medium", () => {
    const j = makeReturningJourney();
    assert.strictEqual(j.confidence.band, "medium",
      `expected medium, got ${j.confidence.band} (overall=${j.confidence.overallConfidence})`);
  });

  it("proof_saas_intent allowed at medium confidence", async () => {
    const out = await runPipeline(makeReturningJourney());
    assert.strictEqual(out.plan.proofKey, "proof_saas_intent",
      "proof_saas_intent should survive at medium band");
  });

  it("cta_saas_demo allowed at medium confidence", async () => {
    const out = await runPipeline(makeReturningJourney());
    assert.strictEqual(out.plan.ctaKey, "cta_saas_demo",
      "cta_saas_demo should survive at medium band");
  });

  it("hero_saas_intent blocked at medium — falls back to default", async () => {
    const out = await runPipeline(makeReturningJourney());
    assert.strictEqual(out.plan.heroKey, DEFAULT_PLAN.heroKey,
      "hero requires high confidence — must fall back to hero_saas_default");
  });

  it("theme stripped at medium confidence", async () => {
    const out = await runPipeline(makeReturningJourney());
    assert.strictEqual(out.plan.themeKey, undefined);
    assert.strictEqual(out.anySlotGated,  true);
  });
});

// ── Scenario E: Post-Conversion ───────────────────────────────────────────────

describe("Scenario E — Post-Conversion", () => {
  /**
   * Visitor who submitted the form (hasSubmittedForm=true), no pricing revisit.
   * rule_saas_customer_expansion: requires hasVisitedPricing → NO.
   * rule_saas_customer_onboarding: funnelStage=customer OR hasSubmittedForm → YES.
   *
   * Expected:
   *   rule    = rule_saas_customer_onboarding
   *   band    = very_high
   *   gating  = all slots unlocked (≥5 events for theme)
   *   plan    = hero_saas_customer_onboarding + proof_saas_default + cta_saas_onboarding
   *   anySlotGated = false
   */
  function makePostConversionJourney() {
    return buildJourney({
      funnelStage:      "customer",
      intentScore:      100,
      hasSubmittedForm: true,
      pageViewCount:    5,
      ctaClickCount:    1,
      formStartCount:   1,
    });
  }

  it("matches rule_saas_customer_onboarding (hasSubmittedForm=true, no pricing revisit)", async () => {
    const out = await runPipeline(makePostConversionJourney());
    assert.strictEqual(out.matchedRuleId, "rule_saas_customer_onboarding");
  });

  it("band is very_high (hasSubmittedForm overrides all)", () => {
    const j = makePostConversionJourney();
    assert.strictEqual(j.confidence.band,             "very_high");
    assert.strictEqual(j.confidence.overallConfidence, 1.0);
  });

  it("no slots gated — full experience unlocked", async () => {
    const out = await runPipeline(makePostConversionJourney());
    assert.strictEqual(out.anySlotGated, false,
      "no slots should be gated at very_high confidence");
  });

  it("rule plan served exactly: hero_saas_customer_onboarding + proof_saas_default + cta_saas_onboarding", async () => {
    const out = await runPipeline(makePostConversionJourney());
    assert.strictEqual(out.plan.heroKey,  "hero_saas_customer_onboarding");
    assert.strictEqual(out.plan.proofKey, "proof_saas_default");
    assert.strictEqual(out.plan.ctaKey,   "cta_saas_onboarding");
  });

  it("theme corporate-trust included (very_high + ≥5 events)", async () => {
    const out = await runPipeline(makePostConversionJourney());
    assert.ok(out.plan.themeKey !== undefined, "theme should be present at very_high");
    assert.strictEqual(out.plan.themeKey, "corporate-trust");
  });
});

// ── Scenario F: Customer Expansion ───────────────────────────────────────────

describe("Scenario F — Customer Expansion", () => {
  /**
   * Existing customer revisiting pricing.
   * hasSubmittedForm=true + hasVisitedPricing=true → expansion rule (priority 12).
   *
   * Expected:
   *   rule    = rule_saas_customer_expansion
   *   band    = very_high
   *   gating  = all slots unlocked (≥5 events for theme)
   *   plan    = hero_saas_customer_onboarding + proof_saas_intent + cta_saas_expansion
   *   anySlotGated = false
   */
  function makeExpansionJourney() {
    return buildJourney({
      funnelStage:       "customer",
      hasSubmittedForm:  true,
      hasVisitedPricing: true,
      intentScore:       55,
      pageViewCount:     6,
      ctaClickCount:     1,
      formStartCount:    1,
    });
  }

  it("band is very_high (form submitted)", () => {
    const j = makeExpansionJourney();
    assert.strictEqual(j.confidence.band, "very_high");
  });

  it("matches rule_saas_customer_expansion (hasSubmittedForm + hasVisitedPricing)", async () => {
    const out = await runPipeline(makeExpansionJourney());
    assert.strictEqual(out.matchedRuleId, "rule_saas_customer_expansion");
  });

  it("full rule plan served (no gating at very_high)", async () => {
    const out = await runPipeline(makeExpansionJourney());
    assert.strictEqual(out.anySlotGated, false,
      "no slots should be gated for expansion customer");
    assert.strictEqual(out.plan.heroKey,  "hero_saas_customer_onboarding");
    assert.strictEqual(out.plan.proofKey, "proof_saas_intent");
    assert.strictEqual(out.plan.ctaKey,   "cta_saas_expansion");
  });

  it("theme modern-saas included (very_high + ≥5 events)", async () => {
    const out = await runPipeline(makeExpansionJourney());
    assert.ok(out.plan.themeKey !== undefined, "theme should be present at very_high");
    assert.strictEqual(out.plan.themeKey, "modern-saas");
  });
});

// ── Scenario G: Churn Risk ────────────────────────────────────────────────────

describe("Scenario G — Churn Risk", () => {
  /**
   * Existing customer with low activity and moderate friction.
   * hasVisitedPricing=true but intentScore=15 < 50 → trial_ready doesn't fire.
   * rule_saas_home_intent fires (hasVisitedPricing=true) but band=low → all gated.
   *
   * Expected:
   *   rule    = rule_saas_home_intent (hasVisitedPricing=true)
   *   band    = low (friction + low diversity)
   *   gating  = all blocked → defaults
   *   plan    = hero_saas_default + proof_saas_default + cta_saas_default
   */
  function makeChurnRiskJourney() {
    return buildJourney({
      funnelStage:           "consideration",
      intentScore:           15,
      shortTermIntentScore:  5,
      longTermAffinityScore: 60,
      frictionScore:         30,
      hasVisitedPricing:     true,
      signalDiversityScore:  0.1,
      uniqueSignalCount:     1,
      pageViewCount:         1,
      funnelStageConfidence: 0.55,
      matchedSequences:      [],
    });
  }

  it("matches rule_saas_home_intent (hasVisitedPricing=true, intentScore=15 < 50)", async () => {
    const out = await runPipeline(makeChurnRiskJourney());
    assert.strictEqual(out.matchedRuleId, "rule_saas_home_intent");
  });

  it("band is low (friction + low signal diversity)", () => {
    const j = makeChurnRiskJourney();
    assert.strictEqual(j.confidence.band, "low",
      `expected low, got ${j.confidence.band} (overall=${j.confidence.overallConfidence})`);
  });

  it("all slots blocked — fall back to defaults", async () => {
    const out = await runPipeline(makeChurnRiskJourney());
    assert.strictEqual(out.plan.heroKey,  DEFAULT_PLAN.heroKey);
    assert.strictEqual(out.plan.proofKey, DEFAULT_PLAN.proofKey);
    assert.strictEqual(out.plan.ctaKey,   DEFAULT_PLAN.ctaKey);
    assert.strictEqual(out.anySlotGated,  true);
  });

  it("theme is stripped", async () => {
    const out = await runPipeline(makeChurnRiskJourney());
    assert.strictEqual(out.plan.themeKey, undefined);
  });
});
