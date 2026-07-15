"use client";

/**
 * BillingDashboard.tsx
 *
 * Tenant billing admin dashboard — all 11 parts of the billing UI spec.
 *
 * ─── Tab structure ────────────────────────────────────────────────────────────
 *
 *   Credits & Usage  — balance hero, category breakdown, feature table,
 *                      budget cap, cost controls  (default landing)
 *   Wallet           — Stripe status, auto-reload config, notifications
 *   History          — full wallet transaction ledger
 *   Plan             — subscription plan + plan comparison
 *   Debug            — raw wallet data, anomalies, blocked enrichments
 *
 * ─── Client component ─────────────────────────────────────────────────────────
 *
 *   All data is passed in as props (loaded in the server component page.tsx).
 *   Interactive sections (budget cap save, auto-reload save, toggles) use
 *   useTransition + server actions.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { BillingPlan, BillingEstimate, UsageSummary, CreditBundle }
  from "@/billing/types";
import type { TenantWallet, WalletLedgerEntry, EnrichmentUsageSummaryRow,
  WalletReloadAttempt, StripeModeInfo, WalletWebhookEvent, UsageEventSummary }
  from "@/billing/types";
import type { CreditSettings }  from "@/billing/credits";
import type { SessionCapResult, SessionCreditLedgerEntry } from "@/billing/plan-enforcement";
import type { SessionCreditBundle } from "@/billing/plans";
import {
  CREDIT_CATEGORIES,
  computeCategoryBreakdown,
  getEffectiveMode,
  estimateSavings,
  creditsToEuro,
  FALLBACK_MODE_ORDER,
} from "@/billing/credits";
import { CREDIT_PRICING_DEFAULTS } from "@/billing/pricing";
import {
  LABELS,
  WALLET_STATUS,
  CATEGORY_COPY,
  FALLBACK_MODE_COPY,
  ANOMALY_LABELS,
  EMPTY_STATES,
  featureName,
  ledgerTypeLabel,
} from "@/billing/copy";
import {
  saveCreditSettingsAction,
  saveWalletCapAction,
  saveAutoReloadAction,
  saveNotificationSettingsAction,
  addCreditsAction,
  reactivateWalletAction,
  updateSubscriptionAction,
  createSubscriptionAction,
  activatePendingPlanNowAction,
  renewSubscriptionNowAction,
  syncSubscriptionFromStripeAction,
} from "../actions";
import type { AddCreditsAdjustmentType, UpdateSubscriptionInput } from "../actions";
import type { TenantDunningSettings } from "@/billing/dunning";
import { DunningSettingsPanel } from "@/components/admin/DunningSettingsPanel";
import { usePagination, PaginationControls } from "@/components/admin/Pagination";
import type { StripeInvoiceRow } from "../actions";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = "credits" | "wallet" | "subscription" | "sessions" | "payments" | "debug";

// UsageSummary is imported from billing/types — local alias removed.

interface DebugData {
  usageEventCredits: number;
  ledgerDeductions:  number;
  usageEventCount:   number;
  discrepancy:       number;
}

interface Subscription {
  id:                     string;
  tenant_id:              string;
  stripe_customer_id:     string | null;
  stripe_subscription_id: string | null;
  plan:                   string;
  status:                 string;
  billing_cycle:          string;
  current_period_start:   string | null;
  current_period_end:     string | null;
  trial_end:              string | null;
  cancel_at_period_end:   boolean;
  canceled_at:            string | null;
  pending_plan?:                string | null;
  pending_plan_billing_cycle?:  string | null;
  pending_plan_effective_date?: string | null;
  pending_plan_paid_at?:        string | null;
  created_at:             string;
  updated_at:             string;
}

export interface BillingDashboardProps {
  tenantId:                  string;
  /**
   * The tenant's assigned package key (e.g. "pro"), set via tenant settings.
   * May differ from the Stripe subscription plan when the package is manually
   * assigned without a linked Stripe subscription.
   */
  tenantPackage?:            string;
  subscription:              Subscription | null;
  plan:                      BillingPlan;
  currentBalance:            number;
  /**
   * Usage summary derived from walletState in page.tsx.
   * period_spend_cents → usedCredits.
   * Period dates from walletState.period_start / period_end.
   */
  usage:                     UsageSummary;
  estimate:                  BillingEstimate;
  allPlans:                  BillingPlan[];
  usageEventSummary:         UsageEventSummary | null;
  debugData:                 DebugData | undefined;
  wallet:                    TenantWallet | null;
  /**
   * Append-only wallet transaction history for this tenant.
   *
   * Data source: `public.get_wallet_ledger` RPC (migration 057) —
   * a SECURITY DEFINER function returning wallet_ledger rows ordered
   * by created_at DESC.  Falls back to a direct table query on
   * pre-migration-057 deployments.
   *
   * Each entry carries: id, entry_type, category, amount_cents,
   * balance_after_cents, reference_type, reference_id, note, simulated,
   * created_at.  Empty array = no ledger history yet → LedgerTable
   * renders the no_transactions empty state.
   */
  walletLedger:              WalletLedgerEntry[];
  /** Current 0-based page index for the ledger table. */
  ledgerPage:                number;
  /** Number of rows per page (matches LEDGER_PAGE_SIZE in page.tsx). */
  ledgerPageSize:            number;
  /** True when a page after the current one exists. */
  ledgerHasNext:             boolean;
  spendToday:                number;
  spendThisMonth:            number;
  /**
   * Per-feature enrichment usage for the current calendar month.
   *
   * Data source: `public.get_wallet_breakdown` RPC (migration 056) —
   * a single SQL GROUP BY replacing the previous JS-side aggregation of
   * raw enrichment_usage rows.
   *
   * Shape is identical to the old EnrichmentUsageSummaryRow[] — all
   * downstream consumers (computeCategoryBreakdown, FeatureBreakdownTable,
   * CostControlCard, DebugPanel) continue to work without modification.
   *
   * Empty array = no enrichment usage yet in this period → each section
   * renders its own "no usage yet" empty state.
   */
  enrichmentUsageSummary:    EnrichmentUsageSummaryRow[];
  /**
   * Sum of total_price_cents across all enrichmentUsageSummary rows.
   * Computed in page.tsx from the RPC results — no separate DB round-trip.
   */
  totalEnrichmentSpendCents: number;
  reloadAttempts:            WalletReloadAttempt[];
  isTestModeAvailable:       boolean;
  stripeModeInfo:            StripeModeInfo;
  webhookEvents:             WalletWebhookEvent[];
  creditSettings:            CreditSettings;
  /** Whether the current admin session has superadmin privileges. */
  isSuperAdmin:              boolean;
  /**
   * Super-admin override for tenant active status.
   * NULL = auto (subscription-driven). TRUE = force active. FALSE = force disabled.
   */
  isActiveOverride?:         boolean | null;
  /**
   * Credit bundles available for purchase, resolved server-side so that
   * STRIPE_PRICE_* env vars (non-NEXT_PUBLIC_) are always present.
   */
  creditBundles:             CreditBundle[];
  /**
   * Result of a Stripe credit-bundle checkout redirect.
   * "success"   — checkout.session.completed fired; credits pending webhook.
   * "cancelled" — user dismissed the Stripe checkout.
   */
  buyStatus?:      "success" | "cancelled";
  /** Bundle ID that was just purchased (only present when buyStatus="success"). */
  boughtBundleId?: string;
  /**
   * Result of a Stripe subscription checkout redirect (?checkout=…).
   * "success"   — user completed checkout; subscription row may still be pending webhook.
   * "cancelled" — user dismissed the checkout without paying.
   */
  checkoutStatus?: "success" | "cancelled";
  /**
   * Result of a one-time plan-change payment redirect (?plan_change=…).
   * "success"   — payment received; pending_plan_paid_at set on the subscription.
   * "cancelled" — user dismissed the checkout.
   */
  planChangeStatus?: "success" | "cancelled";

  /** Current month's personalised session cap status from checkSessionSoftCap(). */
  sessionCap:    SessionCapResult;
  /** Session credit purchase/deduction ledger from getSessionCreditLedger(). */
  sessionLedger: SessionCreditLedgerEntry[];
  /**
   * Session credit bundles available for purchase. Resolved server-side so that
   * STRIPE_PRICE_SESSIONS_* env vars are always present.
   */
  sessionBundles:      SessionCreditBundle[];
  /**
   * Result of a Stripe session-bundle checkout redirect (?session_bundle=…).
   * "success"   — checkout completed; credits credited via confirmSessionBundlePurchaseAction.
   * "cancelled" — user dismissed the checkout.
   */
  sessionBuyStatus?:      "success" | "cancelled";
  /** Bundle ID that was just purchased (only present when sessionBuyStatus="success"). */
  sessionBoughtBundleId?: string;
  /**
   * Dunning (payment-due) settings for this tenant.
   * When present, the Payment Due Notifications panel is shown in the Plan tab.
   */
  dunningSettings?: TenantDunningSettings | null;
  /** Stripe payment history for this tenant. */
  stripeInvoices?: StripeInvoiceRow[];
  /** Non-null when getStripeInvoicesAction returned an error. Shown in the Payments tab. */
  stripeInvoicesError?: string | null;
  /** The Stripe customer ID that was used for the lookup (for diagnostics). */
  stripeCustomerId?: string | null;
}

// ── Utility helpers ────────────────────────────────────────────────────────────

function fmtEuro(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// ── Wallet status classifier ──────────────────────────────────────────────────

function classifyWalletStatus(
  wallet: TenantWallet | null,
  spendThisMonth: number,
  creditSettings: CreditSettings,
): keyof typeof WALLET_STATUS {
  if (!wallet) return "no_wallet";
  if (wallet.status === "frozen")    return "frozen";
  if (wallet.status === "suspended") return "suspended";

  // Prefer NUMERIC balance (migration 076) over balance_cents (INTEGER).
  // balance_cents rounds sub-credit debits to 0 (ROUND(0.01) = 0), so a
  // wallet at 99.99 credits would show as 100 — never reaching 0 via tiny debits.
  const balance = wallet.balance ?? wallet.balance_cents ?? 0;
  if (balance <= 0) return "empty";

  const cap = (wallet as unknown as Record<string, unknown>)["monthly_credit_cap_cents"] as number ?? 0;
  if (cap > 0 && spendThisMonth >= cap) return "cap_reached";

  const threshold = wallet.low_balance_threshold_cents ?? 500;
  if (balance <= threshold) return "low";

  return "healthy";
}

// ── Shared UI primitives ───────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{children}</h2>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="mb-2 text-3xl opacity-20">○</div>
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-neutral-400">{body}</p>
      {cta && (
        <button className="mt-3 rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
          {cta}
        </button>
      )}
    </div>
  );
}

