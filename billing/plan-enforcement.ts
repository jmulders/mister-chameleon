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
 *     personalizedSessionsPerMonth  — 1,500 / 7,500 / 40,000 for Starter/Growth/Pro.
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
import { noteFailedRead, rememberedRead } from "@/lib/cache/remembered-read";
import { getDb }                  from "@/data/db";
import { BILLING_PLANS }          from "./plans";
import { noteSessionCounted }     from "./session-cap-notice";
import { trialSessionLimit, trialWindow, type TrialWindow } from "./trial-session-cap";
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
  /**
   * True while the subscription is on trial. `planLimit` is then the trial's
   * session limit and `current` counts from the start of the trial, not from
   * the 1st of the month (billing/trial-session-cap.ts). Absent means false.
   */
  onTrial?:        boolean;
  /** ISO timestamp the trial's sessions are counted from. Null when not on trial. */
  trialStartedAt?: string | null;
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
  return (await getPlanAndTrial(tenantId)).plan;
}

/**
 * The effective plan, and the trial the tenant is in when it is in one.
 *
 * One read of the subscription row answers both, so the cap verdict does not
 * ask for the same row twice.
 */
export async function getPlanAndTrial(
  tenantId: string,
): Promise<{ plan: BillingPlan; trial: TrialWindow | null }> {
  const db = getAnyDb();

  const [subResult, settingsResult] = await Promise.all([
    db.from("subscriptions").select("plan, status, created_at").eq("tenant_id", tenantId).maybeSingle(),
    db.from("tenant_settings").select("settings").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  // A failed read falls back to the starter plan below. That answer is right
  // for this one request and wrong to remember.
  if (subResult.error || settingsResult.error) noteFailedRead();

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

  const { data: dbRow, error: planError } = await db
    .from("billing_plans")
    .select("label, features, limits")
    .eq("plan_id", planId)
    .maybeSingle();

  // On trial or not is the subscription's own status. A tenant with only a
  // packageKey has no subscription, so it is never on trial.
  const trial = trialWindow(subResult.data as { status?: string | null; created_at?: string | null } | null);

  if (planError) noteFailedRead();
  if (!dbRow) return { plan: staticPlan, trial };

  return {
    trial,
    plan: {
      ...staticPlan,
      name:     (dbRow.label    as string | null) ?? staticPlan.name,
      features: { ...staticPlan.features, ...(dbRow.features as Partial<BillingPlan["features"]> ?? {}) },
      limits:   { ...staticPlan.limits,   ...(dbRow.limits   as Partial<BillingPlan["limits"]>   ?? {}) },
    },
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
 * Does recording this session cost one purchased credit?
 *
 * A credit pays for one session beyond the plan limit. So: the session is new
 * (not a further pageview of a visit that is already counted), a personalised
 * page was actually served (not over the cap), the plan limit was already
 * reached before this session, and there are credits to spend.
 *
 * Pure, so the rule is testable without a database.
 */
export function shouldSpendSessionCredit(
  isNewSession: boolean,
  cap: Pick<SessionCapResult, "overLimit" | "current" | "planLimit" | "bonusSessions">,
): boolean {
  if (!isNewSession || cap.overLimit) return false;
  const pastPlanLimit = cap.planLimit > 0 && cap.current >= cap.planLimit;
  return pastPlanLimit && cap.bonusSessions > 0;
}

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

    // ── Record in personalization_sessions (de-duplicated) ────────────────────
    //
    // First, and with the answer read back: the PK (tenant, month, session)
    // makes this insert a no-op for a pageview of a visit that is already
    // counted, and the returned row tells us whether this call created it.
    const { data: inserted, error: insertError } = await db
      .from("personalization_sessions")
      .upsert(
        { tenant_id: tenantId, month_key: key, session_id: sessionId },
        { onConflict: "tenant_id,month_key,session_id", ignoreDuplicates: true },
      )
      .select("session_id");
    const isNewSession = !insertError && Array.isArray(inserted) && inserted.length > 0;

    // ── Spend a purchased credit when we are past the plan limit ──────────────
    //
    // Once per session, so only when the insert above created the row. This
    // used to run before the insert on every call: a visitor reading five pages
    // past the plan limit cost five credits, and a session already counted
    // under the plan cost one more on each later pageview.
    if (shouldSpendSessionCredit(isNewSession, capResult)) {
      // Atomic (FOR UPDATE) and writes to session_credit_ledger. Non-fatal.
      await db.rpc("deduct_session_credit", {
        p_tenant_id: tenantId,
        p_session_id: sessionId,
      }).then(() => null, () => null);
    }

    // ── Tell the tenant when the month runs out ───────────────────────────────
    //
    // Once at 80% of the plan and once when it is used up. Does nothing below
    // three quarters of the plan, and never throws (session-cap-notice.ts).
    if (isNewSession) {
      await noteSessionCounted(db, {
        tenantId,
        monthKey:      key,
        knownCount:    capResult.current,
        planLimit:     capResult.planLimit,
        bonusSessions: capResult.bonusSessions,
        trialSince:    capResult.onTrial ? (capResult.trialStartedAt ?? null) : null,
      });
    }
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

    if (error) {
      noteFailedRead();
      return 0;
    }
    return count ?? 0;
  } catch {
    noteFailedRead();
    return 0;
  }
}

/**
 * Count the tenant's personalised sessions since a moment in time.
 *
 * Used for a trial, whose sessions are counted from its start and not per
 * calendar month. Returns 0 on any error, like getMonthlySessionCount.
 */
export async function getSessionCountSince(
  tenantId: string,
  sinceIso: string,
): Promise<number> {
  if (!tenantId) return 0;
  const db = getAnyDb();

  try {
    const { count, error } = await db
      .from("personalization_sessions")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", sinceIso);

    if (error) {
      noteFailedRead();
      return 0;
    }
    return count ?? 0;
  } catch {
    noteFailedRead();
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
    if (error) noteFailedRead();
    if (error || !data) return 0;
    return (data as { balance: number }).balance ?? 0;
  } catch {
    noteFailedRead();
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

  const [{ plan, trial }, monthCount, bonusSessions] = await Promise.all([
    getPlanAndTrial(tenantId),
    getMonthlySessionCount(tenantId, monthKey),
    getSessionCreditBalance(tenantId),
  ]);

  // ── Trial ───────────────────────────────────────────────────────────────────
  //
  // A trial is capped by sessions as well as by days (trial-session-cap.ts).
  // Its sessions are counted from the day it started, so a trial that runs
  // over the 1st does not start again at zero. The trial limit goes on as
  // `planLimit`: purchased credits lift it and the tenant is told at 80% and
  // at 100%, exactly as with a paid plan. Only a trial pays for the extra
  // count: every other tenant keeps the month's count read above.
  const current = trial
    ? await getSessionCountSince(tenantId, trial.startedAt)
    : monthCount;

  const planLimit = trial
    ? trialSessionLimit(plan.limits.personalizedSessionsPerMonth)
    : plan.limits.personalizedSessionsPerMonth;
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
    onTrial:        trial !== null,
    trialStartedAt: trial?.startedAt ?? null,
  };
}

/**
 * The cap verdict for the public render path, remembered for a minute.
 *
 * The verdict costs four reads in two steps, and every page waited for them
 * before it could decide anything. It answers one question, "may this tenant
 * still personalise", and a minute-old answer answers it as well: the cap is a
 * soft one, and the worst case is a handful of sessions served past it on a
 * busy site.
 *
 * The same verdict goes on to recordPersonalizedSession, as before. So the
 * moment a tenant crosses the plan limit is seen up to a minute and one visit
 * late: the sessions in between count under the plan instead of spending a
 * purchased credit. The count itself is exact, it is one row per session. The
 * dashboards read checkSessionSoftCap() and show the number of this moment.
 *
 * The month is part of the key, so the first visit of a new month does not get
 * the verdict of the old one. A verdict built on a failed read is not kept.
 */
const rememberedSessionSoftCap = rememberedRead(
  "session-soft-cap",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (tenantId: string, _monthKey: string) => checkSessionSoftCap(tenantId),
  { seconds: 60 },
);

export function checkSessionSoftCapRemembered(tenantId: string): Promise<SessionCapResult> {
  return rememberedSessionSoftCap(tenantId, currentMonthKey());
}
