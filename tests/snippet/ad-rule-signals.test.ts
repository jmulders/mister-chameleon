/**
 * Unit tests for the consent gate on the advertiser rule-ad signals.
 *
 * The rule-ad decision context reads the visitor's behavioural history and the
 * tenant's GA4 history. History is personalization data, GA4 is analytics data,
 * so each read must only happen with its own consent category.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { loadAdRuleSignals } from "@/lib/snippet/ad-rule-signals";

function spy<T>(value: T | Error) {
  let calls = 0;
  const fn = async () => {
    calls += 1;
    if (value instanceof Error) throw value;
    return value;
  };
  return { fn, calls: () => calls };
}

const EMPTY_H = { pageviews: 0 };
const EMPTY_G: { ga4Sessions?: number } = {};

describe("loadAdRuleSignals", () => {
  it("reads both with personalization and analytics consent", async () => {
    const h = spy({ pageviews: 3 });
    const g = spy({ ga4Sessions: 2 });
    const [history, ga4] = await loadAdRuleSignals({
      personalization: true, analytics: true,
      loadHistory: h.fn, emptyHistory: () => EMPTY_H,
      loadGa4: g.fn, emptyGa4: () => EMPTY_G,
    });
    assert.deepEqual(history, { pageviews: 3 });
    assert.deepEqual(ga4, { ga4Sessions: 2 });
    assert.equal(h.calls(), 1);
    assert.equal(g.calls(), 1);
  });

  it("skips the history read without personalization consent", async () => {
    const h = spy({ pageviews: 3 });
    const g = spy({ ga4Sessions: 2 });
    const [history, ga4] = await loadAdRuleSignals({
      personalization: false, analytics: true,
      loadHistory: h.fn, emptyHistory: () => EMPTY_H,
      loadGa4: g.fn, emptyGa4: () => EMPTY_G,
    });
    assert.equal(h.calls(), 0);
    assert.deepEqual(history, EMPTY_H);
    assert.deepEqual(ga4, { ga4Sessions: 2 });
  });

  it("skips the GA4 read without analytics consent", async () => {
    const h = spy({ pageviews: 3 });
    const g = spy({ ga4Sessions: 2 });
    const [history, ga4] = await loadAdRuleSignals({
      personalization: true, analytics: false,
      loadHistory: h.fn, emptyHistory: () => EMPTY_H,
      loadGa4: g.fn, emptyGa4: () => EMPTY_G,
    });
    assert.equal(g.calls(), 0);
    assert.deepEqual(history, { pageviews: 3 });
    assert.deepEqual(ga4, EMPTY_G);
  });

  it("degrades a failing read to its empty value", async () => {
    const [history, ga4] = await loadAdRuleSignals({
      personalization: true, analytics: true,
      loadHistory: spy<object>(new Error("x")).fn, emptyHistory: () => EMPTY_H,
      loadGa4: spy<object>(new Error("y")).fn, emptyGa4: () => EMPTY_G,
    });
    assert.deepEqual(history, EMPTY_H);
    assert.deepEqual(ga4, EMPTY_G);
  });
});
