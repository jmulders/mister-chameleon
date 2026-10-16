/**
 * Dunning resolution for the snippet decide payment gate.
 *
 * The per-tenant quarantine_days only changes the outcome of getDunningState
 * for a `past_due` subscription that has a payment_due_since date: `unpaid` is
 * always blocked and every other status is always served. So the dunning
 * settings are only read in that one case instead of on every pageview.
 */

import { getDunningState, type DunningState } from "@/billing/dunning";

export interface SubscriptionGateRow {
  status:            string;
  payment_due_since: string | null;
}

export async function resolveSubscriptionDunning(
  sub:                SubscriptionGateRow,
  loadQuarantineDays: () => Promise<number>,
): Promise<DunningState> {
  if (sub.status !== "past_due" || !sub.payment_due_since) {
    return getDunningState(sub.status, sub.payment_due_since);
  }
  let quarantineDays: number | undefined;
  try {
    quarantineDays = await loadQuarantineDays();
  } catch { /* getDunningState falls back to its default */ }
  return getDunningState(sub.status, sub.payment_due_since, quarantineDays);
}
