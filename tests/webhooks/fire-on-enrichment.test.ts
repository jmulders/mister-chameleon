/**
 * Fire-on-enrichment coordination (RulesDecisionProvider enrichment-pass mode).
 *
 * Goal: every identified visitor gets EXACTLY ONE company-carrying webhook,
 * regardless of how fast they browse. A "company webhook" is a fireOncePerSession
 * rule whose payload selects a firmographic field.
 *
 *   • Fast visitor: the page render (company not resolved yet, enrichment consent
 *     granted) DEFERS — no send, no marker. The enrichment pass injects the
 *     just-identified company and fires it. Net: one webhook, WITH company.
 *   • Slow visitor: the company is already in context at page render → it fires
 *     WITH company and latches the marker; the later enrichment pass sees the
 *     marker and skips. Net: one webhook, no double.
 *   • No enrichment consent: unchanged — the page render fires as before, with the
 *     company fields consent-stripped.
 *
 * Session state is simulated the same way as webhook-fire-once.test.ts: reusing
 * one input object carries the `rule_context` overlay (incl. the fire-once marker)
 * across decisions, exactly as the persisted JourneyState would across pageviews.
 * Each test uses a UNIQUE webhook URL and counts ONLY fetches to it, so a stray
 * fire-and-forget POST from another case can never inflate the tally.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { RulesDecisionProvider } from "../../decision/providers/rules-decision-provider.ts";
import { buildInput, buildJourney, RULES_CONFIG } from "../personalization/_fixtures.ts";
import type { ConsentState } from "../../tracking/consent-types.ts";

const consent = (enrichment: boolean): ConsentState =>
  ({ hasResponded: true, analytics: false, personalization: false, enrichment, advertising: false });

function cfg(url: string, payloadFields: string[]) {
  return {
    schemaVersion: 1, rulesEnabled: true, defaultPlan: RULES_CONFIG.defaultPlan,
    rules: [{
      id: "wh-co", priority: 900, label: "notify", webhookOnly: true,
      condition: { type: "field", field: "source", operator: "equals", value: "direct" },
      plan: { webhook: { url, fireOncePerSession: true, payloadFields } },
      reason: "Webhook: notify",
    }],
  } as unknown as ConstructorParameters<typeof RulesDecisionProvider>[0];
}

let seq = 0;

/** A fetch stub that records the JSON body of every POST to this test's URL. */
function harness() {
  const id = `e${++seq}`;
  const url = `https://hooks.example.com/enr/${id}`;
  const bodies: Array<{ fields?: Record<string, unknown> }> = [];
  const orig = globalThis.fetch;
  // @ts-expect-error minimal fetch stub
  globalThis.fetch = async (u: unknown, init?: { body?: string }) => {
    if (String(u) === url) {
      let parsed: { fields?: Record<string, unknown> } = {};
      try { parsed = JSON.parse(init?.body ?? "{}"); } catch { /* ignore */ }
      bodies.push(parsed);
    }
    return { ok: true, status: 200 };
  };
  return {
    id, url, bodies,
    /** Wait until `expected` fires land (3s cap), then a grace window for strays. */
    async settle(expected: number) {
      for (let i = 0; i < 300 && bodies.length < expected; i++) await new Promise((r) => setTimeout(r, 10));
      await new Promise((r) => setTimeout(r, 200));
    },
    restore() { globalThis.fetch = orig; },
  };
}

function pageProvider(h: { id: string; url: string }, fields: string[], enrichmentConsent: boolean) {
  return new RulesDecisionProvider(cfg(h.url, fields), false, `t-${h.id}`, `s-${h.id}`, consent(enrichmentConsent));
}
function enrichmentProvider(h: { id: string; url: string }, fields: string[]) {
  return new RulesDecisionProvider(cfg(h.url, fields), false, `t-${h.id}`, `s-${h.id}`, consent(true), true);
}

describe("fire-on-enrichment", () => {
  it("fast visitor: page render (no company) then enrichment pass → ONE webhook, WITH company", async () => {
    const h = harness();
    try {
      const input = buildInput(buildJourney({})); // one reused session; no company yet
      // Page render: enrichment consent granted, company missing → DEFER (no fire).
      await pageProvider(h, ["companyName"], true).getHomepagePlan(input as never);
      // Company now identified — enrichment pass injects it on the same session.
      (input as unknown as { enrichment: unknown }).enrichment = { companyName: "Acme BV" };
      await enrichmentProvider(h, ["companyName"]).getHomepagePlan(input as never);

      await h.settle(1);
      assert.equal(h.bodies.length, 1, "exactly one webhook fired");
      assert.equal(h.bodies[0]?.fields?.companyName, "Acme BV", "webhook carries the company");
    } finally { h.restore(); }
  });

  it("slow visitor: company already present at page render → ONE webhook, no double from enrichment", async () => {
    const h = harness();
    try {
      const input = buildInput(buildJourney({}));
      (input as unknown as { enrichment: unknown }).enrichment = { companyName: "Nakatomi BV" };
      // Page render fires WITH company and latches the fire-once marker.
      await pageProvider(h, ["companyName"], true).getHomepagePlan(input as never);
      // Enrichment pass on the same session sees the marker → skips.
      await enrichmentProvider(h, ["companyName"]).getHomepagePlan(input as never);

      await h.settle(1);
      assert.equal(h.bodies.length, 1, "no double fire");
      assert.equal(h.bodies[0]?.fields?.companyName, "Nakatomi BV");
    } finally { h.restore(); }
  });

  it("no enrichment consent: page render fires as before, company fields stripped", async () => {
    const h = harness();
    try {
      const input = buildInput(buildJourney({})); // no company; no enrichment consent
      await pageProvider(h, ["companyName"], false).getHomepagePlan(input as never);

      await h.settle(1);
      assert.equal(h.bodies.length, 1, "unchanged: still fires once on page render");
      assert.equal(h.bodies[0]?.fields?.companyName, undefined, "no company without enrichment consent");
    } finally { h.restore(); }
  });

  it("non-company webhook is untouched: page render fires it, enrichment pass skips it", async () => {
    const h = harness();
    try {
      const input = buildInput(buildJourney({}));
      // payload selects only a context field → NOT a company webhook → never deferred.
      await pageProvider(h, ["audienceSegments"], true).getHomepagePlan(input as never);
      await enrichmentProvider(h, ["audienceSegments"]).getHomepagePlan(input as never);

      await h.settle(1);
      assert.equal(h.bodies.length, 1, "only the page render fired; enrichment pass skipped a non-company webhook");
    } finally { h.restore(); }
  });
});
