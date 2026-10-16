/**
 * Unit tests for the snippet payment-gate dunning resolution.
 *
 * The per-tenant quarantine_days only changes the outcome for a `past_due`
 * subscription with a payment_due_since date, so the dunning-settings read must
 * be skipped for every other status (it ran on every snippet pageview before).
 */

import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import assert           from "node:assert/strict";
import { resolveSubscriptionDunning, loadPaymentGate } from "@/lib/snippet/payment-gate";

function counter(days: number | Error) {
  let calls = 0;
  const load = async () => {
    calls += 1;
    if (days instanceof Error) throw days;
    return days;
  };
  return { load, calls: () => calls };
}

describe("resolveSubscriptionDunning", () => {
  it("does not read dunning settings for an active subscription", async () => {
    const c = counter(8);
    const state = await resolveSubscriptionDunning({ status: "active", payment_due_since: null }, c.load);
    assert.equal(c.calls(), 0);
    assert.equal(state.isBlocked, false);
    assert.equal(state.isQuarantined, false);
  });

  it("does not read dunning settings for an unpaid subscription and blocks it", async () => {
    const c = counter(8);
    const state = await resolveSubscriptionDunning({ status: "unpaid", payment_due_since: null }, c.load);
    assert.equal(c.calls(), 0);
    assert.equal(state.isBlocked, true);
  });

  it("reads dunning settings for past_due and applies the tenant quarantine", async () => {
    const dueSince = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const short = counter(2);
    const blocked = await resolveSubscriptionDunning({ status: "past_due", payment_due_since: dueSince }, short.load);
    assert.equal(short.calls(), 1);
    assert.equal(blocked.isBlocked, true);

    const long = counter(30);
    const quarantined = await resolveSubscriptionDunning({ status: "past_due", payment_due_since: dueSince }, long.load);
    assert.equal(long.calls(), 1);
    assert.equal(quarantined.isQuarantined, true);
  });

  it("falls back to the default quarantine when the settings read fails", async () => {
    const dueSince = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const c = counter(new Error("db down"));
    const state = await resolveSubscriptionDunning({ status: "past_due", payment_due_since: dueSince }, c.load);
    assert.equal(c.calls(), 1);
    assert.equal(state.isQuarantined, true); // 3 days < default 8
  });
});

function fakeDb(row: unknown, seen: { tenantId?: string } = {}): SupabaseClient {
  const db = {
    from: () => ({
      select: () => ({
        eq: (_col: string, val: string) => {
          seen.tenantId = val;
          return { maybeSingle: async () => ({ data: row }) };
        },
      }),
    }),
  };
  return db as unknown as SupabaseClient;
}

describe("loadPaymentGate", () => {
  it("serves normally when the tenant has no subscription row", async () => {
    assert.equal(await loadPaymentGate(fakeDb(null), "t1", async () => 8), null);
  });

  it("reads the subscription of the given tenant", async () => {
    const seen: { tenantId?: string } = {};
    await loadPaymentGate(fakeDb(null, seen), "nascita", async () => 8);
    assert.equal(seen.tenantId, "nascita");
  });

  it("blocks an unpaid subscription", async () => {
    const state = await loadPaymentGate(fakeDb({ status: "unpaid", payment_due_since: null }), "t1", async () => 8);
    assert.equal(state?.isBlocked, true);
  });

  it("quarantines a recent past_due subscription", async () => {
    const dueSince = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const state = await loadPaymentGate(fakeDb({ status: "past_due", payment_due_since: dueSince }), "t1", async () => 8);
    assert.equal(state?.isQuarantined, true);
  });

  it("ignores a malformed row instead of blocking", async () => {
    assert.equal(await loadPaymentGate(fakeDb({ status: 42 }), "t1", async () => 8), null);
  });
});
