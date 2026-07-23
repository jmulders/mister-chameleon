/**
 * Unit tests for the pure ad-billing aggregator (CPM + CPC + mixed).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { aggregateAdBilling, type AdEventLite } from "../../lib/ads/aggregate-billing.ts";
import type { Ad } from "../../lib/ads/types.ts";

type Priced = Pick<Ad, "id" | "pricing_model" | "rate_cents">;

function ads(...list: Priced[]): Map<string, Priced> {
  return new Map(list.map((a) => [a.id, a]));
}
function ev(over: Partial<AdEventLite>): AdEventLite {
  return {
    ad_id: "ad1", ad_tenant_id: "adco", publisher_domain: "pub.nl",
    event_type: "impression", occurred_at: "2026-07-22T10:00:00Z", ...over,
  };
}

describe("aggregateAdBilling", () => {
  it("CPM: charges per impression (rate/1000), clicks are free", () => {
    const catalogue = ads({ id: "ad1", pricing_model: "cpm", rate_cents: 500 }); // €5 CPM → 0.5c/impr
    const events = [
      ev({ event_type: "impression" }), ev({ event_type: "impression" }), ev({ event_type: "impression" }),
      ev({ event_type: "click" }),
    ];
    const r = aggregateAdBilling(events, catalogue);
    assert.equal(r.perTenantCents.get("adco"), 1.5);        // 3 × 0.5
    assert.equal(r.perAdCents.get("ad1")!.cents, 1.5);
    assert.equal(r.daily.length, 1);
    assert.equal(r.daily[0].impressions, 3);
    assert.equal(r.daily[0].clicks, 1);
    assert.equal(r.daily[0].spend_cents, 1.5);
  });

  it("CPC: charges per click, impressions are free", () => {
    const catalogue = ads({ id: "ad1", pricing_model: "cpc", rate_cents: 50 }); // €0.50/click
    const events = [ev({ event_type: "impression" }), ev({ event_type: "click" }), ev({ event_type: "click" })];
    const r = aggregateAdBilling(events, catalogue);
    assert.equal(r.perTenantCents.get("adco"), 100);        // 2 × 50
    assert.equal(r.daily[0].impressions, 1);
    assert.equal(r.daily[0].clicks, 2);
    assert.equal(r.daily[0].spend_cents, 100);
  });

  it("aggregates across ads and tenants", () => {
    const catalogue = ads(
      { id: "ad1", pricing_model: "cpm", rate_cents: 1000 },  // 1c/impr
      { id: "ad2", pricing_model: "cpc", rate_cents: 20 },    // 20c/click
    );
    const events = [
      ev({ ad_id: "ad1", ad_tenant_id: "A", event_type: "impression" }),
      ev({ ad_id: "ad1", ad_tenant_id: "A", event_type: "impression" }),
      ev({ ad_id: "ad2", ad_tenant_id: "B", event_type: "click" }),
    ];
    const r = aggregateAdBilling(events, catalogue);
    assert.equal(r.perTenantCents.get("A"), 2);   // 2 × 1c
    assert.equal(r.perTenantCents.get("B"), 20);  // 1 × 20c
  });

  it("splits the daily rollup by (ad, publisher, date)", () => {
    const catalogue = ads({ id: "ad1", pricing_model: "cpm", rate_cents: 1000 });
    const events = [
      ev({ publisher_domain: "a.nl", occurred_at: "2026-07-22T09:00:00Z" }),
      ev({ publisher_domain: "b.nl", occurred_at: "2026-07-22T09:00:00Z" }),
      ev({ publisher_domain: "a.nl", occurred_at: "2026-07-23T09:00:00Z" }),
    ];
    const r = aggregateAdBilling(events, catalogue);
    assert.equal(r.daily.length, 3); // a.nl/22, b.nl/22, a.nl/23
  });

  it("skips events whose ad is not in the catalogue", () => {
    const catalogue = ads({ id: "ad1", pricing_model: "cpm", rate_cents: 1000 });
    const r = aggregateAdBilling([ev({ ad_id: "gone" })], catalogue);
    assert.equal(r.perTenantCents.size, 0);
    assert.equal(r.daily.length, 0);
  });
});
