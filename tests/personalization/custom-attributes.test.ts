/**
 * Custom attributes — AttributeCondition engine
 *
 * Covers the attribute matcher (reads ctx.customAttributes), its validation
 * (same scalar shape as a flag), and formatCondition. Modeled on the flag tests
 * in rule-context.test.ts, since AttributeCondition is a clone of FlagCondition
 * that reads a different map.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { evaluateCondition, validateStoredConfig, formatCondition } from "@/decision/rules/stored-rule";
import type { StoredRulesConfig, RuleCondition } from "@/decision/rules/stored-rule";

function ctxWith(attrs: Record<string, string | number | boolean> | null): RuleEvaluationContext {
  return { customAttributes: attrs } as unknown as RuleEvaluationContext;
}

describe("AttributeCondition — matcher", () => {
  it("equals on a string attribute", () => {
    const ctx = ctxWith({ categorie: "kipper" });
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "categorie", operator: "equals", value: "kipper" }, ctx), true);
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "categorie", operator: "equals", value: "transporter" }, ctx), false);
  });

  it("numeric ordering on a number attribute", () => {
    const ctx = ctxWith({ massa: 2200 });
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "massa", operator: "greater_than_or_equal", value: 2000 }, ctx), true);
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "massa", operator: "less_than", value: 2000 }, ctx), false);
  });

  it("boolean equals on an occasion attribute", () => {
    const ctx = ctxWith({ occasion: true });
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "occasion", operator: "equals", value: true }, ctx), true);
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "occasion", operator: "equals", value: false }, ctx), false);
  });

  it("exists / not_exists test presence", () => {
    const present = ctxWith({ massa: 1350 });
    const absent  = ctxWith({});
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "massa", operator: "exists" }, present), true);
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "massa", operator: "not_exists" }, present), false);
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "massa", operator: "exists" }, absent), false);
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "massa", operator: "not_exists" }, absent), true);
  });

  it("a null customAttributes map reads as absent", () => {
    const ctx = ctxWith(null);
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "massa", operator: "exists" }, ctx), false);
    assert.strictEqual(evaluateCondition({ type: "attribute", name: "massa", operator: "equals", value: 1 }, ctx), false);
  });
});

describe("AttributeCondition — validation (validateStoredConfig)", () => {
  function errorsFor(condition: RuleCondition): string[] {
    const config: StoredRulesConfig = {
      schemaVersion: 1,
      updatedAt:     "2026-01-01T00:00:00.000Z",
      rules: [{
        id: "r1", priority: 10, label: "attr rule", reason: "test",
        condition,
        plan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default" },
      }],
      defaultPlan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default", reason: "default" },
    };
    return validateStoredConfig(config).map((e) => `${e.field}: ${e.message}`);
  }

  it("accepts a well-formed attribute condition", () => {
    assert.deepEqual(errorsFor({ type: "attribute", name: "categorie", operator: "equals", value: "kipper" }), []);
  });

  it("rejects an empty name", () => {
    const errs = errorsFor({ type: "attribute", name: "", operator: "equals", value: "x" });
    assert.ok(errs.some((e) => e.includes("name")), errs.join(" | "));
  });

  it("rejects an array operator (attributes are scalar)", () => {
    const errs = errorsFor({ type: "attribute", name: "categorie", operator: "in", value: ["a", "b"] } as unknown as RuleCondition);
    assert.ok(errs.some((e) => e.includes("operator")), errs.join(" | "));
  });
});

describe("AttributeCondition — formatCondition", () => {
  it("formats value and existence forms", () => {
    assert.strictEqual(formatCondition({ type: "attribute", name: "massa", operator: "greater_than_or_equal", value: 2000 }), "attr massa greater_than_or_equal 2000");
    assert.strictEqual(formatCondition({ type: "attribute", name: "occasion", operator: "exists" }), "attr occasion exists");
  });
});
