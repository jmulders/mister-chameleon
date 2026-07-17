/**
 * billing/plan-enforcement.ts
 *
 * Plan feature checks and session-cap enforcement — server-side only.
 *
 * ─── Model ────────────────────────────────────────────────────────────────────
 *
 *   Mister Chameleon bills on personalised sessions, not on configuration
 *   object counts.  All plans have unlimited rules, experiments, interest
 *   profiles, scoring rules, and audience segments.
 *
 *   The single numeric limit is:
 *     personalizedSessionsPerMonth  — 25 K / 150 K / 500 K for Starter/Growth/Pro.
 *
 *   When a tenant exceeds their monthly cap, subsequent visitor requests receive
 *   the default (unmodified) experience.  No errors are thrown; the platform
 *   degrades gracefully until the next calendar month or until the tenant
 *   upgrades.
 *
 * ─── Feature gates ────────────────────────────────────────────────────────────
 *
 *   aiPersonalization    — AI shadow/live decisions (Growth+)
 *   crmAbmEnrichment     — CRM (HubSpot/Salesforce) + ABM enrichment (Growth+)
 *   customDecayProfiles  — custom behavioural decay profiles (Growth+)
 *   multiTenant          — agency multi-tenant management (Pro)
 *   analyticsDashboard   — full analytics reports (Growth+)
 *   prioritySupport      — priority support channel (Pro)
 *
 * ─── Session tracking ────────────────────────────────────────────────────────
 *
 *   recordPersonalizedSession(tenantId, sessionId)
 *     — Inserts a de-duplicated row into personalization_sessions.
 *       INSERT … ON CONFLICT DO NOTHING ensures the same session ID in the
 *       same calendar month is counted only once.
 *       When the tenant is over their plan cap but has purchased session credits,
 *       also calls deduct_session_credit() RPC — atomically debits 1 credit and
 *       writes a 'deduction' row to session_credit_ledger for Transaction History.
 *       Call this AFTER personalisation runs successfully (not on bot/fallback).
 *
 *   getMonthlySessionCount(tenantId, monthKey?)
 *     — Returns the number of unique personalised sessions for the month.
 *       monthKey defaults to the current UTC calendar month ("YYYY-MM").
 *
 *   getSessionCreditBalance(tenantId)
 *     — Returns the tenant's available purchased session credits (bonus sessions
 *       above the plan cap).  Returns 0 if no credits have been purchased.
 *
 *   checkSessionSoftCap(tenantId)
 *     — Returns { overLimit, current, limit, planLimit, bonusSessions } without throwing.
 *       effectiveLimit = planLimit + bonusSessions.
 *       Use this in the decision pipeline to decide whether to personalise.
 *
 * ─── Plan resolution order ────────────────────────────────────────────────────
 *
 *   1. Active Stripe subscription (subscriptions.plan) — most authoritative.
 *   2. Tenant's manually-assigned packageKey (tenant_settings JSONB).
 *   3. Default fallback: "starter".
 *
 *   After the plan ID is resolved, the billing_plans DB row is fetched and its
 *   features/limits JSONB overlaid on top of the static BILLING_PLANS defaults
 *   (admin-editable at /admin/platform/billing/plans).
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   This file imports `server-only`.  Do NOT import in client components.
 */

import "server-only";
import { getDb }                  from "@/data/db";
import { BILLING_PLANS }          from "./plans";
import type { BillingPlan }       from "./plans";
import type { SupabaseClient }    from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanFeatureKey = keyof BillingPlan["features"];

export interface PlanEnforcementResult {
  allowed:   boolean;
  reason?:   string;
  planName?: string;
  limit?:    number;
  current?:  number;
}

