/**
 * Migration 056 — get_wallet_breakdown RPC
 *
 * Adds public.get_wallet_breakdown(p_tenant_id TEXT, p_period_key TEXT)
 *
 * Replaces the fragmented application-side enrichment usage queries
 * (getEnrichmentUsageSummary JS-reduce + getTotalEnrichmentSpend SELECT)
 * with a single server-side aggregation RPC.
 *
 * ─── What it replaces ─────────────────────────────────────────────────────────
 *
 *   Before (billing/page.tsx):
 *     [getEnrichmentUsageSummary]  — fetches all raw rows and reduces in JS
 *     [getTotalEnrichmentSpend]    — separate round-trip to sum total_price_cents
 *
 *   After:
 *     [get_wallet_breakdown]       — single GROUP BY query; result is pre-aggregated
 *
 * ─── Return shape ─────────────────────────────────────────────────────────────
 *
 *   One row per enrichment_type found in enrichment_usage for the period.
 *   Rows are ordered by total_price_cents DESC (highest spend first).
 *
 *   enrichment_type   — machine key (ip_enrich, crm_lookup, …)
 *   call_count        — total rows (success + failure + blocked)
 *   success_count     — rows where success = TRUE and NOT wallet_blocked
 *   failure_count     — rows where success = FALSE and NOT wallet_blocked
 *   cache_hit_count   — rows where cache_hit = TRUE
 *   fresh_call_count  — rows that were live API calls (NOT cache_hit, NOT blocked)
 *   blocked_count     — rows where wallet_blocked = TRUE
 *   total_price_cents — sum of total_price_cents (credits spent)
 *
 * ─── Period key ───────────────────────────────────────────────────────────────
 *
 *   p_period_key accepts YYYY-MM format (e.g. "2026-04") and is converted
 *   internally to a [v_from, v_from + 1 month) TIMESTAMPTZ range.
 *   When NULL the current UTC calendar month is used.
 *
 * ─── Empty periods ────────────────────────────────────────────────────────────
 *
 *   When there are no enrichment_usage rows for the period, the function
 *   returns zero rows (empty result set), not an error.  Callers must treat
 *   an empty result as "no usage yet" and render an appropriate empty state.
 *
 * ─── Missing table ────────────────────────────────────────────────────────────
 *
 *   When enrichment_usage table does not exist (migration 041 not applied),
 *   the EXCEPTION handler catches undefined_table and returns an empty set
 *   rather than raising PGRST202 / 42P01 to the caller.
 *
 * ─── Category ─────────────────────────────────────────────────────────────────
 *
 *   Category mapping (recognition / adaptation / brainpower) is NOT included
 *   in the SQL return — it is derived in TypeScript from ENRICHMENT_TYPE_CONFIG
 *   in billing/enrichment-pricing.ts.  This keeps the SQL lean and the mapping
 *   logic in one place.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   SECURITY DEFINER — caller does not need direct SELECT access to
 *   enrichment_usage.  search_path pinned to `public`.
 */

-- ── get_wallet_breakdown ──────────────────────────────────────────────────────

-- Drop any existing version regardless of OUT parameters (avoids 42P13).
DROP FUNCTION IF EXISTS public.get_wallet_breakdown(TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_wallet_breakdown(
  p_tenant_id  TEXT,
  p_period_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  enrichment_type   TEXT,
  call_count        INTEGER,
  success_count     INTEGER,
  failure_count     INTEGER,
  cache_hit_count   INTEGER,
  fresh_call_count  INTEGER,
  blocked_count     INTEGER,
  total_price_cents INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_key TEXT;
  v_from       TIMESTAMPTZ;
  v_to         TIMESTAMPTZ;
BEGIN
  -- Default to current calendar month (UTC) when no period key is supplied.
  v_period_key := COALESCE(p_period_key, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'));

  -- Convert YYYY-MM → [v_from, v_from + 1 month) interval.
  --   e.g. "2026-04" → 2026-04-01 00:00:00 UTC  →  2026-05-01 00:00:00 UTC
  v_from := ((v_period_key || '-01')::DATE)::TIMESTAMPTZ AT TIME ZONE 'UTC';
  v_to   := v_from + INTERVAL '1 month';

  -- Aggregate enrichment_usage rows within the period.
  -- quantity column represents the number of API calls in that row (usually 1).
  -- wallet_blocked rows are counted separately and contribute 0 to total_price_cents.
  RETURN QUERY
  SELECT
    eu.enrichment_type::TEXT,
    COALESCE(SUM(eu.quantity),                                                          0)::INTEGER AS call_count,
    COALESCE(SUM(CASE WHEN eu.success AND NOT eu.wallet_blocked THEN eu.quantity ELSE 0 END), 0)::INTEGER AS success_count,
    COALESCE(SUM(CASE WHEN NOT eu.success AND NOT eu.wallet_blocked THEN eu.quantity ELSE 0 END), 0)::INTEGER AS failure_count,
    COALESCE(SUM(CASE WHEN eu.cache_hit  THEN eu.quantity ELSE 0 END),                0)::INTEGER AS cache_hit_count,
    COALESCE(SUM(CASE WHEN NOT eu.cache_hit AND NOT eu.wallet_blocked THEN eu.quantity ELSE 0 END), 0)::INTEGER AS fresh_call_count,
    COALESCE(SUM(CASE WHEN eu.wallet_blocked THEN eu.quantity ELSE 0 END),            0)::INTEGER AS blocked_count,
    COALESCE(SUM(eu.total_price_cents),                                                0)::INTEGER AS total_price_cents
  FROM public.enrichment_usage eu
  WHERE eu.tenant_id   = p_tenant_id
    AND eu.created_at >= v_from
    AND eu.created_at  < v_to
  GROUP BY eu.enrichment_type
  ORDER BY SUM(eu.total_price_cents) DESC, eu.enrichment_type ASC;

-- Handle missing enrichment_usage table gracefully (migration 041 not applied).
-- Returns empty set instead of raising 42P01 / PGRST202 to the caller.
EXCEPTION WHEN undefined_table THEN
  RETURN;
END;
$$;

-- Allow the service role to call this function.
GRANT EXECUTE ON FUNCTION public.get_wallet_breakdown(TEXT, TEXT) TO service_role;
