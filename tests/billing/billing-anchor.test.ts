/**
 * Calendar-month billing anchor.
 *
 * ─── What this guards ────────────────────────────────────────────────────────
 *
 *   The session bundle resets on `month_key` — a UTC calendar month. Stripe's
 *   default billing cycle anchor is the signup moment. Left alone, those are two
 *   different windows, and the live data proved it: subscriptions anchored to
 *   day 27 and day 16, resetting their cap on the 1st. A period of 27 June →
 *   27 July contains the 1 July reset, so one paid month spanned two bundles.
 *
 *   nextCalendarMonthStartUnix() is what makes the invoice period and the cap
 *   window the same window. These tests pin the two properties Stripe requires
 *   of an anchor (future, within one interval) plus the one the billing model
 *   requires (midnight UTC on the 1st).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { nextCalendarMonthStartUnix } from "@/billing/stripe";

/** Read the anchor back as a Date for assertions. */
function anchorFor(iso: string): Date {
  return new Date(nextCalendarMonthStartUnix(new Date(iso)) * 1000);
}

describe("nextCalendarMonthStartUnix", () => {

  it("lands on midnight UTC of the 1st", () => {
    const d = anchorFor("2026-07-17T13:45:12.000Z");
    assert.equal(d.getUTCDate(),         1);
    assert.equal(d.getUTCMonth(),        7, "August (0-indexed)");
    assert.equal(d.getUTCFullYear(),     2026);
    assert.equal(d.getUTCHours(),        0);
    assert.equal(d.getUTCMinutes(),      0);
    assert.equal(d.getUTCSeconds(),      0);
    assert.equal(d.getUTCMilliseconds(), 0);
  });

  it("rolls December into January of the next year", () => {
    const d = anchorFor("2026-12-31T23:59:59.000Z");
    assert.equal(d.getUTCFullYear(), 2027);
    assert.equal(d.getUTCMonth(),    0, "January");
    assert.equal(d.getUTCDate(),     1);
  });

  it("handles February, leap year or not", () => {
    // Short months are exactly where a day-of-month anchor goes wrong; anchoring
    // to the 1st sidesteps the question entirely.
    assert.equal(anchorFor("2026-02-28T12:00:00.000Z").toISOString(), "2026-03-01T00:00:00.000Z");
    assert.equal(anchorFor("2028-02-29T12:00:00.000Z").toISOString(), "2028-03-01T00:00:00.000Z");
    assert.equal(anchorFor("2028-01-31T12:00:00.000Z").toISOString(), "2028-02-01T00:00:00.000Z");
  });

  it("is always in the future — Stripe rejects a past anchor", () => {
    for (const iso of [
      "2026-01-01T00:00:01.000Z", // one second into a month
      "2026-01-15T12:00:00.000Z",
      "2026-01-31T23:59:59.999Z", // the last instant of a month
      "2026-04-30T23:59:59.999Z", // 30-day month
    ]) {
      const now = new Date(iso);
      assert.ok(
        nextCalendarMonthStartUnix(now) * 1000 > now.getTime(),
        `anchor for ${iso} must be in the future`,
      );
    }
  });

  it("is never more than one monthly interval out — Stripe rejects that too", () => {
    for (const iso of [
      "2026-01-01T00:00:01.000Z",
      "2026-07-17T13:45:12.000Z",
      "2026-12-01T00:00:01.000Z",
    ]) {
      const now      = new Date(iso);
      const distance = nextCalendarMonthStartUnix(now) * 1000 - now.getTime();
      assert.ok(
        distance <= 31 * 24 * 60 * 60 * 1000,
        `anchor for ${iso} is ${Math.round(distance / 86_400_000)} days out — must be ≤ 31`,
      );
    }
  });

  it("agrees with the month key the cap resets on", () => {
    // The whole point: the first full invoice period starts exactly when the
    // next month_key bucket starts. If these ever disagree, a tenant's bundle
    // and their invoice cover different days.
    const anchor       = anchorFor("2026-07-17T13:45:12.000Z");
    const anchorMonth  = anchor.toISOString().slice(0, 7);   // same slice currentMonthKey() uses
    assert.equal(anchorMonth, "2026-08");
    assert.equal(anchor.toISOString(), "2026-08-01T00:00:00.000Z");
  });
});
