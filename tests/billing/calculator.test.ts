/**
 * Billing Calculator Unit Tests
 *
 * Tests calculateBillingEstimate() in isolation — no DB, no Stripe SDK.
 *
 * ─── What the invoice is, as of the current model ────────────────────────────
 *
 *   total = plan base fee. That is the whole formula.
 *
 *   Enrichment credits are a separate consumable, paid for at checkout when a
 *   bundle is bought, and drawn down from the wallet as they are used. Nothing
 *   about that usage lands on the subscription invoice — no included allowance,
 *   no overage rate, no overage line. The estimate lists credit activity as €0
 *   reference lines so the panel shows what happened, not what it costs.
 *
 *   Personalised sessions are capped, not billed per unit: over the monthly
 *   bundle the visitor gets the default page unless the tenant has purchased
 *   session credits. See billing/plan-enforcement.ts. Also not on this invoice.
 *
 * ─── Why this file was rewritten ─────────────────────────────────────────────
 *
 *   The previous version tested the old model: 500 included credits per plan,
 *   €0.03/credit overage, an overage line item, an overage alert. The plans lost
 *   `includedCredits` and `overageCentPerCredit` (now @deprecated, optional, and
 *   unset) and the calculator lost the overage branch — but the tests stayed,
 *   asserting `undefined === 500`. Sixteen red tests on the pricing calculator,
 *   every run, for a calculator that was working as designed.
 *
 *   The tests below assert the model that ships. If the pricing model changes
 *   again, these must fail — that is the point of them.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { calculateBillingEstimate } from "@/billing/calculator";
import { BILLING_PLANS }            from "@/billing/plans";
import type { UsageSummary }        from "@/billing/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PERIOD_S = "2025-03-01T00:00:00.000Z";
const PERIOD_E = "2025-04-01T00:00:00.000Z";
const TENANT   = "tenant-test-001";

/** Build a minimal UsageSummary. Only the credit fields vary per test. */
function makeUsage(overrides: Partial<UsageSummary> = {}): UsageSummary {
  return {
    tenantId:         TENANT,
    currentBalance:   0,
    includedCredits:  0,
    usedCredits:      0,
    deductedCredits:  0,
    purchasedCredits: 0,
    overageCredits:   0,
    periodStart:      PERIOD_S,
    periodEnd:        PERIOD_E,
    ...overrides,
  };
}

// ── Plan model ────────────────────────────────────────────────────────────────

describe("Plan model", () => {
  it("the three plans are priced €149 / €349 / €749 per month", () => {
    assert.equal(BILLING_PLANS.starter.monthlyPriceCents, 14_900);
    assert.equal(BILLING_PLANS.growth.monthlyPriceCents,  34_900);
    assert.equal(BILLING_PLANS.pro.monthlyPriceCents,     74_900);
  });

  it("each plan up the ladder allows more personalised sessions", () => {
    assert.ok(
      BILLING_PLANS.growth.limits.personalizedSessionsPerMonth >
      BILLING_PLANS.starter.limits.personalizedSessionsPerMonth,
      "growth should allow more sessions than starter",
    );
    assert.ok(
      BILLING_PLANS.pro.limits.personalizedSessionsPerMonth >
      BILLING_PLANS.growth.limits.personalizedSessionsPerMonth,
      "pro should allow more sessions than growth",
    );
  });

  it("no plan carries an included credit allowance or an overage rate", () => {
    // The wallet model replaced these. If a plan starts carrying them again,
    // the calculator must grow an overage branch to match — so fail loudly.
    for (const planId of ["starter", "growth", "pro"] as const) {
      assert.equal(
        BILLING_PLANS[planId].includedCredits, undefined,
        `${planId}: credits are purchased separately, not included in the plan`,
      );
      assert.equal(
        BILLING_PLANS[planId].overageCentPerCredit, undefined,
        `${planId}: there is no overage billing`,
      );
    }
  });

  it("annual pricing is cheaper per month than monthly for all plans", () => {
    for (const planId of ["starter", "growth", "pro"] as const) {
      const plan = BILLING_PLANS[planId];
      assert.ok(
        plan.annualMonthlyCents < plan.monthlyPriceCents,
        `${planId}: annualMonthlyCents (${plan.annualMonthlyCents}) should be < monthlyPriceCents (${plan.monthlyPriceCents})`,
      );
    }
  });
});

// ── Formula ───────────────────────────────────────────────────────────────────

describe("Billing formula: total = plan base fee", () => {
  it("no usage: total equals the base fee", () => {
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", makeUsage());
    assert.equal(estimate.totalCents, BILLING_PLANS.starter.monthlyPriceCents);
    assert.equal(estimate.hasOverage, false);
  });

  it("credit usage does not change the total", () => {
    const estimate = calculateBillingEstimate(
      TENANT, "starter", "monthly", makeUsage({ usedCredits: 5_000 }),
    );
    assert.equal(estimate.totalCents, BILLING_PLANS.starter.monthlyPriceCents);
    assert.equal(estimate.hasOverage, false);
  });

  it("purchased bundles do not change the total (paid at checkout)", () => {
    const estimate = calculateBillingEstimate(
      TENANT, "starter", "monthly", makeUsage({ purchasedCredits: 5_000 }),
    );
    assert.equal(estimate.totalCents, BILLING_PLANS.starter.monthlyPriceCents);
  });

  it("every plan bills its own base fee", () => {
    for (const planId of ["starter", "growth", "pro"] as const) {
      const estimate = calculateBillingEstimate(TENANT, planId, "monthly", makeUsage());
      assert.equal(estimate.totalCents, BILLING_PLANS[planId].monthlyPriceCents, planId);
    }
  });
});

