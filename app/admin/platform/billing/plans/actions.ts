"use server";

/**
 * app/admin/platform/billing/plans/actions.ts
 *
 * Server actions for the admin Plans editor.
 *
 * ─── What these do ────────────────────────────────────────────────────────────
 *
 *   upsertPlan         — create or update a row in billing_plans.
 *                        ON CONFLICT (plan_id) DO UPDATE handles both cases.
 *   togglePlanActive   — flip the active flag for a plan without touching
 *                        other fields.
 *   reorderPlan        — swap the sort_order of a plan with its neighbour
 *                        (direction: "up" | "down").
 *   seedDefaultPlans   — seed the three built-in plans (starter/growth/pro)
 *                        from billing/plans.ts without overwriting existing rows.
 *   deletePlan         — hard-delete a custom plan row.  Refuses to delete the
 *                        three built-in plans (starter/growth/pro).
 *
 * ─── Validation ────────────────────────────────────────────────────────────────
 *
 *   • No negative prices (monthly_price_cents, yearly_price_cents, annual_monthly_cents)
 *   • No negative credit counts
 *   • No duplicate plan_id on create
 *   • plan_id must be alphanumeric with underscores only
 *   • label is required
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session (getRequiredAdminSession).
 *
 * ─── Stripe note ──────────────────────────────────────────────────────────────
 *
 *   Changing monthly_price_cents or stripe_*_price_id in this table does NOT
 *   automatically update Stripe.  Stripe Price IDs must be updated manually in
 *   the Stripe dashboard and reflected in the STRIPE_PRICE_* env vars.
 *   The DB values here drive the admin display and the fallback billing
 *   calculations — they are not pushed to Stripe automatically.
 */

import { createClient }            from "@supabase/supabase-js";
import { revalidatePath }          from "next/cache";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { BILLING_PLANS }           from "@/billing/plans";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlanFeatures {
  /** AI-augmented personalisation decisions (Growth+). */
  aiPersonalization:   boolean;
  /** CRM (HubSpot/Salesforce) and ABM enrichment (Growth+). */
  crmAbmEnrichment:    boolean;
  /** Custom decay profiles in behavioural scoring (Growth+). */
  customDecayProfiles: boolean;
  /** Agency multi-tenant management (Pro). */
  multiTenant:         boolean;
  /** Full analytics dashboard (Growth+). */
  analyticsDashboard:  boolean;
  /** Priority support channel (Pro). */
  prioritySupport:     boolean;
}

export interface PlanLimits {
  /**
   * Max unique visitor sessions that receive personalised content per calendar month.
   * 0 = unlimited (Pro enterprise overrides).
   */
  personalizedSessionsPerMonth: number;
}

export interface PlanUpsertPayload {
  plan_id:                  string;
  label:                    string;
  active:                   boolean;
  sort_order:               number;
  /** EUR (e.g. 149.000000). */
  monthly_price:            number;
  /** EUR (e.g. 1488.000000). */
  yearly_price:             number;
  /** EUR effective monthly when billed annually (e.g. 124.000000). */
  annual_monthly_price:     number;
  /** Fractional credits (e.g. 500.000). */
  included_credits:         number;
  /** EUR per credit over quota (e.g. 0.030000). */
  overage_price_per_credit: number;
  features:                 PlanFeatures;
  limits:                   PlanLimits;
  stripe_monthly_price_id:       string | null;
  stripe_yearly_price_id:        string | null;
  stripe_test_monthly_price_id:  string | null;
  stripe_test_yearly_price_id:   string | null;
}

export interface ActionResult {
  ok:     boolean;
  error?: string;
}

// ── Built-in plan IDs (protected from hard-delete) ────────────────────────────

