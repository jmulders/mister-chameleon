/**
 * in / not_in on number-kind fields.
 *
 * The rule editor stores an in / not_in value as a string array (comma-split
 * text input) and validation accepts string | number members, but the runtime
 * used strict `includes`, so `pageViewCount in ["2"]` never matched a 2.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { evaluateCondition }          from "@/decision/rules/stored-rule";
import type { RuleCondition }         from "@/decision/rules/stored-rule";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";

function field(fieldKey: string, operator: string, value: unknown): RuleCondition {
  return { type: "field", field: fieldKey, operator, value } as unknown as RuleCondition;
}

const ctx = { history: { pageViewCount: 2 } } as unknown as RuleEvaluationContext;

describe("stored-rule — in / not_in on number fields", () => {
  it("matches the editor's string array numerically", () => {
    assert.strictEqual(evaluateCondition(field("pageViewCount", "in", ["1", "2", "3"]), ctx), true);
    assert.strictEqual(evaluateCondition(field("pageViewCount", "in", ["4", "5"]), ctx), false);
    assert.strictEqual(evaluateCondition(field("pageViewCount", "not_in", ["2"]), ctx), false);
    assert.strictEqual(evaluateCondition(field("pageViewCount", "not_in", ["4", "5"]), ctx), true);
  });

  it("still matches a number array and ignores non-numeric members", () => {
    assert.strictEqual(evaluateCondition(field("pageViewCount", "in", [2]), ctx), true);
    assert.strictEqual(evaluateCondition(field("pageViewCount", "in", ["abc", "", " "]), ctx), false);
    assert.strictEqual(evaluateCondition(field("pageViewCount", "not_in", ["abc"]), ctx), true);
  });

  it("string fields keep strict membership", () => {
    const sctx = { utmSource: "2" } as unknown as RuleEvaluationContext;
    assert.strictEqual(evaluateCondition(field("utmSource", "in", ["2"]), sctx), true);
    assert.strictEqual(evaluateCondition(field("utmSource", "in", [2]), sctx), false);
  });
});
