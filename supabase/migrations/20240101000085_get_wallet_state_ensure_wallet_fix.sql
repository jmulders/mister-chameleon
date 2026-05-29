-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 085 — ensure_wallet + get_wallet_state comprehensive fix
--
-- ─── Root cause ──────────────────────────────────────────────────────────────
--
--   ensure_wallet (migration 054) is defined as:
--
--     RETURNS SETOF public.tenant_wallets
--     RETURN QUERY SELECT * FROM public.tenant_wallets WHERE ...
--
--   After migration 083 added 16 columns to tenant_wallets, the PL/pgSQL
--   plan for `SELECT *` that was compiled against the old schema (fewer
--   columns) became stale.  PostgreSQL's plan invalidation should handle
--   this in a fresh session, but in some cache states the mismatch between
--   the compiled `SELECT *` column list (old) and the `RETURNS SETOF
--   public.tenant_wallets` composite type (new, wider) causes SQLSTATE 42804
--   ("structure of query does not match function result type").
--
--   get_wallet_state (migration 060) calls `PERFORM public.ensure_wallet(p_tenant_id)`.
--   Even though PERFORM discards the return value, the function body still
--   executes — and if ensure_wallet throws 42804, the error propagates up
--   through PERFORM and is reported as a get_wallet_state failure.
--
-- ─── Fix ─────────────────────────────────────────────────────────────────────
--
--   A. ensure_wallet — change to RETURNS VOID.
--      The only caller that needed its return value was get_wallet_state via
--      PERFORM (which discards it anyway).  RETURNS VOID removes the
--      RETURNS SETOF / SELECT * mismatch vector entirely.
--
--   B. get_wallet_state — replace PERFORM ensure_wallet() with an inline
--      INSERT … ON CONFLICT ON CONSTRAINT to avoid both:
--        • The ensure_wallet 42804 described above.
--        • The 42702 "column reference is ambiguous" that migration 060 was
--          fixing.  ON CONFLICT ON CONSTRAINT uses the constraint name
--          (not a column name), so there is no clash with the RETURNS TABLE
--          OUT parameter also named "tenant_id".
--
--      All SELECT expressions use explicit ::TYPE casts so PostgreSQL can
--      validate the return type at compile time without any type inference.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   DROP FUNCTION IF EXISTS … CASCADE + CREATE OR REPLACE — safe to re-run.
--
-- ─────────────────────────────────────────────────────────────────────────────


-- ── A. ensure_wallet — simplify to RETURNS VOID ───────────────────────────────
--
-- DROP … CASCADE removes the function and any objects that depend on it.
-- get_wallet_state calls ensure_wallet via PERFORM — not a dependency PostgreSQL
-- tracks — so it will not be dropped by CASCADE here.