// ── Annual billing ────────────────────────────────────────────────────────────

describe("Annual billing cycle", () => {
  it("annual base fee uses annualMonthlyCents (effective monthly rate)", () => {
    const plan     = BILLING_PLANS.starter;
    const estimate = calculateBillingEstimate(TENANT, "starter", "annual", makeUsage());
    assert.equal(estimate.totalCents, plan.annualMonthlyCents);
  });

  it("annual with heavy credit usage: still just the annual rate", () => {
    const estimate = calculateBillingEstimate(
      TENANT, "starter", "annual", makeUsage({ usedCredits: 10_000 }),
    );
    assert.equal(estimate.totalCents, BILLING_PLANS.starter.annualMonthlyCents);
  });
});

// ── Period handling ───────────────────────────────────────────────────────────

describe("Period handling", () => {
  it("estimate reflects period start/end from the usage summary", () => {
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", makeUsage());
    assert.equal(estimate.periodStart, PERIOD_S);
    assert.equal(estimate.periodEnd,   PERIOD_E);
  });

  it("no period (new tenant): estimate still returns the base fee", () => {
    const usage    = makeUsage({ periodStart: null, periodEnd: null });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.equal(estimate.totalCents, BILLING_PLANS.starter.monthlyPriceCents);
    assert.equal(estimate.periodStart, null);
  });
});

// ── Reference line items ──────────────────────────────────────────────────────

describe("Credit activity reference lines", () => {
  it("credits used this period appear as a €0 reference line", () => {
    const estimate = calculateBillingEstimate(
      TENANT, "starter", "monthly", makeUsage({ usedCredits: 120 }),
    );
    const usedLine = estimate.lineItems.find((li) => li.label.includes("credits used"));
    assert.ok(usedLine, "should have a credits-used line item");
    assert.equal(usedLine!.totalCents, 0, "reference lines never add to the total");
  });

  it("purchased credits appear as a €0 reference line", () => {
    const estimate = calculateBillingEstimate(
      TENANT, "starter", "monthly", makeUsage({ purchasedCredits: 500 }),
    );
    const bundleLine = estimate.lineItems.find((li) => li.label.includes("bundles"));
    assert.ok(bundleLine, "should have a credit bundle line item");
    assert.equal(bundleLine!.totalCents, 0);
    assert.equal(bundleLine!.isEstimate, false);
  });

  it("no credit activity: only the base line item", () => {
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", makeUsage());
    assert.equal(estimate.lineItems.length, 1);
  });
});

// ── Line item structure ───────────────────────────────────────────────────────

describe("Line item structure", () => {
  it("base fee line item is never marked as an estimate", () => {
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", makeUsage());
    const baseLine = estimate.lineItems[0];
    assert.ok(baseLine, "should have at least one line item");
    assert.equal(baseLine.isEstimate, false);
  });

  it("no line item is ever an overage charge", () => {
    const usage    = makeUsage({ usedCredits: 99_999, purchasedCredits: 99_999 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    const overage  = estimate.lineItems.find((li) => li.label.toLowerCase().includes("overage"));
    assert.equal(overage, undefined, "overage billing no longer exists");
  });

  it("subtotal equals the sum of all line item totals", () => {
    const usage    = makeUsage({ usedCredits: 50, purchasedCredits: 100 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    const summed   = estimate.lineItems.reduce((s, li) => s + li.totalCents, 0);
    assert.equal(estimate.subtotalCents, summed);
  });

  it("totalCents equals subtotalCents + taxCents", () => {
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", makeUsage());
    assert.equal(estimate.totalCents, estimate.subtotalCents + estimate.taxCents);
  });
});

// ── Overage alert ─────────────────────────────────────────────────────────────

describe("Overage alert", () => {
  it("is never raised — there is nothing to overrun", () => {
    const usage    = makeUsage({ usedCredits: 1_000_000, overageCredits: 1_000_000 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.equal(estimate.hasOverage,   false);
    assert.equal(estimate.overageAlert, undefined);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("all three plans return a non-zero total", () => {
    for (const planId of ["starter", "growth", "pro"] as const) {
      const estimate = calculateBillingEstimate(TENANT, planId, "monthly", makeUsage());
      assert.ok(estimate.totalCents > 0, `${planId} estimate should have a positive total`);
    }
  });

  it("totals stay safe integers under absurd usage", () => {
    const usage    = makeUsage({ usedCredits: 1_000_000, purchasedCredits: 1_000_000 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.ok(Number.isSafeInteger(estimate.totalCents), "totalCents should be a safe integer");
  });

  it("formattedTotal is a non-empty string", () => {
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", makeUsage());
    assert.ok(typeof estimate.formattedTotal === "string" && estimate.formattedTotal.length > 0);
  });

  it("estimate tenantId matches input", () => {
    const estimate = calculateBillingEstimate("my-tenant-xyz", "starter", "monthly", makeUsage());
    assert.equal(estimate.tenantId, "my-tenant-xyz");
  });

  it("estimate planId and billingCycle match inputs", () => {
    const estimate = calculateBillingEstimate(TENANT, "pro", "annual", makeUsage());
    assert.equal(estimate.planId, "pro");
    assert.equal(estimate.billingCycle, "annual");
  });
});
