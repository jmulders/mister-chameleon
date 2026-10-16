/**
 * audienceSegmentIds is a comma-joined list of segment keys. Membership must be
 * exact per key: `contains "high-intent"` used to be a substring test and
 * matched a visitor who was only in `high-intent-enterprise`.
 *
 * Also: not_contains on a missing value is true, like the other not_*
 * operators (not_equals, not_in, not_exists).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { evaluateCondition }          from "@/decision/rules/stored-rule";
import type { RuleCondition }         from "@/decision/rules/stored-rule";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";

function field(fieldKey: string, operator: string, value: unknown): RuleCondition {
  return { type: "field", field: fieldKey, operator, value } as unknown as RuleCondition;
}

function ctxWith(fields: Record<string, unknown>): RuleEvaluationContext {
  return fields as unknown as RuleEvaluationContext;
}

const ctx = ctxWith({ audienceSegmentIds: "high-intent-enterprise, returning-buyer" });

describe("stored-rule — audienceSegmentIds is exact membership", () => {
  it("contains does not match a segment that only shares a prefix", () => {
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "contains", "high-intent"), ctx), false);
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "contains", "high-intent-enterprise"), ctx), true);
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "contains", "returning-buyer"), ctx), true);
  });

  it("not_contains is the exact complement", () => {
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "not_contains", "high-intent"), ctx), true);
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "not_contains", "returning-buyer"), ctx), false);
  });

  it("in / not_in test whether any listed segment is a member", () => {
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "in", ["high-intent", "returning-buyer"]), ctx), true);
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "in", ["high-intent"]), ctx), false);
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "not_in", ["high-intent"]), ctx), true);
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "not_in", ["returning-buyer"]), ctx), false);
  });

  it("a visitor without segments: not_contains / not_in true, contains / in false", () => {
    const none = ctxWith({ audienceSegmentIds: null });
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "contains", "x"), none), false);
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "not_contains", "x"), none), true);
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "in", ["x"]), none), false);
    assert.strictEqual(evaluateCondition(field("audienceSegmentIds", "not_in", ["x"]), none), true);
  });
});

describe("stored-rule — not_contains on a missing value", () => {
  it("is true for a missing string field; plain string fields keep substring semantics", () => {
    assert.strictEqual(evaluateCondition(field("utmCampaign", "not_contains", "spring"), ctxWith({ utmCampaign: null })), true);
    assert.strictEqual(evaluateCondition(field("utmCampaign", "contains", "spring"), ctxWith({ utmCampaign: "spring-sale" })), true);
    assert.strictEqual(evaluateCondition(field("utmCampaign", "not_contains", "spring"), ctxWith({ utmCampaign: "spring-sale" })), false);
  });
});
