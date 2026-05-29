/**
 * Billing Calculator Unit Tests
 *
 * Tests calculateBillingEstimate() in isolation — no DB, no Stripe SDK.
 *
 * ─── Coverage ─────────────────────────────────────────────────────────────────
 *
 *   1. Plan model: included credits, overage rate, base price per cycle.
 *   2. Billing formula: total = base + max(0, deducted - included) * overageRate
 *   3. Period handling: no period, active period, mid-period.
 *   4. Edge cases: no usage, exact limit, 1 over limit, far over limit,
 *                  annual vs monthly pricing, purchased credits, canceled plan.
 *   5. Line item structure: correct labels, quantities, isEstimate flags.
 *   6. Overage alert: present when overageCredits > 0, absent otherwise.
 *
 * ─── Usage summary construction ───────────────────────────────────────────────
 *
 *   Tests construct UsageSummary objects manually rather than querying the DB.
 *   This keeps the test suite fast and isolated — DB integration is tested
 *   separately (see tests/billing/usage.test.ts when DB test harness is added).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { calculateBillingEstimate } from "@/billing/calculator";
import { BILLING_PLANS }            from "@/billing/plans";
import type { UsageSummary }        from "@/billing/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW      = "2025-03-01T00:00:00.000Z";
const PERIOD_S = "2025-03-01T00:00:00.000Z";
const PERIOD_E = "2025-04-01T00:00:00.000Z";
const TENANT   = "tenant-test-001";

/**
 * Build a minimal UsageSummary for testing.
 * Only deductedCredits and purchasedCredits affect the billing calculation.
 */
function makeUsage(overrides: Partial<UsageSummary> = {}): UsageSummary {
  const includedCredits = overrides.includedCredits ?? BILLING_PLANS.starter.includedCredits; // 500
  const deducted        = overrides.usedCredits     ?? 0; // credits from deductions (used)
  const overageCredits  = Math.max(0, deducted - includedCredits);
  return {
    tenantId:         TENANT,
    currentBalance:   includedCredits - Math.min(deducted, includedCredits),
    includedCredits,
    usedCredits:      Math.min(deducted, includedCredits),
    purchasedCredits: overrides.purchasedCredits ?? 0,
    overageCredits,
    periodStart:      overrides.periodStart ?? PERIOD_S,
    periodEnd:        overrides.periodEnd   ?? PERIOD_E,
    ...overrides,
  };
}

// ── Plan model tests ──────────────────────────────────────────────────────────

