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

describe("buildDecisionContext — sets the UA verdict for the isBot field", () => {
  async function build(ua: string) {
    const { buildDecisionContext } = await import("@/decision/context/build-decision-context");
    const req = new Request("http://tenant.example/", { headers: new Headers({ "user-agent": ua }) });
    return buildDecisionContext({ request: req });
  }

  it("marks a crawler User-Agent as a bot, whatever the IP", async () => {
    const ctx = await build("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    assert.strictEqual(ctx.isBotUserAgent, true);
    assert.strictEqual(resolve(ctx as unknown as RuleEvaluationContext), true);
  });

  it("does not mark a regular browser as a bot", async () => {
    const ctx = await build("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15");
    assert.strictEqual(ctx.isBotUserAgent, false);
    assert.strictEqual(resolve(ctx as unknown as RuleEvaluationContext), false);
  });
});
