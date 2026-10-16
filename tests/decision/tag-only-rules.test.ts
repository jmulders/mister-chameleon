/**
 * Tag-only rules ("regels die context schrijven", spec §5 and §9).
 *
 * A tag rule writes context and serves the default variants. Without a flag
 * it still won phase B (first match), so every lower-priority variant rule was
 * blocked for the visitors it tagged. With `tagOnly: true` it writes in phase A,
 * is skipped in phase B and still counts as fired.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import type { StoredRulesConfig, StoredRule } from "@/decision/rules/stored-rule";
import { validateStoredConfig }               from "@/decision/rules/stored-rule";
import { analyzeRulesConfig }                 from "@/decision/rules/config-health";
import { RulesDecisionProvider }              from "@/decision/providers/rules-decision-provider";
import { buildJourney, buildInput, RULES_CONFIG } from "../personalization/_fixtures";

let stamp = 0;
function config(rules: unknown[]): StoredRulesConfig {
  stamp += 1;
  return {
    schemaVersion: 1,
    rulesEnabled:  true,
    // Unique per config: compiled rules are cached per config version.
    updatedAt:     `2026-10-16T00:00:${String(stamp).padStart(2, "0")}.000Z`,
    defaultPlan:   RULES_CONFIG.defaultPlan,
    rules,
  } as unknown as StoredRulesConfig;
}

const DIRECT = { type: "field", field: "source", operator: "equals", value: "direct" };

function tagger(extra: Partial<StoredRule> = {}) {
  return {
    id: "tagger", priority: 1, label: "Gericht binnengekomen (meet)", reason: "tags direct traffic",
    condition: DIRECT,
    plan: { ...RULES_CONFIG.defaultPlan, setContext: [{ key: "gericht_binnengekomen", value: true }] },
    ...extra,
  };
}

const VARIANT_FOR_DIRECT = {
  id: "direct_variant", priority: 2, label: "direct variant", reason: "personalise direct traffic",
  condition: DIRECT,
  plan: { heroKey: "hero_linkedin_vision", proofKey: "proof_vision", ctaKey: "cta_platform" },
};

const READER = {
  id: "reader", priority: 2, label: "reader", reason: "reads the tag",
  condition: { type: "flag", name: "gericht_binnengekomen", operator: "equals", value: true },
  plan: { heroKey: "hero_linkedin_vision", proofKey: "proof_vision", ctaKey: "cta_platform" },
};

describe("tag-only rules — engine", () => {
  it("without the flag a tag rule still wins the variant choice (the old behaviour)", async () => {
    const provider = new RulesDecisionProvider(config([tagger(), VARIANT_FOR_DIRECT]));
    await provider.getHomepagePlan(buildInput(buildJourney({})));
    assert.strictEqual(provider.lastMatchedRuleId, "tagger");
  });

  it("with tagOnly the lower-priority variant rule wins", async () => {
    const provider = new RulesDecisionProvider(config([tagger({ tagOnly: true }), VARIANT_FOR_DIRECT]));
    const plan = await provider.getHomepagePlan(buildInput(buildJourney({})));
    assert.strictEqual(provider.lastMatchedRuleId, "direct_variant");
    assert.strictEqual(plan.heroKey, "hero_linkedin_vision");
  });

  it("still writes its context, and a lower rule can read it in the same request", async () => {
    const provider = new RulesDecisionProvider(config([tagger({ tagOnly: true }), READER]));
    await provider.getHomepagePlan(buildInput(buildJourney({})));
    assert.strictEqual(provider.lastMatchedRuleId, "reader");
    assert.ok(provider.lastStickyContextWrites.some((w) => w.key === "gericht_binnengekomen"));
  });

  it("reports the matched tag rule so it counts as fired", async () => {
    const provider = new RulesDecisionProvider(config([tagger({ tagOnly: true }), VARIANT_FOR_DIRECT]));
    await provider.getHomepagePlan(buildInput(buildJourney({})));
    assert.deepStrictEqual(provider.lastTagRuleIds, ["tagger"]);
  });

  it("falls back to the default plan when only the tag rule matches", async () => {
    const provider = new RulesDecisionProvider(config([tagger({ tagOnly: true })]));
    const plan = await provider.getHomepagePlan(buildInput(buildJourney({})));
    assert.strictEqual(provider.lastMatchedRuleId, null);
    assert.strictEqual(plan.heroKey, RULES_CONFIG.defaultPlan.heroKey);
  });

  it("does not report a tag rule whose condition did not match", async () => {
    const miss = tagger({ tagOnly: true, condition: { type: "field", field: "source", operator: "equals", value: "linkedin" } as StoredRule["condition"] });
    const provider = new RulesDecisionProvider(config([miss]));
    await provider.getHomepagePlan(buildInput(buildJourney({})));
    assert.deepStrictEqual(provider.lastTagRuleIds, []);
  });
});

describe("tag-only rules — validation", () => {
  const errorsFor = (rule: unknown) => validateStoredConfig(config([rule]));

  it("accepts a tag-only rule with a context write", () => {
    assert.deepStrictEqual(errorsFor(tagger({ tagOnly: true })), []);
  });

  it("requires at least one context write", () => {
    const rule = tagger({ tagOnly: true });
    rule.plan = { ...RULES_CONFIG.defaultPlan, setContext: [] };
    assert.ok(errorsFor(rule).some((e) => e.field.endsWith("plan.setContext")));
  });

  it("cannot be combined with webhook-only", () => {
    const rule = tagger({ tagOnly: true, webhookOnly: true });
    (rule.plan as unknown as Record<string, unknown>).webhook = { url: "https://hooks.example.com/x" };
    assert.ok(errorsFor(rule).some((e) => e.field.endsWith("tagOnly")));
  });

  it("ignores the variant keys of a tag-only rule", () => {
    const rule = tagger({ tagOnly: true });
    rule.plan = { ...rule.plan, heroKey: "hero_does_not_exist" } as unknown as typeof rule.plan;
    assert.deepStrictEqual(errorsFor(rule), []);
  });

  it("rejects a non-boolean flag", () => {
    assert.ok(errorsFor({ ...tagger(), tagOnly: "yes" }).some((e) => e.field.endsWith("tagOnly")));
  });
});

describe("tag-only rules — config health", () => {
  const codes = (rules: unknown[]) => analyzeRulesConfig(config(rules)).map((f) => `${f.code}:${f.ruleId ?? ""}`);

  it("warns about a rule that looks like a tag rule but is not flagged", () => {
    assert.ok(codes([tagger(), VARIANT_FOR_DIRECT]).includes("unflagged-tag-rule:tagger"));
  });

  it("does not warn once the rule is flagged", () => {
    assert.ok(!codes([tagger({ tagOnly: true }), VARIANT_FOR_DIRECT]).some((c) => c.startsWith("unflagged-tag-rule")));
  });

  it("does not warn about a context-writing rule that serves its own variant", () => {
    const own = { ...tagger(), plan: { ...VARIANT_FOR_DIRECT.plan, setContext: [{ key: "x", value: true }] } };
    assert.ok(!codes([own]).some((c) => c.startsWith("unflagged-tag-rule")));
  });

  it("a flagged tag rule does not shadow an identical variant rule below it", () => {
    assert.ok(!codes([tagger({ tagOnly: true }), VARIANT_FOR_DIRECT]).includes("shadowed-rule:direct_variant"));
    assert.ok(codes([tagger(), VARIANT_FOR_DIRECT]).includes("shadowed-rule:direct_variant"));
  });
});
