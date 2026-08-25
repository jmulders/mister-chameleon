/**
 * Webhook-only rules — decoupled from variant resolution.
 *
 * A rule marked `webhookOnly` fires its plan.webhook when its condition matches
 * but does NOT take part in the first-match variant decision. Every matching
 * webhook-only rule fires (independent pass), and the variant winner is exactly
 * what it would be without those rules. Validation allows such a rule to omit
 * variant keys but requires a webhook.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateStoredConfig } from "../../decision/rules/stored-rule.ts";
import { RulesDecisionProvider } from "../../decision/providers/rules-decision-provider.ts";
import { buildInput, buildJourney, RULES_CONFIG } from "../personalization/_fixtures.ts";

type Cfg = ConstructorParameters<typeof RulesDecisionProvider>[0];

const MATCH_DIRECT = { type: "field", field: "source", operator: "equals", value: "direct" } as const;

// A normal variant rule that matches the default fixture input (source=direct).
const variantRule = {
  id: "variant", priority: 10, label: "variant winner",
  condition: MATCH_DIRECT,
  plan: { ...RULES_CONFIG.defaultPlan },
  reason: "VARIANT_WON",
};

// A webhook-only rule at HIGHER priority (1) that also matches — it must NOT win
// the variant, only fire its webhook.
const webhookOnlyRule = {
  id: "wh_only", priority: 1, label: "notify sales", webhookOnly: true,
  condition: MATCH_DIRECT,
  plan: { webhook: { url: "https://hooks.example.com/mc/webhook-only" } },
  reason: "WEBHOOK_ONLY",
};

function cfg(rules: unknown[]): Cfg {
  return { schemaVersion: 1, rulesEnabled: true, defaultPlan: RULES_CONFIG.defaultPlan, rules } as unknown as Cfg;
}

describe("webhook-only rules — variant decoupling", () => {
  it("a webhook-only rule at top priority does NOT win the variant", async () => {
    const provider = new RulesDecisionProvider(cfg([webhookOnlyRule, variantRule]), false, "tenant-x");
    const plan = await provider.getHomepagePlan(buildInput(buildJourney({})));
    // The lower-priority variant rule wins; the webhook-only rule is ignored for variants.
    assert.equal(plan.reason, "VARIANT_WON");
  });

  it("personalization is byte-for-byte unchanged by adding a webhook-only rule", async () => {
    const without = await new RulesDecisionProvider(cfg([variantRule]), false, "tenant-x")
      .getHomepagePlan(buildInput(buildJourney({})));
    const withWh = await new RulesDecisionProvider(cfg([webhookOnlyRule, variantRule]), false, "tenant-x")
      .getHomepagePlan(buildInput(buildJourney({})));
    assert.deepEqual(withWh, without);
  });

  it("with only a webhook-only rule matching, the DEFAULT plan is served (no variant hijack)", async () => {
    const plan = await new RulesDecisionProvider(cfg([webhookOnlyRule]), false, "tenant-x")
      .getHomepagePlan(buildInput(buildJourney({})));
    assert.equal(plan.reason, RULES_CONFIG.defaultPlan.reason);
  });

  it("the webhook-only rule POSTs its webhook on match, even when a variant rule wins", async () => {
    const calls: unknown[] = [];
    const orig = globalThis.fetch;
    // @ts-expect-error minimal fetch stub
    globalThis.fetch = async (url: unknown) => { calls.push(url); return { ok: true, status: 200 }; };
    try {
      const provider = new RulesDecisionProvider(cfg([webhookOnlyRule, variantRule]), false, "tenant-x");
      await provider.getHomepagePlan(buildInput(buildJourney({})));
      for (let i = 0; i < 40 && calls.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    } finally { globalThis.fetch = orig; }
    assert.ok(calls.includes("https://hooks.example.com/mc/webhook-only"),
      `expected a POST to the webhook-only URL, got ${JSON.stringify(calls)}`);
  });
});

describe("webhook-only rules — validation", () => {
  function errorsFor(rules: unknown[]): string[] {
    return validateStoredConfig(cfg(rules)).map((e) => `${e.field}: ${e.message}`);
  }

  it("accepts a webhook-only rule with a webhook and NO variant keys", () => {
    const errs = errorsFor([webhookOnlyRule]);
    assert.deepEqual(errs, [], `expected no errors, got ${JSON.stringify(errs)}`);
  });

  it("rejects a webhook-only rule that carries no webhook", () => {
    const bad = { ...webhookOnlyRule, plan: {} };
    assert.ok(errorsFor([bad]).some((e) => /webhook/.test(e)), "expected a missing-webhook error");
  });

  it("still requires variant keys for a NORMAL (non-webhook-only) rule", () => {
    const bad = { id: "x", priority: 3, label: "x", condition: MATCH_DIRECT, plan: {}, reason: "x" };
    const errs = errorsFor([bad]);
    assert.ok(errs.some((e) => /heroKey/.test(e)), "expected heroKey validation to still apply");
  });
});
