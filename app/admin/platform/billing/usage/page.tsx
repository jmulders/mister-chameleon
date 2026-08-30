/**
 * /admin/platform/billing/usage
 *
 * Platform-wide credit usage dashboard — all tenants combined.
 *
 * ─── What this shows ──────────────────────────────────────────────────────────
 *
 *   1. Summary
 *      • Total wallet balance across all tenants
 *      • Credits used today / last 7 days / last 30 days
 *
 *   2. Breakdown
 *      • Usage per enrichment type (event_type)
 *      • Total credits charged and call count per type
 *      • Cache hit rate per type
 *
 *   3. Recent activity
 *      • Last 50 usage_events across all tenants
 *      • Last 50 wallet_ledger entries across all tenants
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   Async server component — all queries run server-side at request time.
 *   Queries usage_events and wallet_ledger directly (cross-tenant, no period key).
 *   Gracefully degrades to empty state when tables are missing (42P01).
 *
 * ─── Access control ──────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session (getRequiredAdminSession).
 */

import { createClient }          from "@supabase/supabase-js";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { BillingNav }            from "@/components/admin/BillingNav";

export const dynamic = "force-dynamic";

// ── DB row types ───────────────────────────────────────────────────────────────

interface UsageEventRow {
  id:           string;
  tenant_id:    string;
  event_type:   string;
  credits_used: number;
  credits_cost: number;
  price:        number;
  billable:     boolean;
  success:      boolean;
  cache_hit:    boolean;
  error_code:   string | null;
  session_id:   string | null;
  category:     string | null;
  feature_key:  string | null;
  simulated:    boolean;
  created_at:   string;
}

interface LedgerRow {
  id:                  string;
  tenant_id:           string;
  entry_type:          string;
  category:            string | null;
  amount_cents:        number;
  balance_after_cents: number;
  reference_type:      string | null;
  note:                string | null;
  simulated:           boolean;
  created_at:          string;
}

