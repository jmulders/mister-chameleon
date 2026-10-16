/**
 * Dunning resolution for the snippet decide payment gate.
 *
 * The per-tenant quarantine_days only changes the outcome of getDunningState
 * for a `past_due` subscription that has a payment_due_since date: `unpaid` is
 * always blocked and every other status is always served. So the dunning
 * settings are only read in that one case instead of on every pageview.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
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

/**
 * The subscription payment gate shared by every content-serving endpoint
 * (snippet decide, v1/slot). Returns null when the tenant has no subscription
 * row, which means "serve normally". Throws on a read failure; callers log and
 * continue, because a gate error must never block service.
 *
 * Deliberately not cached, so clearing dunning (webhook) takes effect on the
 * very next call.
 */
export async function loadPaymentGate(
  db:                 SupabaseClient,
  tenantId:           string,
  loadQuarantineDays: () => Promise<number>,
): Promise<DunningState | null> {
  const { data } = await db
    .from("subscriptions")
    .select("status, payment_due_since")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const sub = data as { status?: unknown; payment_due_since?: unknown } | null;
  if (!sub || typeof sub.status !== "string") return null;
  return resolveSubscriptionDunning(
    {
      status:            sub.status,
      payment_due_since: typeof sub.payment_due_since === "string" ? sub.payment_due_since : null,
    },
    loadQuarantineDays,
  );
}
