/**
 * GET /api/cron/billing-renewal
 *
 * Daily subscription lifecycle cron job.
 *
 * ─── What it does ─────────────────────────────────────────────────────────────
 *
 *   Pass 1 — expired active/trialing subscriptions (manually-managed):
 *     For each subscription where status IN ('active','trialing') AND
 *     current_period_end < now() AND stripe_subscription_id IS NULL:
 *
 *       a. cancel_at_period_end = true  → mark canceled
 *       b. Otherwise:
 *            i.  Attempt Stripe charge for the plan price
 *            ii. Charge succeeds  → activate pending plan + advance period
 *            iii.Charge fails     → mark past_due + send dunning email
 *
 *   Pass 2 — escalate quarantined past_due subs to unpaid:
 *     For each subscription where status = 'past_due' AND
 *     payment_due_since + quarantine_days < now():
 *       → mark status = "unpaid" (service blocked)
 *
 *   Pass 3 — expired trials:
 *     status = "trialing" AND trial_end < now() AND current_period_end IS NULL
 *       → mark canceled
 *
 *   Stripe-backed subscriptions (stripe_subscription_id IS NOT NULL) are skipped
 *   — Stripe manages their renewal and dunning automatically via webhooks.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Authenticated via CRON_SECRET header (Bearer token).
 *   Set CRON_SECRET in env.  Configure your cron provider (e.g. Vercel Cron,
 *   GitHub Actions, or an external scheduler) to pass it as:
 *     Authorization: Bearer <CRON_SECRET>
 *
 *   In development, CRON_SECRET is optional — the endpoint accepts requests
 *   without auth when NODE_ENV !== "production".
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Trigger daily (e.g. 00:05 UTC):
 *     GET https://your-app.com/api/cron/billing-renewal
 *     Authorization: Bearer <CRON_SECRET>
 *
 *   Vercel cron (vercel.json):
 *     { "path": "/api/cron/billing-renewal", "schedule": "5 0 * * *" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { renewSubscriptionPeriod, syncPackageKeyFromPlan } from "@/billing/subscriptions";
import { BILLING_PLANS }             from "@/billing/plans";
import { attemptSubscriptionCharge } from "@/billing/subscription-charge";
import {
  markTenantPastDue,
  markTenantUnpaid,
  sendDunningEmail,
  getTenantDunningSettings,
}                                    from "@/billing/dunning";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SubRow {
  id:                         string;
  tenant_id:                  string;
  plan:                       string;
  status:                     string;
  billing_cycle:              string;
  current_period_end:         string | null;
  trial_end:                  string | null;
  cancel_at_period_end:       boolean;
  pending_plan:               string | null;
  pending_plan_billing_cycle: string | null;
  pending_plan_paid_at:       string | null;
  stripe_subscription_id:     string | null;
  payment_due_since:          string | null;
}

interface RenewalResult {
  tenantId: string;
  action:   | "renewed"
            | "plan_activated"
            | "annual_to_monthly"
            | "canceled"
            | "trial_expired"
            | "past_due"
            | "unpaid_escalated";
  error?:   string;
}

// ── Auth helper ────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env["CRON_SECRET"];
  if (process.env["NODE_ENV"] !== "production" && !cronSecret) return true;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

// ── Price helper ───────────────────────────────────────────────────────────────

function getPlanPriceCents(planId: string, billingCycle: string): number {
  const plan = BILLING_PLANS[planId as keyof typeof BILLING_PLANS];
  if (!plan) return 0;
  // Annual billing: charge the annual total once, otherwise monthly.
  return billingCycle === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseSrvc) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseSrvc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now     = new Date().toISOString();
  const results: RenewalResult[] = [];

  // ── Pass 1: expired active/trialing subscriptions ─────────────────────────────

  const { data: expiredSubs, error: fetchErr } = await client
    .from("subscriptions")
    .select(
      "id, tenant_id, plan, status, billing_cycle, current_period_end, " +
      "trial_end, cancel_at_period_end, pending_plan, pending_plan_billing_cycle, " +
      "pending_plan_paid_at, stripe_subscription_id, payment_due_since",
    )
    .in("status", ["active", "trialing"])
    .lt("current_period_end", now)
    .is("stripe_subscription_id", null);   // manually-managed only

  if (fetchErr) {
    console.error("[billing-renewal] Failed to fetch expired subscriptions:", fetchErr.message);
    return NextResponse.json(
      { error: `Database error: ${fetchErr.message}` },
      { status: 500 },
    );
  }

  for (const sub of (expiredSubs ?? []) as unknown as SubRow[]) {
    const { tenant_id } = sub;

    // ── a. Cancel-at-period-end → mark canceled ──────────────────────────────
    if (sub.cancel_at_period_end) {
      const { error } = await client
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: now, updated_at: now })
        .eq("tenant_id", tenant_id);

      results.push({ tenantId: tenant_id, action: "canceled", error: error?.message });
      if (!error) await syncPackageKeyFromPlan(client, tenant_id, null).catch(() => {});
      console.info(`[billing-renewal] canceled: tenant=${tenant_id}`);
      continue;
    }

    // ── b. Determine plan and amount for this renewal ────────────────────────
    const activePlan  = sub.pending_plan ?? sub.plan;
    const activeCycle = sub.pending_plan_billing_cycle ?? sub.billing_cycle;
    const amountCents = getPlanPriceCents(activePlan, activeCycle);

    // ── c. Attempt Stripe charge (skip when first period was pre-paid) ────────
    //
    // When the tenant upgraded via one-time Stripe Checkout, payment for the
    // first period of the new plan was already collected and pending_plan_paid_at
    // is set.  In that case we skip charging to avoid a double-charge.
    const planLabel    = BILLING_PLANS[activePlan as keyof typeof BILLING_PLANS]?.name ?? activePlan;
    const isPrepaid    = Boolean(sub.pending_plan_paid_at);
    const chargeResult = (amountCents > 0 && !isPrepaid)
      ? await attemptSubscriptionCharge(
          client,
          tenant_id,
          amountCents,
          `Subscription renewal — ${planLabel}`,
        )
      : { ok: true as const, paymentIntentId: isPrepaid ? "pre_paid_plan_change" : "no_charge_starter" };

    if (!chargeResult.ok) {
      // ── Charge failed → mark past_due + send dunning email ────────────────
      console.warn(
        `[billing-renewal] Charge failed: tenant=${tenant_id} ` +
        `plan=${activePlan} amount=${amountCents} error=${chargeResult.error}`,
      );

      try {
        await markTenantPastDue(client, tenant_id);

        // Compute quarantine end date for the dunning email.
        const dunningSettings  = await getTenantDunningSettings(client, tenant_id);
        const paymentDueSince  = new Date();
        const quarantineEnd    = new Date(
          paymentDueSince.getTime() + dunningSettings.quarantine_days * 24 * 60 * 60 * 1000,
        );

        await sendDunningEmail(client, tenant_id, {
          planName:      planLabel,
          amountCents,
          dueDate:       paymentDueSince.toISOString(),
          quarantineEnd: quarantineEnd.toISOString(),
        });
      } catch (dunningErr) {
        console.error(
          `[billing-renewal] Dunning steps failed: tenant=${tenant_id}`,
          dunningErr,
        );
      }

      results.push({
        tenantId: tenant_id,
        action:   "past_due",
        error:    chargeResult.error,
      });
      continue;
    }

    // ── d. Charge succeeded → advance the billing period ────────────────────
    const isAnnual = activeCycle === "annual";

    if (isAnnual && !sub.pending_plan) {
      // Annual → convert to monthly same plan.
      const periodStart = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
      const periodEnd   = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error } = await client
        .from("subscriptions")
        .update({
          billing_cycle:        "monthly",
          status:               "active",
          current_period_start: periodStart.toISOString(),
          current_period_end:   periodEnd.toISOString(),
          // Clear any stale dunning state in case this tenant paid late
          payment_due_since:     null,
          dunning_email_sent_at: null,
          updated_at:           now,
        })
        .eq("tenant_id", tenant_id);

      results.push({ tenantId: tenant_id, action: "annual_to_monthly", error: error?.message });
      console.info(`[billing-renewal] annual→monthly: tenant=${tenant_id}`);
      continue;
    }

    // Standard monthly renewal (or annual with pending downgrade).
    const renewal = await renewSubscriptionPeriod(client, tenant_id, { force: true });
    const action  = sub.pending_plan ? "plan_activated" : "renewed";

    // Also clear any dunning state (in case this is a recovered past_due sub).
    if (renewal.ok) {
      await client
        .from("subscriptions")
        .update({ payment_due_since: null, dunning_email_sent_at: null })
        .eq("tenant_id", tenant_id);
    }

    results.push({
      tenantId: tenant_id,
      action,
      error:    renewal.ok ? undefined : renewal.error,
    });

    if (renewal.ok) {
      console.info(
        `[billing-renewal] ${action}: tenant=${tenant_id} nextEnd=${renewal.current_period_end}`,
      );
    } else {
      console.error(`[billing-renewal] renewal failed: tenant=${tenant_id} err=${renewal.error}`);
    }
  }

  // ── Pass 2: escalate past_due → unpaid after quarantine expires ───────────────

  const { data: pastDueSubs, error: pastDueErr } = await client
    .from("subscriptions")
    .select("tenant_id, payment_due_since")
    .eq("status", "past_due")
    .is("stripe_subscription_id", null)
    .not("payment_due_since", "is", null);

  if (pastDueErr) {
    console.error("[billing-renewal] Failed to fetch past_due subscriptions:", pastDueErr.message);
  } else {
    for (const sub of (pastDueSubs ?? []) as Pick<SubRow, "tenant_id" | "payment_due_since">[]) {
      if (!sub.payment_due_since) continue;

      // Fetch per-tenant quarantine_days setting.
      let quarantineDays = 8; // default
      try {
        const ds = await getTenantDunningSettings(client, sub.tenant_id);
        quarantineDays = ds.quarantine_days;
      } catch { /* use default */ }

      const dueAt   = new Date(sub.payment_due_since);
      const blockAt = new Date(dueAt.getTime() + quarantineDays * 24 * 60 * 60 * 1000);

      if (blockAt <= new Date()) {
        try {
          await markTenantUnpaid(client, sub.tenant_id);
          results.push({ tenantId: sub.tenant_id, action: "unpaid_escalated" });
          console.info(`[billing-renewal] unpaid_escalated: tenant=${sub.tenant_id}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push({ tenantId: sub.tenant_id, action: "unpaid_escalated", error: msg });
          console.error(`[billing-renewal] escalation failed: tenant=${sub.tenant_id} err=${msg}`);
        }
      }
    }
  }

  // ── Pass 3: expired trials ─────────────────────────────────────────────────────

  const { data: expiredTrials, error: trialFetchErr } = await client
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("status", "trialing")
    .lt("trial_end", now)
    .is("stripe_subscription_id", null)
    .is("current_period_end", null);

  if (trialFetchErr) {
    console.error("[billing-renewal] Failed to fetch expired trials:", trialFetchErr.message);
  } else {
    for (const trial of (expiredTrials ?? []) as Pick<SubRow, "id" | "tenant_id">[]) {
      const { error } = await client
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: now, updated_at: now })
        .eq("tenant_id", trial.tenant_id);

      results.push({
        tenantId: trial.tenant_id,
        action:   "trial_expired",
        error:    error?.message,
      });

      if (!error) {
        await syncPackageKeyFromPlan(client, trial.tenant_id, null).catch(() => {});
      }

      console.info(`[billing-renewal] trial_expired: tenant=${trial.tenant_id}`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────────

  const processed = results.length;
  const errors    = results.filter((r) => r.error).length;

  console.info(
    `[billing-renewal] complete: processed=${processed} errors=${errors} at=${now}`,
  );

  return NextResponse.json({ ok: errors === 0, processed, errors, results, ranAt: now });
}
