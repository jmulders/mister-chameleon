/**
 * Migration 062 — get_wallet_breakdown: filter out null enrichment_type rows
 *
 * Problem:
 *   The billing dashboard's FeatureBreakdownTable crashed with:
 *     TypeError: Cannot read properties of undefined (reading 'replace')
 *   because some enrichment_usage rows have a NULL enrichment_type.
 *
 *   The previous GROUP BY query did not exclude NULLs:
 *     GROUP BY eu.enrichment_type
 *   PostgreSQL includes NULL as its own group, returning a row where
 *   enrichment_type IS NULL.  The TypeScript caller typed the field as
 *   `string` (not `string | null`), so the UI called featureName(null)
 *   which crashed on `.replace()`.
 *
 * Root cause of null rows:
 *   Legacy enrichment_usage rows written before enrichment_type was
 *   enforced as NOT NULL, or failed enrichment events that logged
 *   without a type identifier.
 *
 * Fix:
 *   Add `AND eu.enrichment_type IS NOT NULL` to the WHERE clause.
 *   NULL-type rows contribute no meaningful breakdown information —
 *   they have no recognisable feature name, category, or pricing.
 *   Excluding them at the SQL level is cleaner than handling them in
 *   the UI fallback layer (which remains as a defense-in-depth guard).
 *
 * Idempotency:
 *   CREATE OR REPLACE FUNCTION is always safe to re-run.
 */

-- DROP required because CREATE OR REPLACE cannot change OUT parameter definitions
-- on an existing function (Postgres error 42P13).
DROP FUNCTION IF EXISTS public.get_wallet_breakdown(TEXT, TEXT);

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
  v_from := ((v_period_key || '-01')::DATE)::TIMESTAMPTZ AT TIME ZONE 'UTC';
  v_to   := v_from + INTERVAL '1 month';

  -- Aggregate enrichment_usage rows within the period.
  -- AND eu.enrichment_type IS NOT NULL — excludes legacy rows that were
  -- recorded without a type identifier. NULL rows carry no actionable
  -- feature name, category, or pricing, so omitting them is correct.
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
  WHERE eu.tenant_id          = p_tenant_id
    AND eu.created_at        >= v_from
    AND eu.created_at         < v_to
    AND eu.enrichment_type IS NOT NULL   -- ← excludes unclassifiable legacy rows
  GROUP BY eu.enrichment_type
  ORDER BY SUM(eu.total_price_cents) DESC, eu.enrichment_type ASC;

EXCEPTION WHEN undefined_table THEN
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_breakdown(TEXT, TEXT) TO service_role;