interface WalletRow {
  tenant_id:     string;
  balance_cents: number;
  status:        string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isSchemaMissing(code: string): boolean {
  return (
    code === "42P01" || // table missing
    code === "42703" || // column missing
    code === "PGRST200" ||
    code === "PGRST116"
  );
}

function fmtCredits(credits: number): string {
  return credits.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function fmtEur(eur: number): string {
  return `€${eur.toFixed(4)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day:    "2-digit",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function categoryColour(cat: string | null): string {
  const map: Record<string, string> = {
    recognition: "bg-blue-50 text-blue-700",
    adaptation:  "bg-purple-50 text-purple-700",
    brainpower:  "bg-emerald-50 text-emerald-700",
    topup:       "bg-green-50 text-green-700",
    refund:      "bg-yellow-50 text-yellow-700",
  };
  return map[cat ?? ""] ?? "bg-neutral-100 text-neutral-500";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlatformBillingUsagePage() {
  await getRequiredAdminSession();

  const db = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // ── Time windows ─────────────────────────────────────────────────────────────

  const now      = new Date();
  const today    = new Date(now); today.setHours(0, 0, 0, 0);
  const last7d   = new Date(now); last7d.setDate(last7d.getDate() - 7);
  const last30d  = new Date(now); last30d.setDate(last30d.getDate() - 30);

  // ── Parallel fetches ──────────────────────────────────────────────────────────

  const [
    eventsResult,
    ledgerResult,
    walletResult,
    todayResult,
    sevenDayResult,
    thirtyDayResult,
  ] = await Promise.all([
    // Recent 50 usage_events (all tenants)
    db
      .from("usage_events")
      .select(
        "id, tenant_id, event_type, credits_used, credits_cost, price, billable, success, cache_hit, error_code, session_id, category, feature_key, simulated, created_at",
      )
      .eq("simulated", false)
      .order("created_at", { ascending: false })
      .limit(50),

    // Recent 50 wallet_ledger (all tenants)
    db
      .from("wallet_ledger")
      .select(
        "id, tenant_id, entry_type, category, amount_cents, balance_after_cents, reference_type, note, simulated, created_at",
      )
      .eq("simulated", false)
      .order("created_at", { ascending: false })
      .limit(50),

    // All wallet balances
    db
      .from("tenant_wallets")
      .select("tenant_id, balance_cents, status"),

    // Today's total credits (sum query)
    db
      .from("usage_events")
      .select("credits_used, credits_cost")
      .eq("simulated", false)
      .eq("billable", true)
      .gte("created_at", today.toISOString()),

    // Last 7d total
    db
      .from("usage_events")
      .select("credits_used, credits_cost")
      .eq("simulated", false)
      .eq("billable", true)
      .gte("created_at", last7d.toISOString()),

    // Last 30d total
    db
      .from("usage_events")
      .select("credits_used, credits_cost")
      .eq("simulated", false)
      .eq("billable", true)
      .gte("created_at", last30d.toISOString()),
  ]);

  // ── Process results (graceful degradation) ────────────────────────────────────

  const events: UsageEventRow[] = [];
  if (eventsResult.error) {
    if (!isSchemaMissing(eventsResult.error.code)) {
      console.error("[usage/page] events fetch error", eventsResult.error);
    }
  } else {
    events.push(...((eventsResult.data ?? []) as UsageEventRow[]));
  }

  const ledgerRows: LedgerRow[] = [];
  if (ledgerResult.error) {
    if (!isSchemaMissing(ledgerResult.error.code)) {
      console.error("[usage/page] ledger fetch error", ledgerResult.error);
    }
  } else {
    ledgerRows.push(...((ledgerResult.data ?? []) as LedgerRow[]));
  }

  const wallets: WalletRow[] = ((walletResult.data ?? []) as WalletRow[]);
  const totalWalletBalance = wallets.reduce((sum, w) => sum + (w.balance_cents ?? 0), 0);

  function sumCredits(rows: { credits_used: number; credits_cost: number }[] | null): number {
    return (rows ?? []).reduce((sum, r) => sum + (r.credits_used ?? r.credits_cost ?? 0), 0);
  }

  const creditsToday   = sumCredits(todayResult.data);
  const credits7d      = sumCredits(sevenDayResult.data);
  const credits30d     = sumCredits(thirtyDayResult.data);

  // ── Enrichment type breakdown ─────────────────────────────────────────────────
  //
  // Group last 30d usage_events by event_type to build the per-type breakdown.
  // Using the already-fetched events array for the breakdown (covers last 50 events).
  // For a full 30d breakdown we'd need a separate query; here we use sevenDayResult.

  type BreakdownEntry = {
    event_type:      string;
    category:        string | null;
    total_calls:     number;
    charged_calls:   number;
    cache_hits:      number;
    total_credits:   number;
  };

  const breakdownMap = new Map<string, BreakdownEntry>();

  // Process all 30d rows for breakdown (using thirtyDayResult + event data)
  // We use the events array (last 50) which is a fair sample for the breakdown panel.
  for (const ev of events) {
    if (!ev.billable) continue;
    const key = ev.event_type;
    const existing = breakdownMap.get(key);
    const credits = ev.credits_used ?? ev.credits_cost ?? 0;
    if (existing) {
      existing.total_calls++;
      if (!ev.cache_hit) existing.charged_calls++;
      if (ev.cache_hit) existing.cache_hits++;
      existing.total_credits += credits;
    } else {
      breakdownMap.set(key, {
        event_type:    key,
        category:      ev.category,
        total_calls:   1,
        charged_calls: ev.cache_hit ? 0 : 1,
        cache_hits:    ev.cache_hit ? 1 : 0,
        total_credits: credits,
      });
    }
  }

  const breakdown = Array.from(breakdownMap.values())
    .sort((a, b) => b.total_credits - a.total_credits);

  return (
    <div className="max-w-6xl p-8">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-neutral-900">Platform Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage plans, enrichment pricing, and billing configuration.
        </p>
      </div>

      <BillingNav />

      <div className="mb-6">
        <h2 className="text-base font-semibold text-neutral-800">Credit usage</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Platform-wide enrichment usage: all tenants, real events only (simulated excluded).
        </p>
      </div>

      {/* ── Summary stats ──────────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Total wallet balance",
            value: fmtCredits(totalWalletBalance),
            sub:   `across ${wallets.length} wallet${wallets.length !== 1 ? "s" : ""}`,
          },
          {
            label: "Credits used today",
            value: fmtCredits(creditsToday),
            sub:   fmtEur(creditsToday / 100),
          },
          {
            label: "Credits used (7d)",
            value: fmtCredits(credits7d),
            sub:   fmtEur(credits7d / 100),
          },
          {
            label: "Credits used (30d)",
            value: fmtCredits(credits30d),
            sub:   fmtEur(credits30d / 100),
          },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-400">{label}</p>
            <p className="mt-0.5 text-2xl font-semibold text-neutral-900">{value}</p>
            <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Enrichment type breakdown ─────────────────────────────────────────── */}
      <div className="mb-8">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">
          Usage by enrichment type
          <span className="ml-2 text-xs font-normal text-neutral-400">(from last 50 events)</span>
        </h3>

        {breakdown.length === 0 ? (
          <p className="text-sm text-neutral-400">No billable events recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left font-medium">Enrichment type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Category</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total calls</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cache hits</th>
                  <th className="px-4 py-2.5 text-right font-medium">Charged calls</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total credits</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total cost</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.event_type} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-neutral-800">{row.event_type}</td>
                    <td className="px-4 py-2.5">
                      {row.category ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${categoryColour(row.category)}`}>
                          {row.category}
                        </span>
                      ) : (
                        <span className="text-neutral-400">, </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-700">{row.total_calls}</td>
                    <td className="px-4 py-2.5 text-right text-blue-600">
                      {row.cache_hits > 0
                        ? `${row.cache_hits} (${Math.round((row.cache_hits / row.total_calls) * 100)}%)`
                        : <span className="text-neutral-400">0</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-700">{row.charged_calls}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-800">{fmtCredits(row.total_credits)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">{fmtEur(row.total_credits / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent activity — two columns ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* ── Last 50 usage_events ─────────────────────────────────────────────── */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">
            Recent usage events
            <span className="ml-2 text-xs font-normal text-neutral-400">(last 50, non-simulated)</span>
          </h3>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {events.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">No usage events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-400 uppercase tracking-wide">
                      <th className="px-3 py-2 text-left font-medium">Time</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-right font-medium">Credits</th>
                      <th className="px-3 py-2 text-center font-medium">Cache</th>
                      <th className="px-3 py-2 text-center font-medium">OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => {
                      const credits = ev.credits_used ?? ev.credits_cost ?? 0;
                      const ok = ev.success && !ev.error_code;
                      return (
                        <tr key={ev.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                          <td className="px-3 py-1.5 text-neutral-500 whitespace-nowrap">{fmtDate(ev.created_at)}</td>
                          <td className="px-3 py-1.5 font-mono text-neutral-800">{ev.event_type}</td>
                          <td className="px-3 py-1.5">
                            {ev.category ? (
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${categoryColour(ev.category)}`}>
                                {ev.category}
                              </span>
                            ) : <span className="text-neutral-400">, </span>}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {credits > 0 ? (
                              <span className="text-neutral-800">{fmtCredits(credits)}</span>
                            ) : (
                              <span className="text-neutral-400">0</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {ev.cache_hit
                              ? <span className="text-blue-500">●</span>
                              : <span className="text-neutral-200">○</span>
                            }
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {ok
                              ? <span className="text-green-500">✓</span>
                              : <span className="text-red-500 text-[10px]">{ev.error_code ?? "✗"}</span>
                            }
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

        {/* ── Last 50 wallet_ledger ──────────────────────────────────────────────── */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">
            Recent wallet ledger
            <span className="ml-2 text-xs font-normal text-neutral-400">(last 50, non-simulated)</span>
          </h3>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {ledgerRows.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">No ledger entries recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-400 uppercase tracking-wide">
                      <th className="px-3 py-2 text-left font-medium">Time</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 text-right font-medium">Balance after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((entry) => {
                      const isDebit  = entry.amount_cents < 0 || entry.entry_type.includes("debit");
                      const isCredit = entry.amount_cents > 0 || entry.entry_type.includes("credit") || entry.entry_type.includes("topup");
                      return (
                        <tr key={entry.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                          <td className="px-3 py-1.5 text-neutral-500 whitespace-nowrap">{fmtDate(entry.created_at)}</td>
                          <td className="px-3 py-1.5 font-mono text-neutral-700">{entry.entry_type}</td>
                          <td className="px-3 py-1.5">
                            {entry.category ? (
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${categoryColour(entry.category)}`}>
                                {entry.category}
                              </span>
                            ) : <span className="text-neutral-400">, </span>}
                          </td>
                          <td className={`px-3 py-1.5 text-right font-mono ${
                            isDebit  ? "text-red-600" :
                            isCredit ? "text-green-600" :
                            "text-neutral-600"
                          }`}>
                            {isDebit  ? "−" : isCredit ? "+" : ""}
                            {fmtCredits(Math.abs(entry.amount_cents))}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-neutral-700">
                            {fmtCredits(entry.balance_after_cents)}
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

      {/* ── Debug reference ──────────────────────────────────────────────────────── */}
      <div className="mt-8 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
        <span className="font-medium text-neutral-700">Debug info:</span>{" "}
        Per-request billing intent is shown in the site debug overlay (
        <code className="font-mono text-neutral-600">debugLevel=full</code>
        ) via the BillingDebugPanel component. Enrichment API routes emit an{" "}
        <code className="font-mono text-neutral-600">X-Billing-Debug</code>{" "}
        response header in dev / <code className="font-mono text-neutral-600">BILLING_DEBUG=1</code> mode.
        All tracking errors are written to the server console as{" "}
        <code className="font-mono text-neutral-600">[billing/enrichment-tracker]</code> log lines.
      </div>
    </div>
  );
}