DROP FUNCTION IF EXISTS public.ensure_wallet(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_wallet(p_tenant_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotent wallet initialisation.  ON CONFLICT (tenant_id) is unambiguous
  -- here because ensure_wallet has no RETURNS TABLE OUT parameter named
  -- tenant_id — the only parameter is the IN param p_tenant_id.
  INSERT INTO public.tenant_wallets (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.ensure_wallet(TEXT) IS
  'Idempotently creates a tenant_wallets row with column-level defaults when '
  'one does not yet exist.  Safe to call multiple times; subsequent calls are '
  'no-ops.  SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.ensure_wallet(TEXT) TO service_role;


-- ── B. get_wallet_state — rebuilt without PERFORM ensure_wallet() ─────────────
--
-- Uses ON CONFLICT ON CONSTRAINT tenant_wallets_pkey to avoid the 42702
-- "column reference is ambiguous" error that the bare ON CONFLICT (tenant_id)
-- would cause (tenant_id is both an OUT parameter and a table column inside
-- a RETURNS TABLE function).
--
-- Every SELECT expression uses an explicit ::TYPE cast so the compiler can
-- validate types without any inference.

DROP FUNCTION IF EXISTS public.get_wallet_state(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_wallet_state(p_tenant_id TEXT)
RETURNS TABLE (
  -- ── Core tenant_wallets columns ─────────────────────────────────────────────
  tenant_id                           TEXT,
  balance_cents                       INTEGER,
  currency                            TEXT,
  status                              TEXT,
  low_balance_threshold_cents         INTEGER,
  monthly_credit_cap_cents            INTEGER,
  fallback_mode                       TEXT,
  auto_reload_enabled                 BOOLEAN,
  auto_reload_trigger_cents           INTEGER,
  auto_reload_amount_cents            INTEGER,
  auto_reload_monthly_limit_cents     INTEGER,
  auto_reload_spent_this_month_cents  INTEGER,
  auto_reload_month_reset_at          TIMESTAMPTZ,
  stripe_payment_method_id            TEXT,
  stripe_test_customer_id             TEXT,
  stripe_test_payment_method_id       TEXT,
  notify_email                        BOOLEAN,
  notify_sms                          BOOLEAN,
  notification_email                  TEXT,
  notification_phone                  TEXT,
  test_mode                           TEXT,
  created_at                          TIMESTAMPTZ,
  updated_at                          TIMESTAMPTZ,
  -- ── Computed flags ──────────────────────────────────────────────────────────
  is_low_balance                      BOOLEAN,
  has_payment_method                  BOOLEAN,
  -- ── Spend summaries ─────────────────────────────────────────────────────────
  spend_today_cents                   INTEGER,
  spend_this_month_cents              INTEGER,
  period_spend_cents                  INTEGER,
  -- ── Billing period ──────────────────────────────────────────────────────────
  period_start                        TIMESTAMPTZ,
  period_end                          TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start  TIMESTAMPTZ;
  v_month_start  TIMESTAMPTZ;
  v_period_start TIMESTAMPTZ;
  v_period_end   TIMESTAMPTZ;
BEGIN
  -- ── Step 1: Ensure wallet row exists ────────────────────────────────────────
  --
  -- Uses ON CONFLICT ON CONSTRAINT (not ON CONFLICT (tenant_id)) to avoid
  -- PostgreSQL error 42702 "column reference is ambiguous".  Inside a
  -- RETURNS TABLE function, "tenant_id" resolves to both the table column
  -- AND the implicit OUT parameter of the same name.  Referencing the
  -- constraint by name side-steps the ambiguity completely.
  --
  -- This replaces the earlier PERFORM public.ensure_wallet(p_tenant_id) call.
  -- ensure_wallet (migration 054) used RETURNS SETOF public.tenant_wallets
  -- with SELECT * — after migration 083 widened the table schema, the cached
  -- SELECT * plan could mismatch the composite type and throw 42804.  Inlining
  -- the INSERT here avoids that failure path entirely.

  INSERT INTO public.tenant_wallets (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT ON CONSTRAINT tenant_wallets_pkey DO NOTHING;

  -- ── Step 2: Compute time boundaries (all UTC) ────────────────────────────────
  v_today_start := date_trunc('day',   now() AT TIME ZONE 'UTC');
  v_month_start := date_trunc('month', now() AT TIME ZONE 'UTC');

  -- ── Step 3: Billing period from subscriptions (fall back to month start) ─────
  SELECT
    s.current_period_start::TIMESTAMPTZ,
    s.current_period_end::TIMESTAMPTZ
  INTO v_period_start, v_period_end
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_period_start IS NULL THEN
    v_period_start := v_month_start;
  END IF;

  -- ── Step 4: Return wallet row + computed extensions ──────────────────────────
  --
  -- Every expression carries an explicit ::TYPE cast so PostgreSQL can verify
  -- the return type at compile time regardless of implicit coercion rules.
  -- SUM() over INTEGER columns returns BIGINT; the inner ::INTEGER cast inside
  -- each sub-query prevents 42804 in the outer COALESCE resolution.

  RETURN QUERY
  SELECT
    w.tenant_id::TEXT,
    w.balance_cents::INTEGER,
    COALESCE(w.currency,      'EUR')::TEXT                               AS currency,
    COALESCE(w.status,        'active')::TEXT                            AS status,
    COALESCE(w.low_balance_threshold_cents,        0)::INTEGER           AS low_balance_threshold_cents,
    COALESCE(w.monthly_credit_cap_cents,           0)::INTEGER           AS monthly_credit_cap_cents,
    COALESCE(w.fallback_mode, 'smart_lite')::TEXT                        AS fallback_mode,
    COALESCE(w.auto_reload_enabled,                FALSE)::BOOLEAN       AS auto_reload_enabled,
    COALESCE(w.auto_reload_trigger_cents,          0)::INTEGER           AS auto_reload_trigger_cents,
    COALESCE(w.auto_reload_amount_cents,           0)::INTEGER           AS auto_reload_amount_cents,
    COALESCE(w.auto_reload_monthly_limit_cents,    0)::INTEGER           AS auto_reload_monthly_limit_cents,
    COALESCE(w.auto_reload_spent_this_month_cents, 0)::INTEGER           AS auto_reload_spent_this_month_cents,
    w.auto_reload_month_reset_at::TIMESTAMPTZ,
    w.stripe_payment_method_id::TEXT,
    w.stripe_test_customer_id::TEXT,
    w.stripe_test_payment_method_id::TEXT,
    COALESCE(w.notify_email, FALSE)::BOOLEAN                             AS notify_email,
    COALESCE(w.notify_sms,   FALSE)::BOOLEAN                             AS notify_sms,
    w.notification_email::TEXT,
    w.notification_phone::TEXT,
    COALESCE(w.test_mode, 'live')::TEXT                                  AS test_mode,
    w.created_at::TIMESTAMPTZ,
    w.updated_at::TIMESTAMPTZ,

    -- Computed flags
    (
      COALESCE(w.low_balance_threshold_cents, 0) > 0
      AND w.balance_cents < COALESCE(w.low_balance_threshold_cents, 0)
    )::BOOLEAN                                                           AS is_low_balance,
    (w.stripe_payment_method_id IS NOT NULL)::BOOLEAN                    AS has_payment_method,

    -- Spend summaries.
    -- SUM(INTEGER) returns BIGINT; cast inside the sub-query first, then again
    -- on the outer COALESCE to guarantee the final type is INTEGER.
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))::INTEGER
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id    = p_tenant_id
        AND  l.amount_cents < 0
        AND  l.created_at  >= v_today_start
    )::INTEGER, 0)::INTEGER                                              AS spend_today_cents,

    COALESCE((
      SELECT SUM(ABS(l.amount_cents))::INTEGER
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id    = p_tenant_id
        AND  l.amount_cents < 0
        AND  l.created_at  >= v_month_start
    )::INTEGER, 0)::INTEGER                                              AS spend_this_month_cents,

    COALESCE((
      SELECT SUM(ABS(l.amount_cents))::INTEGER
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id    = p_tenant_id
        AND  l.amount_cents < 0
        AND  l.created_at  >= v_period_start
    )::INTEGER, 0)::INTEGER                                              AS period_spend_cents,

    v_period_start::TIMESTAMPTZ                                          AS period_start,
    v_period_end::TIMESTAMPTZ                                            AS period_end

  FROM public.tenant_wallets w
  WHERE w.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.get_wallet_state(TEXT) IS
  'Returns the full tenant wallet row plus pre-computed spend summaries and '
  'convenience flags.  Auto-creates a default wallet row when none exists. '
  'SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.get_wallet_state(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
