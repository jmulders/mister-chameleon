/**
 * /admin/tenants/[tenantId]/billing
 *
 * Tenant billing dashboard — plan, usage, cost estimate, transaction history.
 *
 * ─── RPC layer (canonical read path) ─────────────────────────────────────────
 *
 *   All wallet data flows through the stable RPC interface.  No direct table
 *   queries against tenant_wallets or wallet_ledger exist in this file.
 *
 *   public.get_wallet_state(tenantId)
 *     → balance, status, auto-reload config, spend summaries, period dates,
 *       Stripe readiness flags.  Also initialises the wallet row if absent.
 *       Replaces: ensureWallet + getCreditBalance + 2× getWalletSpend
 *
 *   public.get_wallet_breakdown(tenantId, periodKey?)
 *     → per-enrichment-type call counts and credit spend for the month.
 *       Replaces: getEnrichmentUsageSummary (raw SELECT + JS reduce)
 *                 + getTotalEnrichmentSpend (separate SUM round-trip)
 *
 *   public.get_wallet_ledger(tenantId, limit, offset)
 *     → wallet transaction history, most recent first.
 *       Replaces: getCreditHistory / direct wallet_ledger SELECT
 *
 * ─── Non-RPC queries (remaining, with justification) ─────────────────────────
 *
 *   subscriptions         — subscription plan display (Stripe data, no wallet RPC)
 *   usage_events          — legacy debug reconciliation (separate event system)
 *   wallet_reload_attempts — reload attempt history (no RPC exists)
 *   wallet_webhook_events  — Stripe webhook log (no RPC exists)
 *   platform_settings      — Chameleon Credits settings (separate system)
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   Each data fetch is wrapped independently.  If any call fails:
 *     • The real error is logged server-side with code + message.
 *     • A safe default value is used so the page still renders.
 *     • A visible admin error card is shown at the top of the page.
 *
 *   Mapping of known codes:
 *     42P01    — "relation does not exist" → billing migration not applied
 *     PGRST116 — "no rows" from .single() → handled inside the modules
 *     PGRST202 — function not found → pre-migration deployment; graceful fallback
 */

import { createClient }             from "@supabase/supabase-js";
import { notFound }                 from "next/navigation";
import { getTenantById }            from "@/tenant/server";
import { AdvertiserBilling }        from "./_components/AdvertiserBilling";
import { confirmAdTopUpAction }     from "../ads/actions";
import { BILLING_PLANS, getResolvedCreditBundles } from "@/billing/plans";
import { getUsageEventSummary }     from "@/billing/usage-events";
import { calculateBillingEstimate } from "@/billing/calculator";
import { getWalletState }           from "@/billing/wallet";
import { getWalletLedger }          from "@/billing/wallet-ledger";
import { getWalletBreakdown }       from "@/billing/enrichment-usage";
import { getRecentReloadAttempts }  from "@/billing/wallet-reload-attempts";
import { isTestModeEnabled }        from "@/billing/wallet-test-mode";
import { getStripeModeInfo }        from "@/billing/stripe-config";
import { getRecentWebhookEvents }   from "@/billing/wallet-webhook-events";
import { serializeError }           from "@/billing/errors";
import { CREDIT_SETTINGS_DEFAULTS } from "@/billing/credits";
import type { CreditSettings }      from "@/billing/credits";
import type { UsageSummary }        from "@/billing/types";
import { getCreditSettingsAction, confirmBundlePurchaseAction, confirmSubscriptionCheckoutAction, syncPaymentMethodFromStripeAction, confirmSessionBundlePurchaseAction, confirmPlanChangeCheckoutAction } from "./actions";
import { getDunningSettingsAction, getStripeInvoicesAction } from "./actions";
import type { StripeInvoiceRow } from "./actions";
import { BillingDashboard }         from "./_components/BillingDashboard";
import { getRequiredAdminSession, isSuperAdmin as checkIsSuperAdmin } from "@/lib/admin-auth/authorization";
import { checkSessionSoftCap, getSessionCreditLedger } from "@/billing/plan-enforcement";
import type { SessionCapResult, SessionCreditLedgerEntry } from "@/billing/plan-enforcement";
import { SESSION_CREDIT_BUNDLES } from "@/billing/plans";
import type { SessionCreditBundle } from "@/billing/plans";
import { rethrowNextInternal } from "@/lib/server-action-guard";

