/**
 * /admin/platform/billing
 *
 * Platform-level billing overview — all tenants at a glance.
 *
 * ─── What this shows ──────────────────────────────────────────────────────────
 *
 *   • Total platform MRR (sum of active subscription base fees)
 *   • Per-tenant row: plan, status, billing cycle, current-period credits used
 *   • Highlight tenants with past_due status or credit overages
 *   • Quick link to each tenant's detailed billing page
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   This is an async server component. All data fetching is server-side.
 *   No client state — the page refreshes on navigation.
 *
 * ─── Access control ──────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session (getRequiredAdminSession).
 *   Only super-admins see revenue data. Tenant-scoped admins are redirected
 *   to their own billing page.
 */

import Link                          from "next/link";
import { createClient }              from "@supabase/supabase-js";
import { getAllTenants }             from "@/tenant/server";
import { BILLING_PLANS }             from "@/billing/plans";
import { formatCents }               from "@/billing/format";
import type { BillingPlanId }        from "@/billing/types";
import {
  getRequiredAdminSession,
} from "@/lib/admin-auth/authorization";
import { BillingNav }                from "@/components/admin/BillingNav";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubscriptionRow {
  tenant_id:            string;
  plan:                 string;
  status:               string;
  billing_cycle:        string;
  current_period_end:   string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id:   string;
}

