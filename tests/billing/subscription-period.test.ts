/**
 * subscriptionPeriod — waar leest de webhook de facturatieperiode?
 *
 * ─── Wat dit bewaakt ─────────────────────────────────────────────────────────
 *
 *   Stripe verplaatste current_period_start/end in API-versie 2024-09-30 van de
 *   ROOT van het subscription-object naar het subscription-ITEM. De webhook-
 *   handlers (customer.subscription.created/updated) lazen ze van de root:
 *
 *       new Date(sub.current_period_end * 1000).toISOString()
 *
 *   Op de huidige API is sub.current_period_end undefined → new Date(NaN) →
 *   .toISOString() gooit een RangeError. De handler crashte, de route ving het
 *   in try/catch, gaf 200 terug, en de database werd nooit bijgewerkt. Een levend
 *   abonnement liep zo een maand achter zonder dat iets rood kleurde.
 *
 *   Geen enkele test raakte deze handler, dus de bug was onzichtbaar. Deze test
 *   pint het gedrag dat de fix garandeert: lees van het item, val terug op de
 *   oude root-velden, en produceer nooit een NaN.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { subscriptionPeriod } from "@/billing/stripe";

// Minimale payload-vorm; subscriptionPeriod raakt alleen deze velden.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asSub = (o: unknown): any => o;

describe("subscriptionPeriod", () => {

  it("leest de periode van het ITEM (huidige Stripe API ≥ 2024-09-30)", () => {
    const p = subscriptionPeriod(asSub({
      items: { data: [{ current_period_start: 1784229438, current_period_end: 1786907838 }] },
    }));
    assert.equal(p.start, 1784229438);
    assert.equal(p.end,   1786907838);
  });

  it("valt terug op de root-velden voor oude payloads (< 2024-09-30)", () => {
    const p = subscriptionPeriod(asSub({
      items: { data: [{}] },
      current_period_start: 111,
      current_period_end:   222,
    }));
    assert.equal(p.start, 111);
    assert.equal(p.end,   222);
  });

  it("geeft NOOIT NaN terug als de periode volledig ontbreekt", () => {
    // Dit is het exacte scenario dat de handler liet crashen: geen periode
    // nergens. Voorheen: new Date(undefined * 1000) = NaN → RangeError. Nu: een
    // coherente start (billing_cycle_anchor) en een null-einde dat de handler
    // als null wegschrijft in plaats van te ontploffen.
    const p = subscriptionPeriod(asSub({
      items: { data: [{}] },
      billing_cycle_anchor: 1785542400,
    }));
    assert.equal(p.start, 1785542400);
    assert.equal(p.end,   null);
    assert.ok(!Number.isNaN(p.start), "start mag geen NaN zijn");
    // De handler doet: period.end != null ? new Date(period.end*1000)... : null
    // Bewijs dat de start een geldige ISO-datum oplevert (geen throw).
    assert.doesNotThrow(() => new Date(p.start * 1000).toISOString());
  });

  it("item wint van de oude root-velden als beide er zijn", () => {
    const p = subscriptionPeriod(asSub({
      items: { data: [{ current_period_start: 900, current_period_end: 999 }] },
      current_period_start: 111,
      current_period_end:   222,
    }));
    assert.equal(p.start, 900);
    assert.equal(p.end,   999);
  });
});
