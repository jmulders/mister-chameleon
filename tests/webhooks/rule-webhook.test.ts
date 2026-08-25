/**
 * Conditional outbound webhooks — URL safety + rule validation.
 *
 * A rule's plan.webhook.url is operator-configured trusted input, but we still
 * reject obviously-unsafe targets (SSRF guard): absolute https to a public host
 * only. validateStoredConfig enforces the same rule at save time.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSafeWebhookUrl } from "../../lib/webhooks/webhook-url.ts";
import { validateStoredConfig, SEED_RULES_CONFIG } from "../../decision/rules/stored-rule.ts";
import { fireRuleWebhook } from "../../lib/webhooks/fire-rule-webhook.ts";
import { RulesDecisionProvider } from "../../decision/providers/rules-decision-provider.ts";
import { buildInput, buildJourney, RULES_CONFIG } from "../personalization/_fixtures.ts";

describe("isSafeWebhookUrl", () => {
  it("accepts absolute https URLs to public hosts", () => {
    assert.equal(isSafeWebhookUrl("https://hooks.example.com/mc/rule"), true);
    assert.equal(isSafeWebhookUrl("https://api.zapier.com/hooks/catch/123/abc"), true);
  });
  it("rejects non-https schemes", () => {
    assert.equal(isSafeWebhookUrl("http://hooks.example.com/x"), false);
    assert.equal(isSafeWebhookUrl("ftp://example.com/x"), false);
    assert.equal(isSafeWebhookUrl("not a url"), false);
    assert.equal(isSafeWebhookUrl(""), false);
  });
  it("rejects loopback / internal / private hosts", () => {
    for (const u of [
      "https://localhost/x", "https://api.localhost/x", "https://svc.internal/x", "https://box.local/x",
      "https://127.0.0.1/x", "https://0.0.0.0/x", "https://[::1]/x",
      "https://10.0.0.5/x", "https://192.168.1.10/x", "https://169.254.1.1/x", "https://172.16.0.1/x",
    ]) {
      assert.equal(isSafeWebhookUrl(u), false, `expected ${u} to be unsafe`);
    }
  });
});

describe("validateStoredConfig — plan.webhook", () => {
  function withWebhook(webhook: unknown): unknown {
    const base = SEED_RULES_CONFIG as unknown as { rules: { plan: Record<string, unknown> }[] };
    const rule0 = base.rules[0];
    return {
      ...base,
      rules: [{ ...rule0, plan: { ...rule0.plan, webhook } }, ...base.rules.slice(1)],
    };
  }
  const errorsFor = (config: unknown) => validateStoredConfig(config).map((e) => `${e.field}: ${e.message}`);

  it("accepts a valid https webhook", () => {
    const errs = errorsFor(withWebhook({ url: "https://hooks.example.com/mc/rule" }));
    assert.deepEqual(errs.filter((e) => /webhook/.test(e)), []);
  });
  it("rejects an http url", () => {
    assert.ok(errorsFor(withWebhook({ url: "http://hooks.example.com/x" })).some((e) => /webhook\.url/.test(e)));
  });
  it("rejects an internal host", () => {
    assert.ok(errorsFor(withWebhook({ url: "https://localhost/x" })).some((e) => /webhook\.url/.test(e)));
  });
  it("rejects a webhook with no url", () => {
    assert.ok(errorsFor(withWebhook({})).some((e) => /webhook/.test(e)));
  });
  it("rejects a non-object webhook", () => {
    assert.ok(errorsFor(withWebhook("https://x.example.com")).some((e) => /webhook/.test(e)));
  });
});

describe("fireRuleWebhook — delivery", () => {
  it("POSTs the rule-match event as JSON to a safe url", async () => {
    const calls: { url: unknown; init: { method?: string; body?: string } }[] = [];
    const orig = globalThis.fetch;
    // @ts-expect-error minimal fetch stub
    globalThis.fetch = async (url: unknown, init: { method?: string; body?: string }) => {
      calls.push({ url, init });
      return { ok: true, status: 200 };
    };
    try {
      await fireRuleWebhook("https://hooks.example.com/x", {
        tenantId: "t1",
        rule: { id: "r1", label: "Search intent", priority: 3 },
        plan: { heroKey: "hero_default", proofKey: "proof_stats", ctaKey: "cta_demo" },
        context: { pathname: "/", deviceType: "mobile" },
      });
    } finally { globalThis.fetch = orig; }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://hooks.example.com/x");
    assert.equal(calls[0].init.method, "POST");
    const body = JSON.parse(calls[0].init.body ?? "{}");
    assert.equal(body.event, "rule.matched");
    assert.equal(body.tenantId, "t1");
    assert.equal(body.rule.id, "r1");
    assert.equal(body.plan.heroKey, "hero_default");
    assert.equal(body.context.deviceType, "mobile");
    assert.ok(typeof body.occurredAt === "string");
  });

  it("does not fetch an unsafe url", async () => {
    let called = false;
    const orig = globalThis.fetch;
    // @ts-expect-error minimal fetch stub
    globalThis.fetch = async () => { called = true; return { ok: true, status: 200 }; };
    try {
      await fireRuleWebhook("http://localhost/x", { tenantId: "t1", rule: { id: "r1" }, plan: {} });
    } finally { globalThis.fetch = orig; }
    assert.equal(called, false);
  });
});

describe("rule webhook fires on a real decision match", () => {
  it("POSTs the webhook when a matching rule carries plan.webhook (fire-and-forget)", async () => {
    const WEBHOOK_URL = "https://hooks.example.com/mc/rule-matched";
    const config = {
      schemaVersion: 1,
      rulesEnabled:  true,
      defaultPlan:   RULES_CONFIG.defaultPlan,
      rules: [{
        id: "wh_rule", priority: 1, label: "webhook rule",
        // Default fixture input has source=direct, so this always matches here.
        condition: { type: "field", field: "source", operator: "equals", value: "direct" },
        plan: { ...RULES_CONFIG.defaultPlan, webhook: { url: WEBHOOK_URL } },
        reason: "test",
      }],
    } as unknown as ConstructorParameters<typeof RulesDecisionProvider>[0];

    const calls: unknown[] = [];
    const orig = globalThis.fetch;
    // @ts-expect-error minimal fetch stub
    globalThis.fetch = async (url: unknown) => { calls.push(url); return { ok: true, status: 200 }; };
    try {
      // tenantId set + a non-bot input => the same gate as the rule-fire diagnostic.
      const provider = new RulesDecisionProvider(config, false, "tenant-x");
      await provider.getHomepagePlan(buildInput(buildJourney({})));
      // The webhook fires via a dynamic import + .then (not awaited) — poll briefly.
      for (let i = 0; i < 40 && calls.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 10));
      }
    } finally { globalThis.fetch = orig; }

    assert.ok(calls.includes(WEBHOOK_URL), `expected a POST to ${WEBHOOK_URL}, got ${JSON.stringify(calls)}`);
  });

  it("does NOT fire when the provider has no tenantId", async () => {
    const config = {
      schemaVersion: 1, rulesEnabled: true, defaultPlan: RULES_CONFIG.defaultPlan,
      rules: [{
        id: "wh_rule", priority: 1, label: "webhook rule",
        condition: { type: "field", field: "source", operator: "equals", value: "direct" },
        plan: { ...RULES_CONFIG.defaultPlan, webhook: { url: "https://hooks.example.com/x" } },
        reason: "test",
      }],
    } as unknown as ConstructorParameters<typeof RulesDecisionProvider>[0];
    let called = false;
    const orig = globalThis.fetch;
    // @ts-expect-error minimal fetch stub
    globalThis.fetch = async () => { called = true; return { ok: true, status: 200 }; };
    try {
      const provider = new RulesDecisionProvider(config); // no tenantId
      await provider.getHomepagePlan(buildInput(buildJourney({})));
      await new Promise((r) => setTimeout(r, 60));
    } finally { globalThis.fetch = orig; }
    assert.equal(called, false);
  });
});
