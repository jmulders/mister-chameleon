/**
 * freshRuleId — collision-proof editor rule ids.
 *
 * Regression for the "Rule name field not editable" bug: two rules created in the
 * same millisecond used to share `homepage.rule_${Date.now()}`, giving duplicate
 * React keys so updateRule patched BOTH and the name field appeared un-editable.
 * freshRuleId must never collide, even across many rapid calls.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { freshRuleId } from "../../app/dashboard/rules/_components/rule-id.ts";

describe("freshRuleId", () => {
  it("keeps the given prefix", () => {
    assert.match(freshRuleId("homepage.rule"), /^homepage\.rule_/);
    assert.match(freshRuleId("homepage.recipe_google"), /^homepage\.recipe_google_/);
  });

  it("never collides across many rapid calls (same millisecond)", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) ids.add(freshRuleId("homepage.rule"));
    assert.equal(ids.size, 10_000, "all ids must be unique");
  });

  it("stays unique without crypto.randomUUID (fallback path)", () => {
    const orig = globalThis.crypto;
    try {
      // Force the Math.random fallback.
      Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
      const ids = new Set<string>();
      for (let i = 0; i < 5_000; i++) ids.add(freshRuleId("homepage.rule"));
      // Fallback uses Date.now()+random; astronomically unlikely to collide, but
      // allow a tiny slack rather than asserting a hard equality on randomness.
      assert.ok(ids.size >= 4_999, `expected ~all unique, got ${ids.size}`);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: orig, configurable: true });
    }
  });
});
