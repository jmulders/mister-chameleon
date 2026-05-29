"use client";

/**
 * app/admin/tenants/[tenantId]/billing/debug/_components/AdminBillingDebugClient.tsx
 *
 * Client component for the admin billing debug page.
 *
 * ─── What this shows ─────────────────────────────────────────────────────────
 *
 *   A filterable list of recent enrichment requests for a tenant, built from
 *   enrichment_usage DB rows (actual outcomes — not predictive intent).
 *
 *   Each "request" = one page load grouped by session_id.
 *   Expanding a request shows per-stage billing detail.
 *
 * ─── Features ────────────────────────────────────────────────────────────────
 *
 *   • Filter: only charged / only cached / only failed / only simulated
 *   • Filter: only requests with anomalies
 *   • Expand / collapse per-request stage table
 *   • Clear visual status badges: charged / cached / skipped / failed / simulated / free
 *   • Wallet before/after when available (from metadata)
 *   • Anomaly banner per request
 */

import { useState } from "react";
import type {
  BillingRequestDebug,
  BillingStageDebugEntry,
  BillingStageResult,
} from "@/billing/request-debug";

// ── Result badge ──────────────────────────────────────────────────────────────

const RESULT_CFG: Record<BillingStageResult, { label: string; bg: string; text: string }> = {
  charged:   { label: "CHARGED",   bg: "#dcfce7", text: "#15803d" },
  cached:    { label: "CACHED",    bg: "#dbeafe", text: "#1d4ed8" },
  skipped:   { label: "SKIPPED",   bg: "#f3f4f6", text: "#6b7280" },
  failed:    { label: "FAILED",    bg: "#fee2e2", text: "#b91c1c" },
  simulated: { label: "SIMULATED", bg: "#fef9c3", text: "#a16207" },
  free:      { label: "FREE",      bg: "#f0fdf4", text: "#86efac" },
};