function SaveButton({ pending, saved, label = "Save changes" }: { pending: boolean; saved: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : saved ? "✓ Saved" : label}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={`h-5 w-9 rounded-full transition-colors ${checked ? "bg-neutral-800" : "bg-neutral-300"}`}>
        <div className={`mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </div>
    </label>
  );
}

// ── PART 1: Balance Hero ───────────────────────────────────────────────────────

function BalanceHero({
  wallet,
  spendToday,
  spendThisMonth,
  statusKey,
  tenantId,
  isSuperAdmin,
}: {
  wallet:         TenantWallet | null;
  spendToday:     number;
  spendThisMonth: number;
  statusKey:      keyof typeof WALLET_STATUS;
  tenantId:       string;
  isSuperAdmin:   boolean;
}) {
  const [reactivating, setReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  async function handleReactivate() {
    setReactivating(true);
    setReactivateError(null);
    try {
      const res = await reactivateWalletAction(tenantId);
      if (!res.ok) {
        setReactivateError(res.error);
      } else {
        // Refresh the page to load the updated wallet status
        window.location.reload();
      }
    } finally {
      setReactivating(false);
    }
  }

  // Soften the "empty" state for a healthy tenant that simply never topped up:
  // a 0 balance with no enrichment spend this month is not an error, so show it
  // neutral (grey) instead of alarming red. Genuine exhaustion (spend > 0) keeps
  // the red treatment.
  const baseStatus = WALLET_STATUS[statusKey];
  const softEmpty  = statusKey === "empty" && spendThisMonth <= 0;
  const status = softEmpty
    ? {
        ...baseStatus,
        label:      "No credits",
        icon:       "○",
        badgeBg:    "bg-neutral-100",
        badgeText:  "text-neutral-500",
        heroBorder: "border-neutral-200",
        accent:     "text-neutral-400",
      }
    : baseStatus;
  // Prefer NUMERIC balance (migration 076/089) so sub-credit debits
  // (e.g. -0.01 credits) are reflected immediately.  balance_cents is an
  // INTEGER rounded with ROUND(), so it never changes for debit amounts < 0.5.
  const balance = wallet?.balance ?? wallet?.balance_cents ?? 0;

  const dayOfMonth    = new Date().getDate();
  const forecastCents = dayOfMonth > 0 ? Math.round((spendThisMonth / dayOfMonth) * 30) : 0;

  const cap = (wallet as Record<string, unknown> | null)?.["monthly_credit_cap_cents"] as number | undefined ?? 0;

  return (
    <div className={`mb-6 rounded-xl border-2 ${status.heroBorder} bg-white p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {LABELS.SECTION_BALANCE}
          </p>
          <div className="mt-1 flex items-end gap-3">
            <span className="text-4xl font-bold tracking-tight text-neutral-900">
              {balance.toLocaleString("nl-NL")}
            </span>
            <span className="mb-1 text-lg text-neutral-400">cr</span>
            <span className="mb-1 text-base text-neutral-400">{creditsToEuro(balance)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.badgeBg} ${status.badgeText}`}>
              {status.icon} {status.label}
            </span>
            {(statusKey === "suspended" || statusKey === "frozen") && (
              <>
                <p className="text-xs text-red-600">{status.description}</p>
                {isSuperAdmin && (
                  <button
                    onClick={handleReactivate}
                    disabled={reactivating}
                    className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {reactivating ? "Reactivating…" : "Reactivate wallet"}
                  </button>
                )}
                {reactivateError && (
                  <p className="text-xs text-red-600">{reactivateError}</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 text-right">
          {[
            { label: "Today",        val: spendToday },
            { label: "This month",   val: spendThisMonth },
            { label: "Est. monthly", val: forecastCents },
          ].map(({ label, val }) => (
            <div key={label}>
              <p className="text-xs text-neutral-400">{label}</p>
              <p className="text-lg font-semibold text-neutral-800">{val.toLocaleString("nl-NL")} cr</p>
              <p className="text-xs text-neutral-400">{fmtEuro(val)}</p>
            </div>
          ))}
        </div>
      </div>

      {cap > 0 && (
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
            <span>Monthly budget cap</span>
            <span>{spendThisMonth.toLocaleString("nl-NL")} / {cap.toLocaleString("nl-NL")} cr</span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-100">
            <div
              className={`h-2 rounded-full transition-all ${
                spendThisMonth >= cap ? "bg-red-400" :
                spendThisMonth >= cap * 0.8 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${clamp((spendThisMonth / cap) * 100, 0, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Alert banners ─────────────────────────────────────────────────────────────

function AlertBanners({
  wallet,
  reloadAttempts,
  statusKey,
  spendThisMonth,
}: {
  wallet:         TenantWallet | null;
  reloadAttempts: WalletReloadAttempt[];
  statusKey:      keyof typeof WALLET_STATUS;
  spendThisMonth: number;
}) {
  const alerts: { icon: string; msg: string; level: "red" | "amber" }[] = [];

  if (statusKey === "frozen")      alerts.push({ icon: "❄", msg: ANOMALY_LABELS.WALLET_FROZEN,       level: "red"   });
  if (statusKey === "suspended")   alerts.push({ icon: "⊘", msg: ANOMALY_LABELS.WALLET_SUSPENDED,    level: "red"   });
  // no_wallet had no branch at all, so a tenant without a wallet showed no alert
  // whatsoever — while paid enrichment silently could not run. Two tenants sat
  // like that for weeks: hundreds of usage_events, zero ledger entries.
  if (statusKey === "no_wallet")   alerts.push({ icon: "○", msg: ANOMALY_LABELS.NO_WALLET_INITIALIZED, level: "red" });
  // An empty wallet is only a genuine "exhausted" problem when the tenant has
  // actually consumed enrichment this month. A healthy subscribed tenant that
  // simply never bought (optional) enrichment credits gets a neutral note, not
  // a scary red banner — the subscription and personalised sessions are separate.
  if (statusKey === "empty" && spendThisMonth > 0)
    alerts.push({ icon: "✕", msg: ANOMALY_LABELS.CREDITS_EXHAUSTED, level: "red" });
  if (statusKey === "empty" && spendThisMonth <= 0)
    alerts.push({ icon: "○", msg: ANOMALY_LABELS.NO_ENRICHMENT_CREDITS, level: "amber" });
  if (statusKey === "low")         alerts.push({ icon: "⚠", msg: ANOMALY_LABELS.LOW_BALANCE,         level: "amber" });
  if (statusKey === "cap_reached") alerts.push({ icon: "◎", msg: ANOMALY_LABELS.MONTHLY_CAP_REACHED, level: "amber" });
  if (reloadAttempts[0]?.status === "failed")
    alerts.push({ icon: "↺", msg: ANOMALY_LABELS.AUTO_RELOAD_FAILED, level: "red" });
  if (wallet?.auto_reload_enabled && !wallet.stripe_payment_method_id)
    alerts.push({ icon: "💳", msg: ANOMALY_LABELS.AUTO_RELOAD_NO_METHOD, level: "amber" });

  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.map((a, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${
            a.level === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          <span>{a.icon}</span>
          <p className="text-sm">{a.msg}</p>
        </div>
      ))}
    </div>
  );
}

// ── Tab navigation ─────────────────────────────────────────────────────────────

function TabNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "credits",      label: LABELS.TAB_CREDITS },
    { id: "wallet",       label: "Enrichment Wallet" },
    { id: "subscription", label: LABELS.TAB_SUBSCRIPTION },
    { id: "sessions",     label: "Sessions" },
    { id: "payments",     label: "Payments" },
    { id: "debug",        label: LABELS.TAB_DEBUG },
  ];

  return (
    <div className="mb-6 flex gap-1 border-b border-neutral-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === t.id
              ? "border-b-2 border-neutral-900 text-neutral-900"
              : "text-neutral-400 hover:text-neutral-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── PARTS 2–3: Category cards + Feature table ─────────────────────────────────

function CategoryCard({
  category,
  totalCredits,
  totalCalls,
  freshCalls,
  cacheHits,
  blockedCalls,
  pctOfTotal,
}: {
  category:     "recognition" | "adaptation" | "brainpower";
  totalCredits: number;
  totalCalls:   number;
  freshCalls:   number;
  cacheHits:    number;
  blockedCalls: number;
  pctOfTotal:   number;
}) {
  const copy = CATEGORY_COPY[category];
  const meta = CREDIT_CATEGORIES[category];

  const colours = {
    blue:   { bar: "bg-blue-400",   badge: "bg-blue-100 text-blue-700",     icon: "text-blue-500"   },
    purple: { bar: "bg-purple-400", badge: "bg-purple-100 text-purple-700", icon: "text-purple-500" },
    orange: { bar: "bg-orange-400", badge: "bg-orange-100 text-orange-700", icon: "text-orange-500" },
  }[meta.color];

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xl ${colours.icon}`}>{copy.icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">{copy.label}</h3>
            <p className="text-xs text-neutral-400">{copy.tagline}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colours.badge}`}>
          {copy.costLabel}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-500">{copy.explanation}</p>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
          <span>Credits used</span>
          <span className="font-medium text-neutral-700">{totalCredits.toLocaleString("nl-NL")} cr</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-100">
          <div className={`h-1.5 rounded-full ${colours.bar}`} style={{ width: `${clamp(pctOfTotal, 0, 100)}%` }} />
        </div>
        <p className="mt-0.5 text-right text-xs text-neutral-400">{Math.round(pctOfTotal)}% of total</p>
      </div>

      {totalCalls > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 text-center text-xs">
          <div>
            <p className="font-semibold text-neutral-800">{totalCalls.toLocaleString("nl-NL")}</p>
            <p className="text-neutral-400">calls</p>
          </div>
          <div>
            <p className="font-semibold text-emerald-600">{cacheHits.toLocaleString("nl-NL")}</p>
            <p className="text-neutral-400">cached (free)</p>
          </div>
          <div>
            <p className="font-semibold text-red-500">{blockedCalls.toLocaleString("nl-NL")}</p>
            <p className="text-neutral-400">blocked</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-neutral-300">No usage this period</p>
      )}
    </Card>
  );
}

