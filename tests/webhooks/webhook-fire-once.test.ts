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
 *
 * The webhook POST is fire-and-forget (async), so each test uses a UNIQUE webhook
 * URL / tenant / session and counts ONLY fetches to its own URL — a stray
 * fire-and-forget POST leaking from a prior test case can never inflate the tally.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { RulesDecisionProvider } from "../../decision/providers/rules-decision-provider.ts";
import { buildInput, buildJourney, RULES_CONFIG } from "../personalization/_fixtures.ts";
import type { ConsentState } from "../../tracking/consent-types.ts";

const consent = (): ConsentState =>
  ({ hasResponded: true, analytics: false, personalization: false, enrichment: false, advertising: false });

function cfg(fireOnce: boolean, url: string) {
  return {
    schemaVersion: 1, rulesEnabled: true, defaultPlan: RULES_CONFIG.defaultPlan,
    rules: [{
      id: "wh-once", priority: 900, label: "notify", webhookOnly: true,
      condition: { type: "field", field: "source", operator: "equals", value: "direct" },
      plan: { webhook: { url, ...(fireOnce ? { fireOncePerSession: true } : {}) } },
      reason: "Webhook: notify",
    }],
  } as unknown as ConstructorParameters<typeof RulesDecisionProvider>[0];
}

let seq = 0;

/**
 * Run getHomepagePlan over the given input(s) and count POST fires to THIS test's
 * unique URL. Waits until at least `expected` fires land (generous 3s cap — robust
 * on a slow CI runner where the first cold dynamic import is slow), then a grace
 * window in which any UNEXPECTED extra fire (a dedup regression) would still count.
 */
async function countFires(fireOnce: boolean, inputs: unknown[], expected: number): Promise<number> {
  const id = `t${++seq}`;
  const url = `https://hooks.example.com/mc/${id}`;
  let posts = 0;
  const orig = globalThis.fetch;
  // Count ONLY POSTs to this test's exact webhook URL. Critical: with Supabase
  // env configured (as on CI), the provider's rule_context persist makes real
  // Supabase requests whose URLs embed the tenant/session ids — an `includes`
  // filter would wrongly count those. An exact-URL match excludes them.
  // @ts-expect-error minimal fetch stub
  globalThis.fetch = async (u: unknown) => {
    if (String(u) === url) posts += 1;
    return { ok: true, status: 200 };
  };
  try {
    const provider = new RulesDecisionProvider(cfg(fireOnce, url), false, `tenant-${id}`, `sess-${id}`, consent());
    for (const input of inputs) {
      await provider.getHomepagePlan(input as Parameters<typeof provider.getHomepagePlan>[0]);
    }
    for (let i = 0; i < 300 && posts < expected; i++) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => setTimeout(r, 200)); // grace: a would-be extra fire lands here
  } finally { globalThis.fetch = orig; }
  return posts;
}

describe("fireOncePerSession webhook dedup", () => {
  it("fireOnce=true → fires ONCE across N decisions in the same session", async () => {
    const input = buildInput(buildJourney({})); // one session = one reused input
    const posts = await countFires(true, [input, input, input], 1);
    assert.equal(posts, 1);
  });

  it("fireOnce=false → fires on EVERY decision (unchanged behaviour)", async () => {
    const input = buildInput(buildJourney({}));
    const posts = await countFires(false, [input, input, input], 3);
    assert.equal(posts, 3);
  });

  it("separate sessions each get their own single fire", async () => {
    // Distinct input objects = distinct sessions (fresh rule_context each).
    const posts = await countFires(true, [buildInput(buildJourney({})), buildInput(buildJourney({}))], 2);
    assert.equal(posts, 2);
  });
});