export const dynamic = "force-dynamic";

// ── Pagination ────────────────────────────────────────────────────────────────

const LEDGER_PAGE_SIZE = 25;
const LEDGER_PAGE_SIZES = [10, 25, 50, 100];

// ── Types ──────────────────────────────────────────────────────────────────────

interface Subscription {
  id:                          string;
  tenant_id:                   string;
  stripe_customer_id:          string | null;
  stripe_subscription_id:      string | null;
  plan:                        string;
  status:                      string;
  billing_cycle:               string;
  current_period_start:        string | null;
  current_period_end:          string | null;
  trial_end:                   string | null;
  cancel_at_period_end:        boolean;
  canceled_at:                 string | null;
  pending_plan:                string | null;
  pending_plan_billing_cycle:  string | null;
  pending_plan_effective_date: string | null;
  pending_plan_paid_at:        string | null;
  created_at:                  string;
  updated_at:                  string;
}

// ── Load error tracking ────────────────────────────────────────────────────────
//
// Each failed data fetch records a LoadError.  The `isSchemaMissing` flag is
// set when the underlying DB error is one of:
//   42P01  — table doesn't exist (migration not applied)
//   42703  — column doesn't exist (partial migration or schema mismatch)
//   22P02  — UUID-vs-TEXT type mismatch (migration 35 tables not yet rebuilt)
//   PGRST200 — PostgREST schema cache stale (clears within seconds)
// Other errors are unexpected and get a different UI treatment.

interface LoadError {
  message:         string;
  isSchemaMissing: boolean;
  code?:           string;
}

function classifyError(err: unknown): Pick<LoadError, "isSchemaMissing" | "code"> {
  const msg = err instanceof Error ? err.message : "";
  // Detect schema-missing codes embedded in our throw messages: "(code: 42P01)"
  const codeMatch = msg.match(/\(code:\s*([^)]+)\)/);
  const code = codeMatch?.[1]?.trim() ?? "";
  const isSchemaMissing =
    code === "42P01" || code === "42703" || code === "22P02" ||
    code === "PGRST200" || code === "PGRST205" ||
    msg.includes("42P01") || msg.includes("42703") || msg.includes("22P02") ||
    msg.includes("PGRST205");
  return { isSchemaMissing, code: code || undefined };
}

// ── Page error card ────────────────────────────────────────────────────────────

