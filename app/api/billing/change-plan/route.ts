/**
 * POST /api/billing/change-plan
 *
 * Upgrade or downgrade a tenant's active Stripe subscription to a different plan.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     tenantId:     string;           // Tenant slug (TEXT)
 *     newPlanId:    string;           // "starter" | "growth" | "pro"
 *     billingCycle: "monthly" | "annual";
 *   }
 *
 * ─── Behaviour ────────────────────────────────────────────────────────────────
 *
 *   If the tenant already has an active Stripe subscription, the subscription's
 *   price item is swapped inline via the Stripe Subscriptions API.
 *   Stripe prorates the change immediately by default.
 *
 *   If there is no active Stripe subscription (e.g. tenant is on the free/starter
 *   plan without a Stripe record), we redirect to Checkout instead.
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   { ok: true }         — plan changed inline (no redirect needed)
 *   { url: string }      — redirect to Stripe Checkout (new subscription flow)
 *   { error: string }    — something went wrong
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   Admin-only route.  Only callable from the /admin section.
 */

import { NextRequest, NextResponse }                      from "next/server";
import { createClient }                                    from "@supabase/supabase-js";
import { BILLING_PLANS, getResolvedPlanStripePriceId } from "@/billing/plans";
import { createCheckoutSession, createPlanChangeCheckout } from "@/billing/stripe";
import { syncPackageKeyFromPlan }                            from "@/billing/subscriptions";
import { getStripeClient }                                   from "@/billing/stripe-config";
import { rethrowNextInternal } from "@/lib/server-action-guard";
import {
  getRequiredAdminSession,
  canAccessTenant,
} from "@/lib/admin-auth/authorization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripeAny(): any { return getStripeClient(); }

// Plan tier ranks — used to determine if a switch is an upgrade or downgrade.
const PLAN_TIER: Record<string, number> = { starter: 0, growth: 1, pro: 2 };

// Price in euro cents for the given plan + cycle.
function getPlanPriceCents(planId: string, billingCycle: string): number {
  const plan = BILLING_PLANS[planId as keyof typeof BILLING_PLANS];
  if (!plan) return 0;
  return billingCycle === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
}

interface SubRow {
  stripe_subscription_id: string | null;
  stripe_customer_id:     string | null;
  status:                 string;
  plan:                   string | null;
  billing_cycle:          string | null;
  current_period_end:     string | null;
  pending_plan:           string | null;
  pending_plan_billing_cycle: string | null;
  pending_plan_effective_date: string | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 0. Auth — any admin assigned to the target tenant may change its plan ────