export interface SessionCapResult {
  /** true when the tenant has consumed their monthly personalised session cap (including any purchased credits). */
  overLimit:    boolean;
  /** Sessions used so far this calendar month. */
  current:      number;
  /** Effective monthly cap = plan limit + purchased session credits. 0 = unlimited. */
  limit:        number;
  /**
   * Sessions provided by the subscription plan alone (before bonus credits).
   * 0 = unlimited.
   */
  planLimit:    number;
  /** Purchased bonus sessions added on top of the plan limit. */
  bonusSessions: number;
  //
  // These two were optional. Every producer sets them, but the `?` let
  // recordPersonalizedSession read `capResult.planLimit > 0` on a possibly-
  // undefined number: `undefined > 0` is false, silently, so the branch that
  // spends a purchased session credit would just never run. The tenant would
  // have bought credits, had them served, and never had them deducted. Required
  // here so the compiler catches a producer that forgets one.
  /** The calendar month key checked ("YYYY-MM"). */
  monthKey:     string;
}

// ── Internal DB helper ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAnyDb(): SupabaseClient<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getDb() as unknown as SupabaseClient<any>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the current UTC month key in "YYYY-MM" format. */
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

// ── Plan resolution ───────────────────────────────────────────────────────────

/**
 * Resolve the effective billing plan for a tenant.
 *
 * Resolution order:
 *   1. Active Stripe subscription (subscriptions.plan)
 *   2. Tenant's manually-assigned packageKey (tenant_settings.settings→packageKey)
 *   3. "starter" fallback
 *
 * The billing_plans DB row (editable at /admin/platform/billing/plans) is then
 * overlaid on top of the static BILLING_PLANS defaults.
 *
 * Never throws — returns the starter plan on any DB error.
 */
