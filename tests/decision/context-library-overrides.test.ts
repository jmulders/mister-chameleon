/**
 * context_library conditions must see rule-written overrides.
 *
 * buildContextEvalInput read journey / enrichment fields directly, so a
 * setContext override of a registry field (e.g. funnelStage) was visible to
 * field conditions but not to context-library definitions.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { buildContextEvalInput }      from "@/context/library/match";

function ctxWith(fields: Record<string, unknown>): RuleEvaluationContext {
  return fields as unknown as RuleEvaluationContext;
}

describe("context library — rule-written overrides", () => {
  const history = { pageViewCount: 1, journey: { funnelStage: "awareness" } };

  it("a valid override of a shared registry key wins", () => {
    const input = buildContextEvalInput(ctxWith({
      history,
      ruleContext: { funnelStage: "decision", pageViewCount: 7, own_flag: true },
    }));
    assert.strictEqual(input.funnelStage, "decision");
    assert.strictEqual(input.pageViewCount, 7);
  });

  it("a type-invalid override is ignored", () => {
    const input = buildContextEvalInput(ctxWith({
      history,
      ruleContext: { funnelStage: 42, pageViewCount: "many" },
    }));
    assert.strictEqual(input.funnelStage, "awareness");
    assert.strictEqual(input.pageViewCount, 1);
  });

  it("without an overlay nothing changes", () => {
    const input = buildContextEvalInput(ctxWith({ history }));
    assert.strictEqual(input.funnelStage, "awareness");
    assert.strictEqual(input.pageViewCount, 1);
  });
});