  let session;
  try {
    session = await getRequiredAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Parse body ────────────────────────────────────────────────────────────

  let body: { tenantId?: string; newPlanId?: string; billingCycle?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, newPlanId, billingCycle } = body;

  if (!tenantId || !newPlanId || !billingCycle) {
    return NextResponse.json(
      { error: "tenantId, newPlanId, and billingCycle are required" },
      { status: 400 },
    );
  }

  if (billingCycle !== "monthly" && billingCycle !== "annual") {
    return NextResponse.json(
      { error: "billingCycle must be 'monthly' or 'annual'" },
      { status: 400 },
    );
  }

  if (!BILLING_PLANS[newPlanId as keyof typeof BILLING_PLANS]) {
    return NextResponse.json({ error: `Unknown plan: ${newPlanId}` }, { status: 400 });
  }

  // ── 1b. Verify the caller has access to this tenant ──────────────────────────

  const hasAccess = await canAccessTenant(session, tenantId);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "You do not have access to this tenant." },
      { status: 403 },
    );
  }

  // ── 2. Init Supabase (service-role) ─────────────────────────────────────────

  const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseSrvc) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseSrvc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 3. Load existing subscription ───────────────────────────────────────────

  const { data: existingSub } = await client
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id, status, plan, billing_cycle, current_period_end, pending_plan, pending_plan_billing_cycle, pending_plan_effective_date")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const sub = existingSub as SubRow | null;

  // ── 4. Resolve new price ID (env → DB fallback) ──────────────────────────────

  const newPrice = await getResolvedPlanStripePriceId(
    newPlanId,
    billingCycle as "monthly" | "annual",
  );

  if (!newPrice) {
    const envKey = `STRIPE_PRICE_${newPlanId.toUpperCase()}_${billingCycle.toUpperCase()}`;
    return NextResponse.json(
      {
        error:
          `No Stripe Price ID configured for plan "${newPlanId}" (${billingCycle}). ` +
          `Set ${envKey} in the environment or add it to the billing_plans table.`,
      },
      { status: 400 },
    );
  }

  // ── 5a. Active subscription — swap price inline ──────────────────────────────

  if (sub?.stripe_subscription_id && sub.status !== "canceled") {
    const currentPlanId       = sub.plan ?? "starter";
    const currentBillingCycle = sub.billing_cycle ?? "monthly";
    const currentTier         = PLAN_TIER[currentPlanId]   ?? -1;
    const newTier             = PLAN_TIER[newPlanId]        ?? -1;
    const isUpgrade           = newTier > currentTier;

    // ── ANNUAL → MONTHLY: blocked (cannot downgrade cycle mid-period) ────────
    if (currentBillingCycle === "annual" && billingCycle === "monthly") {
      return NextResponse.json(
        {
          error:
            "Cannot switch to a monthly plan while an annual plan is active. " +
            "Your annual plan will automatically convert to monthly at renewal if no selection is made.",
          restriction: "annual_to_monthly_blocked",
        },
        { status: 400 },
      );
    }

    // ── Annual plan restriction: only upgrades allowed ───────────────────────
    if (currentBillingCycle === "annual" && !isUpgrade) {
      const endDate = sub.current_period_end
        ? new Date(sub.current_period_end).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "your renewal date";
      return NextResponse.json(
        {
          error:
            `You're on an annual ${currentPlanId} plan. Downgrades are not available while the annual term is running. ` +
            `You can upgrade at any time. Your plan renews on ${endDate}.`,
          restriction: "annual_downgrade_blocked",
        },
        { status: 400 },
      );
    }

    // ── Monthly subscription with pending change: block further non-upgrade changes ──
    if (currentBillingCycle === "monthly" && sub.pending_plan && !isUpgrade) {
      const pendingPlanName = sub.pending_plan;
      const effectiveDateStr = sub.pending_plan_effective_date
        ? new Date(sub.pending_plan_effective_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "your next billing period";
      return NextResponse.json(
        {
          error:
            `A plan change to ${pendingPlanName} is already scheduled for your next billing period (${effectiveDateStr}). ` +
            `Wait for it to take effect before requesting another change.`,
          restriction: "pending_change_in_progress",
        },
        { status: 400 },
      );
    }

    // ── Monthly non-upgrade (downgrade or same tier): defer to next period ───
    if (currentBillingCycle === "monthly" && !isUpgrade) {
      await client
        .from("subscriptions")
        .update({
          pending_plan:                  newPlanId,
          pending_plan_billing_cycle:    billingCycle,
          pending_plan_effective_date:   sub.current_period_end,
          updated_at:                    new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      return NextResponse.json({
        ok:                 true,
        effectiveNextPeriod: true,
        effectiveDate:       sub.current_period_end,
      });
    }

    // ── Upgrades (monthly or annual) and annual → higher annual: immediate ───
    const prorationBehavior = isUpgrade ? "create_prorations" : "none";

    try {
      // Retrieve current subscription to get the item ID needed for the update.
      const currentSub = await stripeAny().subscriptions.retrieve(
        sub.stripe_subscription_id,
      ) as { items: { data: Array<{ id: string }> } };

      const itemId = currentSub.items.data[0]?.id;
      if (!itemId) {
        return NextResponse.json(
          { error: "Could not find subscription item to update" },
          { status: 500 },
        );
      }

      // Swap to new price.
      await stripeAny().subscriptions.update(sub.stripe_subscription_id, {
        items:              [{ id: itemId, price: newPrice }],
        metadata:           { plan_id: newPlanId },
        proration_behavior: prorationBehavior,
      });

      // Optimistically update local DB; webhook will do a full sync shortly.
      await client
        .from("subscriptions")
        .update({
          plan:          newPlanId,
          billing_cycle: billingCycle,
          updated_at:    new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      // Sync packageKey immediately so the settings page reflects the new plan.
      await syncPackageKeyFromPlan(client, tenantId, newPlanId);

      return NextResponse.json({ ok: true, effectiveNextPeriod: false });
    } catch (err) {
    rethrowNextInternal(err);
      console.error("[billing/change-plan] Stripe error:", err);
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 500 },
      );
    }
  }

  // ── 5b.1. Platform-managed active subscription — defer plan change to next period ─
  //
  // If the tenant has an existing active (or trialing) subscription that is
  // NOT linked to a Stripe Subscription (stripe_subscription_id IS NULL),
  // we never create a new Stripe Subscription.  Instead we:
  //
  //   a. Block if a plan change is already pending.
  //   b. Set pending_plan / pending_plan_billing_cycle / pending_plan_effective_date.
  //   c. Collect first-period payment now via a one-time Stripe Checkout (payment mode).
  //      The checkout saves the card for future off-session charges.
  //   d. On checkout success, confirmPlanChangeCheckoutAction sets pending_plan_paid_at.
  //   e. The billing-renewal cron activates the plan at period end, skipping the
  //      Stripe charge because pending_plan_paid_at is already set.

  if (sub && !sub.stripe_subscription_id && ["active", "trialing"].includes(sub.status)) {
    // a. Block if a plan change is already in progress.
    if (sub.pending_plan) {
      const pendingPlanName = sub.pending_plan;
      const effectiveDateStr = sub.pending_plan_effective_date
        ? new Date(sub.pending_plan_effective_date).toLocaleDateString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
          })
        : "your next billing period";
      return NextResponse.json(
        {
          error:
            `A plan change to ${pendingPlanName} is already scheduled for ${effectiveDateStr}. ` +
            `Wait for it to take effect before requesting another change.`,
          restriction: "pending_change_in_progress",
        },
        { status: 400 },
      );
    }

    // b. Write pending_plan fields before redirecting to checkout so the record
    //    exists even if the user closes the tab mid-checkout.
    await client
      .from("subscriptions")
      .update({
        pending_plan:                newPlanId,
        pending_plan_billing_cycle:  billingCycle,
        pending_plan_effective_date: sub.current_period_end,
        updated_at:                  new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    // c. Collect first-period payment via one-time Stripe Checkout.
    const amountCents = getPlanPriceCents(newPlanId, billingCycle);
    const planLabel   = BILLING_PLANS[newPlanId as keyof typeof BILLING_PLANS]?.name ?? newPlanId;

    const origin      = request.headers.get("origin") ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "";
    const successUrl  = `${origin}/admin/tenants/${tenantId}/billing?plan_change=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl   = `${origin}/admin/tenants/${tenantId}/billing?plan_change=cancelled`;

    if (amountCents > 0) {
      try {
        const checkoutUrl = await createPlanChangeCheckout({
          tenantId,
          newPlanId,
          billingCycle:    billingCycle as "monthly" | "annual",
          amountCents,
          successUrl,
          cancelUrl,
          stripeCustomerId: sub.stripe_customer_id ?? undefined,
          description:      `${planLabel} plan — ${billingCycle === "annual" ? "annual" : "first month"}`,
        });
        return NextResponse.json({ url: checkoutUrl });
      } catch (err) {
    rethrowNextInternal(err);
        console.error("[billing/change-plan] Plan-change Checkout error:", err);
        // Roll back pending_plan on checkout creation failure.
        await client
          .from("subscriptions")
          .update({ pending_plan: null, pending_plan_billing_cycle: null, pending_plan_effective_date: null, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId);
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
      }
    }

    // Free-tier plan (amountCents = 0 → e.g. downgrading to starter) — no payment needed.
    return NextResponse.json({
      ok:                  true,
      effectiveNextPeriod: true,
      effectiveDate:       sub.current_period_end,
    });
  }

  // ── 5b. No active subscription at all — redirect to Checkout ──────────────────

  const origin     = request.headers.get("origin") ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const successUrl = `${origin}/admin/tenants/${tenantId}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${origin}/admin/tenants/${tenantId}/billing?checkout=cancelled`;

  try {
    const checkoutUrl = await createCheckoutSession({
      tenantId,
      planId:           newPlanId,
      billingCycle:     billingCycle as "monthly" | "annual",
      successUrl,
      cancelUrl,
      stripeCustomerId: sub?.stripe_customer_id ?? undefined,
      priceId:          newPrice,   // already resolved from DB above — forward it
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    rethrowNextInternal(err);
    console.error("[billing/change-plan] Stripe Checkout error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