const BUILTIN_PLAN_IDS = new Set(["starter", "growth", "pro"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── upsertPlan ────────────────────────────────────────────────────────────────

/**
 * Create or update a plan row in billing_plans.
 * ON CONFLICT (plan_id) DO UPDATE handles both insert and edit paths.
 */
export async function upsertPlan(payload: PlanUpsertPayload): Promise<ActionResult> {
  await getRequiredAdminSession();

  // ── Validation ─────────────────────────────────────────────────────────────

  if (!payload.label.trim()) {
    return { ok: false, error: "Plan label is required." };
  }
  if (!/^[a-z0-9_]+$/.test(payload.plan_id)) {
    return { ok: false, error: "Plan ID must be lowercase letters, numbers, or underscores only." };
  }
  if (payload.monthly_price < 0) {
    return { ok: false, error: "Monthly price cannot be negative." };
  }
  if (payload.yearly_price < 0) {
    return { ok: false, error: "Annual price cannot be negative." };
  }
  if (payload.annual_monthly_price < 0) {
    return { ok: false, error: "Annual monthly price cannot be negative." };
  }
  for (const [k, v] of Object.entries(payload.limits)) {
    if (typeof v === "number" && v < 0) {
      return { ok: false, error: `Limit "${k}" cannot be negative.` };
    }
  }

  const db  = makeClient();
  const now = new Date().toISOString();

  const { error } = await db
    .from("billing_plans")
    .upsert(
      {
        plan_id:                  payload.plan_id,
        label:                    payload.label.trim(),
        active:                   payload.active,
        sort_order:               payload.sort_order,
        monthly_price:            payload.monthly_price,
        yearly_price:             payload.yearly_price,
        annual_monthly_price:     payload.annual_monthly_price,
        included_credits:         payload.included_credits,
        overage_price_per_credit: payload.overage_price_per_credit,
        features:                 payload.features,
        limits:                   payload.limits,
        stripe_monthly_price_id:       payload.stripe_monthly_price_id      || null,
        stripe_yearly_price_id:        payload.stripe_yearly_price_id       || null,
        stripe_test_monthly_price_id:  payload.stripe_test_monthly_price_id || null,
        stripe_test_yearly_price_id:   payload.stripe_test_yearly_price_id  || null,
        updated_at:               now,
      },
      { onConflict: "plan_id" },
    );

  if (error) {
    console.error("[plans/actions] upsertPlan failed:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/platform/billing/plans");
  return { ok: true };
}

// ── togglePlanActive ─────────────────────────────────────────────────────────

/**
 * Toggle the active/inactive state of a plan without touching other fields.
 */
export async function togglePlanActive(
  planId: string,
  active: boolean,
): Promise<ActionResult> {
  await getRequiredAdminSession();

  const db = makeClient();

  const { error } = await db
    .from("billing_plans")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("plan_id", planId);

  if (error) {
    console.error("[plans/actions] togglePlanActive failed:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/platform/billing/plans");
  return { ok: true };
}

// ── reorderPlan ───────────────────────────────────────────────────────────────

/**
 * Move a plan one position up or down in sort order.
 * Swaps the sort_order value with the adjacent plan.
 */
export async function reorderPlan(
  planId:    string,
  direction: "up" | "down",
): Promise<ActionResult> {
  await getRequiredAdminSession();

  const db = makeClient();

  // Fetch all plans ordered by sort_order
  const { data: plans, error: fetchError } = await db
    .from("billing_plans")
    .select("plan_id, sort_order")
    .order("sort_order", { ascending: true });

  if (fetchError || !plans) {
    return { ok: false, error: fetchError?.message ?? "Could not fetch plans." };
  }

  const idx = plans.findIndex((p) => p.plan_id === planId);
  if (idx === -1) return { ok: false, error: "Plan not found." };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= plans.length) {
    return { ok: false, error: "Cannot move plan further in that direction." };
  }

  const current = plans[idx]!;
  const swap    = plans[swapIdx]!;
  const now     = new Date().toISOString();

  // Swap sort_order values in two updates
  const [r1, r2] = await Promise.all([
    db.from("billing_plans").update({ sort_order: swap.sort_order, updated_at: now }).eq("plan_id", current.plan_id),
    db.from("billing_plans").update({ sort_order: current.sort_order, updated_at: now }).eq("plan_id", swap.plan_id),
  ]);

  if (r1.error || r2.error) {
    const msg = r1.error?.message ?? r2.error?.message ?? "Reorder failed.";
    return { ok: false, error: msg };
  }

  revalidatePath("/admin/platform/billing/plans");
  return { ok: true };
}

// ── deletePlan ────────────────────────────────────────────────────────────────

/**
 * Hard-delete a custom plan row.
 * Built-in plans (starter / growth / pro) cannot be deleted — deactivate instead.
 */
export async function deletePlan(planId: string): Promise<ActionResult> {
  await getRequiredAdminSession();

  if (BUILTIN_PLAN_IDS.has(planId)) {
    return {
      ok:    false,
      error: `"${planId}" is a built-in plan and cannot be deleted. Deactivate it instead.`,
    };
  }

  const db = makeClient();
  const { error } = await db.from("billing_plans").delete().eq("plan_id", planId);

  if (error) {
    console.error("[plans/actions] deletePlan failed:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/platform/billing/plans");
  return { ok: true };
}

// ── seedDefaultPlans ─────────────────────────────────────────────────────────

/**
 * Seed the three built-in plans from billing/plans.ts without overwriting
 * existing rows.  Safe to call multiple times (idempotent).
 */
export async function seedDefaultPlans(): Promise<ActionResult> {
  await getRequiredAdminSession();

  const db  = makeClient();
  const now = new Date().toISOString();

  const rows = Object.values(BILLING_PLANS).map((plan, i) => ({
    plan_id:                  plan.id,
    label:                    plan.name,
    active:                   true,
    sort_order:               i + 1,
    // Convert cents to EUR for fractional schema
    monthly_price:            parseFloat((plan.monthlyPriceCents / 100).toFixed(6)),
    yearly_price:             parseFloat((plan.annualPriceCents / 100).toFixed(6)),
    annual_monthly_price:     parseFloat((plan.annualMonthlyCents / 100).toFixed(6)),
    included_credits:         0,   // Option B: plans do not include credits
    overage_price_per_credit: 0,   // no overage billing
    features:                 plan.features,
    limits:                   plan.limits,
    stripe_monthly_price_id:  null,
    stripe_yearly_price_id:   null,
    updated_at:               now,
  }));

  const { error } = await db
    .from("billing_plans")
    .upsert(rows, { onConflict: "plan_id", ignoreDuplicates: true });

  if (error) {
    console.error("[plans/actions] seedDefaultPlans failed:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/platform/billing/plans");
  return { ok: true };
}
