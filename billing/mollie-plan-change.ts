/**
 * Changing the plan of a subscription that is charged on a Mollie mandate.
 *
 * With Mollie the plan is the platform's own record, and the renewal job
 * charges its price on the mandate (mollie-renewal.ts). There is no Stripe
 * subscription to swap a price on. A change is one of three things:
 *
 *   on trial     the plan changes now. Nothing is charged: the trial's end
 *                charges whatever plan is there then.
 *   upgrade      the plan changes now, and the difference for the rest of the
 *                period is collected from the mandate, as the terms say.
 *   downgrade    scheduled for the next period. The renewal charges the new
 *                price then. Nothing is paid back for the running period.
 *
 * The route (app/api/billing/change-plan) checks who is asking. This file
 * decides and does, so it can be exercised without a session.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { BILLING_PLANS } from "./plans";
import { syncPackageKeyFromPlan } from "./subscriptions";
import { mollieReloadSource } from "./mollie-auto-reload";
import { chargeMollieRenewal, noteRenewalAdvanced, type MollieRenewalResult } from "./mollie-renewal";
import { upgradeProrationCents } from "./plan-change-proration";
import { upgradeDescription } from "./mollie-invoicing";
import type { MollieDeps } from "./mollie";

const PLAN_TIER: Record<string, number> = { starter: 0, growth: 1, pro: 2 };

export interface MolliePlanChangeSub {
  status:                       string;
  plan:                         string | null;
  billing_cycle:                string | null;
  current_period_start?:        string | null;
  current_period_end:           string | null;
  pending_plan:                 string | null;
  pending_plan_effective_date?: string | null;
}

export type MolliePlanChange =
  | { ok: true;  effectiveNextPeriod: boolean; effectiveDate?: string | null; chargedCents?: number }
  | { ok: false; status: number; error: string; restriction: string };

/** What kind of change this is. Pure. */
export function planChangeKind(
  sub: Pick<MolliePlanChangeSub, "status" | "plan">,
  newPlanId: string,
): "same" | "trial" | "upgrade" | "downgrade" {
  const current = sub.plan ?? "starter";
  if (current === newPlanId) return "same";
  if (sub.status === "trialing") return "trial";
  return (PLAN_TIER[newPlanId] ?? -1) > (PLAN_TIER[current] ?? -1) ? "upgrade" : "downgrade";
}

function monthlyCents(planId: string): number {
  return BILLING_PLANS[planId as keyof typeof BILLING_PLANS]?.monthlyPriceCents ?? 0;
}

export async function changePlanViaMollie(
  client: SupabaseClient,
  input:  { tenantId: string; newPlanId: string; billingCycle: string; sub: MolliePlanChangeSub },
  deps?:  { mollie?: MollieDeps; now?: Date },
): Promise<MolliePlanChange> {
  const { tenantId, newPlanId, billingCycle, sub } = input;

  if (billingCycle !== "monthly" || (sub.billing_cycle ?? "monthly") !== "monthly") {
    return { ok: false, status: 400, error: "Annual billing is not available with this payment method yet.", restriction: "annual_not_available" };
  }
  if (sub.pending_plan) {
    const effectiveDateStr = sub.pending_plan_effective_date
      ? new Date(sub.pending_plan_effective_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "your next billing period";
    return {
      ok: false, status: 400, restriction: "pending_change_in_progress",
      error:
        `A plan change to ${sub.pending_plan} is already scheduled for ${effectiveDateStr}. ` +
        `Wait for it to take effect before requesting another change.`,
    };
  }

  const kind          = planChangeKind(sub, newPlanId);
  const currentPlanId = sub.plan ?? "starter";
  const now           = deps?.now ?? new Date();
  const nowIso        = now.toISOString();

  if (kind === "same") {
    return { ok: false, status: 400, error: "This is already your plan.", restriction: "same_plan" };
  }

  const switchNow = async () => {
    await client.from("subscriptions").update({ plan: newPlanId, billing_cycle: "monthly", updated_at: nowIso }).eq("tenant_id", tenantId);
    await syncPackageKeyFromPlan(client, tenantId, newPlanId);
  };

  // On trial: nothing has been paid yet, so nothing is settled.
  if (kind === "trial") {
    await switchNow();
    return { ok: true, effectiveNextPeriod: false };
  }

  // Downgrade: at the next period.
  if (kind === "downgrade") {
    await client
      .from("subscriptions")
      .update({
        pending_plan:                newPlanId,
        pending_plan_billing_cycle:  "monthly",
        pending_plan_effective_date: sub.current_period_end,
        updated_at:                  nowIso,
      })
      .eq("tenant_id", tenantId);
    return { ok: true, effectiveNextPeriod: true, effectiveDate: sub.current_period_end };
  }

  // Upgrade: collect the difference for the rest of the period, then switch.
  const dueCents = upgradeProrationCents({
    oldCents:    monthlyCents(currentPlanId),
    newCents:    monthlyCents(newPlanId),
    periodStart: sub.current_period_start ?? null,
    periodEnd:   sub.current_period_end,
    now,
  });

  // What the tenant is charged: the difference plus VAT. Known after the charge.
  let chargedCents = 0;

  if (dueCents > 0) {
    if (!(await mollieReloadSource(client, tenantId, deps?.mollie))) {
      return {
        ok: false, status: 400, restriction: "no_payment_method",
        error: "There is no payment method on file to collect the upgrade from. Set one up first, in your billing dashboard.",
      };
    }
    const planLabel = BILLING_PLANS[newPlanId as keyof typeof BILLING_PLANS]?.name ?? newPlanId;
    // The charge is keyed on this moment: it is its own entry next to the
    // period's renewal.
    const charge: MollieRenewalResult = await chargeMollieRenewal(client, {
      tenantId,
      periodEnd:      nowIso,
      amountCents:    dueCents,
      plan:           newPlanId,
      cycle:          "monthly",
      description:    `Mister Chameleon: upgrade to ${planLabel}, rest of the period`,
      invoiceDescription: upgradeDescription(newPlanId),
      idempotencyKey: `upgrade:${tenantId}:${currentPlanId}:${newPlanId}:${sub.current_period_end ?? "none"}`,
    }, deps?.mollie);
    if (!charge.ok) {
      // Nothing was upgraded, so nothing is owed: the entry of the failed
      // charge must not show up later as an open payment.
      await client.from("mollie_renewals").delete().match({ tenant_id: tenantId, period_end: nowIso }).eq("status", "failed");
      return { ok: false, status: 402, error: `The upgrade could not be collected: ${charge.error}`, restriction: "charge_failed" };
    }
    // The plan changes with the charge. If the bank refuses the debit later
    // the tenant goes past due for this amount, like for any other charge.
    await noteRenewalAdvanced(client, tenantId, nowIso);
    chargedCents = charge.chargedCents ?? dueCents;
  }

  await switchNow();
  return { ok: true, effectiveNextPeriod: false, chargedCents };
}
