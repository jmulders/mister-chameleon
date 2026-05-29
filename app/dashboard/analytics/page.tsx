/**
 * Dashboard — Analytics
 *
 * Conversion funnel, daily session trend, and per-variant performance table.
 * Gated behind the analyticsDashboard feature flag (Growth+).
 *
 * All data comes from migration 099 Postgres functions — no external analytics
 * service required.
 */

import { getActiveTenantWithDevOverride } from "@/tenant/server";
import Link from "next/link";
import { checkPlanFeature }               from "@/billing/plan-enforcement";
import { Text }                           from "@/components/primitives/Text";
import {
  getAnalyticsFunnel,
  getAnalyticsDaily,
  getAnalyticsVariants,
  type FunnelStage,
  type DailyDataPoint,
  type VariantRow,
} from "./actions";

export const metadata = { title: "Analytics · Dashboard" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString("nl-NL"); }

function conversionRate(hits: number, total: number): string {
  if (total === 0) return "—";
  return (hits / total * 100).toFixed(1) + "%";
}

// ── Page props ────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { tenantConfig, devTenantOverride } = await getActiveTenantWithDevOverride(
    params,
    "dashboard/analytics",
  );
  const tenantId = devTenantOverride ?? tenantConfig.tenantId;

  // ── Feature gate ───────────────────────────────────────────────────────────
  const gate = await checkPlanFeature(tenantId, "analyticsDashboard");
  if (!gate.allowed) {
    return (
      <div className="px-8 py-8 max-w-3xl">
        <Text variant="h2" as="h1">Analytics</Text>
        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-8 py-12 text-center">
          <p className="text-2xl font-bold text-neutral-300 mb-2">📊</p>
          <p className="font-semibold text-neutral-700">Analytics dashboard requires Growth or higher</p>
          <p className="mt-1 text-sm text-neutral-500 max-w-sm mx-auto">
            {gate.reason} Upgrade your plan to unlock the full analytics dashboard with
            funnel visualisation and variant performance reporting.
          </p>
          <Link
            href="/dashboard/tenant"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            View plan options
          </Link>
        </div>
      </div>
    );
  }

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const DAYS = 30;
  const [funnelResult, dailyResult, variantsResult] = await Promise.all([
    getAnalyticsFunnel(tenantId, DAYS),
    getAnalyticsDaily(tenantId, DAYS),
    getAnalyticsVariants(tenantId, DAYS),
  ]);

  const funnel   = funnelResult.ok   ? funnelResult.data   : [];
  const daily    = dailyResult.ok    ? dailyResult.data    : [];
  const variants = variantsResult.ok ? variantsResult.data : [];

  const totalSessions  = funnel[0]?.session_count ?? 0;
  const ctaClicks      = funnel[2]?.session_count ?? 0;
  const conversions    = funnel[3]?.session_count ?? 0;
  const convRate       = conversionRate(conversions, totalSessions);
  const maxDailyCount  = Math.max(...daily.map((d) => d.sessions), 1);

  return (
    <div className="flex flex-col gap-6 px-8 py-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Text variant="h2" as="h1">Analytics</Text>
          <p className="mt-1 text-sm text-neutral-500">
            Last {DAYS} days ·{" "}
            <span className="font-medium text-neutral-700">{tenantConfig.name}</span>
          </p>
        </div>
        {devTenantOverride && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-mono text-amber-700">
            dev override: {devTenantOverride}
          </span>
        )}
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Personalised sessions", value: fmtNum(totalSessions), sub: "unique visitors" },
          { label: "CTA clicks",            value: fmtNum(ctaClicks),      sub: `${conversionRate(ctaClicks, totalSessions)} of sessions` },
          { label: "Conversions",           value: fmtNum(conversions),    sub: `${convRate} conversion rate` },
          { label: "Variants tracked",      value: String(variants.length), sub: "active in period" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Conversion funnel ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Conversion funnel</h2>
        {funnel.length === 0 || totalSessions === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">
            No session data yet for this period. Funnel will populate once visitors are being personalised.
          </p>
        ) : (
          <div className="space-y-3">
            {funnel.map((stage, i) => {
              const pct = Number(stage.pct_of_top);
              const colors = [
                "bg-brand-600",
                "bg-brand-500",
                "bg-brand-400",
                "bg-emerald-500",
              ];
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex size-5 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-500">
                        {i + 1}
                      </span>
                      <span className="font-medium text-neutral-700">{stage.stage}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-semibold text-neutral-900">{fmtNum(stage.session_count)}</span>
                      <span className={`w-12 text-right font-mono text-xs ${
                        i === 0 ? "text-neutral-400" : pct >= 50 ? "text-emerald-600" : "text-amber-600"
                      }`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-neutral-100">
                    <div
                      className={`h-2.5 rounded-full transition-all ${colors[i] ?? "bg-brand-300"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {i < funnel.length - 1 && stage.session_count > 0 && (
                    <p className="text-[10px] text-neutral-400 mt-0.5 text-right">
                      {fmtNum(stage.session_count - (funnel[i + 1]?.session_count ?? 0))} dropped off
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Daily trend ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Daily sessions (last {DAYS} days)</h2>
        {daily.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">No data yet.</p>
        ) : (
          <div className="flex items-end gap-0.5 h-32">
            {daily.map((d) => {
              const heightPct = maxDailyCount > 0 ? (d.sessions / maxDailyCount) * 100 : 0;
              const dateLabel = new Date(d.day).toLocaleDateString("en-GB", {
                day: "numeric", month: "short",
              });
              return (
                <div
                  key={d.day}
                  className="group relative flex-1 flex flex-col justify-end"
                  title={`${dateLabel}: ${fmtNum(d.sessions)} sessions, ${fmtNum(d.cta_clicks)} CTA clicks, ${fmtNum(d.form_submits)} conversions`}
                >
                  <div
                    className="w-full rounded-t-sm bg-brand-500 group-hover:bg-brand-400 transition-colors"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                    <div className="bg-neutral-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                      {dateLabel}: {fmtNum(d.sessions)}
                    </div>
                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-neutral-800" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand-500" />
            Sessions
          </span>
        </div>
      </div>

      {/* ── Variant performance ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Variant performance</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Top variants by impressions · last {DAYS} days
          </p>
        </div>

        {variants.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">
            No variant data yet. Variant keys appear here once events include a{" "}
            <code className="font-mono text-xs bg-neutral-100 px-1 rounded">variant_key</code> field in their payload.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                <th className="px-5 py-3">Variant</th>
                <th className="px-5 py-3 text-right">Impressions</th>
                <th className="px-5 py-3 text-right">CTA clicks</th>
                <th className="px-5 py-3 text-right">Conversions</th>
                <th className="px-5 py-3 text-right">CTR</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v: VariantRow, i: number) => (
                <tr key={v.variant_key} className={`border-b border-neutral-50 ${i % 2 === 0 ? "" : "bg-neutral-50/40"}`}>
                  <td className="px-5 py-3 font-mono text-xs text-neutral-700">{v.variant_key}</td>
                  <td className="px-5 py-3 text-right font-medium text-neutral-900">{fmtNum(v.impressions)}</td>
                  <td className="px-5 py-3 text-right text-neutral-600">{fmtNum(v.cta_clicks)}</td>
                  <td className="px-5 py-3 text-right text-neutral-600">{fmtNum(v.form_submits)}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${
                    Number(v.ctr) >= 10 ? "text-emerald-600" : Number(v.ctr) >= 5 ? "text-amber-600" : "text-neutral-500"
                  }`}>
                    {Number(v.ctr).toFixed(1)}%
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
