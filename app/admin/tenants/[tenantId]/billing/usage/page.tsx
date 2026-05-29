/**
 * /admin/tenants/[tenantId]/billing/usage
 *
 * Per-tenant credit usage dashboard.
 *
 * ─── What this shows ──────────────────────────────────────────────────────────
 *
 *   PART 1 of the billing monitoring spec.
 *
 *   Summary cards:
 *     • Current wallet balance
 *     • Credits used today
 *     • Credits used last 7 days
 *     • Credits used this month
 *     • Estimated spend this month (EUR)
 *     • Number of billable enrichment calls (this month)
 *
 *   Breakdown table (per enrichment type):
 *     • enrichment type, category, total calls, billable calls, cache hits,
 *       credits used, total price, avg cost per call
 *     • Filters: enrichment type, billable-only, cache-hits-only
 *
 *   Recent activity:
 *     • Last 50 usage_events (with expandable detail rows)
 *     • Last 50 wallet_ledger entries
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   Async server component — all queries run server-side.
 *   Gracefully degrades when tables are missing.
 *
 * ─── Access ───────────────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session.
 */

import { createClient }          from "@supabase/supabase-js";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { getTenantById }         from "@/tenant/server";
import { notFound }              from "next/navigation";
import { getWallet }             from "@/billing/wallet";
import { UsageDashboardClient }  from "./_components/UsageDashboardClient";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UsageEventRow {
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

export interface LedgerRow {
  id:                  string;
  tenant_id:           string;
  entry_type:          string;
  category:            string | null;
  /**
   * Exact decimal credits for this entry (NUMERIC, migration 076).
   * Negative for debits, positive for credits.
   * Prefer this over amount_cents — amount_cents rounds sub-credit amounts to 0
   * (e.g. credit_cost=0.01 → amount=-0.0100, amount_cents=0).
   * NULL for entries written before migration 076.
   */
  amount?:             number;
  /** Legacy integer alias. 0 for sub-credit debits (e.g. credit_cost < 0.5). */
  amount_cents:        number;
  /** Exact decimal balance after this entry (NUMERIC, migration 076). NULL for pre-076 rows. */
  balance_after?:      number;
  balance_after_cents: number;
  reference_type:      string | null;
  note:                string | null;
  simulated:           boolean;
  created_at:          string;
}

export interface BreakdownEntry {
  event_type:     string;
  category:       string | null;
  total_calls:    number;
  billable_calls: number;
  cache_hits:     number;
  credits_used:   number;
  total_price:    number;
  avg_cost:       number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isSchemaMissing(code: string): boolean {
  return code === "42P01" || code === "42703" || code === "PGRST200" || code === "PGRST116";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantBillingUsagePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await getRequiredAdminSession();

  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const db = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // ── Time windows ─────────────────────────────────────────────────────────────

  const now     = new Date();
  const today   = new Date(now); today.setHours(0, 0, 0, 0);
  const last7d  = new Date(now); last7d.setDate(last7d.getDate() - 7);
  const last30d = new Date(now); last30d.setDate(last30d.getDate() - 30);

  // First day of this calendar month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── Parallel fetches ──────────────────────────────────────────────────────────

  const [
    walletResult,
    eventsResult,
    ledgerResult,
    ledgerTodayResult,
    ledger7dResult,
    ledgerMonthResult,
    monthResult,
  ] = await Promise.all([
    // Wallet balance (prefer NUMERIC balance column — balance_cents rounds sub-credit debits to 0)
    getWallet(db, tenantId).catch(() => null),

    // Last 100 usage_events (non-simulated)
    db
      .from("usage_events")
      .select(
        "id, tenant_id, event_type, credits_used, credits_cost, price, billable, success, cache_hit, error_code, session_id, category, feature_key, simulated, created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("simulated", false)
      .order("created_at", { ascending: false })
      .limit(100),

    // Last 100 wallet_ledger entries — select NUMERIC amount/balance_after (migration 076)
    db
      .from("wallet_ledger")
      .select(
        "id, tenant_id, entry_type, category, amount, amount_cents, balance_after, balance_after_cents, reference_type, note, simulated, created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("simulated", false)
      .order("created_at", { ascending: false })
      .limit(100),

    // Today's spend from wallet_ledger (NUMERIC amount — no rounding loss for sub-credit debits)
    db
      .from("wallet_ledger")
      .select("amount, amount_cents")
      .eq("tenant_id", tenantId)
      .eq("entry_type", "enrichment_debit")
      .eq("simulated", false)
      .gte("created_at", today.toISOString()),

    // Last 7d spend from wallet_ledger
    db
      .from("wallet_ledger")
      .select("amount, amount_cents")
      .eq("tenant_id", tenantId)
      .eq("entry_type", "enrichment_debit")
      .eq("simulated", false)
      .gte("created_at", last7d.toISOString()),

    // This month's spend from wallet_ledger
    db
      .from("wallet_ledger")
      .select("amount, amount_cents")
      .eq("tenant_id", tenantId)
      .eq("entry_type", "enrichment_debit")
      .eq("simulated", false)
      .gte("created_at", monthStart.toISOString()),

    // This month's usage_events — drives breakdown table and billable call count
    db
      .from("usage_events")
      .select("credits_used, credits_cost, price, event_type, category, cache_hit, billable")
      .eq("tenant_id", tenantId)
      .eq("simulated", false)
      .gte("created_at", monthStart.toISOString()),
  ]);

  // ── Compute summaries ─────────────────────────────────────────────────────────

  const wallet = walletResult;
  // Prefer NUMERIC balance — balance_cents rounds sub-credit debits to 0 and
  // would not reflect changes for wallets transacting < 0.5 credits at a time.
  const walletBalance = wallet?.balance ?? wallet?.balance_cents ?? null;

  /**
   * Sum absolute spend from wallet_ledger rows.
   * Prefers `amount` (NUMERIC, migration 076) over `amount_cents` (INTEGER, rounds
   * sub-credit amounts to 0).  Takes the absolute value because debits are negative.
   */
  function sumLedgerSpend(
    rows: { amount: number | null | undefined; amount_cents: number }[] | null,
  ): number {
    return (rows ?? []).reduce((s, r) => {
      const v = r.amount ?? r.amount_cents ?? 0;
      return s + Math.abs(v);
    }, 0);
  }

  const creditsToday = sumLedgerSpend(ledgerTodayResult.data as { amount: number | null; amount_cents: number }[] | null);
  const credits7d    = sumLedgerSpend(ledger7dResult.data    as { amount: number | null; amount_cents: number }[] | null);

  const monthRows = (monthResult.data ?? []) as {
    credits_used: number;
    credits_cost: number;
    price:        number;
    event_type:   string;
    category:     string | null;
    cache_hit:    boolean;
    billable:     boolean;
  }[];

  const creditsMonth   = sumLedgerSpend(ledgerMonthResult.data as { amount: number | null; amount_cents: number }[] | null);
  const estimatedEur   = monthRows.reduce((s, r) => s + (r.price ?? 0), 0);
  const billableCount  = monthRows.filter((r) => r.billable && !r.cache_hit).length;

  // ── Per-type breakdown ─────────────────────────────────────────────────────────

  const breakdownMap = new Map<string, BreakdownEntry>();
  for (const r of monthRows) {
    const key = r.event_type;
    const credits = r.credits_used ?? r.credits_cost ?? 0;
    const ex = breakdownMap.get(key);
    if (ex) {
      ex.total_calls++;
      if (r.billable && !r.cache_hit) ex.billable_calls++;
      if (r.cache_hit) ex.cache_hits++;
      ex.credits_used += credits;
      ex.total_price  += r.price ?? 0;
    } else {
      breakdownMap.set(key, {
        event_type:     key,
        category:       r.category,
        total_calls:    1,
        billable_calls: r.billable && !r.cache_hit ? 1 : 0,
        cache_hits:     r.cache_hit ? 1 : 0,
        credits_used:   credits,
        total_price:    r.price ?? 0,
        avg_cost:       0,
      });
    }
  }

  const breakdown: BreakdownEntry[] = Array.from(breakdownMap.values())
    .map((row) => ({
      ...row,
      avg_cost: row.billable_calls > 0
        ? row.credits_used / row.billable_calls
        : 0,
    }))
    .sort((a, b) => b.credits_used - a.credits_used);

  // ── Process raw DB rows ───────────────────────────────────────────────────────

  const events: UsageEventRow[] = eventsResult.error
    ? []
    : ((eventsResult.data ?? []) as UsageEventRow[]);

  const ledgerRows: LedgerRow[] = ledgerResult.error
    ? []
    : ((ledgerResult.data ?? []) as LedgerRow[]);

  const fetchErrors: string[] = [];
  if (eventsResult.error && !isSchemaMissing(eventsResult.error.code)) {
    fetchErrors.push(`usage_events: ${eventsResult.error.message}`);
  }
  if (ledgerResult.error && !isSchemaMissing(ledgerResult.error.code)) {
    fetchErrors.push(`wallet_ledger: ${ledgerResult.error.message}`);
  }

  return (
    <div className="max-w-6xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <a
          href={`/admin/tenants/${tenantId}/billing`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Billing
        </a>
        <a
          href={`/admin/tenants/${tenantId}/billing/debug`}
          className="text-sm text-blue-600 hover:underline"
        >
          Request Debug →
        </a>
      </div>

      <h1 className="text-xl font-semibold text-neutral-900">Usage</h1>
      <p className="mt-1 mb-6 text-sm text-neutral-500">
        Credit usage for{" "}
        <span className="font-medium">{tenant.name ?? tenantId}</span>{" "}
        — real enrichment events only, simulated excluded.
      </p>

      {fetchErrors.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-700">Some data could not be loaded</p>
          {fetchErrors.map((e, i) => (
            <p key={i} className="mt-0.5 text-xs text-red-600 font-mono">{e}</p>
          ))}
        </div>
      )}

      <UsageDashboardClient
        tenantId={tenantId}
        walletBalance={walletBalance}
        creditsToday={creditsToday}
        credits7d={credits7d}
        creditsMonth={creditsMonth}
        estimatedEur={estimatedEur}
        billableCount={billableCount}
        breakdown={breakdown}
        events={events}
        ledgerRows={ledgerRows}
      />
    </div>
  );
}
