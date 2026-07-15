/**
 * tests/billing/enrichment-guard.test.ts
 *
 * The wallet guard decides whether a visitor request may run PAID enrichment.
 * Two of its rules look like bugs and have been "corrected" before — both times
 * wrongly. These tests exist to make the intent executable rather than a comment:
 *
 *   1. A missing wallet row BLOCKS. It used to allow everything, which turned an
 *      unprovisioned tenant into one with an unlimited free budget.
 *
 *   2. fallbackMode is returned ONLY for monthly_cap_exceeded. Passing it on an
 *      empty wallet would let smart_lite run recognition stages that cost credits
 *      the tenant does not have — enrichment delivered, nobody billed.
 *
 * The guard fails OPEN on infrastructure errors (missing table, unreadable
 * column). That is deliberate and also covered: a billing outage must never cost
 * a visitor their page.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkWalletForEnrichment } from "@/billing/enrichment-guard";

// ── Test double ───────────────────────────────────────────────────────────────
//
// Minimal stand-in for the Supabase query chain the guard uses:
//   client.from(table).select(cols).eq(col, val).maybeSingle()

type MaybeSingleResult = { data: unknown; error: unknown };

function fakeClient(result: MaybeSingleResult): never {
  const chain = {
    select:      () => chain,
    eq:          () => chain,
    maybeSingle: async () => result,
  };
  return { from: () => chain } as never;
}

const activeWallet = {
  balance:                  500,
  balance_cents:            500,
  status:                   "active",
  monthly_credit_cap_cents: 0,
  fallback_mode:            "smart_lite",
};

describe("checkWalletForEnrichment", () => {

  // ── The leak this closed ───────────────────────────────────────────────────

  test("blocks when the tenant has no wallet row", async () => {
    const result = await checkWalletForEnrichment(fakeClient({ data: null, error: null }), "t1");

    assert.equal(result.blocked, true);
    assert.equal(result.blockReason, "no_wallet");
    assert.equal(result.balanceCents, 0);
  });

  // ── Normal operation ───────────────────────────────────────────────────────

  test("allows when the wallet has balance and no cap", async () => {
    const result = await checkWalletForEnrichment(fakeClient({ data: activeWallet, error: null }), "t1");

    assert.equal(result.blocked, false);
    assert.equal(result.balanceCents, 500);
  });

  test("prefers the NUMERIC balance over the rounded balance_cents", async () => {
    // balance_cents rounds sub-credit values to 0. A wallet at 0.4 credits still
    // has value and must not be blocked.
    const result = await checkWalletForEnrichment(
      fakeClient({ data: { ...activeWallet, balance: 0.4, balance_cents: 0 }, error: null }),
      "t1",
    );

    assert.equal(result.blocked, false);
  });

  // ── No fallbackMode on the "cannot pay" reasons ────────────────────────────
  //
  // If these ever start returning a fallbackMode, build-decision-context will
  // honour smart_lite and run billable recognition stages against an empty
  // wallet. That is the debit_failed leak. Keep them undefined.

  test("empty wallet blocks WITHOUT a fallbackMode", async () => {
    const result = await checkWalletForEnrichment(
      fakeClient({ data: { ...activeWallet, balance: 0, balance_cents: 0 }, error: null }),
      "t1",
    );

    assert.equal(result.blocked, true);
    assert.equal(result.blockReason, "insufficient_balance");
    assert.equal(result.fallbackMode, undefined,
      "empty wallet must not carry a fallbackMode — smart_lite would run unpaid recognition stages");
  });

  test("suspended wallet blocks WITHOUT a fallbackMode", async () => {
    const result = await checkWalletForEnrichment(
      fakeClient({ data: { ...activeWallet, status: "suspended" }, error: null }),
      "t1",
    );

    assert.equal(result.blocked, true);
    assert.equal(result.blockReason, "wallet_suspended");
    assert.equal(result.fallbackMode, undefined);
  });

  test("frozen wallet blocks WITHOUT a fallbackMode", async () => {
    const result = await checkWalletForEnrichment(
      fakeClient({ data: { ...activeWallet, status: "frozen" }, error: null }),
      "t1",
    );

    assert.equal(result.blocked, true);
    assert.equal(result.blockReason, "wallet_frozen");
    assert.equal(result.fallbackMode, undefined);
  });

  // ── Fail open on infrastructure errors ─────────────────────────────────────

  test("fails open when the wallet table is missing", async () => {
    const result = await checkWalletForEnrichment(
      fakeClient({ data: null, error: { code: "42P01", message: "relation does not exist" } }),
      "t1",
    );

    assert.equal(result.blocked, false,
      "a missing table is our outage, not the tenant's — never block a visitor for it");
  });
});
