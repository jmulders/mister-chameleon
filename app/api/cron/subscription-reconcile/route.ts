/**
 * GET /api/cron/subscription-reconcile
 *
 * Safety-net reconciliation for Stripe-backed subscriptions.
 *
 * ─── Why ──────────────────────────────────────────────────────────────────────
 *
 *   Stripe-backed subscriptions are normally kept in sync by webhooks
 *   (customer.subscription.updated, invoice.*). But a webhook can be missed:
 *   the endpoint was misconfigured, the platform was in the wrong Stripe mode,
 *   or an event carried no tenant metadata. When that happens the DB row silently
 *   drifts from Stripe (e.g. a trial that already converted still shows
 *   "trialing" with an expired period).
 *
 *   This cron pulls the authoritative status from Stripe for every Stripe-backed
 *   subscription and reconciles the row, so a missed webhook self-heals on the
 *   next run instead of stranding a tenant. It also back-stamps missing
 *   tenant_id / plan_id metadata onto the Stripe subscription so future webhooks
 *   resolve correctly.
 *
 * ─── What it does per subscription ────────────────────────────────────────────
 *
 *   1. Retrieve the live Stripe subscription. Skip on not-found or a livemode
 *      that does not match the platform's resolved mode (cannot safely touch it).
 *   2. Back-stamp metadata.tenant_id / plan_id if absent.
 *   3. Update status / period dates / cancel flags when they drift.
 *   4. Apply dunning side effects: past_due → markTenantPastDue,
 *      unpaid → markTenantUnpaid + disable tenant, active/trialing → clear a
 *      prior payment-failure lock. Sync packageKey to the plan.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Authenticated via CRON_SECRET (Bearer). In development CRON_SECRET is
 *   optional. Suggested schedule: hourly or a few times a day.
 *     Vercel cron: { "path": "/api/cron/subscription-reconcile", "schedule": "0 * * * *" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import Stripe                        from "stripe";
import { STRIPE_API_VERSION }        from "@/billing/stripe-config";
import { subscriptionPeriod }        from "@/billing/stripe";
import { syncPackageKeyFromPlan }    from "@/billing/subscriptions";
import { markTenantPastDue, markTenantUnpaid } from "@/billing/dunning";
import { resolveStripeCredentials }  from "@/platform/platform-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env["CRON_SECRET"];
  if (process.env["NODE_ENV"] !== "production" && !cronSecret) return true;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

interface ReconcileRow {
  tenant_id:              string;
  plan:                   string | null;
  status:                 string | null;
  stripe_subscription_id: string | null;
  current_period_end:     string | null;
}

type ReconcileOutcome =
  | "in_sync" | "updated" | "metadata_stamped" | "skipped_livemode"
  | "not_found_in_stripe" | "error";

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

  const { secretKey, mode } = await resolveStripeCredentials();
  if (!secretKey) {
    return NextResponse.json({ skipped: "no_stripe_secret_key", reconciled: 0 });
  }
  const stripe       = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION, typescript: true });
  const expectedLive = mode === "live";

  const { data: rows, error: fetchErr } = await client
    .from("subscriptions")
    .select("tenant_id, plan, status, stripe_subscription_id, current_period_end")
    .not("stripe_subscription_id", "is", null);

  if (fetchErr) {
    return NextResponse.json({ error: `Database error: ${fetchErr.message}` }, { status: 500 });
  }

  const results: Array<{ tenantId: string; outcome: ReconcileOutcome; detail?: string }> = [];

  for (const row of (rows ?? []) as ReconcileRow[]) {
    const subId = row.stripe_subscription_id;
    if (!subId) continue;
    try {
      const sub = await stripe.subscriptions.retrieve(subId);

      // Cannot safely touch a subscription from the other Stripe mode.
      if (sub.livemode !== expectedLive) {
        results.push({ tenantId: row.tenant_id, outcome: "skipped_livemode" });
        continue;
      }

      // Back-stamp missing metadata so future webhooks resolve the tenant.
      const md = sub.metadata ?? {};
      if (!md["tenant_id"] || !md["plan_id"]) {
        try {
          await stripe.subscriptions.update(subId, {
            metadata: {
              ...md,
              tenant_id: md["tenant_id"] || row.tenant_id,
              plan_id:   md["plan_id"]   || row.plan || "starter",
            },
          });
          results.push({ tenantId: row.tenant_id, outcome: "metadata_stamped" });
        } catch (metaErr) {
          console.warn(`[subscription-reconcile] metadata stamp failed for ${subId}:`, metaErr);
        }
      }

      const period = subscriptionPeriod(sub as unknown as Parameters<typeof subscriptionPeriod>[0]);
      const desired = {
        status:               sub.status,
        current_period_start: new Date(period.start * 1000).toISOString(),
        current_period_end:   period.end != null ? new Date(period.end * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        canceled_at:          sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      };

      const drifted = row.status !== desired.status || row.current_period_end !== desired.current_period_end;

      if (drifted) {
        await client
          .from("subscriptions")
          .update({ ...desired, updated_at: new Date().toISOString() })
          .eq("tenant_id", row.tenant_id);

        // Dunning / lifecycle side effects, mirroring the webhook handlers.
        if (sub.status === "past_due")      await markTenantPastDue(client, row.tenant_id);
        else if (sub.status === "unpaid") {
          await markTenantUnpaid(client, row.tenant_id);
          await client.from("tenant_settings").update({ is_active_override: false }).eq("tenant_id", row.tenant_id);
        } else if (sub.status === "active" || sub.status === "trialing") {
          // Payment resolved → clear a prior payment-failure lock (leave manual overrides).
          await client
            .from("tenant_settings")
            .update({ is_active_override: null })
            .eq("tenant_id", row.tenant_id)
            .eq("is_active_override", false);
        }

        const planId = md["plan_id"] || row.plan;
        if (planId) await syncPackageKeyFromPlan(client, row.tenant_id, planId);

        results.push({ tenantId: row.tenant_id, outcome: "updated", detail: `${row.status} -> ${desired.status}` });
      } else {
        results.push({ tenantId: row.tenant_id, outcome: "in_sync" });
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "resource_missing") {
        results.push({ tenantId: row.tenant_id, outcome: "not_found_in_stripe" });
      } else {
        console.error(`[subscription-reconcile] error for ${subId}:`, err);
        results.push({ tenantId: row.tenant_id, outcome: "error", detail: (err as Error).message });
      }
    }
  }

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ reconciled: results.length, summary, results });
}