function ResultBadge({ result }: { result: BillingStageResult }) {
  const cfg = RESULT_CFG[result];
  return (
    <span className="inline-block rounded px-1.5 py-px text-[10px] font-bold font-mono tracking-wide"
      style={{ background: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

// ── Mode chip ─────────────────────────────────────────────────────────────────

function ModeChip({ mode }: { mode: BillingRequestDebug["billingMode"] }) {
  const map = {
    live:      { cls: "bg-emerald-100 text-emerald-800", label: "LIVE" },
    simulated: { cls: "bg-yellow-100 text-yellow-800",   label: "SIM" },
    disabled:  { cls: "bg-red-100 text-red-700",         label: "OFF" },
  }[mode];
  return (
    <span className={`inline-block rounded px-1.5 py-px text-[10px] font-bold font-mono ${map.cls}`}>
      {map.label}
    </span>
  );
}

// ── Category badge ────────────────────────────────────────────────────────────

function CatBadge({ cat }: { cat: string | null }) {
  if (!cat) return <span className="text-neutral-400 text-[10px]">—</span>;
  const map: Record<string, string> = {
    recognition: "bg-blue-50 text-blue-700",
    adaptation:  "bg-purple-50 text-purple-700",
    brainpower:  "bg-emerald-50 text-emerald-700",
  };
  const cls = map[cat] ?? "bg-neutral-100 text-neutral-500";
  return (
    <span className={`rounded-full px-1.5 py-px text-[10px] font-medium capitalize ${cls}`}>
      {cat}
    </span>
  );
}

// ── Anomaly badge ─────────────────────────────────────────────────────────────

const ANOMALY_DESCRIPTIONS: Record<string, string> = {
  "billing disabled":              "Billing is DISABLED — no DB writes or wallet debits.",
  "demo mode":                     "Demo / simulated mode — wallet balance unchanged.",
  "debit_wallet RPC unavailable":  "debit_wallet RPC missing — run supabase db push.",
  "insufficient balance":          "Wallet was insufficient — debit rejected.",
  "0 credits were charged":        "Billable stages ran but 0 credits charged — check debit_wallet RPC.",
  "stage error":                   "Stage returned an error — not charged.",
  "no_match":                      "Stage ran but returned no data — not charged.",
};

function getAnomalyTip(anomaly: string): string {
  for (const [key, tip] of Object.entries(ANOMALY_DESCRIPTIONS)) {
    if (anomaly.toLowerCase().includes(key.toLowerCase())) return tip;
  }
  return anomaly;
}

// ── Stage table (inside expanded request) ──────────────────────────────────────

function StageTable({ stages }: { stages: BillingStageDebugEntry[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded border border-neutral-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-neutral-50 text-neutral-500 uppercase tracking-wide text-[10px]">
            <th className="px-3 py-2 text-left font-semibold">Stage</th>
            <th className="px-3 py-2 text-left font-semibold">Type</th>
            <th className="px-3 py-2 text-left font-semibold">Cat</th>
            <th className="px-3 py-2 text-center font-semibold">Billable</th>
            <th className="px-3 py-2 text-center font-semibold">Cache</th>
            <th className="px-3 py-2 text-center font-semibold">Result</th>
            <th className="px-3 py-2 text-right font-semibold">Unit€</th>
            <th className="px-3 py-2 text-right font-semibold">Credits</th>
            <th className="px-3 py-2 text-right font-semibold">Charged</th>
            <th className="px-3 py-2 text-right font-semibold">Before</th>
            <th className="px-3 py-2 text-right font-semibold">After</th>
            <th className="px-3 py-2 text-center font-semibold">Event</th>
            <th className="px-3 py-2 text-center font-semibold">Ledger</th>
            <th className="px-3 py-2 text-right font-semibold">ms</th>
            <th className="px-3 py-2 text-left font-semibold">Error</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s, i) => (
            <tr key={i}
              className={`border-t border-neutral-100 ${
                s.result === "skipped" || s.result === "free" ? "opacity-40" : ""
              }`}
            >
              <td className="px-3 py-2 font-mono text-neutral-800">{s.stageLabel}</td>
              <td className="px-3 py-2 font-mono text-neutral-500 text-[10px]">{s.enrichmentType ?? "—"}</td>
              <td className="px-3 py-2"><CatBadge cat={(s as BillingStageDebugEntry & { category?: string }).category ?? null} /></td>
              <td className="px-3 py-2 text-center font-mono text-[10px]">
                <span className={s.billable ? "text-green-600 font-semibold" : "text-neutral-400"}>
                  {s.billable ? "yes" : "no"}
                </span>
              </td>
              <td className="px-3 py-2 text-center font-mono text-[10px]">
                <span className={s.cacheHit ? "text-blue-600 font-semibold" : "text-neutral-400"}>
                  {s.cacheHit ? "●" : "○"}
                </span>
              </td>
              <td className="px-3 py-2 text-center"><ResultBadge result={s.result} /></td>
              <td className="px-3 py-2 text-right font-mono text-neutral-500 text-[10px]">
                {s.unitPriceEur > 0 ? `€${s.unitPriceEur.toFixed(4)}` : "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-neutral-600 text-[10px]">
                {s.creditCost > 0 ? s.creditCost.toFixed(3) : "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-neutral-700">
                {s.centsCharged > 0 ? `€${(s.centsCharged / 100).toFixed(4)}` : "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-neutral-400 text-[10px]">
                {s.balanceBeforeCents !== undefined ? `€${(s.balanceBeforeCents / 100).toFixed(2)}` : "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-neutral-400 text-[10px]">
                {s.balanceAfterCents !== undefined ? `€${(s.balanceAfterCents / 100).toFixed(2)}` : "—"}
              </td>
              <td className="px-3 py-2 text-center font-mono text-[10px]">
                <span className={s.usageEventCreated ? "text-green-600" : "text-neutral-300"}>
                  {s.usageEventCreated ? "✓" : "—"}
                </span>
              </td>
              <td className="px-3 py-2 text-center font-mono text-[10px]">
                <span className={s.ledgerEntryCreated ? "text-green-600" : "text-neutral-300"}>
                  {s.ledgerEntryCreated ? "✓" : "—"}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-neutral-400 text-[10px]">
                {s.durationMs > 0 ? `${s.durationMs}` : "—"}
              </td>
              <td className="px-3 py-2 font-mono text-red-500 text-[10px]">
                {s.error ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Single request card ────────────────────────────────────────────────────────

function RequestCard({ debug }: { debug: BillingRequestDebug }) {
  const [expanded, setExpanded] = useState(false);

  const charged   = debug.stages.filter((s) => s.result === "charged").length;
  const cached    = debug.stages.filter((s) => s.result === "cached").length;
  const failed    = debug.stages.filter((s) => s.result === "failed").length;
  const simulated = debug.stages.filter((s) => s.result === "simulated").length;

  const ts = new Date(debug.timestamp).toLocaleString("nl-NL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
      >
        <span className="text-neutral-400 text-xs font-mono w-4">{expanded ? "▼" : "▶"}</span>

        {/* Timestamp */}
        <span className="text-xs text-neutral-500 font-mono whitespace-nowrap">{ts}</span>

        {/* Mode */}
        <ModeChip mode={debug.billingMode} />

        {/* Cost */}
        {debug.totalChargedCents > 0 ? (
          <span className="text-xs font-mono font-semibold text-emerald-700">
            −€{(debug.totalChargedCents / 100).toFixed(4)}
          </span>
        ) : (
          <span className="text-xs font-mono text-neutral-400">€0</span>
        )}

        {/* Stage summary pills */}
        <div className="flex gap-1.5 ml-1">
          {charged   > 0 && <span className="rounded px-1.5 py-px bg-emerald-100 text-emerald-700 text-[10px] font-mono">{charged}↓</span>}
          {cached    > 0 && <span className="rounded px-1.5 py-px bg-blue-100 text-blue-700 text-[10px] font-mono">{cached}⚡</span>}
          {failed    > 0 && <span className="rounded px-1.5 py-px bg-red-100 text-red-700 text-[10px] font-mono">{failed}✗</span>}
          {simulated > 0 && <span className="rounded px-1.5 py-px bg-yellow-100 text-yellow-700 text-[10px] font-mono">{simulated}~</span>}
        </div>

        {/* Anomaly indicator */}
        {debug.anomalies.length > 0 && (
          <span className="text-yellow-600 text-[10px]">⚠ {debug.anomalies.length}</span>
        )}

        {/* Request ID */}
        <span className="ml-auto text-[10px] text-neutral-400 font-mono truncate max-w-[240px]">
          {debug.requestId}
        </span>
      </button>

      {/* ── Expanded detail ─────────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-neutral-100">

          {/* Wallet before/after */}
          {debug.walletBeforeCents !== null && (
            <div className="mt-3 flex gap-4 p-2 bg-emerald-50 rounded border border-emerald-200 text-xs font-mono">
              <span>Before: €{(debug.walletBeforeCents / 100).toFixed(4)}</span>
              <span className="text-neutral-400">→</span>
              <span>After: €{((debug.walletAfterCents ?? debug.walletBeforeCents) / 100).toFixed(4)}</span>
              <span className="text-emerald-700 font-semibold">
                −€{(debug.totalChargedCents / 100).toFixed(4)}
              </span>
            </div>
          )}

          {/* Anomalies */}
          {debug.anomalies.map((a, i) => (
            <div key={i} className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 font-mono">
              ⚠ {a}
            </div>
          ))}

          {/* Stage table */}
          <StageTable stages={debug.stages} />
        </div>
      )}
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function AdminBillingDebugClient({ requests }: { requests: BillingRequestDebug[] }) {
  const [filterCharged,   setFilterCharged]   = useState(false);
  const [filterFailed,    setFilterFailed]    = useState(false);
  const [filterCached,    setFilterCached]    = useState(false);
  const [filterSimulated, setFilterSimulated] = useState(false);
  const [filterAnomalies, setFilterAnomalies] = useState(false);

  const filtered = requests.filter((r) => {
    if (filterCharged   && r.totalChargedCents === 0)  return false;
    if (filterFailed    && !r.stages.some((s) => s.result === "failed")) return false;
    if (filterCached    && !r.stages.some((s) => s.result === "cached")) return false;
    if (filterSimulated && r.billingMode !== "simulated") return false;
    if (filterAnomalies && r.anomalies.length === 0)   return false;
    return true;
  });

  const totalCharged    = requests.reduce((sum, r) => sum + r.totalChargedCents, 0);
  const totalRequests   = requests.length;
  const withCharges     = requests.filter((r) => r.totalChargedCents > 0).length;
  const withAnomalies   = requests.filter((r) => r.anomalies.length > 0).length;

  const labelCls = "flex items-center gap-1.5 text-xs cursor-pointer select-none";
  const cbCls    = "accent-indigo-500";

  return (
    <div className="space-y-4">

      {/* ── Summary bar ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Requests",      value: totalRequests, color: "text-neutral-700" },
          { label: "With charges",  value: withCharges,   color: "text-emerald-700" },
          { label: "With anomalies", value: withAnomalies, color: "text-yellow-700" },
          { label: "Total charged", value: `€${(totalCharged / 100).toFixed(4)}`, color: "text-emerald-700" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
            <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter toggles ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-xs font-semibold text-neutral-600 self-center">Filters:</span>
        {[
          { label: "Only charged",   active: filterCharged,   set: setFilterCharged   },
          { label: "Only failures",  active: filterFailed,    set: setFilterFailed    },
          { label: "Only cache hits",active: filterCached,    set: setFilterCached    },
          { label: "Only simulated", active: filterSimulated, set: setFilterSimulated },
          { label: "With anomalies", active: filterAnomalies, set: setFilterAnomalies },
        ].map(({ label, active, set }) => (
          <label key={label} className={labelCls}>
            <input type="checkbox" className={cbCls} checked={active}
              onChange={(e) => set(e.target.checked)} />
            <span className={active ? "text-indigo-700 font-semibold" : "text-neutral-600"}>{label}</span>
          </label>
        ))}
      </div>

      {/* ── Request count ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-neutral-500">
        Showing {filtered.length} of {requests.length} request{requests.length !== 1 ? "s" : ""}.
      </p>

      {/* ── Request cards ─────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          No requests match the active filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <RequestCard key={r.requestId} debug={r} />
          ))}
        </div>
      )}
    </div>
  );
}
