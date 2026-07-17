/**
 * Rule Engine Unit Tests
 *
 * Tests RulesDecisionProvider.getHomepagePlan() in isolation, verifying
 * which rule fires for different visitor contexts.
 *
 * Uses RULES_CONFIG loaded from runtime-rules.json so the tests always
 * reflect the current production rule set (no hardcoded copies).
 *
 * ─── Isolation strategy ──────────────────────────────────────────────────────
 *
 *   history.fromDatabase = false in all tests except those explicitly covering
 *   named conditions (returning_cta_clicked, high_engagement), so named
 *   conditions evaluate to false without affecting behavioral rule assertions.
 *
 *   Traffic-source rules (LinkedIn, Google) are tested with explicit utmSource
 *   overrides against the base direct-traffic context.
 *
 * ─── Canonical rule set (runtime-rules.json) ─────────────────────────────────
 *
 *   Priority  ID
 *   ────────  ─────────────────────────────────────
 *    1        homepage.linkedin
 *    5        homepage.google
 *    7        homepage.returning_cta_clicked
 *   10        homepage.high_engagement
 *   12        rule_saas_customer_expansion
 *   15        rule_saas_customer_onboarding
 *   20        rule_saas_form_dropoff
 *   22        rule_saas_home_trial_ready
 *   25        rule_saas_home_intent
 *   35        rule_saas_home_consideration
 *   50        rule_saas_home_awareness
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { RulesDecisionProvider }   from "@/decision/providers/rules-decision-provider";
import type { JourneyFunnelStage } from "@/lib/journey/types";
import { buildJourney, buildInput, RULES_CONFIG } from "./_fixtures";

function makeProvider() {
  return new RulesDecisionProvider(RULES_CONFIG);
}

// ── Traffic-source rules ───────────────────────────────────────────────────────

describe("rule engine — traffic source rules", () => {

  it("LinkedIn traffic (utmSource=linkedin, source=linkedin) → homepage.linkedin", async () => {
    const j        = buildJourney({});
    const input    = buildInput(j, { source: "linkedin", utmSource: "linkedin" });
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "homepage.linkedin");
    assert.strictEqual(plan.heroKey,  "hero_linkedin_vision");
    assert.strictEqual(plan.proofKey, "proof_vision");
    assert.strictEqual(plan.ctaKey,   "cta_platform");
  });

  it("Google traffic (utmSource=google) → homepage.google", async () => {
    const j        = buildJourney({});
    const input    = buildInput(j, { utmSource: "google" });
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "homepage.google");
    assert.strictEqual(plan.heroKey,  "hero_google_problem");
    assert.strictEqual(plan.ctaKey,   "cta_guide");
  });

  it("direct traffic with awareness stage → rule_saas_home_awareness", async () => {
    const j        = buildJourney({ funnelStage: "awareness" });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_awareness");
    assert.strictEqual(plan.heroKey,  "hero_saas_default");
    assert.strictEqual(plan.ctaKey,   "cta_saas_default");
  });
});

// ── Named-condition rules ─────────────────────────────────────────────────────

describe("rule engine — named conditions (require fromDatabase=true)", () => {

  it("returning + hasClickedCta (fromDatabase=true) → homepage.returning_cta_clicked", async () => {
    const j     = buildJourney({ funnelStage: "awareness" });
    const input = buildInput(
      j,
      { visitType: "returning" },
      // fromDatabase=true enables named condition evaluation
      { fromDatabase: true, hasClickedCta: true, pageViewCount: 1 },
    );
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "homepage.returning_cta_clicked");
    assert.strictEqual(plan.heroKey,  "hero_saas_intent");
    assert.strictEqual(plan.proofKey, "proof_saas_intent");
    assert.strictEqual(plan.ctaKey,   "cta_saas_demo");
  });

  it("3+ page views in history (fromDatabase=true) → homepage.high_engagement", async () => {
    // high_engagement (priority 10) fires before blueprint behavioral rules when
    // the visitor has 3+ page views in their DB history.
    // Note: must not have hasClickedCta=true (returning_cta_clicked priority=7 would win).
    const j     = buildJourney({ funnelStage: "awareness" });
    const input = buildInput(
      j,
      {},
      { fromDatabase: true, hasClickedCta: false, pageViewCount: 3 },
    );
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "homepage.high_engagement");
    assert.strictEqual(plan.heroKey,  "hero_saas_consideration");
    assert.strictEqual(plan.proofKey, "proof_saas_consideration");
    assert.strictEqual(plan.ctaKey,   "cta_saas_demo");
  });

  it("fromDatabase=false suppresses named conditions entirely", async () => {
    // Even with pageViewCount=10, named conditions must not fire when fromDatabase=false
    const j     = buildJourney({ funnelStage: "awareness" });
    const input = buildInput(
      j,
      {},
      { fromDatabase: false, hasClickedCta: true, pageViewCount: 10 },
    );
    const provider = makeProvider();
    await provider.getHomepagePlan(input);
    assert.notStrictEqual(
      provider.lastMatchedRuleInfo?.ruleId,
      "homepage.returning_cta_clicked",
      "returning_cta_clicked must not fire when fromDatabase=false",
    );
    assert.notStrictEqual(
      provider.lastMatchedRuleInfo?.ruleId,
      "homepage.high_engagement",
      "high_engagement must not fire when fromDatabase=false",
    );
  });
});

// ── Customer lifecycle rules ──────────────────────────────────────────────────

describe("rule engine — customer lifecycle rules", () => {

  it("funnelStage=customer → rule_saas_customer_onboarding (priority 15)", async () => {
    const j        = buildJourney({ funnelStage: "customer", hasVisitedPricing: false });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_customer_onboarding");
    assert.strictEqual(plan.heroKey,  "hero_saas_customer_onboarding");
    assert.strictEqual(plan.proofKey, "proof_saas_default");
    assert.strictEqual(plan.ctaKey,   "cta_saas_onboarding");
  });

  it("hasSubmittedForm=true (OR arm) → rule_saas_customer_onboarding (priority 15)", async () => {
    const j        = buildJourney({
      funnelStage:      "consideration",
      hasSubmittedForm: true,
      hasVisitedPricing: false,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_customer_onboarding");
    assert.strictEqual(plan.ctaKey, "cta_saas_onboarding");
  });

  it("hasSubmittedForm=true + hasVisitedPricing=true → rule_saas_customer_expansion (priority 12)", async () => {
    const j        = buildJourney({
      funnelStage:       "customer",
      hasSubmittedForm:  true,
      hasVisitedPricing: true,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_customer_expansion");
    assert.strictEqual(plan.heroKey,  "hero_saas_customer_onboarding");
    assert.strictEqual(plan.proofKey, "proof_saas_intent");
    assert.strictEqual(plan.ctaKey,   "cta_saas_expansion");
  });

  it("expansion (12) beats onboarding (15) when both would match", async () => {
    // hasSubmittedForm=true satisfies BOTH expansion AND onboarding.
    // Expansion wins because priority 12 < 15.
    const j     = buildJourney({ hasSubmittedForm: true, hasVisitedPricing: true });
    const input = buildInput(j);
    const provider = makeProvider();
    await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_customer_expansion");
    assert.strictEqual(provider.lastMatchedRuleInfo?.priority, 12);
  });
});

// ── Form drop-off rule ────────────────────────────────────────────────────────

describe("rule engine — form drop-off rule", () => {

  it("formStartCount>0 + !hasSubmittedForm + frictionScore>=10 → rule_saas_form_dropoff", async () => {
    const j        = buildJourney({
      funnelStage:      "intent",
      formStartCount:   1,
      hasSubmittedForm: false,
      frictionScore:    15,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_form_dropoff");
    assert.strictEqual(plan.heroKey,  "hero_saas_consideration");
    assert.strictEqual(plan.proofKey, "proof_saas_reassurance");
    assert.strictEqual(plan.ctaKey,   "cta_saas_demo");
  });

  it("frictionScore<10 does NOT fire form_dropoff", async () => {
    // Low friction — visitor hasn't struggled enough to need reassurance.
    const j        = buildJourney({
      funnelStage:      "intent",
      formStartCount:   1,
      hasSubmittedForm: false,
      frictionScore:    5,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    await provider.getHomepagePlan(input);
    assert.notStrictEqual(
      provider.lastMatchedRuleInfo?.ruleId,
      "rule_saas_form_dropoff",
      "form_dropoff must not fire when frictionScore < 10",
    );
  });

  it("hasSubmittedForm=true prevents form_dropoff (already converted)", async () => {
    const j        = buildJourney({
      funnelStage:      "customer",
      formStartCount:   1,
      hasSubmittedForm: true,
      frictionScore:    20,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    await provider.getHomepagePlan(input);
    assert.notStrictEqual(
      provider.lastMatchedRuleInfo?.ruleId,
      "rule_saas_form_dropoff",
      "form_dropoff must not fire when hasSubmittedForm=true",
    );
  });
});

// ── Trial-ready rule ──────────────────────────────────────────────────────────

describe("rule engine — trial-ready rule", () => {

  it("hasVisitedPricing=true + intentScore>=50 + stage not customer/high_intent → rule_saas_home_trial_ready", async () => {
    const j        = buildJourney({
      funnelStage:       "intent",
      hasVisitedPricing: true,
      intentScore:       55,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_trial_ready");
    assert.strictEqual(plan.heroKey,  "hero_saas_trial");
    assert.strictEqual(plan.proofKey, "proof_saas_intent");
    assert.strictEqual(plan.ctaKey,   "cta_saas_trial");
  });

  it("intentScore<50 does NOT fire trial_ready (too early for trial)", async () => {
    const j        = buildJourney({
      funnelStage:       "consideration",
      hasVisitedPricing: true,
      intentScore:       40,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    await provider.getHomepagePlan(input);
    assert.notStrictEqual(
      provider.lastMatchedRuleInfo?.ruleId,
      "rule_saas_home_trial_ready",
      "trial_ready must not fire when intentScore < 50",
    );
  });

  it("funnelStage=high_intent excluded from trial_ready → falls to rule_saas_home_intent", async () => {
    // high_intent visitors skip trial_ready (priority 22) and land on intent rule (priority 25).
    // trial_ready has explicit not_equals guard for high_intent.
    const j        = buildJourney({
      funnelStage:       "high_intent",
      hasVisitedPricing: true,
      intentScore:       80,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    await provider.getHomepagePlan(input);
    assert.strictEqual(
      provider.lastMatchedRuleInfo?.ruleId,
      "rule_saas_home_intent",
      "high_intent visitors must bypass trial_ready and land on intent rule",
    );
  });

  it("funnelStage=customer excluded from trial_ready (already converted)", async () => {
    const j        = buildJourney({
      funnelStage:       "customer",
      hasVisitedPricing: true,
      intentScore:       70,
      hasSubmittedForm:  false, // keep expansion from firing
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    await provider.getHomepagePlan(input);
    assert.notStrictEqual(
      provider.lastMatchedRuleInfo?.ruleId,
      "rule_saas_home_trial_ready",
      "trial_ready must not fire for customer stage",
    );
  });
});

// ── Behavioral rules ──────────────────────────────────────────────────────────

describe("rule engine — behavioral rules", () => {

  it("funnelStage=high_intent → rule_saas_home_intent", async () => {
    const j        = buildJourney({ funnelStage: "high_intent", intentScore: 10 });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_intent");
    assert.strictEqual(plan.heroKey,  "hero_saas_intent");
    assert.strictEqual(plan.proofKey, "proof_saas_intent");
    assert.strictEqual(plan.ctaKey,   "cta_saas_demo");
  });

  it("funnelStage=intent → rule_saas_home_intent (OR condition)", async () => {
    const j        = buildJourney({ funnelStage: "intent", intentScore: 30 });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_intent");
    assert.strictEqual(plan.ctaKey, "cta_saas_demo");
  });

  it("intentScore>=60 alone → rule_saas_home_intent (score OR arm)", async () => {
    const j        = buildJourney({
      funnelStage:       "consideration",
      intentScore:       65,
      hasVisitedPricing: false,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_intent");
    assert.strictEqual(plan.ctaKey, "cta_saas_demo");
  });

  it("matchedSequences contains homepage_product_pricing → rule_saas_home_intent", async () => {
    const j        = buildJourney({
      funnelStage:        "consideration",
      intentScore:        20,
      matchedSequences:   ["homepage_product_pricing"],
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_intent");
    assert.strictEqual(plan.heroKey, "hero_saas_intent");
  });

  it("funnelStage=consideration (no pricing, no sequences) → rule_saas_home_consideration", async () => {
    const j        = buildJourney({
      funnelStage:       "consideration",
      intentScore:       20,
      hasVisitedPricing: false,
      matchedSequences:  [],
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_consideration");
    assert.strictEqual(plan.heroKey,  "hero_saas_consideration");
    assert.strictEqual(plan.proofKey, "proof_saas_consideration");
    assert.strictEqual(plan.ctaKey,   "cta_saas_demo");
  });

  it("hasVisitedCases=true → rule_saas_home_consideration (OR arm)", async () => {
    const j        = buildJourney({
      funnelStage:       "awareness",
      intentScore:       10,
      hasVisitedCases:   true,
      hasVisitedPricing: false,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_consideration");
  });

  it("hasVisitedAbout=true → rule_saas_home_consideration (OR arm)", async () => {
    const j        = buildJourney({
      funnelStage:       "awareness",
      intentScore:       10,
      hasVisitedAbout:   true,
      hasVisitedPricing: false,
    });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_consideration");
  });

  it("funnelStage=awareness (direct, new, no signals) → rule_saas_home_awareness", async () => {
    const j        = buildJourney({ funnelStage: "awareness" });
    const input    = buildInput(j);
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_home_awareness");
    assert.strictEqual(plan.heroKey,  "hero_saas_default");
    assert.strictEqual(plan.proofKey, "proof_saas_default");
    assert.strictEqual(plan.ctaKey,   "cta_saas_default");
  });

  it("no rule matches → default plan returned", async () => {
    // Use a null funnelStage so none of the field-equality conditions match.
    // Named conditions are suppressed by fromDatabase=false (default in buildInput).
    // intentScore=0, hasVisitedPricing=false, matchedSequences=[] → no intent/consideration arms fire.
    const j     = buildJourney({ funnelStage: null as unknown as JourneyFunnelStage });
    const input = buildInput(j, {}, { fromDatabase: false });
    const provider = makeProvider();
    const plan     = await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo, null, "should return null when no rule matched");
    assert.strictEqual(plan.heroKey,  "hero_saas_default");
    assert.strictEqual(plan.proofKey, "proof_saas_default");
    assert.strictEqual(plan.ctaKey,   "cta_saas_default");
  });

  it("rule priority is respected — LinkedIn (1) beats all behavioral rules", async () => {
    // Even with very strong behavioral signals, LinkedIn rule fires first (priority 1)
    const j     = buildJourney({
      funnelStage:       "high_intent",
      intentScore:       95,
      hasVisitedPricing: true,
    });
    const input = buildInput(j, { source: "linkedin", utmSource: "linkedin" });
    const provider = makeProvider();
    await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "homepage.linkedin");
    assert.strictEqual(provider.lastMatchedRuleInfo?.priority, 1);
  });

  it("priority ordering — form_dropoff (20) beats trial_ready (22) when both conditions match", async () => {
    // formStartCount>0 + frictionScore>=10 + hasVisitedPricing=true + intentScore>=50
    // both form_dropoff (20) AND trial_ready (22) conditions satisfied.
    // form_dropoff wins because priority 20 < 22.
    const j     = buildJourney({
      funnelStage:       "intent",
      formStartCount:    1,
      hasSubmittedForm:  false,
      frictionScore:     15,
      hasVisitedPricing: true,
      intentScore:       55,
    });
    const input = buildInput(j);
    const provider = makeProvider();
    await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleInfo?.ruleId, "rule_saas_form_dropoff");
    assert.strictEqual(provider.lastMatchedRuleInfo?.priority, 20);
  });
});
