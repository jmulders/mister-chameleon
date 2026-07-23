/**
 * Unit tests for pure ad selection + pricing. No infra — fast suite.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { selectAd, eligibleAds, weightedPick } from "../../lib/ads/select-ad.ts";
import { impressionCostCents, clickCostCents, eventCostCents } from "../../lib/ads/pricing.ts";
import type { Ad } from "../../lib/ads/types.ts";

function ad(over: Partial<Ad> = {}): Ad {
  return {
    id: "a1", ad_tenant_id: "adco", name: "Ad", slot_type: "hero",
    creative: { title: "Buy" }, click_url: "https://x.test", targeting: {},
    pricing_model: "cpm", rate_cents: 500, budget_cents: 0, spent_cents: 0,
    weight: 1, status: "active", start_at: null, end_at: null, ...over,
  };
}

const NOW = new Date("2026-07-22T12:00:00Z");

describe("eligibleAds", () => {
  it("keeps an active, in-flight, in-budget, targeted ad", () => {
    assert.equal(eligibleAds([ad()], { now: NOW }).length, 1);
  });

  it("drops paused / ended / zero-weight ads", () => {
    assert.equal(eligibleAds([ad({ status: "paused" })], { now: NOW }).length, 0);
    assert.equal(eligibleAds([ad({ status: "ended" })],  { now: NOW }).length, 0);
    assert.equal(eligibleAds([ad({ weight: 0 })],        { now: NOW }).length, 0);
  });

  it("respects the flight window", () => {
    assert.equal(eligibleAds([ad({ start_at: "2026-07-23T00:00:00Z" })], { now: NOW }).length, 0, "not started");
    assert.equal(eligibleAds([ad({ end_at:   "2026-07-21T00:00:00Z" })], { now: NOW }).length, 0, "ended");
    assert.equal(eligibleAds([ad({ start_at: "2026-07-01T00:00:00Z", end_at: "2026-08-01T00:00:00Z" })], { now: NOW }).length, 1, "mid-flight");
  });

  it("stops serving when budget is spent (0 = unlimited)", () => {
    assert.equal(eligibleAds([ad({ budget_cents: 1000, spent_cents: 1000 })], { now: NOW }).length, 0, "budget spent");
    assert.equal(eligibleAds([ad({ budget_cents: 1000, spent_cents: 999 })],  { now: NOW }).length, 1, "budget left");
    assert.equal(eligibleAds([ad({ budget_cents: 0, spent_cents: 9e9 })],      { now: NOW }).length, 1, "unlimited");
  });

  it("applies injected targeting and frequency predicates", () => {
    assert.equal(eligibleAds([ad()], { now: NOW, matchTargeting: () => false }).length, 0, "targeting miss");
    assert.equal(eligibleAds([ad()], { now: NOW, isFrequencyOk: () => false }).length, 0, "freq capped");
  });
});

describe("weightedPick", () => {
  it("returns null for an empty list", () => {
    assert.equal(weightedPick([]), null);
  });
  it("picks deterministically given the RNG", () => {
    const a = ad({ id: "a", weight: 1 });
    const b = ad({ id: "b", weight: 3 });
    // total weight 4: r in [0,1) → a; [1,4) → b
    assert.equal(weightedPick([a, b], () => 0.0)!.id, "a");
    assert.equal(weightedPick([a, b], () => 0.5)!.id, "b"); // 0.5*4=2 → b
  });
  it("falls back to the first when all weights are 0", () => {
    assert.equal(weightedPick([ad({ id: "a", weight: 0 }), ad({ id: "b", weight: 0 })])!.id, "a");
  });
});

describe("selectAd", () => {
  it("returns null when nothing is eligible", () => {
    assert.equal(selectAd([ad({ status: "paused" })], { now: NOW }), null);
  });
  it("selects among eligible only", () => {
    const chosen = selectAd(
      [ad({ id: "paused", status: "paused" }), ad({ id: "live" })],
      { now: NOW, random: () => 0 },
    );
    assert.equal(chosen!.id, "live");
  });
});

describe("pricing", () => {
  it("CPM bills per impression (rate/1000), never on click", () => {
    const cpm = ad({ pricing_model: "cpm", rate_cents: 500 }); // EUR 5 CPM
    assert.equal(impressionCostCents(cpm), 0.5);
    assert.equal(clickCostCents(cpm), 0);
    assert.equal(eventCostCents(cpm, "impression"), 0.5);
    assert.equal(eventCostCents(cpm, "click"), 0);
  });
  it("CPC bills per click, never on impression", () => {
    const cpc = ad({ pricing_model: "cpc", rate_cents: 50 }); // EUR 0.50 CPC
    assert.equal(impressionCostCents(cpc), 0);
    assert.equal(clickCostCents(cpc), 50);
    assert.equal(eventCostCents(cpc, "click"), 50);
  });
});
