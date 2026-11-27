/**
 * A rule on where the visitor came from changes the page on the first visit.
 *
 * Found on 22 Nov 2026 on a live tenant: the rule "source is linkedin → the
 * LinkedIn hero" never showed that hero to a first visitor. Confidence gating
 * puts the hero, the proof and the CTA back to their defaults until enough
 * behaviour is known, and a first visitor has none. But where someone came
 * from is a fact of the request, not behaviour. A rule that rests only on that
 * is now let through. A rule that also reads anything else stays gated.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arrivalPlanOf, restsOnArrivalOnly } from "../../decision/arrival-rule.ts";
import { applyConfidenceGating } from "../../decision/apply-confidence-gating.ts";
import { emptyJourneyState } from "../../lib/journey/types.ts";
import type { RuleCondition } from "../../decision/rules/stored-rule.ts";
import type { ExperiencePlan } from "../../decision/types.ts";

const field = (name: string, value: unknown = "x", operator = "equals") =>
  ({ type: "field", field: name, operator, value }) as unknown as RuleCondition;
const group = (logic: "and" | "or", ...conditions: RuleCondition[]) =>
  ({ type: "group", logic, conditions }) as unknown as RuleCondition;

// Variant keys are literal unions in the real type. The gate only compares them.
type Slots = Pick<ExperiencePlan, "heroKey" | "proofKey" | "ctaKey">;
const DEFAULTS = { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default" } as unknown as Slots;
const LINKEDIN_PLAN = { heroKey: "hero_linkedin_vision", proofKey: "proof_vision", ctaKey: "cta_platform" };
const plan = (over: Record<string, unknown> = {}) => ({ ...LINKEDIN_PLAN, reason: "test", ...over }) as unknown as ExperiencePlan;
const firstVisit = () => emptyJourneyState();

describe("restsOnArrivalOnly", () => {
  it("says yes for the traffic source", () => {
    assert.equal(restsOnArrivalOnly(field("source", "linkedin")), true);
  });

  it("says yes for UTM parameters, ad click ids and the referrer", () => {
    for (const name of ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", "gclid", "fbclid", "msclkid", "referrerDomain"]) {
      assert.equal(restsOnArrivalOnly(field(name)), true, name);
    }
  });

  it("says yes for a group of arrival checks, with and or with or", () => {
    assert.equal(restsOnArrivalOnly(group("and", field("source", "google"), field("utmSource", "google"))), true);
    assert.equal(restsOnArrivalOnly(group("or", field("source", "linkedin"), field("utmSource", "linkedin"))), true);
  });

  it("says no for what the platform learns from a visit", () => {
    for (const name of ["visitType", "timeOfDay", "device", "journey.funnelStage", "journey.intentScore", "interestPrimary", "companyType", "crm.isCustomer"]) {
      assert.equal(restsOnArrivalOnly(field(name)), false, name);
    }
  });

  it("says no when arrival is only part of the condition", () => {
    assert.equal(restsOnArrivalOnly(group("and", field("source", "google"), field("visitType", "new"))), false);
    // With "or" the match may have come from the other part.
    assert.equal(restsOnArrivalOnly(group("or", field("source", "google"), field("journey.intentScore", 50))), false);
    assert.equal(restsOnArrivalOnly(group("and", field("source", "linkedin"), group("or", field("utmMedium", "paid"), field("visitType", "new")))), false);
  });

  it("says no for conditions that are not field checks", () => {
    for (const type of ["named", "context", "context_library", "flag", "attribute"]) {
      assert.equal(restsOnArrivalOnly({ type } as unknown as RuleCondition), false, type);
    }
    assert.equal(restsOnArrivalOnly(group("and")), false);
    assert.equal(restsOnArrivalOnly(null), false);
    assert.equal(restsOnArrivalOnly(field("no_such_field")), false);
  });
});

describe("arrivalPlanOf", () => {
  it("hands back the hero, proof and CTA of an arrival rule", () => {
    const rule = { condition: field("source", "linkedin"), plan: { ...LINKEDIN_PLAN, featureKey: "feature_highlights", themeKey: "night" } };
    assert.deepEqual(arrivalPlanOf(rule as never), LINKEDIN_PLAN);
  });

  it("hands back nothing for any other rule, or for no rule", () => {
    assert.equal(arrivalPlanOf({ condition: field("visitType", "new"), plan: LINKEDIN_PLAN } as never), null);
    assert.equal(arrivalPlanOf(null), null);
    assert.equal(arrivalPlanOf(undefined), null);
  });
});

describe("the gate on a first visit", () => {
  it("puts everything back to default for a rule that is not about arrival", () => {
    const out = applyConfidenceGating(plan(), firstVisit(), DEFAULTS);
    assert.equal(out.plan.heroKey, "hero_default");
    assert.equal(out.plan.proofKey, "proof_default");
    assert.equal(out.plan.ctaKey, "cta_default");
    assert.equal(out.anySlotGated, true);
  });

  it("lets the hero, proof and CTA of an arrival rule through", () => {
    const out = applyConfidenceGating(plan(), firstVisit(), DEFAULTS, LINKEDIN_PLAN);
    assert.equal(out.plan.heroKey, "hero_linkedin_vision");
    assert.equal(out.plan.proofKey, "proof_vision");
    assert.equal(out.plan.ctaKey, "cta_platform");
    assert.equal(out.anySlotGated, false);
    assert.deepEqual([out.gating.hero, out.gating.proof, out.gating.cta], [true, true, true]);
    assert.match(out.gatingSummary, /where the visitor came from: hero, proof, cta/);
  });

  it("keeps the theme behind the gate, also for an arrival rule", () => {
    const out = applyConfidenceGating(plan({ themeKey: "night" }), firstVisit(), DEFAULTS, LINKEDIN_PLAN);
    assert.equal(out.plan.themeKey, undefined);
    assert.equal(out.plan.heroKey, "hero_linkedin_vision");
    assert.equal(out.gating.theme, false);
  });

  it("still gates a slot that no longer carries the rule's own value", () => {
    // Something after the rule (AI, an experiment) put another hero in the plan.
    const out = applyConfidenceGating(plan({ heroKey: "hero_intent_direct" }), firstVisit(), DEFAULTS, LINKEDIN_PLAN);
    assert.equal(out.plan.heroKey, "hero_default");
    assert.equal(out.plan.proofKey, "proof_vision");
  });

  it("lets through only the slots the rule sets", () => {
    const out = applyConfidenceGating(plan(), firstVisit(), DEFAULTS, { heroKey: "hero_linkedin_vision" });
    assert.equal(out.plan.heroKey, "hero_linkedin_vision");
    assert.equal(out.plan.proofKey, "proof_default");
    assert.equal(out.plan.ctaKey, "cta_default");
  });

  it("changes nothing when called as before", () => {
    const before = applyConfidenceGating(plan(), firstVisit(), DEFAULTS);
    const same   = applyConfidenceGating(plan(), firstVisit(), DEFAULTS, null);
    assert.deepEqual(same, before);
  });
});

describe("the homepage pipeline", () => {
  const source = readFileSync(new URL("../../lib/pipeline/homepage-pipeline.ts", import.meta.url), "utf8");

  it("hands the gate the matched rule, so an arrival rule can pass", () => {
    assert.match(source, /applyConfidenceGating\(\s*experience\.plan,\s*journeyForGating,\s*defaultPlan,[\s\S]{0,400}arrivalPlanOf\(/);
    assert.match(source, /rulesProvider\.lastMatchedRuleId/);
  });

  it("keeps the control group, the cap and bots on the default plan before any rule runs", () => {
    assert.match(source, /const isUaBot = isBotUserAgent\(h\.get\("user-agent"\)\);/);
    assert.match(source, /const forceDefaultForBot = isControl \|\| isWarmup \|\| isUaBot;/);
    assert.match(source, /new RulesDecisionProvider\(tenantRulesConfig \?\? undefined, forceDefaultForBot,/);
  });
});
