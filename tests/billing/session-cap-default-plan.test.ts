/**
 * Session cap → default plan
 *
 * Proves that a visitor past the tenant's monthly session bundle is served the
 * tenant's defaultPlan and nothing else.
 *
 * ─── Why this test exists ────────────────────────────────────────────────────
 *
 *   The first version of the cap only set `isControl`, which suppresses ABM
 *   injection, returning-visitor context, audience segments and AI candidates.
 *   That looks like enforcement and is not: the rules engine sits below all of
 *   that and still adapts on traffic source, device and visit type. A capped
 *   visitor arriving from Google still got hero_google_problem — the product,
 *   delivered free, to a tenant whose bundle had run out. Nothing errored, so
 *   nothing looked wrong.
 *
 *   The real switch is the same one the tenant-level `rulesEnabled: false`
 *   setting uses: skip evaluation, return defaultPlan. These tests pin that the
 *   cap reaches it, using traffic sources with rules that would otherwise
 *   certainly match.
 *
 *   `forceDefaultPlan` is kept separate from `rulesEnabled` on purpose: one is
 *   the tenant's own configuration, the other is a billing state, and a billing
 *   state must never be written into a customer's settings.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { RulesDecisionProvider } from "@/decision/providers/rules-decision-provider";
import { buildJourney, buildInput, RULES_CONFIG } from "../personalization/_fixtures";

const DEFAULT_PLAN = RULES_CONFIG.defaultPlan;

// ── Capped visitors ───────────────────────────────────────────────────────────

describe("session cap — forceDefaultPlan", () => {

  it("LinkedIn traffic past the cap → defaultPlan, not hero_linkedin_vision", async () => {
    const input    = buildInput(buildJourney({}), { source: "linkedin", utmSource: "linkedin" });
    const provider = new RulesDecisionProvider(RULES_CONFIG, /* forceDefaultPlan */ true);
    const plan     = await provider.getHomepagePlan(input);

    assert.deepStrictEqual(plan, DEFAULT_PLAN);
    assert.notStrictEqual(plan.heroKey, "hero_linkedin_vision");
  });

  it("Google traffic past the cap → defaultPlan, not hero_google_problem", async () => {
    const input    = buildInput(buildJourney({}), { utmSource: "google" });
    const provider = new RulesDecisionProvider(RULES_CONFIG, true);
    const plan     = await provider.getHomepagePlan(input);

    assert.deepStrictEqual(plan, DEFAULT_PLAN);
    assert.notStrictEqual(plan.heroKey, "hero_google_problem");
  });

  it("no rule is reported as matched, so plan experiments cannot run either", async () => {
    // ExperimentDecisionProvider requires a matched rule before it looks up an
    // experiment. If the cap left a rule id behind, a capped visitor could still
    // be bucketed into a challenger variant — personalisation by another name.
    const input    = buildInput(buildJourney({}), { utmSource: "google" });
    const provider = new RulesDecisionProvider(RULES_CONFIG, true);
    await provider.getHomepagePlan(input);

    assert.strictEqual(provider.lastMatchedRuleId, null);
  });

  it("the cap is independent of the visitor's context — every source gets the same plan", async () => {
    const sources = ["linkedin", "google", "direct", "twitter"];
    for (const utmSource of sources) {
      const input    = buildInput(buildJourney({ funnelStage: "high_intent" }), { utmSource });
      const provider = new RulesDecisionProvider(RULES_CONFIG, true);
      const plan     = await provider.getHomepagePlan(input);
      assert.deepStrictEqual(plan, DEFAULT_PLAN, `utmSource=${utmSource} should get the default plan`);
    }
  });
});

// ── Not capped: the engine must still work ────────────────────────────────────

describe("session cap — within the bundle", () => {

  it("the same visitor below the cap DOES get the personalised plan", async () => {
    // The mirror of the first test. Without this, a provider that returned
    // defaultPlan unconditionally would pass every assertion above.
    const input    = buildInput(buildJourney({}), { source: "linkedin", utmSource: "linkedin" });
    const provider = new RulesDecisionProvider(RULES_CONFIG, false);
    const plan     = await provider.getHomepagePlan(input);

    assert.strictEqual(plan.heroKey, "hero_linkedin_vision");
    assert.strictEqual(provider.lastMatchedRuleId, "homepage.linkedin");
  });

  it("forceDefaultPlan defaults to false — existing call sites keep personalising", async () => {
    const input    = buildInput(buildJourney({}), { utmSource: "google" });
    const provider = new RulesDecisionProvider(RULES_CONFIG);
    const plan     = await provider.getHomepagePlan(input);

    assert.strictEqual(plan.heroKey, "hero_google_problem");
  });
});
