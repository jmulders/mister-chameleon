/**
 * A rule that latches its own flag must still win phase B.
 *
 * Phase A applies setContext from every matching rule (so LATER rules see the
 * write). Phase B used to re-evaluate each rule against the mutated overlay, so
 * a rule with `flag seen_offer not_exists` + `setContext seen_offer` matched in
 * A, wrote the flag and then failed its own condition in B: the visitor got
 * the default plan forever.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import type { StoredRulesConfig }                 from "@/decision/rules/stored-rule";
import type { RuleEvaluationContext }             from "@/decision/rules/field-registry";
import { RulesDecisionProvider }                  from "@/decision/providers/rules-decision-provider";
import { buildJourney, buildInput, RULES_CONFIG } from "../personalization/_fixtures";

const LATCH_CONFIG = {
  schemaVersion: 1,
  rulesEnabled:  true,
  updatedAt:     "2026-10-02T00:00:00.000Z",
  defaultPlan:   RULES_CONFIG.defaultPlan,
  rules: [
    {
      id: "first_offer", priority: 1, label: "first offer", reason: "show the offer once",
      condition: { type: "flag", name: "seen_offer", operator: "not_exists" },
      plan: {
        heroKey: "hero_linkedin_vision", proofKey: "proof_vision", ctaKey: "cta_platform",
        setContext: [{ key: "seen_offer", value: true, monotone: true }],
      },
    },
    {
      id: "after_offer", priority: 2, label: "after offer", reason: "reads the latched flag",
      condition: { type: "flag", name: "seen_offer", operator: "equals", value: true },
      plan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default" },
    },
  ],
} as unknown as StoredRulesConfig;

describe("rules-decision-provider — a rule that writes its own flag", () => {
  it("view 1: the latching rule wins and its write is collected", async () => {
    const provider = new RulesDecisionProvider(LATCH_CONFIG);
    const plan = await provider.getHomepagePlan(buildInput(buildJourney({})));
    assert.strictEqual(provider.lastMatchedRuleId, "first_offer");
    assert.strictEqual(plan.heroKey, "hero_linkedin_vision");
    assert.ok(provider.lastStickyContextWrites.some((w) => w.key === "seen_offer"));
  });

  it("view 2: with the flag persisted, the latching rule no longer matches and the next rule reads it", async () => {
    const provider = new RulesDecisionProvider(LATCH_CONFIG);
    const input = buildInput(buildJourney({}));
    (input as unknown as RuleEvaluationContext).ruleContext = { seen_offer: true };
    await provider.getHomepagePlan(input);
    assert.strictEqual(provider.lastMatchedRuleId, "after_offer");
  });

  it("a rule without setContext still chooses over the updated context (spec §5)", async () => {
    // The reader sits above the writer: phase A applies the writer's tag, and
    // phase B evaluates the reader (which wrote nothing) against that overlay.
    const config = {
      ...LATCH_CONFIG,
      updatedAt: "2026-10-02T00:00:01.000Z",
      rules: [
        {
          id: "reader", priority: 1, label: "reader", reason: "reads tag",
          condition: { type: "flag", name: "tagged", operator: "equals", value: true },
          plan: { heroKey: "hero_linkedin_vision", proofKey: "proof_vision", ctaKey: "cta_platform" },
        },
        {
          id: "tagger", priority: 2, label: "tagger", reason: "tags direct traffic",
          condition: { type: "field", field: "source", operator: "equals", value: "direct" },
          plan: { ...RULES_CONFIG.defaultPlan, setContext: [{ key: "tagged", value: true, sticky: false }] },
        },
      ],
    } as unknown as StoredRulesConfig;
    const provider = new RulesDecisionProvider(config);
    await provider.getHomepagePlan(buildInput(buildJourney({})));
    assert.strictEqual(provider.lastMatchedRuleId, "reader");
  });
});
