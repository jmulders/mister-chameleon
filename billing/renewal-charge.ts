/**
 * What a renewal of a manually managed subscription costs, and what it buys.
 *
 * The renewal cron charged first and worked out the new period afterwards,
 * from two separate readings of the billing cycle. For an annual subscription
 * those disagreed: it charged the annual price and then moved the subscription
 * to monthly with a one-month period. A Growth customer paid €3,348 for a
 * month that costs €349.
 *
 * The rule the cron already applied to the period stays: an annual term is not
 * renewed for another year without being asked. After the year the same plan
 * continues per month. This function makes the charge follow that same
 * decision, so the two cannot disagree again.
 *
 * Pure: no I/O.
 */
import { BILLING_PLANS } from "./plans";

export interface RenewableSubscription {
  plan:                       string;
  billing_cycle:              string | null;
  pending_plan:               string | null;
  pending_plan_billing_cycle: string | null;
}

export interface RenewalCharge {
  /** The plan that is active after this renewal. */
  plan:              string;
  /** The cycle the next period runs on, which is also what is charged. */
  cycle:             "monthly" | "annual";
  amountCents:       number;
  /** True when an annual term ends here and continues per month. */
  annualToMonthly:   boolean;
}

function priceCents(planId: string, cycle: "monthly" | "annual"): number {
  const plan = BILLING_PLANS[planId as keyof typeof BILLING_PLANS];
  if (!plan) return 0;
  return cycle === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
}

export function renewalCharge(sub: RenewableSubscription): RenewalCharge {
  const plan      = sub.pending_plan ?? sub.plan;
  const rawCycle  = sub.pending_plan_billing_cycle ?? sub.billing_cycle;
  const isAnnual  = rawCycle === "annual";

  // An annual term without a scheduled change continues per month. A scheduled
  // change (pending_plan) is applied as the customer chose it, annual included.
  const annualToMonthly = isAnnual && !sub.pending_plan;
  const cycle: "monthly" | "annual" = isAnnual && !annualToMonthly ? "annual" : "monthly";

  return { plan, cycle, amountCents: priceCents(plan, cycle), annualToMonthly };
}

/**
 * The Stripe idempotency key for one renewal of one period.
 *
 * Two cron runs that overlap, or a run that is retried after a timeout, send
 * the same key, and Stripe then returns the first payment instead of taking a
 * second one. The period end is part of the key, so the next period gets its
 * own.
 */
export function renewalIdempotencyKey(tenantId: string, currentPeriodEnd: string | null): string {
  return `renewal:${tenantId}:${currentPeriodEnd ?? "none"}`;
}