function FeatureBreakdownTable({ rows }: { rows: EnrichmentUsageSummaryRow[] }) {
  if (rows.length === 0) return <EmptyState {...EMPTY_STATES.no_usage} />;

  const sorted = [...rows].sort((a, b) => b.total_price_cents - a.total_price_cents);

  const catBadge: Record<string, string> = {
    recognition: "bg-blue-100 text-blue-700",
    adaptation:  "bg-purple-100 text-purple-700",
    brainpower:  "bg-orange-100 text-orange-700",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs font-medium text-neutral-400">
            <th className="pb-2 pr-4">Feature</th>
            <th className="pb-2 pr-4">Category</th>
            <th className="pb-2 pr-4 text-right">Total calls</th>
            <th className="pb-2 pr-4 text-right">Billable</th>
            <th className="pb-2 pr-4 text-right">Cached</th>
            <th className="pb-2 pr-4 text-right">Blocked</th>
            <th className="pb-2 pr-4 text-right">cr / call</th>
            <th className="pb-2 text-right">Credits used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {sorted.map((row, idx) => {
            // enrichment_type may be null/undefined for legacy rows — guard everywhere
            const featureKey = row.enrichment_type || null;
            const pricing   = featureKey ? CREDIT_PRICING_DEFAULTS[featureKey] : undefined;
            const crPerCall = pricing?.customer_price_cents ?? 3;
            const category  = pricing?.category ?? "recognition";
            return (
              <tr key={featureKey ?? `unknown-${idx}`} className="hover:bg-neutral-50">
                <td className="py-2.5 pr-4 font-medium text-neutral-800">{featureName(featureKey)}</td>
                <td className="py-2.5 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catBadge[category] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-neutral-600">{row.call_count.toLocaleString("nl-NL")}</td>
                <td className="py-2.5 pr-4 text-right text-neutral-600">{row.fresh_call_count.toLocaleString("nl-NL")}</td>
                <td className="py-2.5 pr-4 text-right text-emerald-600">{row.cache_hit_count.toLocaleString("nl-NL")}</td>
                <td className="py-2.5 pr-4 text-right text-red-500">{row.blocked_count.toLocaleString("nl-NL")}</td>
                <td className="py-2.5 pr-4 text-right text-neutral-500">{crPerCall} cr</td>
                <td className="py-2.5 text-right font-semibold text-neutral-800">
                  {row.total_price_cents.toLocaleString("nl-NL")} cr
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-200">
            <td colSpan={7} className="pt-2.5 text-sm font-medium text-neutral-500">Total</td>
            <td className="pt-2.5 text-right text-sm font-bold text-neutral-900">
              {rows.reduce((s, r) => s + r.total_price_cents, 0).toLocaleString("nl-NL")} cr
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── PART 5: Budget cap card ───────────────────────────────────────────────────

function BudgetCapCard({
  tenantId,
  wallet,
  creditSettings,
  spendThisMonth,
}: {
  tenantId:       string;
  wallet:         TenantWallet | null;
  creditSettings: CreditSettings;
  spendThisMonth: number;
}) {
  const [pending, startTransition] = useTransition();
  const [saved,   setSaved]        = useState(false);

  const walletCap      = (wallet as Record<string, unknown> | null)?.["monthly_credit_cap_cents"] as number | undefined;
  const walletFallback = (wallet as Record<string, unknown> | null)?.["fallback_mode"] as string | undefined;

  const [capValue,  setCapValue]  = useState(String(walletCap ?? creditSettings.monthlyLimitCredits ?? 0));
  const [fallback,  setFallback]  = useState((walletFallback ?? creditSettings.fallbackMode ?? "smart_lite") as "full_adaptive" | "smart_lite" | "default");

  const capCents = parseInt(capValue, 10) || 0;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveWalletCapAction(tenantId, { monthlyCreditCapCents: capCents, fallbackMode: fallback });
      if (r.ok) setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <Card>
      <SectionTitle sub="Set a monthly spend limit and choose what happens when it's reached.">
        {LABELS.SECTION_BUDGET}
      </SectionTitle>
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Monthly credit cap <span className="font-normal text-neutral-400">(0 = unlimited)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" step="100" value={capValue}
              onChange={(e) => setCapValue(e.target.value)}
              className="w-40 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
            <span className="text-sm text-neutral-400">credits</span>
            {capCents > 0 && <span className="text-xs text-neutral-400">≈ {fmtEuro(capCents)}</span>}
          </div>
          {capCents > 0 && (
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-xs text-neutral-400">
                <span>This month: {spendThisMonth.toLocaleString("nl-NL")} cr</span>
                <span>{Math.round(clamp((spendThisMonth / capCents) * 100, 0, 100))}% used</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-100">
                <div
                  className={`h-2 rounded-full transition-all ${
                    spendThisMonth >= capCents * 0.9 ? "bg-red-400" :
                    spendThisMonth >= capCents * 0.7 ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${clamp((spendThisMonth / capCents) * 100, 0, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-neutral-600">When cap is reached, switch to</label>
          <div className="space-y-2">
            {FALLBACK_MODE_ORDER.map((mode) => {
              const copy = FALLBACK_MODE_COPY[mode];
              return (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    fallback === mode ? "border-neutral-800 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <input type="radio" name="fallback_mode" value={mode} checked={fallback === mode}
                    onChange={() => setFallback(mode as typeof fallback)} className="mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-neutral-800">{copy.label}</span>
                    <span className="ml-2 text-xs text-neutral-400">{copy.tag}</span>
                    <p className="mt-0.5 text-xs text-neutral-500">{copy.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <SaveButton pending={pending} saved={saved} />
        </div>
      </form>
    </Card>
  );
}

// ── PART 7: Cost control toggles ──────────────────────────────────────────────

function CostControlCard({
  tenantId,
  creditSettings,
  enrichmentUsageSummary,
}: {
  tenantId:               string;
  creditSettings:         CreditSettings;
  enrichmentUsageSummary: EnrichmentUsageSummaryRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved,   setSaved]        = useState(false);
  const [enabled, setEnabled]      = useState({ ...creditSettings.enabledCategories });

  const breakdown = computeCategoryBreakdown(enrichmentUsageSummary);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveCreditSettingsAction(tenantId, { ...creditSettings, enabledCategories: enabled });
      if (r.ok) setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const categories = (["recognition", "adaptation", "brainpower"] as const);
  const iconColour = { recognition: "text-blue-500", adaptation: "text-purple-500", brainpower: "text-orange-500" };

  return (
    <Card>
      <SectionTitle sub="Permanently disable expensive categories to reduce baseline spend.">
        {LABELS.SECTION_COST_CONTROLS}
      </SectionTitle>
      <form onSubmit={handleSave} className="space-y-3">
        {categories.map((cat) => {
          const copy    = CATEGORY_COPY[cat];
          const savings = estimateSavings(cat, breakdown);
          const isOn    = enabled[cat];
          return (
            <div
              key={cat}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-opacity ${
                isOn ? "border-neutral-200" : "border-neutral-100 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xl ${iconColour[cat]}`}>{copy.icon}</span>
                <div>
                  <p className="text-sm font-medium text-neutral-800">{copy.label}</p>
                  <p className="text-xs text-neutral-400">{copy.featuresShort}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {savings > 0 && (
                  <span className="text-xs text-neutral-400">saves ~{savings.toLocaleString("nl-NL")} cr/mo</span>
                )}
                <Toggle checked={isOn} onChange={(v) => setEnabled((prev) => ({ ...prev, [cat]: v }))} />
              </div>
            </div>
          );
        })}
        <div className="flex justify-end pt-1">
          <SaveButton pending={pending} saved={saved} />
        </div>
      </form>
    </Card>
  );
}

// ── PART 6: Auto-reload card ──────────────────────────────────────────────────

function AutoReloadCard({
  tenantId,
  wallet,
  reloadAttempts,
}: {
  tenantId:       string;
  wallet:         TenantWallet | null;
  reloadAttempts: WalletReloadAttempt[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved,   setSaved]        = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(wallet?.auto_reload_enabled ?? false);
  const [triggerVal,  setTriggerVal]  = useState(String(wallet?.auto_reload_trigger_cents ?? 500));
  const [amountVal,   setAmountVal]   = useState(String(wallet?.auto_reload_amount_cents  ?? 5000));
  const [capVal,      setCapVal]      = useState(String(wallet?.auto_reload_monthly_limit_cents ?? 0));

  const lastAttempt = reloadAttempts[0];

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveAutoReloadAction(tenantId, {
        auto_reload_enabled:             autoEnabled,
        auto_reload_trigger_cents:       parseInt(triggerVal, 10) || 0,
        auto_reload_amount_cents:        parseInt(amountVal,  10) || 0,
        auto_reload_monthly_limit_cents: parseInt(capVal,     10) || 0,
      });
      if (r.ok) setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle sub="Automatically top up when the balance drops below a threshold.">
          {LABELS.SECTION_AUTO_RELOAD}
        </SectionTitle>
        <Toggle checked={autoEnabled} onChange={setAutoEnabled} />
      </div>

      {!wallet ? (
        <p className="text-sm text-neutral-400">{EMPTY_STATES.no_wallet.body}</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className={`space-y-4 transition-opacity ${autoEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Reload when balance drops below</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" step="100" value={triggerVal} onChange={(e) => setTriggerVal(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  <span className="shrink-0 text-sm text-neutral-400">cr</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Top-up amount</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" step="100" value={amountVal} onChange={(e) => setAmountVal(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                  <span className="shrink-0 text-sm text-neutral-400">cr</span>
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Monthly reload cap <span className="font-normal text-neutral-400">(0 = unlimited)</span></label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="100" value={capVal} onChange={(e) => setCapVal(e.target.value)}
                  className="w-40 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                <span className="text-sm text-neutral-400">cr / month max</span>
              </div>
            </div>
          </div>

          <div className={`rounded-lg border px-3 py-2 text-xs ${
            wallet.stripe_payment_method_id
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
            {wallet.stripe_payment_method_id
              ? `✓ Payment method linked`
              : `⚠ No payment method — auto-reload will not fire`}
          </div>

          {lastAttempt && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${
              lastAttempt.status === "succeeded" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
              lastAttempt.status === "failed"    ? "border-red-200 bg-red-50 text-red-700" :
              "border-neutral-200 bg-neutral-50 text-neutral-600"
            }`}>
              Last reload: {lastAttempt.status} — {fmtDateTime(lastAttempt.created_at)}
              {lastAttempt.status === "failed" && lastAttempt.failure_reason && ` (${lastAttempt.failure_reason})`}
            </div>
          )}

          <div className="flex justify-end">
            <SaveButton pending={pending} saved={saved} />
          </div>
        </form>
      )}
    </Card>
  );
}

// ── PART 8: Stripe / payment status ──────────────────────────────────────────

function StripeStatusCard({ tenantId, stripeModeInfo, subscription, wallet, onNavigateToSubscription }: {
  tenantId:                  string;
  stripeModeInfo:            StripeModeInfo;
  subscription:              Subscription | null;
  wallet:                    TenantWallet | null;
  onNavigateToSubscription:  () => void;
}) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError,   setPortalError]   = useState<string | null>(null);

  const hasStripeCustomer = !!(
    subscription?.stripe_customer_id ||
    (wallet as Record<string, unknown> | null)?.["stripe_customer_id"]
  );

  const effectivePmId = stripeModeInfo.mode === "test"
    ? (wallet?.stripe_test_payment_method_id || wallet?.stripe_payment_method_id)
    : wallet?.stripe_payment_method_id;

  async function openBillingPortal(flow?: string) {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res  = await fetch("/api/billing/portal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId, ...(flow ? { flow } : {}) }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setPortalError(data.error ?? "Could not open Stripe portal.");
        setPortalLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Network error.");
      setPortalLoading(false);
    }
  }

  return (
    <Card>
      <SectionTitle sub="Stripe linkage and subscription state.">
        {LABELS.SECTION_PAYMENT}
      </SectionTitle>
      <dl className="space-y-2">
        {[
          {
            label: "Stripe mode",
            value: stripeModeInfo.mode
              ? <Badge label={stripeModeInfo.mode === "live" ? "Live" : "Test"} bg={stripeModeInfo.mode === "live" ? "bg-emerald-100" : "bg-amber-100"} text={stripeModeInfo.mode === "live" ? "text-emerald-700" : "text-amber-700"} />
              : <span className="text-neutral-400 text-sm">Not configured</span>,
            warn: stripeModeInfo.isLive ? !stripeModeInfo.liveKeyPresent : !stripeModeInfo.testKeyPresent,
          },
          {
            label: "Subscription",
            value: subscription?.stripe_subscription_id
              ? <code className="rounded bg-neutral-100 px-1 text-xs text-neutral-600">{subscription.stripe_subscription_id}</code>
              : subscription
                ? <span className="text-neutral-500 text-sm">Manual (platform-managed)</span>
                : <span className="text-neutral-400 text-sm">None — no subscription row</span>,
            // Only warn when there is truly no subscription row at all.
            warn: !subscription,
          },
          {
            label: "Status",
            value: (() => {
              if (!subscription?.status) return <span className="text-neutral-400 text-sm">No subscription</span>;
              const s = subscription.status;
              const bg   = s === "active"   ? "bg-emerald-100"
                         : s === "trialing" ? "bg-blue-100"
                         : s === "past_due" ? "bg-amber-100"
                         : s === "unpaid"   ? "bg-red-100"
                         : "bg-neutral-100";
              const text = s === "active"   ? "text-emerald-700"
                         : s === "trialing" ? "text-blue-700"
                         : s === "past_due" ? "text-amber-700"
                         : s === "unpaid"   ? "text-red-700"
                         : "text-neutral-600";
              return <Badge label={s} bg={bg} text={text} />;
            })(),
          },
          {
            label: "Payment method",
            value: (() => {
              // Use the mode-appropriate field: test mode stores PM in
              // stripe_test_payment_method_id, live mode in stripe_payment_method_id.
              const effectivePmId = stripeModeInfo.mode === "test"
                ? (wallet?.stripe_test_payment_method_id || wallet?.stripe_payment_method_id)
                : wallet?.stripe_payment_method_id;
              return effectivePmId
                ? <code className="rounded bg-neutral-100 px-1 text-xs text-neutral-600">{effectivePmId}</code>
                : <span className="text-neutral-400 text-sm">None</span>;
            })(),
            warn: (() => {
              const effectivePmId = stripeModeInfo.mode === "test"
                ? (wallet?.stripe_test_payment_method_id || wallet?.stripe_payment_method_id)
                : wallet?.stripe_payment_method_id;
              return !effectivePmId && (wallet?.auto_reload_enabled ?? false);
            })(),
          },
        ].map((row) => (
          <div key={row.label} className={`flex items-center justify-between rounded-lg px-3 py-2 ${row.warn ? "bg-amber-50" : "bg-neutral-50"}`}>
            <dt className="text-xs font-medium text-neutral-500">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      {/* ── Action row ──────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-3">

        {/* No subscription row at all — direct them to the Subscription tab */}
        {!subscription && (
          <button
            onClick={onNavigateToSubscription}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Subscribe to a plan →
          </button>
        )}

        {/* Has a Stripe customer — show targeted PM button when no PM set,
            and general portal button for invoices / subscription management */}
        {hasStripeCustomer && !effectivePmId && (
          <button
            onClick={() => openBillingPortal("payment_method_update")}
            disabled={portalLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {portalLoading ? "Opening…" : "Set up payment method →"}
          </button>
        )}
        {hasStripeCustomer && (
          <button
            onClick={() => openBillingPortal()}
            disabled={portalLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            {portalLoading ? "Opening…" : "Manage payment & invoices ↗"}
          </button>
        )}

        {/* No Stripe customer yet — explain how to get one */}
        {!hasStripeCustomer && !subscription?.stripe_subscription_id && (
          <p className="text-xs text-neutral-400">
            Subscribe to a plan to set up your payment method.
          </p>
        )}
      </div>

      {/* Payment method missing warning when auto-reload is on */}
      {(() => {
        const effectivePmId = stripeModeInfo.mode === "test"
          ? (wallet?.stripe_test_payment_method_id || wallet?.stripe_payment_method_id)
          : wallet?.stripe_payment_method_id;
        return !effectivePmId && (wallet?.auto_reload_enabled ?? false);
      })() && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠ Auto-reload is enabled but no payment method is linked. <button onClick={() => openBillingPortal("payment_method_update")} className="underline hover:no-underline">Set up a payment method →</button>
        </p>
      )}

      {portalError && (
        <p className="mt-2 text-xs text-red-600">{portalError}</p>
      )}
    </Card>
  );
}

// ── Notification settings ─────────────────────────────────────────────────────

function NotificationCard({ tenantId, wallet }: { tenantId: string; wallet: TenantWallet | null }) {
  const [pending, startTransition] = useTransition();
  const [saved,   setSaved]        = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(wallet?.notify_email ?? true);
  const [notifySms,   setNotifySms]   = useState(wallet?.notify_sms   ?? false);
  const [emailAddr,   setEmailAddr]   = useState(wallet?.notification_email ?? "");
  const [phoneNum,    setPhoneNum]    = useState(wallet?.notification_phone ?? "");
  const [threshold,   setThreshold]  = useState(String(wallet?.low_balance_threshold_cents ?? 500));

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveNotificationSettingsAction(tenantId, {
        notify_email:                notifyEmail,
        notify_sms:                  notifySms,
        notification_email:          emailAddr || null,
        notification_phone:          phoneNum  || null,
        low_balance_threshold_cents: parseInt(threshold, 10) || 0,
      });
      if (r.ok) setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  if (!wallet) return (
    <Card><p className="text-sm text-neutral-400">{EMPTY_STATES.no_wallet.body}</p></Card>
  );

  return (
    <Card>
      <SectionTitle sub="Alert settings for low balance and empty wallet events.">
        {LABELS.SECTION_NOTIFICATIONS}
      </SectionTitle>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 p-3">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            <span className="text-sm text-neutral-700">Email alerts</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 p-3">
            <input type="checkbox" checked={notifySms} onChange={(e) => setNotifySms(e.target.checked)} />
            <span className="text-sm text-neutral-700">SMS alerts</span>
          </label>
        </div>
        {notifyEmail && (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Alert email</label>
            <input type="email" value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)}
              placeholder="alerts@yourcompany.com"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
          </div>
        )}
        {notifySms && (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Alert phone (E.164)</label>
            <input type="tel" value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)}
              placeholder="+31612345678"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Low balance threshold (credits)</label>
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="100" value={threshold} onChange={(e) => setThreshold(e.target.value)}
              className="w-36 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
            <span className="text-sm text-neutral-400">credits</span>
          </div>
        </div>
        <div className="flex justify-end">
          <SaveButton pending={pending} saved={saved} />
        </div>
      </form>
    </Card>
  );
}

// ── PART 4: Ledger table ──────────────────────────────────────────────────────

// ── Ledger pagination controls ────────────────────────────────────────────────

function LedgerPagination({
  page,
  pageSize,
  hasNext,
  rowCount,
}: {
  page:     number;
  pageSize: number;
  hasNext:  boolean;
  rowCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Build a URL for a given page + page size. Server reads ledgerPage /
  // ledgerPageSize; the #history anchor keeps the tab in view after navigation.
  function pageUrl(p: number, size: number = pageSize) {
    const params = new URLSearchParams();
    if (p > 0) params.set("ledgerPage", String(p));
    if (size !== 25) params.set("ledgerPageSize", String(size));
    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ""}#history`;
  }

  const hasPrev   = page > 0;
  const firstRow  = page * pageSize + 1;
  const lastRow   = page * pageSize + rowCount;

  if (rowCount === 0) return null; // nothing to show

  const linkCls =
    "inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors";
  const disabledCls =
    "inline-flex items-center gap-1 rounded border border-neutral-100 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-300 cursor-not-allowed";

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-neutral-400">Rijen {firstRow}–{lastRow}</p>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5">
          <span>Toon</span>
          <select
            value={String(pageSize)}
            onChange={(e) => router.push(pageUrl(0, Number(e.target.value)))}
            className="rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-xs text-neutral-700 focus:border-neutral-500 focus:outline-none"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        {(hasPrev || hasNext) && (
          <div className="flex items-center gap-2">
            {hasPrev ? (
              <Link href={pageUrl(page - 1)} className={linkCls}>Vorige</Link>
            ) : (
              <span className={disabledCls}>Vorige</span>
            )}
            <span className="text-neutral-400">Pagina {page + 1}</span>
            {hasNext ? (
              <Link href={pageUrl(page + 1)} className={linkCls}>Volgende</Link>
            ) : (
              <span className={disabledCls}>Volgende</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LedgerTable({ entries }: { entries: WalletLedgerEntry[] }) {
  if (entries.length === 0) return <EmptyState {...EMPTY_STATES.no_transactions} />;

  const catBadge: Record<string, string> = {
    recognition: "bg-blue-100 text-blue-700",
    adaptation:  "bg-purple-100 text-purple-700",
    brainpower:  "bg-orange-100 text-orange-700",
    topup:       "bg-emerald-100 text-emerald-700",
    refund:      "bg-sky-100 text-sky-700",
    adjustment:  "bg-neutral-100 text-neutral-600",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs font-medium text-neutral-400">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4">Category</th>
            <th className="pb-2 pr-4 text-right">Amount</th>
            <th className="pb-2 pr-4 text-right">Balance after</th>
            <th className="pb-2">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {entries.map((entry) => {
            // Prefer amount (NUMERIC, migration 076) over amount_cents (legacy INTEGER).
            // amount_cents rounds to 0 for sub-credit costs (e.g. 0.01 credits → 0 cents).
            const displayAmount = entry.amount ?? entry.amount_cents ?? 0;
            const displayBalance = entry.balance_after ?? entry.balance_after_cents ?? null;
            const isCredit = displayAmount > 0;
            return (
              <tr key={entry.id} className="hover:bg-neutral-50">
                <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-neutral-500">{fmtDateTime(entry.created_at)}</td>
                <td className="whitespace-nowrap py-2.5 pr-4 text-neutral-700">
                  {ledgerTypeLabel(entry.entry_type)}
                  {entry.simulated && <span className="ml-1 text-xs text-neutral-400">(sim)</span>}
                </td>
                <td className="py-2.5 pr-4">
                  {entry.category ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catBadge[entry.category] ?? "bg-neutral-100 text-neutral-500"}`}>
                      {entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
                    </span>
                  ) : <span className="text-neutral-300">—</span>}
                </td>
                <td className={`py-2.5 pr-4 text-right font-medium tabular-nums ${isCredit ? "text-emerald-600" : "text-red-500"}`}>
                  {isCredit ? "+" : ""}{displayAmount.toLocaleString("nl-NL", { maximumFractionDigits: 4 })} cr
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-neutral-600">
                  {displayBalance != null
                    ? displayBalance.toLocaleString("nl-NL", { maximumFractionDigits: 4 }) + " cr"
                    : <span className="text-neutral-300">—</span>}
                </td>
                <td className="max-w-48 truncate py-2.5 text-xs text-neutral-400">
                  {entry.note ?? entry.reference_id ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Super-admin subscription management panel ─────────────────────────────────

/** Converts a date string to a local date-input value (YYYY-MM-DD). */
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}

/** Converts a local date-input value to an ISO UTC midnight timestamp. */
function fromDateInputValue(val: string): string | null {
  if (!val) return null;
  return new Date(val + "T00:00:00Z").toISOString();
}

function SuperAdminSubscriptionPanel({
  tenantId, subscription, isActiveOverride, allPlans,
  onSetTenantStatus, adminStatusError, adminStatusSuccess,
}: {
  tenantId:          string;
  subscription:      Subscription | null;
  isActiveOverride?: boolean | null;
  allPlans:          BillingPlan[];
  onSetTenantStatus: (v: boolean | null) => void;
  adminStatusError:  string | null;
  adminStatusSuccess: string | null;
}) {
  // ── Edit form state ──────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);

  const [fStatus,      setFStatus]      = useState(subscription?.status ?? "active");
  const [fPlan,        setFPlan]        = useState(subscription?.plan ?? "starter");
  const [fCycle,       setFCycle]       = useState(subscription?.billing_cycle ?? "monthly");
  const [fPeriodStart, setFPeriodStart] = useState(toDateInputValue(subscription?.current_period_start));
  const [fPeriodEnd,   setFPeriodEnd]   = useState(toDateInputValue(subscription?.current_period_end));
  const [fTrialEnd,    setFTrialEnd]    = useState(toDateInputValue(subscription?.trial_end));
  const [fCancelEOP,   setFCancelEOP]   = useState(subscription?.cancel_at_period_end ?? false);

  // ── Create form state (for tenants without a subscription row) ───────────────
  const [createMode,   setCreateMode]   = useState(false);
  const [cPlan,        setCPlan]        = useState<"starter"|"growth"|"pro">("starter");
  const [cStatus,      setCStatus]      = useState<"active"|"trialing">("active");
  const [cCycle,       setCCycle]       = useState<"monthly"|"annual">("monthly");
  const [cPeriodStart, setCPeriodStart] = useState(toDateInputValue(new Date().toISOString()));
  const [cPeriodEnd,   setCPeriodEnd]   = useState(toDateInputValue(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  ));
  const [cTrialEnd, setCTrialEnd] = useState("");

  // ── Feedback ─────────────────────────────────────────────────────────────────
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string|null>(null);
  const [saveSuccess,  setSaveSuccess]  = useState<string|null>(null);

  // Sync form fields when subscription prop changes (after page reload).
  // (Only sync when not in edit mode to avoid overwriting unsaved changes.)

  async function handleSaveSubscription() {
    setSaving(true); setSaveError(null); setSaveSuccess(null);
    const update: UpdateSubscriptionInput = {
      status:               fStatus as UpdateSubscriptionInput["status"],
      plan:                 fPlan   as UpdateSubscriptionInput["plan"],
      billing_cycle:        fCycle  as UpdateSubscriptionInput["billing_cycle"],
      current_period_start: fromDateInputValue(fPeriodStart),
      current_period_end:   fromDateInputValue(fPeriodEnd),
      trial_end:            fromDateInputValue(fTrialEnd),
      cancel_at_period_end: fCancelEOP,
    };
    const result = await updateSubscriptionAction(tenantId, update);
    setSaving(false);
    if (result.ok) {
      setSaveSuccess("Subscription updated. Reload to see changes.");
      setEditMode(false);
    } else {
      setSaveError(result.error);
    }
  }

  async function handleCreateSubscription() {
    setSaving(true); setSaveError(null); setSaveSuccess(null);
    const result = await createSubscriptionAction(tenantId, {
      plan:                 cPlan,
      status:               cStatus,
      billing_cycle:        cCycle,
      current_period_start: fromDateInputValue(cPeriodStart) ?? new Date().toISOString(),
      current_period_end:   fromDateInputValue(cPeriodEnd) ?? new Date(Date.now() + 30 * 86400000).toISOString(),
      trial_end:            fromDateInputValue(cTrialEnd),
    });
    setSaving(false);
    if (result.ok) {
      setSaveSuccess("Subscription created. Reload the page.");
      setCreateMode(false);
    } else {
      setSaveError(result.error);
    }
  }

  async function handleActivatePending() {
    setSaving(true); setSaveError(null); setSaveSuccess(null);
    const result = await activatePendingPlanNowAction(tenantId);
    setSaving(false);
    if (result.ok) {
      setSaveSuccess(`Pending plan (${result.plan}) activated. Reload to see changes.`);
    } else {
      setSaveError(result.error);
    }
  }

  async function handleRenewNow() {
    setSaving(true); setSaveError(null); setSaveSuccess(null);
    const result = await renewSubscriptionNowAction(tenantId);
    setSaving(false);
    if (result.ok) {
      setSaveSuccess("Period advanced. Reload to see the new dates.");
    } else {
      setSaveError(result.error);
    }
  }

  async function handleSyncFromStripe() {
    setSaving(true); setSaveError(null); setSaveSuccess(null);
    const result = await syncSubscriptionFromStripeAction(tenantId);
    setSaving(false);
    if (result.ok) {
      setSaveSuccess(`Synced from Stripe. ${result.summary ?? ""} Reload to see updated dates.`);
    } else {
      setSaveError(result.error ?? "Sync failed.");
    }
  }

  const statusOptions: Array<{ value: string; label: string }> = [
    { value: "active",   label: "Active"    },
    { value: "trialing", label: "Trialing"  },
    { value: "past_due", label: "Past due"  },
    { value: "paused",   label: "Paused"    },
    { value: "unpaid",   label: "Unpaid"    },
    { value: "canceled", label: "Canceled"  },
  ];

  const fieldCls = "w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs focus:border-neutral-400 focus:outline-none";
  const labelCls = "block text-[11px] font-medium text-neutral-500 mb-0.5";

  // Trial status info.
  const isTrialing    = subscription?.status === "trialing";
  const trialEndDate  = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const trialExpired  = trialEndDate ? trialEndDate < new Date() : false;
  const trialDaysLeft = trialEndDate && !trialExpired
    ? Math.ceil((trialEndDate.getTime() - Date.now()) / 86400000)
    : 0;

  return (
    <Card>
      <SectionTitle sub="Super-admin only — direct subscription management">
        Subscription management
      </SectionTitle>

      {/* ── Trial status banner ─────────────────────────────────────────────── */}
      {isTrialing && (
        <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
          trialExpired
            ? "border-red-200 bg-red-50 text-red-700"
            : trialDaysLeft <= 3
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-blue-200 bg-blue-50 text-blue-800"
        }`}>
          {trialExpired
            ? "⚠ Trial has expired. The cron job will mark this subscription as canceled on its next run."
            : `Trial active — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} remaining ` +
              (trialEndDate ? `(ends ${trialEndDate.toLocaleDateString("en-GB")})` : "")}
        </div>
      )}

      {/* ── No subscription — offer to create one ──────────────────────────── */}
      {!subscription && !createMode && (
        <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center">
          <p className="text-xs text-neutral-500 mb-2">
            No subscription row exists for this tenant. This is normal for tenants
            created before the Stripe checkout flow (e.g. manually provisioned or old
            trial accounts). Create one to enable lifecycle management.
          </p>
          <button
            onClick={() => setCreateMode(true)}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
          >
            Create subscription row
          </button>
        </div>
      )}

      {/* ── Create subscription form ────────────────────────────────────────── */}
      {!subscription && createMode && (
        <div className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium text-neutral-700">New subscription row</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Plan</label>
              <select className={fieldCls} value={cPlan} onChange={e => setCPlan(e.target.value as typeof cPlan)}>
                {allPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={fieldCls} value={cStatus} onChange={e => setCStatus(e.target.value as typeof cStatus)}>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Billing cycle</label>
              <select className={fieldCls} value={cCycle} onChange={e => setCCycle(e.target.value as typeof cCycle)}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Period start</label>
              <input type="date" className={fieldCls} value={cPeriodStart} onChange={e => setCPeriodStart(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Period end</label>
              <input type="date" className={fieldCls} value={cPeriodEnd} onChange={e => setCPeriodEnd(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Trial end (optional)</label>
              <input type="date" className={fieldCls} value={cTrialEnd} onChange={e => setCTrialEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateSubscription}
              disabled={saving}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create subscription"}
            </button>
            <button onClick={() => setCreateMode(false)} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Existing subscription — view / edit ─────────────────────────────── */}
      {subscription && (
        <div className="mt-3 space-y-3">

          {/* Edit form */}
          {editMode ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={fieldCls} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                    {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Plan</label>
                  <select className={fieldCls} value={fPlan} onChange={e => setFPlan(e.target.value)}>
                    {allPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Billing cycle</label>
                  <select className={fieldCls} value={fCycle} onChange={e => setFCycle(e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Period start</label>
                  <input type="date" className={fieldCls} value={fPeriodStart} onChange={e => setFPeriodStart(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Period end</label>
                  <input type="date" className={fieldCls} value={fPeriodEnd} onChange={e => setFPeriodEnd(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Trial end</label>
                  <input type="date" className={fieldCls} value={fTrialEnd} onChange={e => setFTrialEnd(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cae-check"
                  checked={fCancelEOP}
                  onChange={e => setFCancelEOP(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-neutral-300"
                />
                <label htmlFor="cae-check" className="text-xs text-neutral-600">
                  Cancel at period end
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSubscription}
                  disabled={saving}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button onClick={() => setEditMode(false)} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Summary view */
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {[
                  ["Status",       subscription.status],
                  ["Plan",         subscription.plan],
                  ["Billing cycle", subscription.billing_cycle],
                  ["Period start",  subscription.current_period_start ? fmtDate(subscription.current_period_start) : "—"],
                  ["Period end",    subscription.current_period_end   ? fmtDate(subscription.current_period_end)   : "—"],
                  ["Trial end",     subscription.trial_end            ? fmtDate(subscription.trial_end)            : "—"],
                  ["Cancel at end", subscription.cancel_at_period_end ? "Yes" : "No"],
                  ["Stripe sub",    subscription.stripe_subscription_id ? subscription.stripe_subscription_id.slice(0, 18) + "…" : "— not linked"],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-[11px] text-neutral-400">{label as string}</dt>
                    <dd className="mt-0.5 font-medium text-neutral-800">{value as string}</dd>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setEditMode(true)}
                className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Edit subscription
              </button>
            </div>
          )}

          {/* Quick-action buttons */}
          <div className="flex flex-wrap gap-2">
            {subscription.pending_plan && (
              <button
                onClick={handleActivatePending}
                disabled={saving}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {saving ? "Activating…" : `Activate pending plan (${allPlans.find(p => p.id === subscription.pending_plan)?.name ?? subscription.pending_plan}) now`}
              </button>
            )}
            <button
              onClick={handleRenewNow}
              disabled={saving}
              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {saving ? "Renewing…" : "🔄 Advance period now"}
            </button>
            <button
              onClick={handleSyncFromStripe}
              disabled={saving}
              className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              {saving ? "Syncing…" : "↓ Sync period dates from Stripe"}
            </button>
          </div>
        </div>
      )}

      {/* ── Feedback messages ────────────────────────────────────────────────── */}
      {saveError   && <p className="mt-2 text-xs text-red-600">{saveError}</p>}
      {saveSuccess && <p className="mt-2 text-xs text-emerald-600">{saveSuccess}</p>}

      {/* ── Tenant active override ───────────────────────────────────────────── */}
      <div className="mt-4 border-t border-neutral-100 pt-4">
        <p className="mb-2 text-xs font-medium text-neutral-600">Tenant access override</p>
        <div className="flex flex-wrap gap-2">
          {isActiveOverride === false && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <span>⛔ Force-disabled.</span>
              <button onClick={() => onSetTenantStatus(null)} className="underline hover:no-underline">Reset to auto</button>
            </div>
          )}
          {isActiveOverride === true && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <span>✓ Force-active.</span>
              <button onClick={() => onSetTenantStatus(null)} className="underline hover:no-underline">Reset to auto</button>
            </div>
          )}
          {isActiveOverride === null && (
            <p className="text-xs text-neutral-500">Status: auto (subscription-driven).</p>
          )}
          <button onClick={() => onSetTenantStatus(false)} className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Disable</button>
          <button onClick={() => onSetTenantStatus(true)}  className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50">Force activate</button>
          <button onClick={() => onSetTenantStatus(null)}  className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Reset to auto</button>
        </div>
        {adminStatusError   && <p className="mt-2 text-xs text-red-600">{adminStatusError}</p>}
        {adminStatusSuccess && <p className="mt-2 text-xs text-emerald-600">{adminStatusSuccess}</p>}
      </div>
    </Card>
  );
}

// ── Subscription tab ───────────────────────────────────────────────────────────

// Plan tier order — used to classify upgrades vs downgrades in the UI.
const PLAN_TIER_ORDER = ["starter", "growth", "pro"];

function SubscriptionPanel({ tenantId, subscription, plan, tenantPackage, allPlans, usage, estimate, checkoutStatus, planChangeStatus, isSuperAdmin, isActiveOverride }: {
  tenantId:           string;
  subscription:       Subscription | null;
  plan:               BillingPlan;
  tenantPackage?:     string;
  allPlans:           BillingPlan[];
  usage:              UsageSummary;
  estimate:           BillingEstimate;
  checkoutStatus?:    "success" | "cancelled";
  planChangeStatus?:  "success" | "cancelled";
  isSuperAdmin:       boolean;
  isActiveOverride?:  boolean | null;
}) {
  const statusColour = subscription
    ? subscription.status === "active"   ? { bg: "bg-emerald-100", text: "text-emerald-700" }
    : subscription.status === "trialing" ? { bg: "bg-blue-100",    text: "text-blue-700"    }
    : subscription.status === "past_due" ? { bg: "bg-amber-100",   text: "text-amber-700"   }
    : subscription.status === "unpaid"   ? { bg: "bg-red-100",     text: "text-red-700"     }
    :                                      { bg: "bg-neutral-100",  text: "text-neutral-600" }
    : null;

  // For the plans grid: a plan is "current" when there's an active Stripe
  // subscription, OR when the tenant's manually-assigned package matches.
  const currentPlanId = subscription ? plan.id : (tenantPackage ?? plan.id);

  // ── State: new subscription checkout ──────────────────────────────────────
  const [billingCycle,   setBillingCycle]   = useState<"monthly" | "annual">("monthly");
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutError,  setCheckoutError]  = useState<string | null>(null);

  async function startCheckout(planId: string) {
    setCheckoutPlanId(planId);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId, planId, billingCycle }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setCheckoutError(data.error ?? "Failed to create checkout session.");
        setCheckoutPlanId(null);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Network error.");
      setCheckoutPlanId(null);
    }
  }

  // ── State: active subscription plan change ─────────────────────────────────
  const [changePlanId,   setChangePlanId]   = useState<string | null>(null);
  const [changeError,    setChangeError]    = useState<string | null>(null);
  const [changeSuccess,  setChangeSuccess]  = useState<string | null>(null);

  // ── State: super-admin tenant status override ──────────────────────────────
  const [adminStatusError,   setAdminStatusError]   = useState<string | null>(null);
  const [adminStatusSuccess, setAdminStatusSuccess] = useState<string | null>(null);

  async function handleSetTenantStatus(isActive: boolean | null) {
    setAdminStatusError(null);
    setAdminStatusSuccess(null);
    try {
      const res = await fetch("/api/billing/admin/set-tenant-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, isActive }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; action?: string };
      if (!res.ok || data.error) {
        setAdminStatusError(data.error ?? "Failed to update tenant status.");
      } else {
        setAdminStatusSuccess(
          isActive === true ? "Tenant force-activated." :
          isActive === false ? "Tenant disabled." :
          "Tenant status reset to auto."
        );
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      setAdminStatusError(err instanceof Error ? err.message : "Network error.");
    }
  }

  async function handleChangePlan(planId: string) {
    setChangePlanId(planId);
    setChangeError(null);
    setChangeSuccess(null);
    try {
      const res = await fetch("/api/billing/change-plan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          tenantId,
          newPlanId:    planId,
          billingCycle: subscription?.billing_cycle ?? "monthly",
        }),
      });
      const data = await res.json() as {
        ok?: boolean; url?: string; error?: string;
        effectiveNextPeriod?: boolean; restriction?: string;
      };

      if (!res.ok || data.error) {
        setChangeError(data.error ?? "Failed to change plan.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      const newPlanName = allPlans.find((p) => p.id === planId)?.name ?? planId;
      setChangeSuccess(
        data.effectiveNextPeriod
          ? `Your plan will switch to ${newPlanName} at the start of your next billing period.`
          : `Plan changed to ${newPlanName}. Refreshing…`,
      );
      if (!data.effectiveNextPeriod) {
        setTimeout(() => window.location.reload(), 1800);
      }
    } finally {
      setChangePlanId(null);
    }
  }

  // Tier of the currently active plan (used for upgrade/downgrade button logic)
  const activeTierIndex = PLAN_TIER_ORDER.indexOf(plan.id);
  const isAnnual        = subscription?.billing_cycle === "annual";

  const daysUntilRenewal = subscription?.current_period_end
    ? Math.max(0, Math.floor((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 9999;

  return (
    <div className="space-y-4">
      {/* ── Active subscription card ────────────────────────────────────────── */}
      {subscription && statusColour ? (
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
              <p className="text-sm text-neutral-500">{plan.description}</p>
            </div>
            <Badge label={subscription.status} bg={statusColour.bg} text={statusColour.text} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              ["Billing cycle", subscription.billing_cycle],
              ["Period start",  subscription.current_period_start ? fmtDate(subscription.current_period_start) : "—"],
              ["Period end",    subscription.current_period_end   ? fmtDate(subscription.current_period_end)   : "—"],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg bg-neutral-50 p-3">
                <dt className="text-xs text-neutral-400">{label as string}</dt>
                <dd className="mt-0.5 text-sm font-medium text-neutral-800">{value as string}</dd>
              </div>
            ))}
          </dl>
          {/* Pending plan change notice */}
          {subscription.pending_plan && (
            <div className={`mt-4 rounded-lg border px-3 py-2.5 ${
              subscription.pending_plan_paid_at
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}>
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 text-base ${subscription.pending_plan_paid_at ? "text-emerald-500" : "text-amber-500"}`}>
                  {subscription.pending_plan_paid_at ? "✓" : "⏱"}
                </span>
                <div>
                  <p className={`text-xs font-semibold ${subscription.pending_plan_paid_at ? "text-emerald-800" : "text-amber-800"}`}>
                    {subscription.pending_plan_paid_at ? "Upgrade paid — activates next period" : "Plan change scheduled"}
                  </p>
                  <p className={`mt-0.5 text-xs ${subscription.pending_plan_paid_at ? "text-emerald-700" : "text-amber-700"}`}>
                    Switching to{" "}
                    <span className="font-medium">
                      {allPlans.find((p) => p.id === subscription.pending_plan)?.name ?? subscription.pending_plan}
                    </span>
                    {subscription.pending_plan_effective_date
                      ? ` on ${fmtDate(subscription.pending_plan_effective_date)}`
                      : " at your next billing period"}.
                    {subscription.pending_plan_paid_at
                      ? " First-period payment received — no charge at renewal."
                      : " No further plan changes until this takes effect."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-neutral-100 pt-4">
            <p className="mb-1 text-xs text-neutral-400">Current period estimate</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-neutral-900">
                {fmtEuro((estimate as unknown as Record<string, unknown>)["totalCents"] as number ?? (estimate as unknown as Record<string, unknown>)["subtotalCents"] as number ?? 0)}
              </span>
              <span className="mb-0.5 text-sm text-neutral-400">estimated</span>
            </div>
          </div>
        </Card>

      ) : checkoutStatus === "success" ? (
        /* Subscription just paid — webhook may not have fired yet */
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 animate-spin text-lg text-emerald-500">⟳</span>
            <div>
              <p className="text-sm font-semibold text-neutral-800">Subscription activating…</p>
              <p className="mt-0.5 text-xs text-neutral-400">
                Payment received. Your subscription is being set up — this usually takes a few seconds.
                Refresh the page to see the updated status.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 inline-flex items-center rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </Card>

      ) : (
        /* No Stripe subscription — show manually-assigned package tier */
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg text-neutral-400">◆</span>
              <div>
                <p className="text-sm font-semibold text-neutral-800">
                  {plan.name} — manually assigned
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {plan.description}
                </p>
                <p className="mt-1.5 text-xs text-neutral-400">
                  No Stripe subscription is linked yet. The tenant has access to all{" "}
                  <span className="font-medium text-neutral-600">{plan.name}</span> features.
                  Link a Stripe subscription to enable a fixed billing cycle.
                </p>
              </div>
            </div>
            <Badge label={plan.name} bg="bg-neutral-100" text="text-neutral-700" />
          </div>
        </Card>
      )}

      {/* ── Available plans grid ─────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <SectionTitle sub={
            subscription
              ? isAnnual
                ? "Annual plan — only upgrades are available mid-period. Downgrades take effect at renewal."
                : "Monthly plan changes take effect at the start of your next billing period."
              : "Select a plan and billing cycle, then click Subscribe to link a Stripe subscription."
          }>
            Available plans
          </SectionTitle>
          {/* Billing cycle toggle — only useful when no subscription yet */}
          {!subscription && (
            <div className="flex items-center rounded-lg border border-neutral-200 p-0.5 text-xs font-medium">
              {(["monthly", "annual"] as const).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    billingCycle === cycle
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {cycle === "monthly" ? "Monthly" : "Annual −17%"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error / success messages for plan changes */}
        {checkoutError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {checkoutError}
          </div>
        )}
        {changeError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {changeError}
          </div>
        )}
        {changeSuccess && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {changeSuccess}
          </div>
        )}

        {/* Pending plan change banner */}
        {subscription?.pending_plan && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Plan change scheduled:</span>{" "}
            Your plan will switch to{" "}
            <span className="font-medium">{allPlans.find(p => p.id === subscription.pending_plan)?.name ?? subscription.pending_plan}</span>{" "}
            {subscription.pending_plan_effective_date
              ? `on ${fmtDate(subscription.pending_plan_effective_date)}`
              : "at the start of your next billing period"}.
            No further plan changes can be made until this takes effect.
          </div>
        )}

        {/* Annual renewal warning */}
        {subscription && isAnnual && subscription.current_period_end && (
          <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
            daysUntilRenewal <= 30
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-neutral-200 bg-neutral-50 text-neutral-600"
          }`}>
            {daysUntilRenewal <= 30
              ? `⚠ Annual plan renews in ${daysUntilRenewal} days (${fmtDate(subscription.current_period_end)}). Select your next plan period or it will automatically convert to monthly.`
              : `Annual plan renews on ${fmtDate(subscription.current_period_end)}.`}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {allPlans.map((p) => {
            const isCurrent             = p.id === currentPlanId;
            const hasStripeSubscription = !!subscription;
            const isLoadingThisCheckout = checkoutPlanId === p.id;
            const isLoadingThisChange   = changePlanId   === p.id;
            const displayPrice          = billingCycle === "annual" ? p.annualMonthlyCents : p.monthlyPriceCents;
            const planTierIndex         = PLAN_TIER_ORDER.indexOf(p.id);
            const isUpgrade             = planTierIndex > activeTierIndex;
            const isDowngrade           = planTierIndex < activeTierIndex;
            // Annual plan: block non-upgrades
            const isBlockedByAnnual     = hasStripeSubscription && isAnnual && !isUpgrade && !isCurrent;

            return (
              <div
                key={p.id}
                className={`flex flex-col rounded-xl border p-4 ${isCurrent ? "border-neutral-800 bg-neutral-50" : "border-neutral-200"}`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-neutral-900">{p.name}</h4>
                  {isCurrent && (
                    <Badge
                      label={hasStripeSubscription ? "Current" : "Assigned"}
                      bg="bg-neutral-800"
                      text="text-white"
                    />
                  )}
                  {!isCurrent && isUpgrade && (
                    <Badge label="Upgrade" bg="bg-emerald-100" text="text-emerald-700" />
                  )}
                </div>
                <p className="mt-1 text-lg font-bold text-neutral-900">
                  {fmtEuro(hasStripeSubscription ? (subscription?.billing_cycle === "annual" ? p.annualMonthlyCents : p.monthlyPriceCents) : displayPrice)}
                  <span className="text-sm font-normal text-neutral-400">/mo</span>
                </p>
                {((hasStripeSubscription && subscription?.billing_cycle === "annual") || (!hasStripeSubscription && billingCycle === "annual")) && (
                  <p className="text-[11px] text-neutral-400">billed {fmtEuro(p.annualPriceCents)}/yr</p>
                )}
                <p className="mt-2 text-xs text-neutral-500">{p.description}</p>

                {/* Subscribe button — no Stripe subscription yet */}
                {!hasStripeSubscription && (
                  <button
                    onClick={() => startCheckout(p.id)}
                    disabled={!!checkoutPlanId}
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isCurrent
                        ? "bg-neutral-900 text-white hover:bg-neutral-700"
                        : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {isLoadingThisCheckout ? "Redirecting…" : isCurrent ? `Link ${p.name} subscription` : `Subscribe to ${p.name}`}
                  </button>
                )}

                {/* Change plan button — active subscription, different plan */}
                {hasStripeSubscription && !isCurrent && (
                  isBlockedByAnnual ? (
                    <p className="mt-4 text-center text-[11px] text-neutral-400">
                      Not available on annual plan
                    </p>
                  ) : (
                    <>
                      <button
                        onClick={() => handleChangePlan(p.id)}
                        disabled={!!changePlanId || !!changeSuccess || !!subscription?.pending_plan}
                        className={`mt-4 w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          isUpgrade
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {isLoadingThisChange
                          ? "Updating…"
                          : isUpgrade
                            ? `Upgrade to ${p.name}`
                            : isDowngrade
                              ? `Downgrade to ${p.name}`
                              : `Switch to ${p.name}`}
                      </button>
                      {subscription?.pending_plan && !isCurrent && !isBlockedByAnnual && (
                        <p className="mt-2 text-center text-[11px] text-amber-600">
                          Awaiting pending plan change
                        </p>
                      )}
                    </>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Informational note about plan change timing */}
        {subscription && !changeSuccess && (
          <p className="mt-3 text-[11px] text-neutral-400">
            {!subscription.stripe_subscription_id
              ? "Plan changes are paid now and activate at the start of your next billing period. Once a change is scheduled, no further changes can be made until it takes effect."
              : isAnnual
                ? "Upgrades are applied immediately with a prorated charge for the remaining period. Annual plan downgrades are not available until renewal."
                : "Monthly plan changes take effect at the start of your next billing period."}
          </p>
        )}
      </Card>

      {/* ── Super-admin subscription management ──────────────────────────────── */}
      {isSuperAdmin && (
        <SuperAdminSubscriptionPanel
          tenantId={tenantId}
          subscription={subscription}
          isActiveOverride={isActiveOverride}
          allPlans={allPlans}
          onSetTenantStatus={handleSetTenantStatus}
          adminStatusError={adminStatusError}
          adminStatusSuccess={adminStatusSuccess}
        />
      )}
    </div>
  );
}

// ── PART 10: Debug panel ──────────────────────────────────────────────────────

function DebugPanel({ tenantId, wallet, enrichmentUsageSummary, reloadAttempts, debugData, stripeModeInfo, spendToday, spendThisMonth }: {
  tenantId:                  string;
  wallet:                    TenantWallet | null;
  enrichmentUsageSummary:    EnrichmentUsageSummaryRow[];
  reloadAttempts:            WalletReloadAttempt[];
  debugData:                 DebugData | undefined;
  stripeModeInfo:            StripeModeInfo;
  webhookEvents?:            WalletWebhookEvent[];
  spendToday:                number;
  spendThisMonth:            number;
}) {
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);

  async function handleReconcileLedger() {
    if (!debugData || debugData.discrepancy <= 0) return;
    const correctionAmount = Math.round((debugData.ledgerDeductions - debugData.usageEventCredits) * 100) / 100;
    setReconciling(true); setReconcileMsg(null);
    const result = await addCreditsAction(tenantId, {
      amountCredits:  correctionAmount,
      adjustmentType: "adjustment",
      reason:         `Ledger reconciliation — corrects ${Math.abs(correctionAmount).toFixed(2)} cr discrepancy between usage events and ledger deductions.`,
    });
    setReconciling(false);
    setReconcileMsg(result.ok
      ? `✓ Reconciled: ${correctionAmount > 0 ? "+" : ""}${correctionAmount.toFixed(2)} cr written. Reload to confirm.`
      : `Error: ${result.error ?? "Reconciliation failed."}`);
  }
  const blockedRows    = enrichmentUsageSummary.filter((r) => r.blocked_count > 0);
  const failedReloads  = reloadAttempts.filter((r) => r.status === "failed");
  const categoryTotals = computeCategoryBreakdown(enrichmentUsageSummary);

  const anomalies: string[] = [];
  if (!wallet)                              anomalies.push(ANOMALY_LABELS.NO_WALLET_INITIALIZED);
  if (wallet?.status === "suspended")       anomalies.push(ANOMALY_LABELS.WALLET_SUSPENDED);
  if (wallet?.status === "frozen")          anomalies.push(ANOMALY_LABELS.WALLET_FROZEN);
  if (failedReloads.length > 0)            anomalies.push(ANOMALY_LABELS.AUTO_RELOAD_FAILED);
  if (stripeModeInfo.isTest ? !stripeModeInfo.testKeyPresent : !stripeModeInfo.liveKeyPresent)
                                             anomalies.push(ANOMALY_LABELS.STRIPE_NOT_CONFIGURED);
  // STRIPE_TEST_MODE is intentional in dev — already shown as a badge on the Wallet tab.
  // Usage/ledger discrepancy is informational only — usage_events (legacy) and wallet_ledger
  // are independent systems; divergence is expected from test data and manual grants.
  // Keep the value visible in the reconciliation table below, but don't flag it as an anomaly.

  return (
    <div className="space-y-4">
      {anomalies.length > 0 && (
        <Card>
          <SectionTitle>Anomalies & flags</SectionTitle>
          <ul className="space-y-1">
            {anomalies.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-amber-700"><span>⚠</span> {a}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>Raw wallet state</SectionTitle>
        <pre className="overflow-x-auto rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
          {JSON.stringify({
            // balance (NUMERIC, migration 076/089) — authoritative decimal value.
            // balance_cents (INTEGER) rounds sub-credit debits to 0 — never use for display.
            balance:                  wallet?.balance,
            balance_cents:            wallet?.balance_cents,
            status:                   wallet?.status,
            monthly_credit_cap_cents: (wallet as Record<string, unknown> | null)?.["monthly_credit_cap_cents"],
            fallback_mode:            (wallet as Record<string, unknown> | null)?.["fallback_mode"],
            auto_reload_enabled:      wallet?.auto_reload_enabled,
            auto_reload_trigger:      wallet?.auto_reload_trigger_cents,
            auto_reload_amount:       wallet?.auto_reload_amount_cents,
            spend_today_credits:      spendToday,
            spend_month_credits:      spendThisMonth,
          }, null, 2)}
        </pre>
      </Card>

      <Card>
        <SectionTitle>Category totals (this month)</SectionTitle>
        <div className="space-y-1">
          {categoryTotals.map((ct) => (
            <div key={ct.category} className="flex justify-between rounded bg-neutral-50 px-3 py-2 text-xs">
              <span className="text-neutral-600 capitalize">{ct.category}</span>
              <span className="font-mono font-semibold text-neutral-800">{ct.totalCredits.toLocaleString("nl-NL")} cr</span>
            </div>
          ))}
        </div>
      </Card>

      {blockedRows.length > 0 && (
        <Card>
          <SectionTitle>Blocked enrichments this month</SectionTitle>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-400">
                <th className="pb-1 pr-4">Enrichment</th>
                <th className="pb-1 text-right">Blocked calls</th>
              </tr>
            </thead>
            <tbody>
              {blockedRows.map((r) => (
                <tr key={r.enrichment_type}>
                  <td className="py-1 pr-4 text-neutral-700">{featureName(r.enrichment_type)}</td>
                  <td className="py-1 text-right text-red-500">{r.blocked_count.toLocaleString("nl-NL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {reloadAttempts.length > 0 && (
        <Card>
          <SectionTitle>Last auto-reload attempts</SectionTitle>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-400">
                <th className="pb-1 pr-4">Date</th>
                <th className="pb-1 pr-4">Status</th>
                <th className="pb-1 pr-4 text-right">Amount</th>
                <th className="pb-1">Failure reason</th>
              </tr>
            </thead>
            <tbody>
              {reloadAttempts.slice(0, 10).map((a) => (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="py-1.5 pr-4 text-neutral-500">{fmtDateTime(a.created_at)}</td>
                  <td className={`py-1.5 pr-4 font-medium ${
                    a.status === "succeeded" ? "text-emerald-600" : a.status === "failed" ? "text-red-500" : "text-neutral-500"
                  }`}>{a.status}</td>
                  <td className="py-1.5 pr-4 text-right text-neutral-600">{a.reload_amount_cents.toLocaleString("nl-NL")} cr</td>
                  <td className="max-w-40 truncate py-1.5 text-neutral-400">{a.failure_reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {debugData && debugData.usageEventCredits > 0 && (
        <Card>
          <SectionTitle>Usage / ledger reconciliation</SectionTitle>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["Usage event credits",  debugData.usageEventCredits],
              ["Ledger deductions (raw)", debugData.ledgerDeductions],
              ["Usage event count",    debugData.usageEventCount],
              ["Discrepancy",          debugData.discrepancy],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded bg-neutral-50 p-2">
                <dt className="text-neutral-400">{label as string}</dt>
                <dd className={`font-mono font-semibold ${label === "Discrepancy" && typeof val === "number" && val > 5 ? "text-red-600" : "text-neutral-700"}`}>
                  {typeof val === "number" ? val.toLocaleString("nl-NL") : "—"}
                </dd>
              </div>
            ))}
          </dl>
          {debugData.discrepancy > 5 && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={handleReconcileLedger}
                disabled={reconciling}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {reconciling ? "Reconciling…" : `⚖ Reconcile ledger (${(debugData.ledgerDeductions - debugData.usageEventCredits) >= 0 ? "+" : ""}${(debugData.ledgerDeductions - debugData.usageEventCredits).toFixed(2)} cr)`}
              </button>
              {reconcileMsg
                ? <span className={`text-[11px] ${reconcileMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{reconcileMsg}</span>
                : <span className="text-[11px] text-neutral-400">Writes a corrective adjustment entry to zero the discrepancy.</span>
              }
            </div>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle>Stripe mode</SectionTitle>
        <pre className="overflow-x-auto rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
          {JSON.stringify(stripeModeInfo, null, 2)}
        </pre>
      </Card>
    </div>
  );
}

// ── TENANT: Buy Credits panel ─────────────────────────────────────────────────
//
// Visible to all tenants. Shows the three credit bundles as selectable cards.
// Clicking "Buy" POSTs to /api/billing/create-bundle-checkout and redirects
// to Stripe Checkout. On return the page shows a success or cancellation banner.

function BuyCreditsPanel({ tenantId, bundles }: { tenantId: string; bundles: CreditBundle[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const router = useRouter();

  async function handleBuy(bundleId: string) {
    setLoadingId(bundleId);
    setError(null);
    try {
      const res = await fetch("/api/billing/create-bundle-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId, bundleId }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Could not start checkout. Please try again.");
        setLoadingId(null);
        return;
      }
      // Redirect to Stripe Checkout. Page is unmounted here; no need to reset state.
      router.push(json.url);
    } catch {
      setError("Network error — please try again.");
      setLoadingId(null);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle>Buy Enrichment Credits</SectionTitle>
      </div>
      <p className="mb-5 text-xs text-neutral-500">
        Enrichment credits are used for data lookups — email enrichment, company profiles,
        intent signals, and similar API-backed features. They are separate from session credits,
        which control how many visitors receive personalised experiences each month.
        To buy bonus session credits, go to the <strong>Sessions</strong> tab.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {bundles.map((bundle) => {
          const priceEuro        = (bundle.priceCents / 100).toFixed(2);
          const perCreditCents   = bundle.priceCents / bundle.credits;
          const perCreditDisplay = perCreditCents < 1
            ? `€${perCreditCents.toFixed(3)}`
            : `€${(perCreditCents / 100).toFixed(2)}`;
          const isLoading = loadingId === bundle.id;
          const isAnyLoading = loadingId !== null;

          // Compute saving vs smallest bundle (first in array)
          const basePricePerCredit = bundles[0]!.priceCents / bundles[0]!.credits;
          const savingPct = bundle.id === bundles[0]!.id
            ? 0
            : Math.round((1 - perCreditCents / basePricePerCredit) * 100);

          return (
            <div
              key={bundle.id}
              className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {bundle.credits.toLocaleString("nl-NL")} credits
                  </p>
                  <p className="text-xs text-neutral-400">{perCreditDisplay}/credit</p>
                </div>
                {savingPct > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    -{savingPct}%
                  </span>
                )}
              </div>

              <p className="mb-4 text-2xl font-bold text-neutral-900">
                €{priceEuro}
              </p>

              {bundle.stripePrice ? (
                <button
                  onClick={() => handleBuy(bundle.id)}
                  disabled={isAnyLoading}
                  className="mt-auto w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Redirecting…
                    </span>
                  ) : (
                    "Buy now"
                  )}
                </button>
              ) : (
                <button
                  disabled
                  className="mt-auto w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
                >
                  Not configured
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        Payments are processed securely by Stripe. Credits are added to your wallet
        after payment confirmation — this typically takes a few seconds.
      </p>
    </Card>
  );
}

// ── SUPER ADMIN: Add Credits panel ───────────────────────────────────────────
//
// Visible only when isSuperAdmin === true.  Renders a simple form that calls
// addCreditsAction — super admin check is also enforced server-side.

const ADJUSTMENT_TYPE_OPTIONS: { value: AddCreditsAdjustmentType; label: string; description: string }[] = [
  { value: "admin_grant",  label: "Admin grant",  description: "Complimentary credits — service recovery, promotion, or onboarding."        },
  { value: "adjustment",   label: "Adjustment",   description: "Balance correction for a billing discrepancy or usage anomaly."               },
  { value: "refund",       label: "Refund",        description: "Reimbursement — credits added back after an erroneous debit or failed job."  },
];

function AddCreditsPanel({ tenantId }: { tenantId: string }) {
  const [amount,         setAmount]         = useState<string>("");
  const [reason,         setReason]         = useState<string>("");
  const [adjustmentType, setAdjustmentType] = useState<AddCreditsAdjustmentType>("admin_grant");
  const [isPending,      startTransition]   = useTransition();
  const [result,         setResult]         = useState<
    | { ok: true;  newBalanceCents: number }
    | { ok: false; error: string }
    | null
  >(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed === 0) {
      setResult({ ok: false, error: "Enter a non-zero number of credits." });
      return;
    }
    if (adjustmentType !== "adjustment" && parsed < 0) {
      setResult({ ok: false, error: "Only the Adjustment type supports negative (deduction) amounts." });
      return;
    }
    if (!reason.trim()) {
      setResult({ ok: false, error: "A reason is required." });
      return;
    }

    startTransition(async () => {
      const res = await addCreditsAction(tenantId, {
        amountCredits:  parsed,
        reason:         reason.trim(),
        adjustmentType,
      });
      setResult(res);
      if (res.ok) {
        setAmount("");
        setReason("");
        setAdjustmentType("admin_grant");
      }
    });
  }

  return (
    <Card>
      {/* Header with super-admin badge */}
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle>Add Credits</SectionTitle>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
          <span className="text-[10px]">🔒</span> Super admin only
        </span>
      </div>
      <p className="mb-5 text-xs text-neutral-500">
        Manually credit the tenant wallet. This action is logged in the ledger with your admin email and the reason you provide.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Adjustment type — radio cards */}
        <div>
          <label className="mb-2 block text-xs font-medium text-neutral-700">Adjustment type</label>
          <div className="space-y-2">
            {ADJUSTMENT_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  adjustmentType === opt.value
                    ? "border-violet-300 bg-violet-50"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <input
                  type="radio"
                  name="adjustmentType"
                  value={opt.value}
                  checked={adjustmentType === opt.value}
                  onChange={() => setAdjustmentType(opt.value)}
                  className="mt-0.5 accent-violet-600"
                />
                <div>
                  <p className="text-xs font-medium text-neutral-800">{opt.label}</p>
                  <p className="text-xs text-neutral-400">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">
            Amount{" "}
            <span className="text-neutral-400">
              (credits — 1 credit = €0.01
              {adjustmentType === "adjustment" ? "; negative value = deduction" : ""})
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={adjustmentType === "adjustment" ? "e.g. -500 or 5000" : "e.g. 5000"}
              className="w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-300"
            />
            {amount && parseFloat(amount) !== 0 && Number.isFinite(parseFloat(amount)) && (
              <span className={`text-xs ${parseFloat(amount) < 0 ? "text-red-500" : "text-neutral-500"}`}>
                {parseFloat(amount) < 0
                  ? `deduction: −€${(Math.abs(parseFloat(amount)) / 100).toFixed(2)}`
                  : `= €${(parseFloat(amount) / 100).toFixed(2)}`}
              </span>
            )}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">
            Reason <span className="text-neutral-400">(required — appears in ledger)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Service recovery for failed enrichment batch on 2026-04-18"
            required
            rows={2}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-300"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !amount || !reason.trim()}
            className={`rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-40 ${
              parseFloat(amount) < 0
                ? "bg-red-600 hover:bg-red-500"
                : "bg-violet-700 hover:bg-violet-600"
            }`}
          >
            {isPending
              ? (parseFloat(amount) < 0 ? "Deducting credits…" : "Adding credits…")
              : (parseFloat(amount) < 0 ? "Deduct credits" : "Add credits")}
          </button>
          {isPending && (
            <span className="text-xs text-neutral-400">Updating wallet…</span>
          )}
        </div>

        {/* Result feedback */}
        {result && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              result.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {result.ok ? (
              <span>
                ✓ {parseFloat(amount) < 0 ? "Credits deducted" : "Credits added"} — new balance:{" "}
                <strong>{result.newBalanceCents.toLocaleString()} cr</strong>{" "}
                (€{(result.newBalanceCents / 100).toFixed(2)}).{" "}
                The ledger entry is now visible below.
              </span>
            ) : (
              <span>⚠ {result.error}</span>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}

// ── PART 9: No-wallet empty state ─────────────────────────────────────────────

function NoWalletState() {
  return (
    <Card className="flex flex-col items-center py-12 text-center">
      <div className="mb-3 text-4xl opacity-20">○</div>
      <h3 className="text-sm font-semibold text-neutral-800">{EMPTY_STATES.no_wallet.title}</h3>
      <p className="mt-1 max-w-sm text-xs text-neutral-400">{EMPTY_STATES.no_wallet.body}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 text-left">
        {[
          { label: "Top up wallet",         desc: "Add credits manually to initialise the wallet." },
          { label: "Enable auto-reload",    desc: "Link a payment method for automatic top-ups."   },
          { label: "Configure budget cap",  desc: "Set a monthly spend limit and fallback mode."    },
          { label: "Connect Stripe",        desc: "Link a subscription to enable billing features."  },
        ].map((action) => (
          <div key={action.label} className="rounded-lg border border-neutral-200 p-3">
            <p className="text-xs font-medium text-neutral-700">{action.label}</p>
            <p className="mt-0.5 text-xs text-neutral-400">{action.desc}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Stripe Payments tab ───────────────────────────────────────────────────────

function formatCurrency(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style:    "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function InvoiceStatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const styles: Record<string, string> = {
    paid:           "bg-green-100 text-green-700",
    open:           "bg-yellow-100 text-yellow-700",
    void:           "bg-neutral-100 text-neutral-500",
    uncollectible:  "bg-red-100 text-red-600",
    draft:          "bg-blue-100 text-blue-600",
    failed:         "bg-red-100 text-red-600",
    processing:     "bg-yellow-100 text-yellow-700",
  };
  const cls = styles[s] ?? "bg-neutral-100 text-neutral-500";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {s}
    </span>
  );
}

function StripePaymentsTab({
  invoices,
  error,
  customerId,
}: {
  invoices:   StripeInvoiceRow[];
  error:      string | null;
  customerId: string | null;
}) {
  const invoicesPager = usePagination(invoices, 25);

  if (error) {
    return (
      <Card>
        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <span className="mt-0.5 text-red-500">⚠</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-700">Failed to load payment history</p>
              <p className="mt-0.5 text-xs text-red-600 break-words">{error}</p>
            </div>
          </div>
          {customerId && (
            <p className="text-xs text-neutral-400">
              Customer ID used: <code className="rounded bg-neutral-100 px-1 py-0.5">{customerId}</code>
            </p>
          )}
        </div>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 text-3xl">🧾</div>
          <p className="text-sm font-medium text-neutral-700">No payments found</p>
          <p className="mt-1 text-xs text-neutral-400">
            No Stripe invoices or PaymentIntents found for this customer.
          </p>
          {customerId && (
            <p className="mt-2 text-xs text-neutral-400">
              Customer: <code className="rounded bg-neutral-100 px-1 py-0.5">{customerId}</code>
            </p>
          )}
        </div>
      </Card>
    );
  }

  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amountPaid, 0);

  const currency = invoices[0]?.currency ?? "eur";

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs text-neutral-500">Total paid</p>
          <p className="mt-0.5 text-lg font-semibold text-neutral-900">
            {formatCurrency(totalPaid, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs text-neutral-500">Invoices</p>
          <p className="mt-0.5 text-lg font-semibold text-neutral-900">{invoices.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs text-neutral-500">Last payment</p>
          <p className="mt-0.5 text-lg font-semibold text-neutral-900">
            {invoices[0]
              ? new Date(invoices[0].createdAt).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>

      {/* Invoice table */}
      <Card>
        <SectionTitle sub="Stripe invoices for this tenant, newest first. Click the invoice number to open the Stripe-hosted page.">
          Payment History
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                <th className="pb-2 pr-4">Invoice</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Description</th>
                <th className="pb-2 pr-4">Period</th>
                <th className="pb-2 pr-4 text-right">Amount</th>
                <th className="pb-2 text-center">Status</th>
                <th className="pb-2 pl-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {invoicesPager.pageItems.map((inv) => (
                <tr key={inv.id} className="text-neutral-700 hover:bg-neutral-50/60">
                  <td className="py-2.5 pr-4 font-mono text-xs text-neutral-500">
                    {inv.source === "invoice" ? (
                      inv.hostedUrl ? (
                        <a
                          href={inv.hostedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {inv.number ?? inv.id.slice(0, 14)}
                        </a>
                      ) : (
                        inv.number ?? inv.id.slice(0, 14)
                      )
                    ) : (
                      <span className="text-neutral-400">{inv.id.slice(0, 18)}…</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-neutral-600">
                    {new Date(inv.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-neutral-600">
                    <div className="flex items-center gap-1.5">
                      {inv.source === "payment" && (
                        <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                          One-off
                        </span>
                      )}
                      <span className="max-w-[200px] truncate">{inv.description ?? "—"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-neutral-500">
                    {inv.periodStart && inv.periodEnd ? (
                      <>
                        {new Date(inv.periodStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(inv.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium tabular-nums">
                    {formatCurrency(inv.status === "paid" ? inv.amountPaid : inv.amountDue, inv.currency)}
                  </td>
                  <td className="py-2.5 text-center">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="py-2.5 pl-4">
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-400 hover:text-neutral-700"
                        title="Download PDF"
                      >
                        PDF ↓
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls {...invoicesPager} label="betalingen" />
      </Card>
    </div>
  );
}

// ── Main dashboard component ──────────────────────────────────────────────────

export function BillingDashboard({
  tenantId,
  tenantPackage,
  subscription,
  plan,
  currentBalance,
  usage,
  estimate,
  allPlans,
  usageEventSummary,
  debugData,
  wallet,
  walletLedger,
  ledgerPage,
  ledgerPageSize,
  ledgerHasNext,
  spendToday,
  spendThisMonth,
  enrichmentUsageSummary,
  totalEnrichmentSpendCents,
  reloadAttempts,
  isTestModeAvailable,
  stripeModeInfo,
  webhookEvents,
  creditSettings,
  isSuperAdmin,
  isActiveOverride,
  creditBundles,
  buyStatus,
  boughtBundleId,
  checkoutStatus,
  planChangeStatus,
  sessionCap,
  sessionLedger,
  sessionBundles,
  sessionBuyStatus,
  sessionBoughtBundleId,
  dunningSettings,
  stripeInvoices = [],
  stripeInvoicesError,
  stripeCustomerId,
}: BillingDashboardProps) {
  const [tab, setTab] = useState<Tab>(
    checkoutStatus === "success"   ? "subscription" :
    planChangeStatus === "success" ? "subscription" :
    buyStatus                      ? "wallet"        :
    sessionBuyStatus               ? "sessions"      :
    "credits",
  );

  const statusKey  = classifyWalletStatus(wallet, spendThisMonth, creditSettings);
  const breakdown  = computeCategoryBreakdown(enrichmentUsageSummary);
  const grandTotal = breakdown.reduce((s, b) => s + b.totalCredits, 0);

  return (
    <div>
      {/* PART 1: Balance hero — always visible */}
      <BalanceHero wallet={wallet} spendToday={spendToday} spendThisMonth={spendThisMonth} statusKey={statusKey} tenantId={tenantId} isSuperAdmin={isSuperAdmin} />

      {/* Alert banners */}
      <AlertBanners wallet={wallet} reloadAttempts={reloadAttempts} statusKey={statusKey} spendThisMonth={spendThisMonth} />

      {/* Purchase result banner — shown after returning from credit-bundle Checkout */}
      {buyStatus === "success" && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="mt-0.5 text-emerald-500">✓</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Payment received</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {boughtBundleId
                ? `Your ${creditBundles.find((b) => b.id === boughtBundleId)?.label ?? "credits"} have been added to your wallet.`
                : "Your credits have been added to your wallet."}{" "}
              Your balance above has been updated.
            </p>
          </div>
        </div>
      )}
      {planChangeStatus === "success" && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="mt-0.5 text-emerald-500">✓</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Plan upgrade payment received</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your plan upgrade has been paid for and is scheduled to activate at the start of your next billing period.
            </p>
          </div>
        </div>
      )}
      {(buyStatus === "cancelled" || checkoutStatus === "cancelled" || planChangeStatus === "cancelled") && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="mt-0.5 text-neutral-400">✕</span>
          <p className="text-sm text-neutral-600">Checkout cancelled — no payment was taken.</p>
        </div>
      )}

      {/* Tab navigation */}
      <TabNav tab={tab} setTab={setTab} />

      {/* ─── CREDITS & USAGE ──────────────────────────────────────────────── */}
      {tab === "credits" && (
        <div className="space-y-6">
          {/* PART 2: Category overview */}
          <section>
            <SectionTitle sub="Enrichment credits consumed by category this month. These are separate from session credits — see the Sessions tab for personalised visit usage.">
              {LABELS.SECTION_CATEGORIES}
            </SectionTitle>
            {grandTotal === 0 ? (
              <Card><EmptyState {...EMPTY_STATES.no_usage} /></Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {breakdown.map((b) => (
                  <CategoryCard
                    key={b.category}
                    category={b.category}
                    totalCredits={b.totalCredits}
                    totalCalls={b.totalCalls}
                    freshCalls={b.freshCalls}
                    cacheHits={b.cacheHits}
                    blockedCalls={b.blockedCalls}
                    pctOfTotal={grandTotal > 0 ? (b.totalCredits / grandTotal) * 100 : 0}
                  />
                ))}
              </div>
            )}
          </section>

          {/* PART 3: Feature breakdown table */}
          <section>
            <SectionTitle sub="Per-feature call counts and credit spend this month.">
              {LABELS.SECTION_FEATURES}
            </SectionTitle>
            <Card>
              <FeatureBreakdownTable rows={enrichmentUsageSummary} />
            </Card>
          </section>

          {/* PART 5: Budget cap */}
          <BudgetCapCard
            tenantId={tenantId}
            wallet={wallet}
            creditSettings={creditSettings}
            spendThisMonth={spendThisMonth}
          />

          {/* PART 7: Cost controls */}
          <CostControlCard
            tenantId={tenantId}
            creditSettings={creditSettings}
            enrichmentUsageSummary={enrichmentUsageSummary}
          />
        </div>
      )}

      {/* ─── WALLET ───────────────────────────────────────────────────────── */}
      {tab === "wallet" && (
        <div className="space-y-6">
          {/* Scope clarification */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            <strong>Enrichment wallet</strong> — this tab covers your Chameleon Credits balance,
            used for data enrichment (email lookups, company profiles, intent signals, and similar
            API-backed features). To buy or view bonus personalised-session credits, use the
            <strong> Sessions</strong> tab.
          </div>

          {/* Buy credits — visible to all tenants */}
          <BuyCreditsPanel tenantId={tenantId} bundles={creditBundles} />

          {!wallet ? (
            <NoWalletState />
          ) : (
            <>
              {/* PART 8: Stripe status */}
              <StripeStatusCard
                tenantId={tenantId}
                stripeModeInfo={stripeModeInfo}
                subscription={subscription}
                wallet={wallet}
                onNavigateToSubscription={() => setTab("subscription")}
              />
              {/* PART 6: Auto-reload */}
              <AutoReloadCard tenantId={tenantId} wallet={wallet} reloadAttempts={reloadAttempts} />
              {/* Notifications */}
              <NotificationCard tenantId={tenantId} wallet={wallet} />
            </>
          )}

          {/* Super admin: manual credit grant */}
          {isSuperAdmin && <AddCreditsPanel tenantId={tenantId} />}

          {/* PART 4: Ledger — merged from former History tab */}
          <Card>
            <SectionTitle sub="Append-only ledger of all enrichment credit movements (top-ups, deductions, auto-reloads). Session credit history is on the Sessions tab.">
              Enrichment Credit History
            </SectionTitle>
            <LedgerTable entries={walletLedger} />
            <LedgerPagination
              page={ledgerPage}
              pageSize={ledgerPageSize}
              hasNext={ledgerHasNext}
              rowCount={walletLedger.length}
            />
          </Card>
        </div>
      )}

      {/* ─── SUBSCRIPTION ─────────────────────────────────────────────────── */}
      {tab === "subscription" && (
        <div className="space-y-6">
          <SubscriptionPanel
            tenantId={tenantId}
            subscription={subscription}
            plan={plan}
            tenantPackage={tenantPackage}
            allPlans={allPlans}
            usage={usage}
            estimate={estimate}
            checkoutStatus={checkoutStatus}
            planChangeStatus={planChangeStatus}
            isSuperAdmin={isSuperAdmin}
            isActiveOverride={isActiveOverride}
          />
          {dunningSettings && (
            <DunningSettingsPanel
              tenantId={tenantId}
              initialSettings={dunningSettings}
              subscriptionStatus={subscription?.status ?? null}
              isSuperAdmin={isSuperAdmin}
            />
          )}
        </div>
      )}

      {/* ─── SESSIONS ────────────────────────────────────────────────────── */}
      {tab === "sessions" && (
        <SessionsTab
          tenantId={tenantId}
          cap={sessionCap}
          ledger={sessionLedger}
          bundles={sessionBundles}
          buyStatus={sessionBuyStatus}
          boughtBundleId={sessionBoughtBundleId}
        />
      )}

      {/* ─── PAYMENTS ────────────────────────────────────────────────────── */}
      {tab === "payments" && (
        <StripePaymentsTab
          invoices={stripeInvoices}
          error={stripeInvoicesError ?? null}
          customerId={stripeCustomerId ?? null}
        />
      )}

      {/* ─── DEBUG ────────────────────────────────────────────────────────── */}
      {tab === "debug" && (
        <DebugPanel
          tenantId={tenantId}
          wallet={wallet}
          enrichmentUsageSummary={enrichmentUsageSummary}
          reloadAttempts={reloadAttempts}
          debugData={debugData}
          stripeModeInfo={stripeModeInfo}
          webhookEvents={webhookEvents}
          spendToday={spendToday}
          spendThisMonth={spendThisMonth}
        />
      )}
    </div>
  );
}

// ── SessionsTab ───────────────────────────────────────────────────────────────

function SessionsTab({
  tenantId,
  cap,
  ledger,
  bundles,
  buyStatus,
  boughtBundleId,
}: {
  tenantId:       string;
  cap:            SessionCapResult;
  ledger:         SessionCreditLedgerEntry[];
  bundles:        SessionCreditBundle[];
  buyStatus?:     "success" | "cancelled";
  boughtBundleId?: string;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [buyError,  setBuyError]  = useState<string | null>(null);
  const router = useRouter();
  const ledgerPager = usePagination(ledger, 25);

  async function handleBuyBundle(bundleId: string) {
    setLoadingId(bundleId);
    setBuyError(null);
    try {
      const res = await fetch("/api/billing/create-session-bundle-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId, bundleId }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setBuyError(json.error ?? "Could not start checkout. Please try again.");
        setLoadingId(null);
        return;
      }
      router.push(json.url);
    } catch {
      setBuyError("Network error — please try again.");
      setLoadingId(null);
    }
  }

  function fmtN(n: number) { return n.toLocaleString("nl-NL"); }
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  const planLimitDisplay = (cap.planLimit ?? 0) === 0 ? "Unlimited" : fmtN(cap.planLimit ?? 0);
  const usagePct = cap.limit > 0 ? Math.min(100, Math.round((cap.current / cap.limit) * 100)) : 0;
  const progressColor = usagePct >= 100 ? "bg-red-500" : usagePct >= 80 ? "bg-amber-500" : "bg-brand-500";

  function entryTypeLabel(type: SessionCreditLedgerEntry["entry_type"]): string {
    switch (type) {
      case "purchase":   return "Top-up purchased";
      case "deduction":  return "Sessions served (bonus)";
      case "grant":      return "Credit grant";
      case "refund":     return "Refund";
      case "adjustment": return "Manual adjustment";
      default:           return type;
    }
  }

  function entryTypeColor(type: SessionCreditLedgerEntry["entry_type"]): string {
    switch (type) {
      case "purchase":
      case "grant":
      case "refund":    return "text-emerald-700";
      case "deduction": return "text-neutral-500";
      default:          return "text-amber-600";
    }
  }

  return (
    <div className="space-y-6">

      {/* Purchase result banners */}
      {buyStatus === "success" && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="mt-0.5 text-emerald-500">✓</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Payment received</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {boughtBundleId
                ? `${bundles.find((b) => b.id === boughtBundleId)?.label ?? "Session credits"} have been added to your balance.`
                : "Your session credits have been added to your balance."
              }{" "}
              Your bonus credit balance above has been updated.
            </p>
          </div>
        </div>
      )}
      {buyStatus === "cancelled" && (
        <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="mt-0.5 text-neutral-400">✕</span>
          <p className="text-sm text-neutral-600">Checkout cancelled — no payment was taken.</p>
        </div>
      )}

      {/* Usage + balance cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Monthly usage */}
        <div className="col-span-2 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Personalised sessions — {cap.monthKey}
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-900">
                {fmtN(cap.current)}
                <span className="ml-2 text-base font-normal text-neutral-400">
                  / {planLimitDisplay}
                  {(cap.bonusSessions ?? 0) > 0 ? ` + ${fmtN(cap.bonusSessions ?? 0)} bonus` : ""}
                </span>
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">unique visitor sessions served this month</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              cap.overLimit ? "bg-red-100 text-red-700" :
              usagePct >= 80 ? "bg-amber-100 text-amber-700" :
              "bg-emerald-100 text-emerald-700"
            }`}>
              {cap.overLimit ? "Cap reached" : `${usagePct}% used`}
            </span>
          </div>

          {cap.limit > 0 && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-neutral-100">
                <div className={`h-2 rounded-full transition-all ${progressColor}`} style={{ width: `${usagePct}%` }} />
              </div>
              {(cap.bonusSessions ?? 0) > 0 && (
                <div className="flex text-[10px] text-neutral-400 justify-between">
                  <span>Plan cap: {fmtN(cap.planLimit ?? 0)}</span>
                  <span>+{fmtN(cap.bonusSessions ?? 0)} bonus sessions</span>
                </div>
              )}
            </div>
          )}

          {cap.overLimit && (
            <p className="mt-3 text-xs text-red-600 font-medium">
              Cap reached. Visitors are receiving the default experience until the month resets or credits are purchased.
            </p>
          )}
        </div>

        {/* Bonus credit balance */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Bonus credit balance</p>
          <p className="mt-1 text-3xl font-bold text-neutral-900">{fmtN(cap.bonusSessions ?? 0)}</p>
          <p className="text-xs text-neutral-400 mt-0.5">purchased sessions (never expire)</p>
          <p className="mt-auto pt-4 text-xs text-neutral-400">
            Deducted automatically when sessions exceed the plan cap.
          </p>
        </div>
      </div>

      {/* Buy session credit bundles */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">Buy session credits</h3>
        <p className="text-xs text-neutral-500 mb-5">
          Top up your bonus session balance. Purchased credits never expire and are consumed
          automatically when personalised sessions exceed your monthly plan cap.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {bundles.map((bundle) => {
            const priceEuro     = (bundle.priceCents / 100).toFixed(2);
            const perK          = (bundle.centsPerThousand / 100).toFixed(2);
            const isLoading     = loadingId === bundle.id;
            const isAnyLoading  = loadingId !== null;

            // Saving % vs smallest bundle
            const basePerK = bundles[0]!.centsPerThousand;
            const savingPct = bundle.id === bundles[0]!.id
              ? 0
              : Math.round((1 - bundle.centsPerThousand / basePerK) * 100);

            return (
              <div
                key={bundle.id}
                className="flex flex-col rounded-xl border border-neutral-200 bg-neutral-50 p-4 transition-shadow hover:shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{bundle.label}</p>
                    <p className="text-xs text-neutral-400">€{perK}/1,000 sessions</p>
                  </div>
                  {savingPct > 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      -{savingPct}%
                    </span>
                  )}
                </div>

                <p className="mb-4 text-2xl font-bold text-neutral-900">€{priceEuro}</p>

                {bundle.stripePrice ? (
                  <button
                    onClick={() => handleBuyBundle(bundle.id)}
                    disabled={isAnyLoading}
                    className="mt-auto w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Redirecting…
                      </span>
                    ) : "Buy now"}
                  </button>
                ) : (
                  <button
                    disabled
                    className="mt-auto w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
                  >
                    Not configured
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {buyError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {buyError}
          </p>
        )}

        <p className="mt-4 text-xs text-neutral-400">
          Payments are processed securely via Stripe. Credits are added instantly after payment
          confirmation.
        </p>
      </div>

      {/* Session credit ledger */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Session credit history</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Top-ups, deductions, grants, and adjustments</p>
          </div>
          <span className="text-xs text-neutral-400">{ledger.length} entries</span>
        </div>

        {ledger.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">
            No session credit transactions yet. Deductions appear here when visitors are served
            from purchased bonus credits (above the plan cap).
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Note</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {ledgerPager.pageItems.map((entry, i) => (
                <tr key={entry.id} className={`border-b border-neutral-50 ${i % 2 === 0 ? "" : "bg-neutral-50/40"}`}>
                  <td className="px-5 py-3 text-xs text-neutral-500 whitespace-nowrap">{fmtDate(entry.created_at)}</td>
                  <td className={`px-5 py-3 font-medium text-sm ${entryTypeColor(entry.entry_type)}`}>
                    {entryTypeLabel(entry.entry_type)}
                  </td>
                  <td className="px-5 py-3 text-xs text-neutral-400 max-w-xs truncate">{entry.note ?? "—"}</td>
                  <td className={`px-5 py-3 text-right font-mono font-semibold ${entry.amount > 0 ? "text-emerald-700" : "text-neutral-600"}`}>
                    {entry.amount > 0 ? "+" : ""}{fmtN(entry.amount)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-neutral-600">{fmtN(entry.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-5 pb-4">
          <PaginationControls {...ledgerPager} label="transacties" />
        </div>
      </div>
    </div>
  );
}
