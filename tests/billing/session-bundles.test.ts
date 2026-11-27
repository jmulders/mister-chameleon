/**
 * The bundles of extra sessions, beside the plans.
 *
 * A tenant over the monthly limit can buy extra sessions. When the plan
 * limits went down to 1,500 / 7,500 / 40,000 (27 Nov 2026) the bundles still
 * sold 10,000 sessions for €24.90: beside a plan of 1,500 sessions nobody
 * would ever have upgraded. The owner chose 1,000 / 5,000 / 20,000 sessions
 * for €29 / €119 / €399.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import { BILLING_PLANS, SESSION_CREDIT_BUNDLES } from "../../billing/plans.ts";

const perThousand = (cents: number, sessions: number) => cents / (sessions / 1000);

describe("session bundles", () => {
  it("are 1,000 / 5,000 / 20,000 sessions for €29 / €119 / €399", () => {
    assert.deepEqual(
      SESSION_CREDIT_BUNDLES.map((b) => [b.id, b.sessions, b.priceCents]),
      [["sessions_1k", 1_000, 2_900], ["sessions_5k", 5_000, 11_900], ["sessions_20k", 20_000, 39_900]],
    );
  });

  it("show the rate per 1,000 sessions that their price and size give", () => {
    for (const b of SESSION_CREDIT_BUNDLES) {
      assert.equal(b.centsPerThousand, Math.round(perThousand(b.priceCents, b.sessions)), b.id);
      assert.equal(b.label, `${b.sessions.toLocaleString("en-GB")} Sessions`, b.id);
    }
  });

  it("get cheaper per session as they get larger", () => {
    const rates = SESSION_CREDIT_BUNDLES.map((b) => b.centsPerThousand);
    assert.deepEqual(rates, [...rates].sort((x, y) => y - x));
    assert.equal(new Set(rates).size, rates.length);
  });

  it("all cost more per session than the Pro plan, so a larger plan stays the better deal", () => {
    const pro = perThousand(BILLING_PLANS.pro.monthlyPriceCents, BILLING_PLANS.pro.limits.personalizedSessionsPerMonth);
    for (const b of SESSION_CREDIT_BUNDLES) {
      assert.ok(b.centsPerThousand > pro, `${b.id}: ${b.centsPerThousand} is above the Pro rate of ${pro.toFixed(1)}`);
    }
  });

  it("all cost less per session than the plan a small tenant is on", () => {
    // Otherwise nobody would buy one: staying over the limit would be cheaper.
    const starter = perThousand(BILLING_PLANS.starter.monthlyPriceCents, BILLING_PLANS.starter.limits.personalizedSessionsPerMonth);
    for (const b of SESSION_CREDIT_BUNDLES) assert.ok(b.centsPerThousand < starter, b.id);
  });

  it("read their Stripe price from new variables, never from those of the old prices", () => {
    // Stripe charges the amount of the price behind the id, not priceCents.
    // The old variables point at €24.90, €99 and €349.
    const source = fs.readFileSync("billing/plans.ts", "utf8");
    const bundles = source.slice(source.indexOf("export const SESSION_CREDIT_BUNDLES"), source.indexOf("// ── Resolved credit bundles"));
    assert.deepEqual(
      [...bundles.matchAll(/process\.env\["(STRIPE_PRICE_SESSIONS_\w+)"\]/g)].map((m) => m[1]),
      ["STRIPE_PRICE_SESSIONS_1K", "STRIPE_PRICE_SESSIONS_5K", "STRIPE_PRICE_SESSIONS_20K"],
    );
    for (const old of ["STRIPE_PRICE_SESSIONS_10K", "STRIPE_PRICE_SESSIONS_50K", "STRIPE_PRICE_SESSIONS_200K"]) {
      assert.equal(source.includes(`process.env["${old}"]`), false, `${old} is not read`);
    }
  });

  it("are named the same in the guide for tenants and for the operator", () => {
    const guide = fs.readFileSync("docs/tenant-handleiding.md", "utf8");
    assert.ok(guide.includes("Bundels: 1.000 (€29), 5.000 (€119), 20.000 (€399)."));
    const operator = fs.readFileSync("docs/operator-infra-handleiding.md", "utf8");
    assert.ok(operator.includes("`STRIPE_PRICE_SESSIONS_{1K,5K,20K}`"));
  });
});
