/**
 * summarizeCondition — human one-line summary of a rule condition tree, used by
 * the read-only Webhooks overview. Display-only; must never throw on odd input.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { summarizeCondition } from "@/lib/webhooks/summarize-condition";
import type { RuleCondition } from "@/decision/rules/stored-rule";

describe("summarizeCondition", () => {
  it("renders a field clause with the operator symbol", () => {
    const c: RuleCondition = { type: "field", field: "source", operator: "equals", value: "google" };
    assert.equal(summarizeCondition(c), "source = google");
  });

  it("defaults a missing operator to equals", () => {
    const c = { type: "field", field: "source", value: "google" } as unknown as RuleCondition;
    assert.equal(summarizeCondition(c), "source = google");
  });

  it("renders exists/not-set without a value", () => {
    const c: RuleCondition = { type: "flag", name: "hoge_intentie", operator: "exists" };
    assert.equal(summarizeCondition(c), "hoge_intentie is set");
  });

  it("joins a group with AND/OR", () => {
    const c: RuleCondition = {
      type: "group", logic: "and",
      conditions: [
        { type: "field", field: "visitType", operator: "equals", value: "returning" },
        { type: "field", field: "source", operator: "equals", value: "google" },
      ],
    };
    assert.equal(summarizeCondition(c), "(visitType = returning AND source = google)");
  });

  it("renders in-operator array values", () => {
    const c: RuleCondition = { type: "field", field: "source", operator: "in", value: ["google", "linkedin"] };
    assert.equal(summarizeCondition(c), "source in google, linkedin");
  });

  it("renders named / context / context_library kinds", () => {
    assert.equal(summarizeCondition({ type: "named", name: "high_engagement" } as RuleCondition), "named: high_engagement");
    assert.equal(summarizeCondition({ type: "context", contextId: "ctx_google_traffic" } as RuleCondition), "context: ctx_google_traffic");
    assert.equal(
      summarizeCondition({ type: "context_library", contextIds: ["a", "b"], minConfidence: 0.8 } as RuleCondition),
      "audience: a / b (≥0.8)",
    );
  });

  it("degrades gracefully on null / unknown input, never throwing", () => {
    assert.equal(summarizeCondition(null), "always");
    assert.equal(summarizeCondition({ type: "weird" } as unknown as RuleCondition), "condition");
  });

  it("caps pathological nesting depth", () => {
    let c: RuleCondition = { type: "field", field: "source", operator: "equals", value: "google" };
    for (let i = 0; i < 8; i++) c = { type: "group", logic: "and", conditions: [c] };
    assert.ok(summarizeCondition(c).includes("…"));
  });
});
