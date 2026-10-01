"use client";

/**
 * UsageDashboardClient.tsx
 *
 * Client component for the per-tenant billing usage dashboard.
 *
 * ─── Features ────────────────────────────────────────────────────────────────
 *
 *   • Summary cards: balance, credits today/7d/month, estimated spend, billable calls
 *   • Breakdown table: per enrichment type with avg cost
 *     - Filters: type name search, billable-only, cache-only
 *   • Recent usage_events: expandable rows with full stage detail
 *   • Recent wallet_ledger: compact audit trail
 *
 * ─── PART 1 + PART 6 (filters) + PART 7 (UI) of the billing monitoring spec ──
 */

import { useState } from "react";
import type { UsageEventRow, LedgerRow, BreakdownEntry } from "../page";

// ── Formatting ─────────────────────────────────────────────────────────────────

function fmtCredits(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function fmtEur(v: number): string {
  return `€${v.toFixed(4)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day:    "2-digit",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ── Category badge ─────────────────────────────────────────────────────────────

function CatBadge({ cat }: { cat: string | null }) {
  const map: Record<string, string> = {
    recognition: "bg-blue-50 text-blue-700",
    adaptation:  "bg-purple-50 text-purple-700",
    brainpower:  "bg-emerald-50 text-emerald-700",
    topup:       "bg-green-50 text-green-700",
    refund:      "bg-yellow-50 text-yellow-700",
  };
  const cls = map[cat ?? ""] ?? "bg-neutral-100 text-neutral-500";
  if (!cat) return <span className="text-neutral-400">—</span>;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}>
      {cat}
    </span>
  );
}

// ── Result badge for usage events ─────────────────────────────────────────────

function EventBadge({ ev }: { ev: UsageEventRow }) {
  if (ev.cache_hit) return (
    <span className="rounded px-1.5 py-px text-[10px] font-bold font-mono bg-blue-100 text-blue-700">CACHED</span>
  );
  if (!ev.success || ev.error_code) return (
    <span className="rounded px-1.5 py-px text-[10px] font-bold font-mono bg-red-100 text-red-700">
      {ev.error_code ?? "FAILED"}
    </span>
  );
  const credits = ev.credits_used ?? ev.credits_cost ?? 0;
  if (credits > 0) return (
    <span className="rounded px-1.5 py-px text-[10px] font-bold font-mono bg-green-100 text-green-700">CHARGED</span>
  );
  return (
    <span className="rounded px-1.5 py-px text-[10px] font-bold font-mono bg-neutral-100 text-neutral-500">FREE</span>
  );
}

// ── Ledger entry type badge ────────────────────────────────────────────────────

function LedgerTypeBadge({ entry }: { entry: LedgerRow }) {
  // Prefer NUMERIC amount — amount_cents rounds sub-credit debits to 0.
  const effectiveAmount = entry.amount ?? entry.amount_cents ?? 0;
  const isDebit  = effectiveAmount < 0 || entry.entry_type.includes("debit");
  const isCredit = effectiveAmount > 0 || entry.entry_type.includes("credit") || entry.entry_type.includes("topup");
  const cls = isDebit  ? "bg-red-50 text-red-700" :
              isCredit ? "bg-green-50 text-green-700" :
              "bg-neutral-100 text-neutral-500";
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-bold font-mono ${cls}`}>
      {entry.entry_type}
    </span>
  );
}

// ── Expandable usage event row ─────────────────────────────────────────────────

