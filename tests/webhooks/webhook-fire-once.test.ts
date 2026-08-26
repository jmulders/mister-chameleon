/**
 * fireOncePerSession — a webhook with the flag fires at most once per visitor
 * session; without it, it fires on every page-decision (unchanged). Separate
 * sessions each get their own single fire.
 *
 * The per-session dedup rides the in-request rule_context overlay: the provider
 * records a reserved `__wh:<ruleId>` marker synchronously when it fires, so a
 * later decision in the SAME session (same input carrying that overlay) skips.
 * Reusing one input object across getHomepagePlan calls simulates the persisted
 * session state; a fresh input simulates a new session.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { RulesDecisionProvider } from "../../decision/providers/rules-decision-provider.ts";
import { buildInput, buildJourney, RULES_CONFIG } from "../personalization/_fixtures.ts";
import type { ConsentState } from "../../tracking/consent-types.ts";

const consent = (): ConsentState =>
  ({ hasResponded: true, analytics: false, personalization: false, enrichment: false, advertising: false });

const WH_URL = "https://hooks.example.com/mc/once";

function cfg(fireOnce: boolean) {
  return {
    schemaVersion: 1, rulesEnabled: true, defaultPlan: RULES_CONFIG.defaultPlan,
    rules: [{
      id: "wh-once", priority: 900, label: "notify", webhookOnly: true,
      condition: { type: "field", field: "source", operator: "equals", value: "direct" },
      plan: { webhook: { url: WH_URL, ...(fireOnce ? { fireOncePerSession: true } : {}) } },
      reason: "Webhook: notify",
    }],
  } as unknown as ConstructorParameters<typeof RulesDecisionProvider>[0];
}

/** Run getHomepagePlan `times` times over the given input(s) and count POST fires. */
async function countFires(fireOnce: boolean, inputs: unknown[]): Promise<number> {
  let posts = 0;
  const orig = globalThis.fetch;
  // @ts-expect-error minimal fetch stub
  globalThis.fetch = async () => { posts += 1; return { ok: true, status: 200 }; };
  try {
    const provider = new RulesDecisionProvider(cfg(fireOnce), false, "tenant-x", "sess-1", consent());
    for (const input of inputs) {
      await provider.getHomepagePlan(input as Parameters<typeof provider.getHomepagePlan>[0]);
    }
    // Let the fire-and-forget dynamic import + fetch settle.
    for (let i = 0; i < 60 && posts < inputs.length; i++) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => setTimeout(r, 50));
  } finally { globalThis.fetch = orig; }
  return posts;
}

describe("fireOncePerSession webhook dedup", () => {
  it("fireOnce=true → fires ONCE across N decisions in the same session", async () => {
    const input = buildInput(buildJourney({})); // one session = one reused input
    const posts = await countFires(true, [input, input, input]);
    assert.equal(posts, 1);
  });

  it("fireOnce=false → fires on EVERY decision (unchanged behaviour)", async () => {
    const input = buildInput(buildJourney({}));
    const posts = await countFires(false, [input, input, input]);
    assert.equal(posts, 3);
  });

  it("separate sessions each get their own single fire", async () => {
    // Distinct input objects = distinct sessions (fresh rule_context each).
    const posts = await countFires(true, [buildInput(buildJourney({})), buildInput(buildJourney({}))]);
    assert.equal(posts, 2);
  });
});
