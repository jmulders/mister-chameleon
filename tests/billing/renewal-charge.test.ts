/**
 * A renewal charges for the period it grants.
 *
 * The cron charged an annual subscription the annual price and then gave it one
 * month. See billing/renewal-charge.ts.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { renewalCharge, renewalIdempotencyKey } from "../../billing/renewal-charge.ts";
import { BILLING_PLANS } from "../../billing/plans.ts";

const base = { pending_plan: null, pending_plan_billing_cycle: null };

describe("renewalCharge", () => {
  it("a monthly subscription renews per month at the monthly price", () => {
    const r = renewalCharge({ ...base, plan: "growth", billing_cycle: "monthly" });
    assert.deepEqual(r, { plan: "growth", cycle: "monthly", amountCents: BILLING_PLANS.growth.monthlyPriceCents, annualToMonthly: false });
  });

  it("an annual term continues per month, and is charged for a month", () => {
    const r = renewalCharge({ ...base, plan: "growth", billing_cycle: "annual" });
    assert.equal(r.annualToMonthly, true);
    assert.equal(r.cycle, "monthly");
    assert.equal(r.amountCents, BILLING_PLANS.growth.monthlyPriceCents);
    assert.notEqual(r.amountCents, BILLING_PLANS.growth.annualPriceCents);
  });

  it("a scheduled change to an annual plan is charged as the customer chose it", () => {
    const r = renewalCharge({ plan: "starter", billing_cycle: "monthly", pending_plan: "pro", pending_plan_billing_cycle: "annual" });
    assert.deepEqual(r, { plan: "pro", cycle: "annual", amountCents: BILLING_PLANS.pro.annualPriceCents, annualToMonthly: false });
  });

  it("a scheduled downgrade from annual to monthly charges the new plan per month", () => {
    const r = renewalCharge({ plan: "pro", billing_cycle: "annual", pending_plan: "growth", pending_plan_billing_cycle: "monthly" });
    assert.deepEqual(r, { plan: "growth", cycle: "monthly", amountCents: BILLING_PLANS.growth.monthlyPriceCents, annualToMonthly: false });
  });

  it("an unknown plan costs nothing rather than a guess", () => {
    assert.equal(renewalCharge({ ...base, plan: "no-such-plan", billing_cycle: "monthly" }).amountCents, 0);
  });

  it("a missing cycle is treated as monthly", () => {
    assert.equal(renewalCharge({ ...base, plan: "growth", billing_cycle: null }).cycle, "monthly");
  });
});

describe("renewalIdempotencyKey", () => {
  it("is the same for the same tenant and period, and different for the next period", () => {
    const a = renewalIdempotencyKey("t1", "2026-11-01T00:00:00.000Z");
    assert.equal(a, renewalIdempotencyKey("t1", "2026-11-01T00:00:00.000Z"));
    assert.notEqual(a, renewalIdempotencyKey("t1", "2026-12-01T00:00:00.000Z"));
    assert.notEqual(a, renewalIdempotencyKey("t2", "2026-11-01T00:00:00.000Z"));
  });
});
