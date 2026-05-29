/**
 * billing/usage-summary.ts
 *
 * Usage aggregation helpers — queries the `usage_summary` VIEW.
 *
 * ─── What is usage_summary? ───────────────────────────────────────────────────
 *
 *   `usage_summary` is a Postgres VIEW (created in migration 051) over the
 *   `usage_events` table.  It aggregates usage by:
 *
 *     tenant × billing month × category × feature_key
 *
 *   Every row in the view represents one combination of those four dimensions
 *   for a given calendar month.  Simulated (test mode) events are excluded.
 *
 * ─── Rollup patterns ──────────────────────────────────────────────────────────
 *
 *   By period (all categories):  getUsageSummary(client, tenantId, "2025-01")
 *   By category only:            getUsageSummaryByCategory(client, tenantId, "2025-01")
 *   By feature only:             getUsageSummaryByFeature(client, tenantId, "2025-01")
 *   Current month:               getUsageSummary(client, tenantId, currentPeriodKey())
 *
 * ─── Fallback behaviour ───────────────────────────────────────────────────────
 *
 *   When the `usage_summary` view is missing (migration 051 not yet applied)
 *   or returns an error, all functions return an empty result set and log a
 *   warning.  Callers must handle the empty-result case gracefully.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   All functions require a Supabase client.
 *   Do NOT import in client components.
 */

import type { SupabaseClient }    from "@supabase/supabase-js";
import type { UsageSummaryRow }   from "./types";
import type { CreditCategory }    from "./credits";

// Re-export for consumers that import from here
export type { UsageSummaryRow };

// ── Period key helper ──────────────────────────────────────────────────────────

/**
 * Return the period key for the current calendar month in YYYY-MM format.
 * Usage: getUsageSummary(client, tenantId, currentPeriodKey())
 */
export function currentPeriodKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

/**
 * Return the period key for a given Date in YYYY-MM format.
 */
export function periodKeyFromDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMissingView(code: string): boolean {
  return code === "42P01" || code === "42P07" || code === "PGRST200" || code === "PGRST205";
}

// ── Read: full summary for a billing period ────────────────────────────────────

/**
 * Fetch all usage_summary rows for a tenant in a given billing period.
 *
 * Returns one row per (category × feature_key) combination.
 * Order: category ASC, feature_key ASC.
 *
 * @param client    Supabase client (service-role recommended).
 * @param tenantId  Tenant to query.
 * @param periodKey Billing month in YYYY-MM format, e.g. "2025-01".
 */
export async function getUsageSummary(
  client:    SupabaseClient,
  tenantId:  string,
  periodKey: string,
): Promise<UsageSummaryRow[]> {
  const { data, error } = await client
    .from("usage_summary")
    .select("*")
    .eq("tenant_id",  tenantId)
    .eq("period_key", periodKey)
    .order("category")
    .order("feature_key");

  if (error) {
    if (isMissingView(error.code)) {
      console.warn("[billing/usage-summary] usage_summary view missing — run migration 051", {
        code: error.code, tenantId, periodKey,
      });
    } else {
      console.error("[billing/usage-summary] getUsageSummary error", {
        code: error.code, message: error.message, tenantId, periodKey,
      });
    }
    return [];
  }

  return (data ?? []) as UsageSummaryRow[];
}

// ── Read: collapsed by category ────────────────────────────────────────────────

/**
 * Category-level rollup: total credits and calls per Chameleon Credits category
 * for a tenant in a billing period.
 *
 * Returns at most 3 rows (recognition / adaptation / brainpower).
 */
export interface CategoryRollupRow {
  category:            string;
  total_calls:         number;
  billable_calls:      number;
  cache_hit_calls:     number;
  total_cost_cents:    number;
  internal_cost_cents: number;
}

