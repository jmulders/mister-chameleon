/**
 * billing/format.ts
 *
 * Pure formatting and display utility functions for billing data.
 *
 * ─── Client safety ────────────────────────────────────────────────────────────
 *
 *   ALL functions in this file are pure — no env var access, no Supabase,
 *   no Stripe SDK.  Safe to import in client components, server components,
 *   API routes, and tests.
 *
 * ─── What lives here ─────────────────────────────────────────────────────────
 *
 *   • formatCents()              — euro cents → formatted currency string
 *   • annualSavingPercent()      — compute annual discount percentage
 *   • creditUsagePercent()       — credit usage as 0–100 percentage
 *   • shouldWarnOverage()        — true when > 80% of allowance is consumed
 *   • daysRemainingInPeriod()    — days left before billing period closes
 *
 * ─── What does NOT live here ─────────────────────────────────────────────────
 *
 *   Business logic, DB calls, env var reads, and Stripe SDK calls stay in
 *   plans.ts, calculator.ts, usage.ts, and stripe.ts respectively.
 */

import type { BillingPlan, UsageSummary } from "./types";

// ── Currency formatting ────────────────────────────────────────────────────────

/**
 * Format euro cents as a localised currency string.
 *
 * @example
 *   formatCents(14900)           → "€ 149,00"
 *   formatCents(3, "EUR", "en")  → "€0.03"
 */
export function formatCents(
  cents:    number,
  currency = "EUR",
  locale   = "nl-NL",
): string {
  return new Intl.NumberFormat(locale, {
    style:    "currency",
    currency,
  }).format(cents / 100);
}

// ── Plan helpers ───────────────────────────────────────────────────────────────

/**
 * Annual saving percentage vs paying monthly for 12 months.
 *
 * @example
 *   annualSavingPercent(growthPlan) → 20
 */
export function annualSavingPercent(plan: BillingPlan): number {
  const monthlyTotal = plan.monthlyPriceCents * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - plan.annualPriceCents) / monthlyTotal) * 100);
}

// ── Usage display helpers ──────────────────────────────────────────────────────

/**
 * Percentage of included credits used (0–100, capped for display).
 * Values above 100 indicate overage and are capped to 100 for the bar width.
 *
 * @example
 *   creditUsagePercent({ usedCredits: 400, includedCredits: 500, ... }) → 80
 */
/**
 * Always returns 0 — no longer meaningful under Option B (no included allowance).
 * Kept for backwards compatibility with callers; safe to remove once all call
 * sites have been updated.
 */
export function creditUsagePercent(_usage: UsageSummary): number {
  return 0;
}

/**
 * Always returns false — no overage billing under Option B model.
 */
export function shouldWarnOverage(_usage: UsageSummary): boolean {
  return false;
}

/**
 * Days remaining until the current billing period closes.
 * Returns null if no period end date is set (e.g. unsubscribed tenant).
 */
export function daysRemainingInPeriod(usage: UsageSummary): number | null {
  if (!usage.periodEnd) return null;
  const end  = new Date(usage.periodEnd).getTime();
  const diff = end - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
