/**
 * billing/calculator.ts
 *
 * Billing calculation engine.
 *
 * ─── What this calculates ─────────────────────────────────────────────────────
 *
 *   1. Base subscription fee (from plan + billing cycle)
 *   2. Enrichment credit overages (credits used beyond the included allowance)
 *   3. Monthly estimate for the current billing period
 *
 * ─── Key design decisions ─────────────────────────────────────────────────────
 *
 *   • Stripe is the source of truth for what has actually been invoiced.
 *   • This calculator is used for:
 *       a) Real-time estimate displayed in the admin billing panel
 *       b) Pre-billing sanity checks
 *       c) Overage alerts
 *   • All amounts are in euro cents to avoid floating-point issues.
 *
 * ─── Client safety ────────────────────────────────────────────────────────────
 *
 *   calculateBillingEstimate() is a pure function — no DB, no Stripe SDK,
 *   no env var access.  Safe to use server-side or client-side.
 *
 *   Display helpers (creditUsagePercent, shouldWarnOverage, daysRemainingInPeriod)
 *   have been moved to billing/format.ts and are re-exported here for backwards
 *   compatibility.
 */

import type { BillingPlanId, BillingCycle, BillingEstimate, BillingLineItem, UsageSummary } from "./types";
import { BILLING_PLANS }   from "./plans";
import { formatCents }     from "./format";

// Re-export types for consumers that imported them from here
export type { BillingLineItem, BillingEstimate };

// Re-export display helpers — moved to format.ts; re-exported for backwards compat
export { creditUsagePercent, shouldWarnOverage, daysRemainingInPeriod } from "./format";

// ── Calculator ─────────────────────────────────────────────────────────────────

/**
 * Calculate the billing estimate for a tenant for the current period.
 *
 * @param tenantId     Tenant identifier
 * @param planId       Current plan ID
 * @param cycle        Billing cycle ("monthly" or "annual")
 * @param usage        Usage summary from getUsageSummary()
 */
export function calculateBillingEstimate(
  tenantId: string,
  planId:   BillingPlanId,
  cycle:    BillingCycle,
  usage:    UsageSummary,
): BillingEstimate {
  const plan       = BILLING_PLANS[planId];
  const lineItems: BillingLineItem[] = [];

  // ── Base subscription fee ───────────────────────────────────────────────────

  const baseCents =
    cycle === "annual"
      ? plan.annualMonthlyCents   // effective monthly rate for annual billing
      : plan.monthlyPriceCents;

  lineItems.push({
    label:      `${plan.name} plan (${cycle === "annual" ? "billed annually" : "monthly"})`,
    quantity:   1,
    unitCents:  baseCents,
    totalCents: baseCents,
    isEstimate: false,
  });

  // ── Credit usage (informational reference line) ──────────────────────────────
  //
  // Credits are a separate consumable — not included in the plan fee and not
  // billed as overages.  Bundle purchases are paid at checkout.  We include
  // the period spend as a €0 reference line so the estimate shows activity.

  if (usage.usedCredits > 0) {
    lineItems.push({
      label:      `Enrichment credits used this period (${usage.usedCredits.toLocaleString()} cr)`,
      quantity:   null,
      unitCents:  null,
      totalCents: 0,
      isEstimate: false,
    });
  }

  if (usage.purchasedCredits > 0) {
    lineItems.push({
      label:      `Credit bundles purchased this period (+${usage.purchasedCredits.toLocaleString()} cr)`,
      quantity:   null,
      unitCents:  null,
      totalCents: 0,
      isEstimate: false,
    });
  }

  // ── Totals ───────────────────────────────────────────────────────────────────

  const subtotalCents = lineItems.reduce((acc, item) => acc + item.totalCents, 0);
  const taxCents      = 0; // implement tax calculation when required
  const totalCents    = subtotalCents + taxCents;

  return {
    tenantId,
    planId,
    billingCycle:   cycle,
    periodStart:    usage.periodStart,
    periodEnd:      usage.periodEnd,
    lineItems,
    subtotalCents,
    taxCents,
    totalCents,
    formattedTotal: formatCents(totalCents),
    hasOverage:     false,
    overageAlert:   undefined,
  };
}