export async function getUsageSummaryByCategory(
  client:    SupabaseClient,
  tenantId:  string,
  periodKey: string,
): Promise<CategoryRollupRow[]> {
  const rows = await getUsageSummary(client, tenantId, periodKey);

  // Aggregate across all feature_keys within each category
  const byCategory = new Map<string, CategoryRollupRow>();

  for (const row of rows) {
    const existing = byCategory.get(row.category);
    if (existing) {
      existing.total_calls         += row.total_calls;
      existing.billable_calls      += row.billable_calls;
      existing.cache_hit_calls     += row.cache_hit_calls;
      existing.total_cost_cents    += row.total_cost_cents;
      existing.internal_cost_cents += row.internal_cost_cents_sum;
    } else {
      byCategory.set(row.category, {
        category:            row.category,
        total_calls:         row.total_calls,
        billable_calls:      row.billable_calls,
        cache_hit_calls:     row.cache_hit_calls,
        total_cost_cents:    row.total_cost_cents,
        internal_cost_cents: row.internal_cost_cents_sum,
      });
    }
  }

  // Return in canonical category order
  const ORDER: CreditCategory[] = ["recognition", "adaptation", "brainpower"];
  return ORDER.map((cat) => byCategory.get(cat) ?? {
    category:            cat,
    total_calls:         0,
    billable_calls:      0,
    cache_hit_calls:     0,
    total_cost_cents:    0,
    internal_cost_cents: 0,
  });
}

// ── Read: collapsed by feature ─────────────────────────────────────────────────

/**
 * Feature-level rollup: cost and call count per feature_key for a billing period.
 * Useful for the per-feature line-item view in the admin dashboard.
 *
 * Returns rows sorted by total_cost_cents descending (highest spend first).
 */
export interface FeatureRollupRow {
  feature_key:         string;
  category:            string;
  total_calls:         number;
  billable_calls:      number;
  cache_hit_calls:     number;
  total_cost_cents:    number;
  internal_cost_cents: number;
  /** Margin in percent: (customer - internal) / customer × 100. Null when internal = 0. */
  margin_percent:      number | null;
}

export async function getUsageSummaryByFeature(
  client:    SupabaseClient,
  tenantId:  string,
  periodKey: string,
): Promise<FeatureRollupRow[]> {
  const rows = await getUsageSummary(client, tenantId, periodKey);

  return rows
    .map((row): FeatureRollupRow => {
      const margin = row.internal_cost_cents_sum > 0 && row.total_cost_cents > 0
        ? Math.round(
            ((row.total_cost_cents - row.internal_cost_cents_sum) / row.total_cost_cents) * 100,
          )
        : null;

      return {
        feature_key:         row.feature_key,
        category:            row.category,
        total_calls:         row.total_calls,
        billable_calls:      row.billable_calls,
        cache_hit_calls:     row.cache_hit_calls,
        total_cost_cents:    row.total_cost_cents,
        internal_cost_cents: row.internal_cost_cents_sum,
        margin_percent:      margin,
      };
    })
    .sort((a, b) => b.total_cost_cents - a.total_cost_cents);
}

// ── Read: month-to-date total ─────────────────────────────────────────────────

/**
 * Total credits spent by a tenant in the current calendar month.
 *
 * Used by the budget cap guard to determine whether the monthly_credit_cap_cents
 * has been reached.  Fast path: sums the view without returning all rows.
 *
 * Returns 0 when the view is missing (fail open — do not block enrichments).
 */
export async function getMonthToDateSpend(
  client:    SupabaseClient,
  tenantId:  string,
  periodKey: string = currentPeriodKey(),
): Promise<number> {
  try {
    const rows = await getUsageSummary(client, tenantId, periodKey);
    return rows.reduce((sum, row) => sum + row.total_cost_cents, 0);
  } catch {
    return 0;
  }
}

// ── Read: multi-period history ─────────────────────────────────────────────────

/**
 * Fetch usage summaries for the last N calendar months.
 * Returns results from oldest to newest.
 *
 * @param months Number of months to include (default 3).
 */
export async function getUsageSummaryHistory(
  client:   SupabaseClient,
  tenantId: string,
  months    = 3,
): Promise<CategoryRollupRow[][]> {
  const results: CategoryRollupRow[][] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key  = periodKeyFromDate(date);
    const rows = await getUsageSummaryByCategory(client, tenantId, key);
    results.push(rows);
  }

  return results;
}
