/**
 * The `isBot` rule field is the User-Agent verdict only.
 *
 * ctx.isBot is the MEASUREMENT verdict (UA bot OR cloud-provider IP). Cloud
 * IPs only keep a visitor out of measurement, never out of serving (see
 * tests/personalization/rule-context.test.ts, "bot exclusion"). A rule with
 * `isBot = false` therefore must not drop a real browser on a cloud IP.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { FIELD_REGISTRY }             from "@/decision/rules/field-registry";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { evaluateCondition }          from "@/decision/rules/stored-rule";
import type { RuleCondition }         from "@/decision/rules/stored-rule";

function ctxWith(fields: Record<string, unknown>): RuleEvaluationContext {
  return fields as unknown as RuleEvaluationContext;
}

const resolve = FIELD_REGISTRY.isBot.resolve;
const notBot  = { type: "field", field: "isBot", operator: "equals", value: false } as unknown as RuleCondition;

describe("field-registry — isBot resolves the User-Agent verdict", () => {
  it("a clean browser on a cloud IP is not a bot for serving", () => {
    const ctx = ctxWith({ isBot: true, enrichment: { isCloudProvider: true } });
    assert.strictEqual(resolve(ctx), false);
    assert.strictEqual(evaluateCondition(notBot, ctx), true);
  });

  it("an explicit UA verdict on the context wins", () => {
    assert.strictEqual(resolve(ctxWith({ isBotUserAgent: true,  isBot: true, enrichment: { isCloudProvider: true } })), true);
    assert.strictEqual(resolve(ctxWith({ isBotUserAgent: false, isBot: true })), false);
  });

  it("a bot verdict without a cloud IP can only come from the UA", () => {
    assert.strictEqual(resolve(ctxWith({ isBot: true, enrichment: { isCloudProvider: false } })), true);
    assert.strictEqual(resolve(ctxWith({ isBot: true })), true);
    assert.strictEqual(resolve(ctxWith({ isBot: false })), false);
    assert.strictEqual(resolve(ctxWith({})), null);
  });
});