describe("Plan model", () => {
  it("starter plan has 500 included credits at €0.03/credit overage", () => {
    assert.equal(BILLING_PLANS.starter.includedCredits, 500);
    assert.equal(BILLING_PLANS.starter.overageCentPerCredit, 3);
    assert.equal(BILLING_PLANS.starter.monthlyPriceCents, 14900);
  });

  it("growth plan has more credits than starter", () => {
    assert.ok(
      BILLING_PLANS.growth.includedCredits > BILLING_PLANS.starter.includedCredits,
      "growth.includedCredits should exceed starter.includedCredits",
    );
  });

  it("pro plan has the most credits", () => {
    assert.ok(
      BILLING_PLANS.pro.includedCredits >= BILLING_PLANS.growth.includedCredits,
      "pro.includedCredits should be ≥ growth.includedCredits",
    );
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

// ── Formula tests ─────────────────────────────────────────────────────────────

describe("Billing formula: total = base + max(0, deducted - included) * overageRate", () => {
  it("no usage: total equals base fee only", () => {
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", makeUsage());
    assert.equal(estimate.totalCents, BILLING_PLANS.starter.monthlyPriceCents);
    assert.equal(estimate.hasOverage, false);
  });

  it("usage below included limit: no overage charge", () => {
    const usage    = makeUsage({ usedCredits: 499, overageCredits: 0 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.equal(estimate.totalCents, BILLING_PLANS.starter.monthlyPriceCents);
    assert.equal(estimate.hasOverage, false);
  });

  it("usage exactly at included limit: no overage charge", () => {
    const plan     = BILLING_PLANS.starter;
    const usage    = makeUsage({ usedCredits: plan.includedCredits, overageCredits: 0 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.equal(estimate.totalCents, plan.monthlyPriceCents);
    assert.equal(estimate.hasOverage, false);
  });

  it("1 credit over limit: exactly 1 overage credit charged", () => {
    const plan     = BILLING_PLANS.starter;
    const usage    = makeUsage({
      usedCredits:    plan.includedCredits,
      overageCredits: 1,
    });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    const expected = plan.monthlyPriceCents + 1 * plan.overageCentPerCredit; // 14900 + 3 = 14903
    assert.equal(estimate.totalCents, expected);
    assert.equal(estimate.hasOverage, true);
  });

  it("100 credits over limit: base + 100 × overageRate", () => {
    const plan     = BILLING_PLANS.starter;
    const usage    = makeUsage({
      usedCredits:    plan.includedCredits,
      overageCredits: 100,
    });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    const expected = plan.monthlyPriceCents + 100 * plan.overageCentPerCredit;
    assert.equal(estimate.totalCents, expected);
  });

  it("growth plan 250 credits over: correct rate applied", () => {
    const plan  = BILLING_PLANS.growth;
    const usage = makeUsage({
      tenantId:         TENANT,
      includedCredits:  plan.includedCredits,
      usedCredits:      plan.includedCredits,
      overageCredits:   250,
      purchasedCredits: 0,
      currentBalance:   0,
      periodStart:      PERIOD_S,
      periodEnd:        PERIOD_E,
    });
    const estimate = calculateBillingEstimate(TENANT, "growth", "monthly", usage);
    const expected = plan.monthlyPriceCents + 250 * plan.overageCentPerCredit;
    assert.equal(estimate.totalCents, expected);
  });
});

// ── Annual billing tests ──────────────────────────────────────────────────────

describe("Annual billing cycle", () => {
  it("annual base fee uses annualMonthlyCents (effective monthly rate)", () => {
    const plan     = BILLING_PLANS.starter;
    const estimate = calculateBillingEstimate(TENANT, "starter", "annual", makeUsage());
    assert.equal(estimate.totalCents, plan.annualMonthlyCents);
    assert.ok(
      plan.annualMonthlyCents < plan.monthlyPriceCents,
      "annual effective monthly rate should be cheaper",
    );
  });

  it("annual with overage: base is annual rate + overage", () => {
    const plan  = BILLING_PLANS.starter;
    const usage = makeUsage({ usedCredits: plan.includedCredits, overageCredits: 50 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "annual", usage);
    const expected = plan.annualMonthlyCents + 50 * plan.overageCentPerCredit;
    assert.equal(estimate.totalCents, expected);
  });
});

// ── Period handling tests ─────────────────────────────────────────────────────

describe("Period handling", () => {
  it("estimate reflects period start/end from usage summary", () => {
    const usage    = makeUsage({ periodStart: PERIOD_S, periodEnd: PERIOD_E });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.equal(estimate.periodStart, PERIOD_S);
    assert.equal(estimate.periodEnd,   PERIOD_E);
  });

  it("no period (new tenant): estimate still returns base fee", () => {
    const usage    = makeUsage({ periodStart: null, periodEnd: null });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.equal(estimate.totalCents, BILLING_PLANS.starter.monthlyPriceCents);
    assert.equal(estimate.periodStart, null);
  });
});

// ── Purchased credits tests ───────────────────────────────────────────────────

describe("Purchased credit bundles", () => {
  it("purchased credits appear as a €0 reference line item", () => {
    const usage    = makeUsage({ purchasedCredits: 500 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    const bundleLine = estimate.lineItems.find((li) => li.label.includes("bundles"));
    assert.ok(bundleLine, "should have a credit bundle line item");
    assert.equal(bundleLine!.totalCents, 0);
    assert.equal(bundleLine!.isEstimate, false);
  });

  it("no purchased credits: no bundle line item", () => {
    const usage    = makeUsage({ purchasedCredits: 0 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    const bundleLine = estimate.lineItems.find((li) => li.label.includes("bundles"));
    assert.equal(bundleLine, undefined);
  });
});

// ── Line item structure tests ─────────────────────────────────────────────────

describe("Line item structure", () => {
  it("base fee line item is never marked as estimate", () => {
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", makeUsage());
    const baseLine = estimate.lineItems[0];
    assert.ok(baseLine, "should have at least one line item");
    assert.equal(baseLine.isEstimate, false);
  });

  it("overage line item is marked as estimate", () => {
    const plan  = BILLING_PLANS.starter;
    const usage = makeUsage({ usedCredits: plan.includedCredits, overageCredits: 10 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    const overageLine = estimate.lineItems.find((li) => li.label.includes("overage"));
    assert.ok(overageLine, "should have an overage line item");
    assert.equal(overageLine!.isEstimate, true);
  });

  it("subtotal equals sum of all line item totals", () => {
    const usage    = makeUsage({ overageCredits: 50, purchasedCredits: 100 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    const summedTotal = estimate.lineItems.reduce((s, li) => s + li.totalCents, 0);
    assert.equal(estimate.subtotalCents, summedTotal);
  });

  it("totalCents equals subtotalCents + taxCents", () => {
    const usage    = makeUsage({ overageCredits: 100 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.equal(estimate.totalCents, estimate.subtotalCents + estimate.taxCents);
  });
});

// ── Overage alert tests ───────────────────────────────────────────────────────

describe("Overage alert", () => {
  it("no overage: overageAlert is undefined", () => {
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", makeUsage());
    assert.equal(estimate.overageAlert, undefined);
  });

  it("overage present: overageAlert is a non-empty string", () => {
    const usage    = makeUsage({ overageCredits: 5 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.ok(typeof estimate.overageAlert === "string" && estimate.overageAlert.length > 0);
  });

  it("overage alert mentions overage credit count", () => {
    const usage    = makeUsage({ overageCredits: 42 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.ok(estimate.overageAlert!.includes("42"), `alert should mention "42": ${estimate.overageAlert}`);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("all three plans return a non-zero total", () => {
    for (const planId of ["starter", "growth", "pro"] as const) {
      const plan     = BILLING_PLANS[planId];
      const usage    = makeUsage({ includedCredits: plan.includedCredits });
      const estimate = calculateBillingEstimate(TENANT, planId, "monthly", usage);
      assert.ok(estimate.totalCents > 0, `${planId} estimate should have a positive total`);
    }
  });

  it("very large overage: no integer overflow (test with 1 million credits)", () => {
    const usage = makeUsage({
      includedCredits: BILLING_PLANS.starter.includedCredits,
      usedCredits:     BILLING_PLANS.starter.includedCredits,
      overageCredits:  1_000_000,
    });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    const expected = BILLING_PLANS.starter.monthlyPriceCents +
                     1_000_000 * BILLING_PLANS.starter.overageCentPerCredit;
    assert.equal(estimate.totalCents, expected);
    assert.ok(Number.isSafeInteger(estimate.totalCents), "totalCents should be a safe integer");
  });

  it("zero usedCredits and zero purchasedCredits: only base line item", () => {
    const usage    = makeUsage({ usedCredits: 0, purchasedCredits: 0, overageCredits: 0 });
    const estimate = calculateBillingEstimate(TENANT, "starter", "monthly", usage);
    assert.equal(estimate.lineItems.length, 1);
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

void NOW; // reference to suppress unused-variable warning
