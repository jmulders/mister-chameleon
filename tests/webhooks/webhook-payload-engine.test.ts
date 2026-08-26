/**
 * Configurable webhook payload — end to end through the engine.
 *
 * A webhook rule with payloadFields fires a POST whose body.fields contains the
 * selected fields the request's consent permits, and omits the rest.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { RulesDecisionProvider } from "../../decision/providers/rules-decision-provider.ts";
import { buildInput, buildJourney, RULES_CONFIG } from "../personalization/_fixtures.ts";
import type { ConsentState } from "../../tracking/consent-types.ts";

const consent = (p: Partial<ConsentState> = {}): ConsentState =>
  ({ hasResponded: true, analytics: false, personalization: false, enrichment: false, advertising: false, ...p });

const WH_URL = "https://hooks.example.com/mc/payload";

function cfg() {
  return {
    schemaVersion: 1, rulesEnabled: true, defaultPlan: RULES_CONFIG.defaultPlan,
    rules: [{
      id: "wh", priority: 900, label: "notify", webhookOnly: true,
      condition: { type: "field", field: "source", operator: "equals", value: "direct" },
      plan: { webhook: { url: WH_URL, payloadFields: ["source", "companyName", "intentScore", "personName"] } },
      reason: "Webhook: notify",
    }],
  } as unknown as ConstructorParameters<typeof RulesDecisionProvider>[0];
}

async function fire(consentState: ConsentState): Promise<Record<string, unknown> | null> {
  // Input with enrichment + a known lead + an intent score, source=direct.
  const base = buildInput(buildJourney({ intentScore: 77 }));
  const input = {
    ...base,
    enrichment: { companyName: "Acme BV" },
    knownLead: { name: "Pieter de Vries", confidence: "exact" },
  } as unknown as typeof base;

  let body: Record<string, unknown> | null = null;
  const orig = globalThis.fetch;
  // @ts-expect-error minimal fetch stub
  globalThis.fetch = async (_url: unknown, init: { body?: string }) => {
    if (init?.body) body = JSON.parse(init.body);
    return { ok: true, status: 200 };
  };
  try {
    const provider = new RulesDecisionProvider(cfg(), false, "tenant-x", "sess-1", consentState);
    await provider.getHomepagePlan(input);
    for (let i = 0; i < 40 && body === null; i++) await new Promise((r) => setTimeout(r, 10));
  } finally { globalThis.fetch = orig; }
  return body;
}

describe("webhook payload — consent gating through the engine", () => {
  it("full consent → context + firmographic + scoring + person all present", async () => {
    const body = await fire(consent({ personalization: true, enrichment: true }));
    assert.ok(body, "expected a POST body");
    const fields = body!.fields as Record<string, unknown>;
    assert.equal(fields.source, "direct");
    assert.equal(fields.companyName, "Acme BV");
    assert.equal(fields.intentScore, 77);
    assert.equal(fields.personName, "Pieter de Vries");
  });

  it("no consent → only the context field survives", async () => {
    const body = await fire(consent());
    assert.ok(body, "expected a POST body");
    const fields = body!.fields as Record<string, unknown>;
    assert.equal(fields.source, "direct");
    assert.equal(fields.companyName, undefined);
    assert.equal(fields.intentScore, undefined);
    assert.equal(fields.personName, undefined);
  });

  it("enrichment only → firmographic present, scoring + person dropped", async () => {
    const body = await fire(consent({ enrichment: true }));
    const fields = (body!.fields ?? {}) as Record<string, unknown>;
    assert.equal(fields.companyName, "Acme BV");
    assert.equal(fields.intentScore, undefined);   // needs personalization
    assert.equal(fields.personName, undefined);     // needs both
  });
});
