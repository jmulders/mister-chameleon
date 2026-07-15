/**
 * tests/billing/session-cap.test.ts
 *
 * The monthly session cap, with purchased credits consumed first.
 *
 * Rule (owner's decision):
 *   1. under the plan limit          → personalise, no credit spent
 *   2. over the limit, credits left  → personalise, spend one credit
 *   3. over the limit, no credits    → serve the default, unpersonalised page
 *
 * ─── The arithmetic that looks right and isn't ────────────────────────────────
 *
 *   The obvious formula is `limit = planLimit + credits` and `over = current >=
 *   limit`. It breaks as soon as credits are actually consumed, because every
 *   session over the cap moves BOTH terms: current goes up by one, credits go
 *   down by one. The two meet in the middle and the tenant loses half of what
 *   they bought.
 *
 *   plan 100, bought 10:
 *     current=100 credits=10 → limit 110 → serve → credits 9
 *     current=102 credits=8  → limit 108 → serve → credits 7
 *     current=105 credits=5  → limit 105 → BLOCKED, with 5 credits unspent
 *
 *   Correct: you may serve while `current < planLimit` OR `credits > 0`.
 *   isOverCap() encodes that; this test pins it.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isOverCap } from "@/billing/plan-enforcement";

describe("isOverCap", () => {

  test("under the plan limit → not over", () => {
    assert.equal(isOverCap({ current: 10, planLimit: 100, credits: 0 }), false);
  });

  test("exactly at the limit with no credits → over", () => {
    assert.equal(isOverCap({ current: 100, planLimit: 100, credits: 0 }), true);
  });

  test("over the limit but credits remain → not over (credits are spent first)", () => {
    assert.equal(isOverCap({ current: 150, planLimit: 100, credits: 5 }), false);
  });

  test("planLimit 0 means unlimited → never over", () => {
    assert.equal(isOverCap({ current: 9_999_999, planLimit: 0, credits: 0 }), false);
  });

  // ── The regression this exists for ─────────────────────────────────────────

  test("a tenant does not lose credits to the meet-in-the-middle bug", () => {
    // plan 100, bought 10, five already consumed: current 105, credits 5.
    // `current >= planLimit + credits` → 105 >= 105 → would block here, with
    // five paid-for sessions still unused.
    assert.equal(
      isOverCap({ current: 105, planLimit: 100, credits: 5 }),
      false,
      "must keep serving while purchased credits remain",
    );
  });

  test("blocks only once the last credit is gone", () => {
    assert.equal(isOverCap({ current: 110, planLimit: 100, credits: 0 }), true);
  });

  // ── Defensive ──────────────────────────────────────────────────────────────

  test("negative credits are treated as none", () => {
    assert.equal(isOverCap({ current: 100, planLimit: 100, credits: -3 }), true);
  });
});
