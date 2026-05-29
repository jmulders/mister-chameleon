/**
 * billing/subscriptions.ts
 *
 * Server-side subscription data access — CRUD for the `subscriptions` table.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   All functions accept a SupabaseClient (service-role recommended).
 *   Do NOT import in client components.
 *
 * ─── Tenant ID convention ─────────────────────────────────────────────────────
 *
 *   tenant_id is a TEXT slug (e.g. "mister-chameleon") — NOT a UUID.
 *   This matches tenant_settings.tenant_id in the Supabase schema.
 *
 * ─── Source-of-truth model ────────────────────────────────────────────────────
 *
 *   Stripe is source of truth for payment state.
 *   subscriptions table is source of truth for platform access gating.
 *   Webhooks keep them in sync.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingPlanId, BillingCycle, SubscriptionStatus } from "./types";

// ── Package key sync ───────────────────────────────────────────────────────────

/**
 * Sync tenant_settings.packageKey to match the active subscription plan.
 *
 * packageKey is the source of truth for platform feature access.
 * subscriptions.plan is the billing source of truth.
 * They must be kept in sync whenever the subscription plan changes.
 *
 * @param planId  Pass the new plan ID ("starter" | "growth" | "pro") when the
 *                subscription activates or upgrades/downgrades.
 *                Pass null when the subscription is canceled — resets to "starter".
 */