function AdminErrorCard({ errors }: { errors: LoadError[] }) {
  const hasSchemaMissing = errors.some((e) => e.isSchemaMissing);
  const hasUnexpected    = errors.some((e) => !e.isSchemaMissing);

  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-lg mt-0.5">⚠</span>
        <div>
          <p className="text-sm font-semibold text-red-800">
            Some billing data could not be loaded
          </p>
          <ul className="mt-1 space-y-0.5">
            {errors.map((e, i) => (
              <li key={i} className="text-xs text-red-700">{e.message}</li>
            ))}
          </ul>
          {hasSchemaMissing && (
            <p className="mt-2 text-xs text-red-600">
              One or more billing tables are missing. Run{" "}
              <code className="rounded bg-red-100 px-1">supabase db push</code> to
              apply the latest migrations and create the required tables.
            </p>
          )}
          {hasUnexpected && (
            <p className="mt-2 text-xs text-red-600">
              An unexpected database error occurred. The billing tables appear to
              exist — check the server logs for the full error details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantBillingPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const sp           = await searchParams;

  // ── Ledger pagination ──────────────────────────────────────────────────────
  const ledgerPage = Math.max(0, parseInt(String(sp["ledgerPage"] ?? "0"), 10) || 0);
  const rawLedgerSize = parseInt(String(sp["ledgerPageSize"] ?? String(LEDGER_PAGE_SIZE)), 10);
  const ledgerPageSize = LEDGER_PAGE_SIZES.includes(rawLedgerSize) ? rawLedgerSize : LEDGER_PAGE_SIZE;

  // ── Bundle purchase return params ─────────────────────────────────────────
  //
  // Credit bundle purchases redirect back with ?bundle=success&bundle_id=...
  // Subscription checkouts redirect back with ?checkout=success&session_id=...

  const bundleParam   = String(sp["bundle"] ?? "");
  const buyStatus     = bundleParam === "success"   ? "success"
                      : bundleParam === "cancelled"  ? "cancelled"
                      : undefined;
  const boughtBundleId    = buyStatus === "success" ? String(sp["bundle_id"] ?? "") || undefined : undefined;
  const bundleSessionId   = buyStatus === "success" ? String(sp["session_id"] ?? "") || undefined : undefined;

  // Session bundle purchase return params
  const sessionBundleParam    = String(sp["session_bundle"] ?? "");
  const sessionBuyStatus      = sessionBundleParam === "success"   ? "success"
                              : sessionBundleParam === "cancelled"  ? "cancelled"
                              : undefined;
  const sessionBoughtBundleId = sessionBuyStatus === "success" ? String(sp["bundle_id"] ?? "") || undefined : undefined;
  const sessionBundleSessionId = sessionBuyStatus === "success" ? String(sp["session_id"] ?? "") || undefined : undefined;

  // Subscription checkout return params
  const checkoutParam     = String(sp["checkout"] ?? "");
  const checkoutStatus    = checkoutParam === "success"   ? "success"
                          : checkoutParam === "cancelled"  ? "cancelled"
                          : undefined;
  const checkoutSessionId = checkoutStatus === "success" ? String(sp["session_id"] ?? "") || undefined : undefined;

  // Plan-change (one-time payment) checkout return params
  const planChangeParam      = String(sp["plan_change"] ?? "");
  const planChangeStatus     = planChangeParam === "success"   ? "success"
                             : planChangeParam === "cancelled"  ? "cancelled"
                             : undefined;
  const planChangeSessionId  = planChangeStatus === "success" ? String(sp["session_id"] ?? "") || undefined : undefined;

  // Stripe Billing Portal return param — indicates the user just came back from
  // the portal and we should sync the payment method without waiting for a webhook.
  const portalReturn = String(sp["portal"] ?? "") === "return";

  // ── Confirm bundle purchase server-side ────────────────────────────────────
  //
  // When Stripe redirects back with ?bundle=success&session_id=cs_xxx, verify
  // the checkout session and credit the wallet immediately.  This works without
  // the Stripe CLI / webhooks — critical for local development.
  // The action is idempotent: if the webhook already credited, it skips.

  if (buyStatus === "success" && bundleSessionId) {
    try {
      await confirmBundlePurchaseAction(tenantId, bundleSessionId);
    } catch {
      // Non-fatal — page renders normally; balance reflects reality.
    }
  }

  if (sessionBuyStatus === "success" && sessionBundleSessionId) {
    try {
      await confirmSessionBundlePurchaseAction(tenantId, sessionBundleSessionId);
    } catch {
      // Non-fatal.
    }
  }

  // ── Confirm subscription checkout server-side ──────────────────────────────
  //
  // When Stripe redirects back with ?checkout=success&session_id=cs_xxx, verify
  // the session and write the subscription row + seed credits immediately.
  // This works without the Stripe CLI / webhooks — critical for local dev.
  // Idempotent: if the webhook already handled this, the action returns early.

  if (checkoutStatus === "success" && checkoutSessionId) {
    try {
      await confirmSubscriptionCheckoutAction(tenantId, checkoutSessionId);
    } catch {
      // Non-fatal — page renders normally; subscription reflects reality.
    }
  }

  // ── Confirm plan-change payment checkout server-side ──────────────────────
  //
  // When Stripe redirects back with ?plan_change=success&session_id=cs_xxx,
  // verify the one-time payment session and set pending_plan_paid_at on the
  // subscription row.  This works without webhooks — critical for local dev.

  if (planChangeStatus === "success" && planChangeSessionId) {
    try {
      await confirmPlanChangeCheckoutAction(tenantId, planChangeSessionId);
    } catch {
      // Non-fatal — page renders; subscription reflects reality.
    }
  }

  // ── Sync payment method on portal return ──────────────────────────────────
  //
  // When the user returns from the Stripe Billing Portal (?portal=return),
  // pull the current payment method from Stripe and persist it in the wallet.
  // This handles any card added or changed via the portal without webhooks.

  if (portalReturn) {
    try {
      await syncPaymentMethodFromStripeAction(tenantId);
    } catch {
      // Non-fatal.
    }
  }

  // ── 0. Verify admin session + resolve super admin status ──────────────────

  const adminSession      = await getRequiredAdminSession();
  const adminIsSuperAdmin = checkIsSuperAdmin(adminSession);

  // ── 1. Load tenant ────────────────────────────────────────────────────────

  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  // ── 2. Service-role client ────────────────────────────────────────────────

  const client = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  const loadErrors: LoadError[] = [];

  // ── 3a. Subscription ──────────────────────────────────────────────────────
  //
  // Direct subscriptions query is retained: it is the source of truth for
  // plan, status, and Stripe subscription IDs — not served by any wallet RPC.

  let subscription: Subscription | null = null;
  {
    const { data: sub, error: subErr } = await client
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subErr) {
      const isSchemaMissing =
        subErr.code === "42P01"    || subErr.code === "42703" ||
        subErr.code === "22P02"    || subErr.code === "PGRST200" ||
        subErr.code === "PGRST205";
      console.error("[billing/page] subscriptions query error", {
        tenantId,
        code:    subErr.code,
        message: subErr.message,
        hint:    isSchemaMissing ? "Billing migration not applied — run: supabase db push" : undefined,
      });
      loadErrors.push({
        message: isSchemaMissing
          ? "Subscriptions table is missing."
          : `Subscription could not be loaded (${subErr.code ?? "unknown error"}).`,
        isSchemaMissing,
        code: subErr.code,
      });
    }

    subscription = sub as Subscription | null;
  }

  // ── 3b. Tenant active status override ────────────────────────────────────────
  let isActiveOverride: boolean | null = null;
  {
    const { data: settingsRow } = await client
      .from("tenant_settings")
      .select("is_active_override")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    isActiveOverride = (settingsRow as { is_active_override?: boolean | null } | null)?.is_active_override ?? null;
  }

  // ── 4. Resolve plan ────────────────────────────────────────────────────────
  //
  // Priority: Stripe subscription plan → tenant package key → "starter".
  // This ensures that a manually-assigned Pro package shows "Pro" in the UI
  // even when there is no Stripe subscription linked yet.

  const planId       = (subscription?.plan ?? tenant.packageKey ?? "starter") as keyof typeof BILLING_PLANS;
  const billingCycle = (subscription?.billing_cycle ?? "monthly") as "monthly" | "annual";
  const plan         = BILLING_PLANS[planId] ?? BILLING_PLANS["starter"];

  // ── 5a. Wallet state — public.get_wallet_state(tenantId) ──────────────────
  //
  // Single RPC replaces:
  //   • ensureWallet()         — wallet row initialisation
  //   • getCreditBalance()     — tenant_wallets.balance_cents
  //   • getWalletSpend() ×2   — today spend + month spend from wallet_ledger
  //
  // Returns null pre-migration-055 — page degrades gracefully.

  let walletState: import("@/billing/wallet").WalletState | null = null;
  try {
    walletState = await getWalletState(client, tenantId);
  } catch (err) {
    rethrowNextInternal(err);
    const e = serializeError(err) as Record<string, unknown>;
    console.error(
      `[billing/page] getWalletState failed — tenantId=${tenantId} code=${e["code"] ?? "unknown"} message=${e["message"] ?? String(err)}`,
    );
    loadErrors.push({ message: "Wallet could not be loaded.", ...classifyError(err) });
  }

  // Convenience aliases — walletState is the single source of truth.
  // Prefer NUMERIC balance (migration 076) over balance_cents (INTEGER).
  // balance_cents rounds sub-credit debits to 0 (e.g. -0.01 → amount_cents=0),
  // so balances never update for tenants with sub-credit enrichment pricing.
  const currentBalance = walletState?.balance ?? walletState?.balance_cents ?? 0;
  const spendToday     = walletState?.spend_today_cents      ?? 0;
  const spendThisMonth = walletState?.spend_this_month_cents ?? 0;

  // wallet satisfies TenantWallet | null — WalletState extends TenantWallet.
  const wallet = walletState;

  // ── 5b. Usage summary — derived from walletState + plan ───────────────────
  //
  // Previously: getUsageSummary() made 3 separate DB round-trips:
  //   • subscriptions (period dates)
  //   • tenant_wallets (balance)
  //   • wallet_ledger (period aggregation)
  //
  // Now: all three data points are already in walletState.
  //   period_spend_cents — total enrichment debits since period start
  //   period_start/end   — from subscriptions (joined inside the RPC)
  //   balance_cents      — current wallet balance
  //
  // purchasedCredits (top-ups in period) is not tracked by the RPC.
  // It is used only to add a cosmetic reference line item to the estimate
  // (a $0 line "Credit bundles purchased"). Safe to omit — totalCents unaffected.

  const periodSpend = walletState?.period_spend_cents ?? 0;

  const usage: UsageSummary = {
    tenantId,
    currentBalance,
    usedCredits:      periodSpend,
    purchasedCredits: 0,
    // The three fields below are all zero because the wallet model has no plan
    // credit allowance and no overage — see billing/calculator.ts. They are
    // required on UsageSummary and were simply omitted here, which typechecked
    // only because next.config ignored build errors. Spelled out rather than
    // made optional: the calculator reads them, and a silently-undefined number
    // in a billing path is how `undefined > 0` bugs start.
    includedCredits:  0,   // no plan allowance — credits are bought separately
    deductedCredits:  periodSpend,  // raw ledger debits; equals usedCredits with no cap
    overageCredits:   0,   // there is no overage billing
    periodStart:      walletState?.period_start ?? subscription?.current_period_start ?? null,
    periodEnd:        walletState?.period_end   ?? subscription?.current_period_end   ?? null,
  };

  // ── 5c. Billing estimate (pure function — no DB calls) ─────────────────────

  const estimate = calculateBillingEstimate(tenantId, planId, billingCycle, usage);

  // ── 5d. Usage event summary + reconciliation debug data ───────────────────
  //        Only loaded when the subscription has period dates to query against.
  //        Source: usage_events table (legacy event system — separate from wallet).

  let usageEventSummary: Awaited<ReturnType<typeof getUsageEventSummary>> | null = null;
  let debugData: {
    usageEventCredits: number;
    ledgerDeductions:  number;
    usageEventCount:   number;
    discrepancy:       number;
  } | undefined;

  const periodStart = usage.periodStart;
  const periodEnd   = usage.periodEnd;

  if (periodStart && periodEnd) {
    try {
      usageEventSummary = await getUsageEventSummary(
        client,
        tenantId,
        periodStart,
        periodEnd,
      );

      const usageEventCredits = usageEventSummary.totalCredits;
      // Use raw deductedCredits (not usedCredits which is capped at includedCredits).
      // The cap causes a permanent phantom discrepancy when usage exceeds the plan quota.
      const ledgerDeductions  = usage.deductedCredits ?? Math.abs(usage.usedCredits);

      debugData = {
        usageEventCredits,
        ledgerDeductions,
        usageEventCount: usageEventSummary.totalCalls,
        // Only meaningful when both sides have data — if usage_events is empty
        // (legacy system not in use), the comparison is noise.
        discrepancy:     usageEventCredits > 0
          ? Math.round(Math.abs(usageEventCredits - ledgerDeductions) * 100) / 100
          : 0,
      };
    } catch (err) {
    rethrowNextInternal(err);
      const e = serializeError(err) as Record<string, unknown>;
      console.error(
        `[billing/page] getUsageEventSummary failed — tenantId=${tenantId} code=${e["code"] ?? "unknown"} message=${e["message"] ?? String(err)}`,
      );
      loadErrors.push({ message: "Usage event breakdown could not be loaded.", ...classifyError(err) });
    }
  }

  // ── 6. Detail queries — ledger history + enrichment breakdown ─────────────
  //
  // All detail reads go through the RPC layer.

  // ── 6a. Ledger history — public.get_wallet_ledger(tenantId, limit, offset) ─
  //
  // SECURITY DEFINER RPC returning wallet_ledger rows ordered by created_at DESC.
  // Falls back to direct table query on pre-migration-057 deployments.
  // Replaces: getCreditHistory() (direct wallet_ledger SELECT mapped to CreditTransaction[]).

  // Fetch one extra row beyond the page size to detect whether a next page exists.
  // The extra row is sliced off before rendering — it never reaches the client.
  let walletLedger: Awaited<ReturnType<typeof getWalletLedger>> = [];
  let ledgerHasNext = false;
  try {
    const raw = await getWalletLedger(
      client,
      tenantId,
      ledgerPageSize + 1,
      ledgerPage * ledgerPageSize,
    );
    ledgerHasNext = raw.length > ledgerPageSize;
    walletLedger  = raw.slice(0, ledgerPageSize);
  } catch (err) {
    rethrowNextInternal(err);
    const e = serializeError(err) as Record<string, unknown>;
    console.warn(
      `[billing/page] getWalletLedger error — tenantId=${tenantId} code=${e["code"] ?? "unknown"} message=${e["message"] ?? String(err)}`,
    );
  }

  // ── 6b. Enrichment breakdown — public.get_wallet_breakdown(tenantId) ───────
  //
  // Single SQL GROUP BY replacing JS-side aggregation of raw enrichment_usage rows.
  // Returns EnrichmentUsageSummaryRow[] — identical shape to old getEnrichmentUsageSummary().
  // periodKey omitted → RPC defaults to the current UTC calendar month.
  // Empty period → [] returned cleanly; UI renders "no usage yet" empty state.

  let enrichmentUsageSummary: import("@/billing/enrichment-usage").EnrichmentUsageSummaryRow[] = [];
  let totalEnrichmentSpendCents = 0;
  try {
    enrichmentUsageSummary = await getWalletBreakdown(client, tenantId);
    totalEnrichmentSpendCents = enrichmentUsageSummary.reduce(
      (sum, r) => sum + r.total_price_cents,
      0,
    );
  } catch (err) {
    rethrowNextInternal(err);
    const e = serializeError(err) as Record<string, unknown>;
    console.warn(
      `[billing/page] getWalletBreakdown error — tenantId=${tenantId} code=${e["code"] ?? "unknown"} message=${e["message"] ?? String(err)}`,
    );
  }

  // ── 6c. Recent reload attempts ─────────────────────────────────────────────
  //        No RPC exists for this — direct table query is appropriate.

  let reloadAttempts: Awaited<ReturnType<typeof getRecentReloadAttempts>> = [];
  try {
    reloadAttempts = await getRecentReloadAttempts(client, tenantId, 15);
  } catch (err) {
    rethrowNextInternal(err);
    const e = serializeError(err) as Record<string, unknown>;
    console.warn(
      `[billing/page] getRecentReloadAttempts error — tenantId=${tenantId} code=${e["code"] ?? "unknown"} message=${e["message"] ?? String(err)}`,
    );
  }

  // ── 7. Wallet test-mode availability (env flag — server-only) ─────────────

  const isTestModeAvailable = isTestModeEnabled();

  // ── 8. Stripe mode info + recent webhook events ────────────────────────────

  const stripeModeInfo = getStripeModeInfo();

  // ── 8a. Chameleon Credits settings ────────────────────────────────────────
  //        Stored in platform_settings; returns safe defaults when no row exists.

  let creditSettings: CreditSettings = { ...CREDIT_SETTINGS_DEFAULTS };
  {
    const result = await getCreditSettingsAction(tenantId);
    if (result.ok) {
      creditSettings = result.settings;
    } else {
      console.warn(
        `[billing/page] getCreditSettingsAction failed — tenantId=${tenantId} error=${result.error}`,
      );
    }
  }

  let webhookEvents: Awaited<ReturnType<typeof getRecentWebhookEvents>> = [];
  try {
    webhookEvents = await getRecentWebhookEvents(client, tenantId, 20);
  } catch (err) {
    rethrowNextInternal(err);
    const e = serializeError(err) as Record<string, unknown>;
    console.warn(
      `[billing/page] getRecentWebhookEvents error — tenantId=${tenantId} code=${e["code"] ?? "unknown"} message=${e["message"] ?? String(err)}`,
    );
  }

  // ── 8b. Session usage + session credit ledger ─────────────────────────────
  //        Uses the same service-role client pattern as the rest of the page.
  //        Fails open — if the personalization_sessions table doesn't exist yet
  //        (migration 020 not applied), the tab renders with zeros.

  let sessionCap: SessionCapResult = {
    overLimit: false, current: 0, limit: 0,
    planLimit: 0, bonusSessions: 0,
    monthKey: new Date().toISOString().slice(0, 7),
  };
  let sessionLedger: SessionCreditLedgerEntry[] = [];

  try {
    [sessionCap, sessionLedger] = await Promise.all([
      checkSessionSoftCap(tenantId),
      getSessionCreditLedger(tenantId, 50),
    ]);
  } catch (err) {
    rethrowNextInternal(err);
    console.warn("[billing/page] session data fetch failed:", err);
  }

  // ── 9. Resolve credit bundles (env → DB fallback) ─────────────────────────
  //
  // Stripe Price IDs are resolved at runtime: env var first (same source as
  // keys during local dev), then platform_settings DB (admin-configured for prod).

  const creditBundles = await getResolvedCreditBundles();

  // ── 10. Dunning settings ───────────────────────────────────────────────────

  const dunningResult  = await getDunningSettingsAction(tenantId).catch(() => null);
  const dunningSettings = dunningResult?.ok ? dunningResult.data : null;

  // ── 11. Stripe invoice history ────────────────────────────────────────────
  //   Fetched in parallel with dunning; fails open so the rest of the page
  //   still loads even if Stripe is unreachable or not configured.

  const invoicesResult  = await getStripeInvoicesAction(tenantId).catch(() => null);
  const stripeInvoices: StripeInvoiceRow[] = invoicesResult?.ok ? invoicesResult.invoices : [];
  const stripeInvoicesError: string | null = invoicesResult && !invoicesResult.ok ? invoicesResult.error : null;
  const stripeCustomerId: string | null    = invoicesResult?.customerId ?? null;

  // ── 12. Render ─────────────────────────────────────────────────────────────

  // Advertiser accounts are metered per impression/click against the wallet, not
  // on a subscription — show the focused advertiser billing view instead of the
  // full subscription/enrichment dashboard. `?full=1` falls through to the
  // standard page (for the Stripe wallet top-up).
  if (tenant?.tenantRole === "advertiser" && String(sp["full"] ?? "") !== "1") {
    let topup: "success" | "already" | "cancelled" | null = null;
    let advBalance = currentBalance;
    let advLedger  = walletLedger;
    const topupParam = String(sp["topup"] ?? "");
    if (topupParam === "cancelled") {
      topup = "cancelled";
    } else if (topupParam === "success") {
      const csid = String(sp["session_id"] ?? "");
      if (csid) {
        const res = await confirmAdTopUpAction(tenantId, csid);
        if (res.ok) {
          topup = res.alreadyCredited ? "already" : "success";
          // The credit lands after walletState/walletLedger were read above, so
          // re-read both — otherwise the balance and the transactions list would
          // still show pre-top-up values until the next page load.
          const [w, freshLedger] = await Promise.all([
            getWalletState(client, tenantId).catch(() => null),
            getWalletLedger(client, tenantId, ledgerPageSize, 0).catch(() => null),
          ]);
          if (w) advBalance = (w.balance ?? w.balance_cents ?? 0) as number;
          if (freshLedger) advLedger = freshLedger;
        }
      }
    }
    return (
      <AdvertiserBilling
        tenantId={tenantId}
        balanceCents={advBalance}
        spendThisMonthCents={spendThisMonth}
        ledger={advLedger as unknown as Parameters<typeof AdvertiserBilling>[0]["ledger"]}
        topup={topup}
      />
    );
  }

  return (
    <div className="max-w-5xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Billing & Wallet</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Subscription plan, enrichment wallet, and usage for{" "}
          <span className="font-medium text-neutral-700">{tenant.name ?? tenantId}</span>.
        </p>
      </div>

      {loadErrors.length > 0 && <AdminErrorCard errors={loadErrors} />}

      <BillingDashboard
        tenantId={tenantId}
        tenantPackage={tenant.packageKey as string | undefined}
        subscription={subscription}
        plan={plan}
        currentBalance={currentBalance}
        usage={usage}
        estimate={estimate}
        allPlans={Object.values(BILLING_PLANS)}
        usageEventSummary={usageEventSummary}
        debugData={debugData}
        wallet={wallet}
        walletLedger={walletLedger}
        ledgerPage={ledgerPage}
        ledgerPageSize={ledgerPageSize}
        ledgerHasNext={ledgerHasNext}
        spendToday={spendToday}
        spendThisMonth={spendThisMonth}
        enrichmentUsageSummary={enrichmentUsageSummary}
        totalEnrichmentSpendCents={totalEnrichmentSpendCents}
        reloadAttempts={reloadAttempts}
        isTestModeAvailable={isTestModeAvailable}
        stripeModeInfo={stripeModeInfo}
        webhookEvents={webhookEvents}
        creditSettings={creditSettings}
        isSuperAdmin={adminIsSuperAdmin}
        isActiveOverride={isActiveOverride}
        creditBundles={creditBundles}
        buyStatus={buyStatus}
        boughtBundleId={boughtBundleId}
        checkoutStatus={checkoutStatus}
        planChangeStatus={planChangeStatus}
        sessionCap={sessionCap}
        sessionLedger={sessionLedger}
        sessionBundles={SESSION_CREDIT_BUNDLES}
        sessionBuyStatus={sessionBuyStatus}
        sessionBoughtBundleId={sessionBoughtBundleId}
        dunningSettings={dunningSettings}
        stripeInvoices={stripeInvoices}
        stripeInvoicesError={stripeInvoicesError}
        stripeCustomerId={stripeCustomerId}
      />
    </div>
  );
}
