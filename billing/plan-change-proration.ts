/**
 * What an upgrade costs for the rest of the running period.
 *
 * The terms say a higher plan starts at once and is paid pro rata. Stripe
 * works that out itself for the subscriptions it manages. For a subscription
 * charged on a Mollie mandate the platform does: the difference between the
 * two monthly prices, for the part of the period that is still to come.
 *
 * Pure: no I/O.
 */

export interface ProrationInput {
  /** Price of the running plan for one period, in cents. */
  oldCents:    number;
  /** Price of the plan the tenant moves to, in cents. */
  newCents:    number;
  periodStart: string | null;
  periodEnd:   string | null;
  now?:        Date;
}

/**
 * The part of the period that is still to come, from 0 to 1.
 *
 * Without a usable period the whole difference is due: there is nothing to
 * divide by, and charging nothing would give the upgrade away.
 */
export function remainingFraction(periodStart: string | null, periodEnd: string | null, now: Date = new Date()): number {
  const start = periodStart ? new Date(periodStart).getTime() : Number.NaN;
  const end   = periodEnd   ? new Date(periodEnd).getTime()   : Number.NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;
  const left = (end - now.getTime()) / (end - start);
  return Math.min(1, Math.max(0, left));
}

/**
 * The amount to collect now for an upgrade, in whole cents. Zero when the new
 * plan is not dearer, and zero when the period has run out: the renewal that
 * follows charges the new price in full.
 */
export function upgradeProrationCents(input: ProrationInput): number {
  const difference = input.newCents - input.oldCents;
  if (!(difference > 0)) return 0;
  return Math.round(difference * remainingFraction(input.periodStart, input.periodEnd, input.now));
}