export async function syncPackageKeyFromPlan(
  client:   SupabaseClient,
  tenantId: string,
  planId:   string | null,
): Promise<void> {
  const packageKey = (planId === "growth" || planId === "pro") ? planId : "starter";

  const { error } = await client
    .from("tenant_settings")
    .update({ package_key: packageKey, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  if (error) {
    // Non-fatal: log but don't throw — the subscription row is already written.
    // The admin can manually correct packageKey on the settings page.
    console.warn(
      `[billing/subscriptions] syncPackageKeyFromPlan: failed to update packageKey ` +
      `for tenant "${tenantId}" to "${packageKey}": ${error.message} (code: ${error.code})`,
    );
  } else {
    console.info(
      `[billing/subscriptions] syncPackageKeyFromPlan: tenantId=${tenantId} packageKey=${packageKey}`,
    );
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Subscription {
  id:                     string;
  tenant_id:              string;
  stripe_customer_id:     string | null;
  stripe_subscription_id: string | null;
  stripe_price_id:        string | null;
  plan:                   BillingPlanId;
  status:                 SubscriptionStatus;
  billing_cycle:          BillingCycle;
  current_period_start:   string | null;
  current_period_end:     string | null;
  trial_end:              string | null;
  cancel_at_period_end:   boolean;
  canceled_at:            string | null;
  // ── Pending plan (monthly deferred switch) ──────────────────────────────────
  pending_plan?:                  string | null;
  pending_plan_billing_cycle?:    string | null;
  pending_plan_effective_date?:   string | null;
  pending_plan_paid_at?:          string | null;
  // ── Dunning lifecycle ────────────────────────────────────────────────────────
  /** Set when the subscription first becomes past_due. Cleared on payment. */
  payment_due_since?:             string | null;
  /** Set when the payment-due email has been dispatched. Prevents duplicate sends. */
  dunning_email_sent_at?:         string | null;
  created_at:             string;
  updated_at:             string;
}

export type SubscriptionUpsert = Partial<Omit<Subscription, "id" | "tenant_id" | "created_at">>;

// ── Reads ──────────────────────────────────────────────────────────────────────

/**
 * Fetch the subscription row for a tenant.
 * Returns null if no subscription exists.
 */
export async function getSubscription(
  client:   SupabaseClient,
  tenantId: string,
): Promise<Subscription | null> {
  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(`[billing/subscriptions] getSubscription: ${error.message}`);
  return data as Subscription | null;
}

/**
 * Fetch a subscription by Stripe customer ID.
 * Used for webhook routing when tenant_id is not in event metadata.
 */
export async function getSubscriptionByCustomerId(
  client:     SupabaseClient,
  customerId: string,
): Promise<Subscription | null> {
  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(`[billing/subscriptions] getSubscriptionByCustomerId: ${error.message}`);
  return data as Subscription | null;
}

/**
 * Fetch a subscription by Stripe subscription ID.
 * Used for webhook routing (invoice events, subscription events).
 */
export async function getSubscriptionByStripeId(
  client:        SupabaseClient,
  stripeSubId:   string,
): Promise<Subscription | null> {
  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", stripeSubId)
    .maybeSingle();

  if (error) throw new Error(`[billing/subscriptions] getSubscriptionByStripeId: ${error.message}`);
  return data as Subscription | null;
}

/**
 * Fetch all subscriptions with a given status.
 * Useful for admin dashboards (past_due, canceled).
 */
export async function getSubscriptionsByStatus(
  client: SupabaseClient,
  status: SubscriptionStatus,
): Promise<Subscription[]> {
  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("status", status)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`[billing/subscriptions] getSubscriptionsByStatus: ${error.message}`);
  return (data ?? []) as Subscription[];
}

// ── Writes ─────────────────────────────────────────────────────────────────────

/**
 * Upsert a subscription row for a tenant.
 *
 * Creates the row if it doesn't exist; updates the provided fields if it does.
 * The `tenant_id` is the upsert key — there is exactly one row per tenant.
 *
 * @param fields   Partial subscription fields to set/update.
 *                 `tenant_id` is NOT included — pass it separately.
 */
export async function upsertSubscription(
  client:   SupabaseClient,
  tenantId: string,
  fields:   SubscriptionUpsert,
): Promise<Subscription> {
  const now     = new Date().toISOString();
  const payload = {
    tenant_id:  tenantId,
    ...fields,
    updated_at: now,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("subscriptions")
    .upsert(payload, { onConflict: "tenant_id" })
    .select()
    .single();

  if (error) throw new Error(`[billing/subscriptions] upsertSubscription: ${error.message}`);
  return data as Subscription;
}

/**
 * Update specific fields on an existing subscription by tenant ID.
 * Does nothing if no subscription row exists — use upsertSubscription if you
 * need create-or-update semantics.
 */
export async function updateSubscription(
  client:   SupabaseClient,
  tenantId: string,
  fields:   SubscriptionUpsert,
): Promise<void> {
  const { error } = await client
    .from("subscriptions")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`[billing/subscriptions] updateSubscription: ${error.message}`);
}

/**
 * Update subscription by Stripe customer ID.
 * Used in webhook handlers where we only have the customer ID.
 */
export async function updateSubscriptionByCustomerId(
  client:     SupabaseClient,
  customerId: string,
  fields:     SubscriptionUpsert,
): Promise<void> {
  const { error } = await client
    .from("subscriptions")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);

  if (error) throw new Error(`[billing/subscriptions] updateSubscriptionByCustomerId: ${error.message}`);
}

/**
 * Mark a subscription as canceled.
 * Sets status = "canceled", records canceled_at, and optionally clears the
 * cancel_at_period_end flag (since the cancellation has now taken effect).
 */
export async function cancelSubscription(
  client:      SupabaseClient,
  tenantId:    string,
  canceledAt?: string,
): Promise<void> {
  return updateSubscription(client, tenantId, {
    status:              "canceled",
    cancel_at_period_end: false,
    canceled_at:         canceledAt ?? new Date().toISOString(),
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Whether a subscription is in an active, paid state.
 * Past-due is considered active for access gating (grace period).
 */
export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub) return false;
  return sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
}

/**
 * Whether the subscription is scheduled to cancel at the end of the period.
 */
export function isScheduledForCancellation(sub: Subscription | null): boolean {
  return Boolean(sub?.cancel_at_period_end);
}

/**
 * Whether a subscription has a deferred monthly plan change scheduled.
 * A pending change blocks further plan switches until it takes effect.
 */
export function hasPendingPlanChange(sub: Subscription | null): boolean {
  return Boolean(sub?.pending_plan);
}

/**
 * Get a human-readable subscription status label.
 */
export function subscriptionStatusLabel(status: SubscriptionStatus | string): string {
  const labels: Record<string, string> = {
    active:    "Active",
    trialing:  "Trial",
    past_due:  "Past due",
    canceled:  "Canceled",
    unpaid:    "Unpaid",
    paused:    "Paused",
  };
  return labels[status] ?? status;
}

// ── Period renewal ─────────────────────────────────────────────────────────────

/**
 * Advance a subscription period (monthly: +1 month, annual: +1 year).
 *
 * Behaviour:
 *  - If a pending_plan is set, activates it (updates plan + billing_cycle,
 *    clears pending_* fields).
 *  - Sets status to "active".
 *  - Advances current_period_start = old current_period_end ?? now
 *    and current_period_end = start + billing period.
 *  - For annual subscriptions that had a pending downgrade to monthly,
 *    converts billing_cycle to "monthly" and advances by 1 month.
 *
 * @param force  If true, skip the check that period_end must be in the past.
 *               Used by the super-admin "Renew now" action.
 */
export async function renewSubscriptionPeriod(
  client:   SupabaseClient,
  tenantId: string,
  options?: { force?: boolean },
): Promise<
  | { ok: true;  current_period_end: string }
  | { ok: false; error: string }
> {
  const { data: sub } = await client
    .from("subscriptions")
    .select("plan, status, billing_cycle, current_period_end, pending_plan, pending_plan_billing_cycle")
    .eq("tenant_id", tenantId)
    .maybeSingle() as {
      data: {
        plan: string;
        status: string;
        billing_cycle: string;
        current_period_end: string | null;
        pending_plan: string | null;
        pending_plan_billing_cycle: string | null;
      } | null
    };

  if (!sub) {
    // Auto-create a subscription row from tenant_settings so the platform
    // never requires a manual DB insert after a Stripe signup.
    const { data: tenantData } = await client
      .from("tenant_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!tenantData) {
      return { ok: false, error: "Tenant not found." };
    }

    const settings    = tenantData.settings as Record<string, unknown>;
    const plan        = (settings.packageKey as string | undefined) ?? "starter";
    const trialEndsAt = (settings.trial as Record<string, string> | undefined)?.endsAt;
    const now         = new Date().toISOString();
    const periodEnd   = trialEndsAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertErr } = await client.from("subscriptions").upsert({
      tenant_id:            tenantId,
      plan,
      status:               trialEndsAt ? "trialing" : "active",
      billing_cycle:        "monthly",
      current_period_start: now,
      current_period_end:   periodEnd,
    }, { onConflict: "tenant_id", ignoreDuplicates: true });

    // A duplicate-key error just means the row already exists — that's fine.
    // Any other error is a real problem.
    const isDuplicate = insertErr?.message?.toLowerCase().includes("duplicate key") ||
                        insertErr?.message?.toLowerCase().includes("unique constraint");
    if (insertErr && !isDuplicate) {
      return { ok: false, error: `Could not auto-create subscription: ${insertErr.message}` };
    }

    // Retry now that the row exists. But also check if pending_plan columns
    // exist — if migration 093 is not applied the SELECT will silently return
    // null. In that case we log a warning and tell the user to apply it.
    const { data: retried, error: retryErr } = await client
      .from("subscriptions")
      .select("plan, status, billing_cycle, current_period_end")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (retryErr) {
      return { ok: false, error: `Subscription lookup failed: ${retryErr.message}` };
    }
    if (!retried) {
      return { ok: false, error: "Subscription row exists but could not be read — check that migration 093 has been applied in Supabase." };
    }

    // Row found — re-run the full function to do the advance with all columns.
    return renewSubscriptionPeriod(client, tenantId, options);
  }

  if (!options?.force) {
    if (sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
      return { ok: false, error: "Current period has not yet expired. Use force=true to advance anyway." };
    }
  }

  const now       = new Date();
  const periodStart = sub.current_period_end ? new Date(sub.current_period_end) : now;

  // Activate pending plan if scheduled.
  const activePlan  = sub.pending_plan  ?? sub.plan;
  const activeCycle = (sub.pending_plan_billing_cycle ?? sub.billing_cycle) as "monthly" | "annual";

  // Compute new period end.
  const periodEnd = new Date(periodStart);
  if (activeCycle === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const { error } = await client
    .from("subscriptions")
    .update({
      plan:                        activePlan,
      billing_cycle:               activeCycle,
      status:                      "active",
      current_period_start:        periodStart.toISOString(),
      current_period_end:          periodEnd.toISOString(),
      pending_plan:                null,
      pending_plan_billing_cycle:  null,
      pending_plan_effective_date: null,
      pending_plan_paid_at:        null,
      updated_at:                  now.toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (error) {
    return { ok: false, error: `${error.message} (code: ${error.code})` };
  }

  return { ok: true, current_period_end: periodEnd.toISOString() };
}