interface CreditBalanceRow {
  tenant_id: string;
  balance:   number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusColour(status: string): string {
  const map: Record<string, string> = {
    active:   "bg-green-100 text-green-700",
    trialing: "bg-blue-100 text-blue-700",
    past_due: "bg-red-100 text-red-700",
    canceled: "bg-neutral-100 text-neutral-500",
    unpaid:   "bg-red-100 text-red-700",
    paused:   "bg-yellow-100 text-yellow-700",
  };
  return map[status] ?? "bg-neutral-100 text-neutral-500";
}

function planLabel(planId: string): string {
  return BILLING_PLANS[planId as BillingPlanId]?.name ?? planId;
}

function mrrCents(planId: string, cycle: string): number {
  const plan = BILLING_PLANS[planId as BillingPlanId];
  if (!plan) return 0;
  return cycle === "annual" ? plan.annualMonthlyCents : plan.monthlyPriceCents;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlatformBillingPage() {
  await getRequiredAdminSession();

  const db = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // ── Fetch all tenants + their subscription rows ───────────────────────────

  const [tenants, subsResult, balancesResult] = await Promise.all([
    getAllTenants(),
    db.from("subscriptions").select("tenant_id, plan, status, billing_cycle, current_period_end, cancel_at_period_end, stripe_customer_id"),
    db.from("credit_balance").select("tenant_id, balance"),
  ]);

  const subs: SubscriptionRow[]     = (subsResult.data    ?? []) as SubscriptionRow[];
  const balances: CreditBalanceRow[] = (balancesResult.data ?? []) as CreditBalanceRow[];

  const subByTenant     = Object.fromEntries(subs.map((s) => [s.tenant_id, s]));
  const balanceByTenant = Object.fromEntries(balances.map((b) => [b.tenant_id, b.balance]));

  // ── Compute platform MRR ──────────────────────────────────────────────────

  const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trialing");
  const totalMrrCents = activeSubs.reduce(
    (sum, s) => sum + mrrCents(s.plan, s.billing_cycle),
    0,
  );

  // ── Build tenant rows ─────────────────────────────────────────────────────

  const rows = tenants.map((tenant) => {
    const sub     = subByTenant[tenant.tenantId];
    const balance = balanceByTenant[tenant.tenantId] ?? null;
    const plan    = sub ? BILLING_PLANS[sub.plan as BillingPlanId] : null;
    const included = plan?.includedCredits ?? 0;
    const hasOverage = balance !== null && balance < 0; // shouldn't happen but worth flagging

    return { tenant, sub, balance, plan, included, hasOverage };
  });

  // Sort: past_due first, then by plan descending (pro → growth → starter → none)
  const planOrder: Record<string, number> = { pro: 3, growth: 2, starter: 1 };
  rows.sort((a, b) => {
    const aStatus = a.sub?.status ?? "";
    const bStatus = b.sub?.status ?? "";
    if (aStatus === "past_due" && bStatus !== "past_due") return -1;
    if (bStatus === "past_due" && aStatus !== "past_due") return  1;
    return (planOrder[b.sub?.plan ?? ""] ?? 0) - (planOrder[a.sub?.plan ?? ""] ?? 0);
  });

  const atRiskCount = rows.filter(
    (r) => r.sub?.status === "past_due" || r.sub?.status === "unpaid",
  ).length;

  return (
    <div className="max-w-6xl p-8">

      {/* ── Billing tab navigation ───────────────────────────────────────────── */}
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-neutral-900">Platform Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage plans, enrichment pricing, and billing configuration.
        </p>
      </div>

      <BillingNav />

      {/* ── Section header ───────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-neutral-800">Subscription overview</h2>
        <p className="mt-1 text-sm text-neutral-500">
          All {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} — plan status, MRR, and credit balance at a glance.
        </p>
      </div>

      {/* ── Summary stats ───────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total tenants",    value: String(tenants.length) },
          { label: "Active subs",      value: String(activeSubs.length) },
          { label: "MRR (est.)",       value: formatCents(totalMrrCents) },
          {
            label: "At risk",
            value: String(atRiskCount),
            warn: atRiskCount > 0,
          },
        ].map(({ label, value, warn }) => (
          <div
            key={label}
            className={`rounded-lg border p-4 ${
              warn ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"
            }`}
          >
            <p className={`text-xs ${warn ? "text-red-400" : "text-neutral-400"}`}>{label}</p>
            <p className={`mt-0.5 text-2xl font-semibold ${warn ? "text-red-700" : "text-neutral-900"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tenant table ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Tenant</th>
                <th className="px-5 py-3 text-left font-medium">Plan</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Billing</th>
                <th className="px-5 py-3 text-right font-medium">MRR</th>
                <th className="px-5 py-3 text-right font-medium">Credits</th>
                <th className="px-5 py-3 text-right font-medium">Period ends</th>
                <th className="px-5 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ tenant, sub, balance, plan, included }) => {
                const isPastDue = sub?.status === "past_due" || sub?.status === "unpaid";
                const mrr       = sub ? mrrCents(sub.plan, sub.billing_cycle) : 0;
                // Option B: no included credits — show balance directly, no percentage
                const creditPct = null;
                void included; // unused now but kept in destructuring for type safety

                return (
                  <tr
                    key={tenant.tenantId}
                    className={`border-b border-neutral-50 text-sm ${isPastDue ? "bg-red-50" : ""}`}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-neutral-800">{tenant.name ?? tenant.tenantId}</p>
                      <p className="text-xs text-neutral-400 font-mono">{tenant.tenantId.slice(0, 8)}…</p>
                    </td>
                    <td className="px-5 py-3 text-neutral-700">
                      {sub ? planLabel(sub.plan) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {sub ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColour(sub.status)}`}>
                          {sub.status.replace("_", " ")}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">No sub</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-neutral-600 capitalize">
                      {sub?.billing_cycle ?? <span className="text-neutral-400">—</span>}
                      {sub?.cancel_at_period_end && (
                        <span className="ml-1 text-xs text-yellow-600">(cancels)</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-neutral-700">
                      {mrr > 0 ? formatCents(mrr) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {balance !== null ? (
                        <span className={`text-sm font-mono ${
                          creditPct !== null && creditPct >= 90 ? "text-red-600 font-semibold" :
                          creditPct !== null && creditPct >= 70 ? "text-yellow-600" :
                          "text-neutral-600"
                        }`}>
                          {balance.toLocaleString()}
                          {creditPct !== null && (
                            <span className="ml-1 text-xs text-neutral-400">({creditPct}% used)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-neutral-500 whitespace-nowrap">
                      {sub?.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString("nl-NL")
                        : <span className="text-neutral-400">—</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/tenants/${tenant.tenantId}/billing`}
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
