/**
 * Dashboard — Session Credits & Billing
 *
 * Shows the tenant's current monthly session usage against their plan cap,
 * purchased session credit balance, and full session credit ledger history
 * (purchases, deductions from bonus-credit sessions, grants, refunds).
 *
 * The wallet ledger (Chameleon enrichment credits) lives at
 * /admin/tenants/[id]/billing — this page is for SESSION credits only.
 */

import { getActiveTenantWithDevOverride } from "@/tenant/server";
import {
  checkSessionSoftCap,
  getSessionCreditLedger,
  type SessionCreditLedgerEntry,
} from "@/billing/plan-enforcement";
import { getEffectivePlan } from "@/billing/plan-enforcement";
import { SESSION_CREDIT_BUNDLES } from "@/billing/plans";
import { Text } from "@/components/primitives/Text";

export const metadata = { title: "Session Credits · Dashboard" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNumber(n: number): string {
  return n.toLocaleString("nl-NL");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function entryTypeLabel(type: SessionCreditLedgerEntry["entry_type"]): string {
  switch (type) {
    case "purchase":    return "Top-up purchased";
    case "deduction":   return "Sessions served (bonus)";
    case "grant":       return "Credit grant";
    case "refund":      return "Refund";
    case "adjustment":  return "Manual adjustment";
    default:            return type;
  }
}

function entryTypeColor(type: SessionCreditLedgerEntry["entry_type"]): string {
  switch (type) {
    case "purchase":
    case "grant":
    case "refund":     return "text-emerald-700";
    case "deduction":  return "text-neutral-500";
    case "adjustment": return "text-amber-600";
    default:           return "text-neutral-500";
  }
}

function bundleLabel(bundleId: string | null): string {
  if (!bundleId) return "";
  const bundle = SESSION_CREDIT_BUNDLES.find((b) => b.id === bundleId);
  return bundle ? ` — ${bundle.label}` : "";
}

// ── Page ──────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { tenantConfig, devTenantOverride } = await getActiveTenantWithDevOverride(
    params,
    "dashboard/billing",
  );
  const tenantId = devTenantOverride ?? tenantConfig.tenantId;

  const [cap, ledger, plan] = await Promise.all([
    checkSessionSoftCap(tenantId),
    getSessionCreditLedger(tenantId, 100),
    getEffectivePlan(tenantId),
  ]);

  const planLimitDisplay = cap.planLimit === 0
    ? "Unlimited"
    : fmtNumber(cap.planLimit ?? 0);

  const usagePct = cap.limit > 0
    ? Math.min(100, Math.round((cap.current / cap.limit) * 100))
    : 0;

  const progressColor = usagePct >= 100
    ? "bg-red-500"
    : usagePct >= 80
    ? "bg-amber-500"
    : "bg-brand-500";

  return (
    <div className="flex flex-col gap-6 px-8 py-8 max-w-4xl">

      {/* Header */}
      <div>
        <Text variant="h2" as="h1">Session Credits</Text>
        <p className="mt-1 text-sm text-neutral-500">
          Monthly personalisation usage for{" "}
          <span className="font-medium text-neutral-700">{tenantConfig.name}</span>
          {" "}on the <span className="font-medium text-neutral-700">{plan.name}</span> plan.
        </p>
      </div>

      {devTenantOverride && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Dev override active: <code className="font-mono">{devTenantOverride}</code>
        </div>
      )}

      {/* ── Usage strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Current usage */}
        <div className="col-span-2 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                This month ({cap.monthKey})
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-900">
                {fmtNumber(cap.current)}
                <span className="ml-2 text-base font-normal text-neutral-400">
                  / {planLimitDisplay}
                  {cap.bonusSessions ? ` + ${fmtNumber(cap.bonusSessions)} bonus` : ""}
                </span>
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">personalised sessions served</p>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
              cap.overLimit
                ? "bg-red-100 text-red-700"
                : usagePct >= 80
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
            }`}>
              {cap.overLimit ? "Cap reached" : `${usagePct}% used`}
            </div>
          </div>

          {/* Progress bar */}
          {cap.limit > 0 && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-neutral-100">
                <div
                  className={`h-2 rounded-full transition-all ${progressColor}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              {cap.planLimit !== undefined && cap.bonusSessions !== undefined && cap.bonusSessions > 0 && (
                <div className="flex text-[10px] text-neutral-400 justify-between">
                  <span>Plan cap: {fmtNumber(cap.planLimit)}</span>
                  <span>+{fmtNumber(cap.bonusSessions)} bonus sessions</span>
                </div>
              )}
            </div>
          )}

          {cap.overLimit && (
            <p className="mt-3 text-xs text-red-600 font-medium">
              Personalisation cap reached. Visitors are receiving the default experience.{" "}
              Purchase a top-up below to restore personalisation for the rest of this month.
            </p>
          )}
        </div>

        {/* Credit balance */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Bonus credit balance
          </p>
          <p className="mt-1 text-3xl font-bold text-neutral-900">
            {fmtNumber(cap.bonusSessions ?? 0)}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">purchased sessions (never expire)</p>
          <div className="mt-auto pt-4">
            <p className="text-xs text-neutral-400">
              Credits are deducted when sessions go above your plan cap.
            </p>
          </div>
        </div>
      </div>

      {/* ── Buy top-up bundles ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Session top-ups</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Credits never expire — they carry over month to month.
          Billed via Stripe; your card on file is charged immediately.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {SESSION_CREDIT_BUNDLES.map((bundle) => (
            <div
              key={bundle.id}
              className="flex flex-col rounded-lg border border-neutral-200 p-4 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
            >
              <p className="font-semibold text-neutral-900">{bundle.label}</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                €{(bundle.priceCents / 100).toFixed(2)}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                €{(bundle.centsPerThousand / 100).toFixed(2)} per 1K sessions
              </p>
              <button
                className="mt-3 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
                disabled
                title="Stripe checkout — coming soon"
              >
                Buy
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-neutral-400">
          Tip: upgrading to the next plan tier is more cost-effective for sustained high traffic.
        </p>
      </div>

      {/* ── Session credit ledger ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Session credit history</h2>
          <span className="text-xs text-neutral-400">{ledger.length} entries</span>
        </div>

        {ledger.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">
            No credit transactions yet.
            Deductions appear here when sessions are served from purchased bonus credits.
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
              {ledger.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-neutral-50 ${i % 2 === 0 ? "" : "bg-neutral-50/40"}`}
                >
                  <td className="px-5 py-3 text-xs text-neutral-500 whitespace-nowrap">
                    {fmtDate(entry.created_at)}
                  </td>
                  <td className={`px-5 py-3 font-medium ${entryTypeColor(entry.entry_type)}`}>
                    {entryTypeLabel(entry.entry_type)}
                    {entry.bundle_id ? (
                      <span className="text-neutral-400 font-normal">
                        {bundleLabel(entry.bundle_id)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-xs text-neutral-400 max-w-xs truncate">
                    {entry.note ?? "—"}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono font-semibold ${
                    entry.amount > 0 ? "text-emerald-700" : "text-neutral-600"
                  }`}>
                    {entry.amount > 0 ? "+" : ""}{fmtNumber(entry.amount)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-neutral-600">
                    {fmtNumber(entry.balance_after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
