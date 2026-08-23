/**
 * rules-usage — cross-reference between adaptive blocks and stored rules.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blockVariantKeys,
  findRulesUsingBlock,
  buildRuleUsageIndex,
} from "../../lib/adaptive-blocks/rules-usage.ts";
import type { StoredRulesConfig } from "../../decision/rules/stored-rule.ts";

function config(rules: Array<{ id: string; label: string; plan: Record<string, unknown> }>, defaultPlan?: Record<string, unknown>): StoredRulesConfig {
  return {
    schemaVersion: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    rules: rules.map((r) => ({ ...r, priority: 1, condition: { type: "named", named: "always" }, reason: "" })),
    defaultPlan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default", reason: "", ...(defaultPlan ?? {}) },
  } as unknown as StoredRulesConfig;
}

const cfg = config(
  [
    { id: "r1", label: "Enterprise CTA", plan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_meeting" } },
    { id: "r2", label: "Nurture", plan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default", formVariants: { contact: "form_short" } } },
  ],
);

describe("blockVariantKeys", () => {
  it("includes the routing key and adaptive sub-variant keys", () => {
    const keys = blockVariantKeys({ key: "cta_meeting", adaptiveVariants: [{ variantKey: "form_short", content: {} }] } as never);
    assert.deepEqual([...keys].sort(), ["cta_meeting", "form_short"]);
  });
});

describe("findRulesUsingBlock", () => {
  it("finds a rule referencing the block key via its slot field", () => {
    const refs = findRulesUsingBlock({ key: "cta_meeting", adaptiveVariants: [] } as never, cfg);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].ruleId, "r1");
    assert.equal(refs[0].field, "ctaKey");
  });

  it("finds the default plan when it references the block", () => {
    const refs = findRulesUsingBlock({ key: "cta_default", adaptiveVariants: [] } as never, cfg);
    // r2 uses cta_default AND the default plan uses cta_default.
    assert.ok(refs.some((r) => r.ruleId === "r2"));
    assert.ok(refs.some((r) => r.isDefault && r.ruleId === "__default__"));
  });

  it("matches an adaptive sub-variant against formVariants", () => {
    const refs = findRulesUsingBlock({ key: "cta_other", adaptiveVariants: [{ variantKey: "form_short", content: {} }] } as never, cfg);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].ruleId, "r2");
    assert.equal(refs[0].field, "formVariants");
  });

  it("returns nothing for an unreferenced block", () => {
    assert.deepEqual(findRulesUsingBlock({ key: "cta_unused", adaptiveVariants: [] } as never, cfg), []);
  });

  it("handles a null config", () => {
    assert.deepEqual(findRulesUsingBlock({ key: "cta_meeting", adaptiveVariants: [] } as never, null), []);
  });
});

describe("buildRuleUsageIndex", () => {
  it("maps each referenced key to its rules in one pass", () => {
    const idx = buildRuleUsageIndex(cfg);
    assert.equal(idx.get("cta_meeting")?.length, 1);
    assert.ok((idx.get("cta_default")?.length ?? 0) >= 2); // r2 + default plan
    assert.equal(idx.get("form_short")?.[0].ruleId, "r2");
    assert.equal(idx.get("cta_unused"), undefined);
  });
});