export async function getEffectivePlan(tenantId: string): Promise<BillingPlan> {
  const db = getAnyDb();

  const [subResult, settingsResult] = await Promise.all([
    db.from("subscriptions").select("plan, status").eq("tenant_id", tenantId).maybeSingle(),
    db.from("tenant_settings").select("settings").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  let planId = "starter";

  if (subResult.data?.plan && subResult.data.status !== "canceled") {
    planId = subResult.data.plan;
  } else {
    const packageKey = (
      settingsResult.data?.settings as { packageKey?: string } | null
    )?.packageKey;
    if (packageKey) planId = packageKey;
  }

  const staticPlan =
    BILLING_PLANS[planId as keyof typeof BILLING_PLANS] ?? BILLING_PLANS["starter"];

  const { data: dbRow } = await db
    .from("billing_plans")
    .select("label, features, limits")
    .eq("plan_id", planId)
    .maybeSingle();

  if (!dbRow) return staticPlan;

  return {
    ...staticPlan,
    name:     (dbRow.label    as string | null) ?? staticPlan.name,
    features: { ...staticPlan.features, ...(dbRow.features as Partial<BillingPlan["features"]> ?? {}) },
    limits:   { ...staticPlan.limits,   ...(dbRow.limits   as Partial<BillingPlan["limits"]>   ?? {}) },
  };
}

// ── Feature checks ────────────────────────────────────────────────────────────

/**
 * Check whether a premium feature flag is enabled for a tenant's current plan.
 */
export async function checkPlanFeature(
  tenantId: string,
  feature:  PlanFeatureKey,
): Promise<PlanEnforcementResult> {
  const plan = await getEffectivePlan(tenantId);

  if (plan.features[feature]) {
    return { allowed: true, planName: plan.name };
  }

  const upgradeHints: Partial<Record<PlanFeatureKey, string>> = {
    aiPersonalization:   "AI personalisation requires the Growth plan or higher.",
    crmAbmEnrichment:    "CRM and ABM enrichment require the Growth plan or higher.",
    customDecayProfiles: "Custom decay profiles require the Growth plan or higher.",
    multiTenant:         "Multi-tenant agency management requires the Pro plan.",
    analyticsDashboard:  "The analytics dashboard requires the Growth plan or higher.",
    prioritySupport:     "Priority support requires the Pro plan.",
  };

  return {
    allowed:  false,
    planName: plan.name,
    reason:   upgradeHints[feature] ??
              `"${feature}" is not available on the ${plan.name} plan. Upgrade to unlock it.`,
  };
}

// ── Session tracking ──────────────────────────────────────────────────────────

/**
 * Record a single personalised visitor session for billing purposes.
 *
 * Uses INSERT … ON CONFLICT DO NOTHING so the same (tenant, month, session)
 * triple is counted only once — idempotent and safe to call multiple times.
 *
 * ─── The billing unit: one visit ─────────────────────────────────────────────
 *
 *   A contextual session is one WEB session — the visitor arrives, reads one or
 *   more pages, leaves. Two consequences, both load-bearing:
 *
 *   1. Every page counts, not just the homepage. app/(site)/page.tsx and
 *      lib/cms-page-decision.ts both call this. The PK (tenant, month, session)
 *      collapses the whole visit into one row, so "every page counts" does not
 *      mean "every page is billed".
 *
 *   2. Pass the mc_ws cookie value, never mc_session_id. The latter lives 30
 *      days and is a VISITOR key: keyed on it, a visitor who comes back weekly
 *      is billed once a month. See WEB_SESSION_COOKIE in @/data/session.
 *
 * ─── Month boundary ──────────────────────────────────────────────────────────
 *
 *   month_key is the calendar month and the cap resets on the 1st. That is the
 *   intended commercial model: a tenant starting on the 15th pays a prorated
 *   half month, then full months from the 1st. It requires the Stripe
 *   subscription to be anchored to the 1st with proration — if the anchor drifts
 *   to the signup date, the reset and the invoice stop lining up.
 *
 *   Calendar month is computed in UTC. For a Dutch tenant the reset lands at
 *   01:00/02:00 local on the 1st, not midnight — an hour of a busy night bills
 *   to the previous month.
 *
 * @param tenantId  The tenant that served the personalised content.
 * @param sessionId The visitor's WEB session token (mc_ws) — opaque, no PII.
 * @param cap       The already-computed cap verdict from the pipeline. Pass it —
 *                  otherwise this re-queries what the caller just worked out.
 * @param monthKey  Calendar month in "YYYY-MM" format (default: cap's, else now).
 */
export async function recordPersonalizedSession(
  tenantId:  string,
  sessionId: string,
  cap?:      SessionCapResult,
  monthKey?: string,
): Promise<void> {
  if (!tenantId || !sessionId) return;

  const key = monthKey ?? cap?.monthKey ?? currentMonthKey();
  const db  = getAnyDb();

  try {
    // ── Resolve the cap ───────────────────────────────────────────────────────
    //
    // The caller (the pipeline) has already computed this to decide whether to
    // personalise at all — pass it in. This function used to run three queries
    // of its own on EVERY pageview, duplicating that work and answering the
    // question after the fact. The fallback keeps older call sites working.
    const capResult = cap ?? await checkSessionSoftCap(tenantId);

    // ── Spend a purchased credit when we are past the plan limit ──────────────
    //
    // Only when we actually served a personalised page: over the plan limit AND
    // credits left. If overLimit is true the visitor got the default page, so
    // there is nothing to bill — charging there would sell them nothing.
    const pastPlanLimit =
      capResult.planLimit > 0 && capResult.current >= capResult.planLimit;

    if (!capResult.overLimit && pastPlanLimit && capResult.bonusSessions > 0) {
      // Atomic (FOR UPDATE) and writes to session_credit_ledger. Non-fatal.
      await db.rpc("deduct_session_credit", {
        p_tenant_id: tenantId,
        p_session_id: sessionId,
      }).then(() => null, () => null);
    }

    // ── Record in personalization_sessions (de-duplicated) ────────────────────
    await db.from("personalization_sessions").insert({
      tenant_id:  tenantId,
      month_key:  key,
      session_id: sessionId,
    });
    // ON CONFLICT DO NOTHING is handled by the DB constraint — no error on duplicate.
  } catch {
    // Non-fatal — session tracking failure must never break personalisation.
  }
}

/**
 * Get the number of unique personalised sessions served this calendar month.
 *
 * @param tenantId  Tenant to query.
 * @param monthKey  Optional "YYYY-MM" key (default: current UTC month).
 */
export async function getMonthlySessionCount(
  tenantId: string,
  monthKey?: string,
): Promise<number> {
  if (!tenantId) return 0;

  const key = monthKey ?? currentMonthKey();
  const db  = getAnyDb();

  try {
    const { count, error } = await db
      .from("personalization_sessions")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("month_key",  key);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch the tenant's purchased session credit balance.
 *
 * Returns 0 when the tenant has no credits row (never purchased top-ups).
 * Never throws — a query failure simply means no bonus credits are applied.
 */
export async function getSessionCreditBalance(tenantId: string): Promise<number> {
  if (!tenantId) return 0;
  const db = getAnyDb();
  try {
    const { data, error } = await db
      .from("session_credit_balances")
      .select("balance")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return 0;
    return (data as { balance: number }).balance ?? 0;
  } catch {
    return 0;
  }
}

// ── Session credit ledger ─────────────────────────────────────────────────────

export interface SessionCreditLedgerEntry {
  id:                       string;
  entry_type:               "purchase" | "deduction" | "grant" | "refund" | "adjustment";
  amount:                   number;     // positive = credit added; negative = deducted
  balance_after:            number;
  bundle_id:                string | null;
  stripe_payment_intent_id: string | null;
  note:                     string | null;
  created_at:               string;
}

/**
 * Fetch the session credit ledger for a tenant, newest first.
 *
 * Returns purchases (top-up bundles), deductions (sessions served from bonus
 * credits), grants, refunds, and manual adjustments.
 *
 * @param tenantId  Tenant to query.
 * @param limit     Max rows to return (default 50).
 */
export async function getSessionCreditLedger(
  tenantId: string,
  limit = 50,
): Promise<SessionCreditLedgerEntry[]> {
  if (!tenantId) return [];
  const db = getAnyDb();
  try {
    const { data, error } = await db
      .from("session_credit_ledger")
      .select("id, entry_type, amount, balance_after, bundle_id, stripe_payment_intent_id, note, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as SessionCreditLedgerEntry[];
  } catch {
    return [];
  }
}

/**
 * The cap rule, as pure arithmetic — no I/O, so it can be tested directly.
 *
 * A tenant may be served a personalised page while EITHER:
 *   • they are still under their plan's monthly limit, or
 *   • they have purchased session credits left.
 *
 * ─── Why not `current >= planLimit + credits` ────────────────────────────────
 *
 *   That is the obvious formula and it silently robs the tenant. Every session
 *   over the plan limit moves both terms: `current` +1, `credits` −1. The two
 *   converge and block at the halfway point, with credits still unspent.
 *
 *     plan 100, bought 10:
 *       current=100 credits=10 → limit 110 → serve → credits 9
 *       current=105 credits=5  → limit 105 → BLOCKED, 5 credits left unused
 *
 *   The tenant paid for ten extra sessions and got five. See
 *   tests/billing/session-cap.test.ts.
 *
 * @param planLimit 0 means unlimited (enterprise override).
 */
export function isOverCap(input: {
  current:   number;
  planLimit: number;
  credits:   number;
}): boolean {
  const { current, planLimit } = input;
  const credits = Math.max(0, input.credits);   // a negative balance is no balance

  if (planLimit <= 0)      return false;        // unlimited
  if (current < planLimit) return false;        // still inside the plan
  return credits <= 0;                          // over the plan: credits decide
}

/**
 * Check whether a tenant has consumed their monthly personalised session cap.
 *
 * When overLimit is true the caller should serve the default (unpersonalised)
 * experience.  No errors are thrown — degradation is always graceful.
 *
 * A planLimit of 0 means unlimited (used for enterprise overrides).
 */
export async function checkSessionSoftCap(tenantId: string): Promise<SessionCapResult> {
  const monthKey = currentMonthKey();

  const [plan, current, bonusSessions] = await Promise.all([
    getEffectivePlan(tenantId),
    getMonthlySessionCount(tenantId, monthKey),
    getSessionCreditBalance(tenantId),
  ]);

  const planLimit = plan.limits.personalizedSessionsPerMonth;
  // Reported as plan + remaining credits so the dashboard shows headroom. Not
  // used for the decision itself — see isOverCap for why that formula is unsafe.
  const limit = planLimit === 0 ? 0 : planLimit + bonusSessions;

  return {
    overLimit:    isOverCap({ current, planLimit, credits: bonusSessions }),
    current,
    limit,
    planLimit,
    bonusSessions,
    monthKey,
  };
}