function EventRow({ ev }: { ev: UsageEventRow }) {
  const [expanded, setExpanded] = useState(false);
  const credits = ev.credits_used ?? ev.credits_cost ?? 0;

  return (
    <>
      <tr
        className="border-b border-neutral-50 hover:bg-neutral-50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-3 py-2 text-neutral-400 text-[10px] font-mono w-4">
          {expanded ? "▼" : "▶"}
        </td>
        <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
          {fmtDate(ev.created_at)}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-neutral-800">{ev.event_type}</td>
        <td className="px-3 py-2"><CatBadge cat={ev.category} /></td>
        <td className="px-3 py-2 text-center"><EventBadge ev={ev} /></td>
        <td className="px-3 py-2 text-right font-mono text-xs">
          {credits > 0 ? (
            <span className="text-neutral-800">{fmtCredits(credits)}</span>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-right font-mono text-xs text-neutral-500">
          {ev.price > 0 ? fmtEur(ev.price) : "—"}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-neutral-50 border-b border-neutral-100">
          <td colSpan={7} className="px-6 py-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs font-mono">
              <div><span className="text-neutral-400">id</span>
                <span className="ml-2 text-neutral-700">{ev.id}</span>
              </div>
              <div><span className="text-neutral-400">session</span>
                <span className="ml-2 text-neutral-700">{ev.session_id ?? "—"}</span>
              </div>
              <div><span className="text-neutral-400">feature_key</span>
                <span className="ml-2 text-neutral-700">{ev.feature_key ?? "—"}</span>
              </div>
              <div><span className="text-neutral-400">billable</span>
                <span className={`ml-2 font-semibold ${ev.billable ? "text-green-700" : "text-neutral-500"}`}>
                  {ev.billable ? "yes" : "no"}
                </span>
              </div>
              <div><span className="text-neutral-400">cache_hit</span>
                <span className={`ml-2 font-semibold ${ev.cache_hit ? "text-blue-700" : "text-neutral-500"}`}>
                  {ev.cache_hit ? "yes" : "no"}
                </span>
              </div>
              <div><span className="text-neutral-400">success</span>
                <span className={`ml-2 font-semibold ${ev.success ? "text-green-700" : "text-red-600"}`}>
                  {ev.success ? "yes" : "no"}
                </span>
              </div>
              {ev.error_code && (
                <div className="col-span-2"><span className="text-red-400">error</span>
                  <span className="ml-2 text-red-600">{ev.error_code}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  tenantId:      string;
  walletBalance: number | null;
  creditsToday:  number;
  credits7d:     number;
  creditsMonth:  number;
  estimatedEur:  number;
  billableCount: number;
  breakdown:     BreakdownEntry[];
  events:        UsageEventRow[];
  ledgerRows:    LedgerRow[];
}

export function UsageDashboardClient({
  walletBalance,
  creditsToday,
  credits7d,
  creditsMonth,
  estimatedEur,
  billableCount,
  breakdown,
  events,
  ledgerRows,
}: Props) {

  // ── Breakdown filters ─────────────────────────────────────────────────────────
  const [typeFilter,      setTypeFilter]      = useState("");
  const [billableOnly,    setBillableOnly]    = useState(false);
  const [cacheOnly,       setCacheOnly]       = useState(false);

  // ── Event filters ─────────────────────────────────────────────────────────────
  const [evTypeFilter,    setEvTypeFilter]    = useState("");
  const [evBillableOnly,  setEvBillableOnly]  = useState(false);
  const [evCacheOnly,     setEvCacheOnly]     = useState(false);
  const [evFailedOnly,    setEvFailedOnly]    = useState(false);

  const filteredBreakdown = breakdown.filter((row) => {
    if (typeFilter   && !row.event_type.includes(typeFilter)) return false;
    if (billableOnly && row.billable_calls === 0)             return false;
    if (cacheOnly    && row.cache_hits    === 0)              return false;
    return true;
  });

  const filteredEvents = events.filter((ev) => {
    if (evTypeFilter   && !ev.event_type.includes(evTypeFilter)) return false;
    if (evBillableOnly && !ev.billable)                           return false;
    if (evCacheOnly    && !ev.cache_hit)                          return false;
    if (evFailedOnly   && ev.success && !ev.error_code)           return false;
    return true;
  });

  const checkboxCls = "accent-indigo-500";
  const labelCls    = "flex items-center gap-1.5 text-xs cursor-pointer select-none text-neutral-600";

  return (
    <div className="space-y-8">

      {/* ── Summary cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: "Wallet balance",
            value: walletBalance !== null ? fmtCredits(walletBalance) : "—",
            sub:   walletBalance !== null ? fmtEur(walletBalance / 100) : "not initialized",
          },
          {
            label: "Credits today",
            value: fmtCredits(creditsToday),
            sub:   fmtEur(creditsToday / 100),
          },
          {
            label: "Credits (7d)",
            value: fmtCredits(credits7d),
            sub:   fmtEur(credits7d / 100),
          },
          {
            label: "Credits (month)",
            value: fmtCredits(creditsMonth),
            sub:   fmtEur(creditsMonth / 100),
          },
          {
            label: "Est. spend (month)",
            value: fmtEur(estimatedEur),
            sub:   "from usage_events.price",
          },
          {
            label: "Billable calls",
            value: billableCount.toLocaleString(),
            sub:   "non-cached, billable",
          },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>
            <p className="mt-0.5 text-xl font-semibold text-neutral-900 font-mono">{value}</p>
            <p className="mt-0.5 text-[10px] text-neutral-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Breakdown table ────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <h3 className="text-sm font-semibold text-neutral-700">
            Usage by enrichment type
            <span className="ml-2 text-xs font-normal text-neutral-400">(this calendar month)</span>
          </h3>
          <div className="flex flex-wrap gap-4 ml-auto">
            <input
              type="text"
              placeholder="Filter by type…"
              className="rounded border border-neutral-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
            <label className={labelCls}>
              <input type="checkbox" className={checkboxCls} checked={billableOnly}
                onChange={(e) => setBillableOnly(e.target.checked)} />
              Billable only
            </label>
            <label className={labelCls}>
              <input type="checkbox" className={checkboxCls} checked={cacheOnly}
                onChange={(e) => setCacheOnly(e.target.checked)} />
              Cache hits only
            </label>
          </div>
        </div>

        {filteredBreakdown.length === 0 ? (
          <p className="text-sm text-neutral-400">No usage data for this period.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-[10px] text-neutral-400 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left font-medium">Enrichment type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Category</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total calls</th>
                  <th className="px-4 py-2.5 text-right font-medium">Billable</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cache hits</th>
                  <th className="px-4 py-2.5 text-right font-medium">Credits used</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg / call</th>
                </tr>
              </thead>
              <tbody>
                {filteredBreakdown.map((row) => (
                  <tr key={row.event_type} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-2.5 font-mono text-neutral-800">{row.event_type}</td>
                    <td className="px-4 py-2.5"><CatBadge cat={row.category} /></td>
                    <td className="px-4 py-2.5 text-right text-neutral-700">{row.total_calls}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-700">{row.billable_calls}</td>
                    <td className="px-4 py-2.5 text-right text-blue-600">
                      {row.cache_hits > 0
                        ? `${row.cache_hits} (${Math.round((row.cache_hits / row.total_calls) * 100)}%)`
                        : <span className="text-neutral-400">0</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-800">
                      {fmtCredits(row.credits_used)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {fmtEur(row.total_price)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {row.avg_cost > 0 ? fmtCredits(row.avg_cost) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent activity ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Usage events */}
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-neutral-700">
              Recent usage events
              <span className="ml-2 text-xs font-normal text-neutral-400">(last 100)</span>
            </h3>
            <div className="ml-auto flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Filter type…"
                className="rounded border border-neutral-200 px-2 py-1 text-[10px] w-28 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={evTypeFilter}
                onChange={(e) => setEvTypeFilter(e.target.value)}
              />
              {[
                { label: "Billable", active: evBillableOnly, set: setEvBillableOnly },
                { label: "Cache",    active: evCacheOnly,    set: setEvCacheOnly    },
                { label: "Failed",   active: evFailedOnly,   set: setEvFailedOnly   },
              ].map(({ label, active, set }) => (
                <label key={label} className={labelCls}>
                  <input type="checkbox" className={checkboxCls}
                    checked={active} onChange={(e) => set(e.target.checked)} />
                  <span className={active ? "text-indigo-700 font-semibold" : ""}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {filteredEvents.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">No events match the active filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 text-[10px] text-neutral-400 uppercase tracking-wide">
                      <th className="px-3 py-2 w-4"></th>
                      <th className="px-3 py-2 text-left font-medium">Time</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Cat</th>
                      <th className="px-3 py-2 text-center font-medium">Result</th>
                      <th className="px-3 py-2 text-right font-medium">Credits</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((ev) => (
                      <EventRow key={ev.id} ev={ev} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Wallet ledger */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">
            Recent wallet ledger
            <span className="ml-2 text-xs font-normal text-neutral-400">(last 100)</span>
          </h3>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {ledgerRows.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">No ledger entries recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 text-[10px] text-neutral-400 uppercase tracking-wide">
                      <th className="px-3 py-2 text-left font-medium">Time</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Cat</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 text-right font-medium">Balance after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((entry) => {
                      // Prefer NUMERIC amount/balance_after (migration 076) —
                      // amount_cents rounds sub-credit debits (< 0.5 credits) to 0.
                      const displayAmount  = entry.amount  ?? entry.amount_cents  ?? 0;
                      const displayBalance = entry.balance_after ?? entry.balance_after_cents ?? 0;
                      const isDebit  = displayAmount < 0 || entry.entry_type.includes("debit");
                      const isCredit = displayAmount > 0 || entry.entry_type.includes("credit") || entry.entry_type.includes("topup");
                      return (
                        <tr key={entry.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                          <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">{fmtDate(entry.created_at)}</td>
                          <td className="px-3 py-2"><LedgerTypeBadge entry={entry} /></td>
                          <td className="px-3 py-2"><CatBadge cat={entry.category} /></td>
                          <td className={`px-3 py-2 text-right font-mono ${
                            isDebit  ? "text-red-600" :
                            isCredit ? "text-green-600" :
                            "text-neutral-600"
                          }`}>
                            {isDebit ? "−" : isCredit ? "+" : ""}
                            {fmtCredits(Math.abs(displayAmount))}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-neutral-700">
                            {fmtCredits(displayBalance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Links ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-4 text-xs text-neutral-500">
        <a href="../debug" className="text-blue-600 hover:underline">
          → Per-request debug panel
        </a>
        <span className="text-neutral-300">|</span>
        <a href="." className="text-blue-600 hover:underline">
          ← Back to Usage
        </a>
      </div>
    </div>
  );
}
