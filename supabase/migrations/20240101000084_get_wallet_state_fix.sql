-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 084 — get_wallet_state recreate
--
-- ─── Why this exists ─────────────────────────────────────────────────────────
--
--   Migration 055 created get_wallet_state when tenant_wallets still had a
--   minimal schema (balance_cents, currency, status, created_at, updated_at).
--   The function compiled lazily — CREATE FUNCTION succeeded but the compiled
--   plan was invalid for the columns that didn't yet exist.
--
--   Migration 083 added all the missing columns (auto_reload_*, stripe_*,
--   notify_*, test_mode, fallback_mode, etc.).  PostgreSQL then tried to
--   recompile the function body against the new schema and hit SQLSTATE 42804
--   ("structure of query does not match function result type") because:
--
--     a) SUM() over INTEGER columns returns BIGINT in PostgreSQL; the
--        RETURNS TABLE declaration says INTEGER.  The final ::INTEGER casts
--        in migration 055 were correct but the function plan was stale.
--     b) Some new columns have NUMERIC(14,4)/BOOLEAN types; the implicit
--        coercions needed to be explicitly stated.
--
--   Dropping and recreating with a fresh, explicit-cast SELECT resolves both.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   DROP FUNCTION … CASCADE + CREATE OR REPLACE — safe to re-run.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop all overloads (CASCADE drops any dependent views).
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
  -- ── Spend summaries (always INTEGER cents) ──────────────────────────────────
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
  -- ── Step 1: Ensure wallet row exists (idempotent) ────────────────────────────
  INSERT INTO public.tenant_wallets (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- ── Step 2: Compute time boundaries (all UTC) ────────────────────────────────
  v_today_start := date_trunc('day',   now() AT TIME ZONE 'UTC');
  v_month_start := date_trunc('month', now() AT TIME ZONE 'UTC');

  -- ── Step 3: Fetch billing period dates from subscriptions ────────────────────
  SELECT
    s.current_period_start::TIMESTAMPTZ,
    s.current_period_end::TIMESTAMPTZ
  INTO v_period_start, v_period_end
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  LIMIT 1;

  -- Fall back to current month when no subscription exists.
  IF v_period_start IS NULL THEN
    v_period_start := v_month_start;
  END IF;

  -- ── Step 4: Return wallet row with computed extensions ───────────────────────
  --
  -- Every expression is explicitly cast to match the RETURNS TABLE declaration.
  -- SUM() over INTEGER columns returns BIGINT in PostgreSQL; the ::INTEGER casts
  -- on the spend sub-queries prevent a 42804 type-mismatch error.

  RETURN QUERY
  SELECT
    -- Core pass-through columns
    w.tenant_id::TEXT,
    w.balance_cents::INTEGER,
    COALESCE(w.currency,     'EUR')::TEXT                               AS currency,
    COALESCE(w.status,       'active')::TEXT                            AS status,
    COALESCE(w.low_balance_threshold_cents,        0)::INTEGER          AS low_balance_threshold_cents,
    COALESCE(w.monthly_credit_cap_cents,           0)::INTEGER          AS monthly_credit_cap_cents,
    COALESCE(w.fallback_mode, 'smart_lite')::TEXT                       AS fallback_mode,
    COALESCE(w.auto_reload_enabled,                FALSE)::BOOLEAN      AS auto_reload_enabled,
    COALESCE(w.auto_reload_trigger_cents,          0)::INTEGER          AS auto_reload_trigger_cents,
    COALESCE(w.auto_reload_amount_cents,           0)::INTEGER          AS auto_reload_amount_cents,
    COALESCE(w.auto_reload_monthly_limit_cents,    0)::INTEGER          AS auto_reload_monthly_limit_cents,
    COALESCE(w.auto_reload_spent_this_month_cents, 0)::INTEGER          AS auto_reload_spent_this_month_cents,
    w.auto_reload_month_reset_at::TIMESTAMPTZ,
    w.stripe_payment_method_id::TEXT,
    w.stripe_test_customer_id::TEXT,
    w.stripe_test_payment_method_id::TEXT,
    COALESCE(w.notify_email, FALSE)::BOOLEAN                            AS notify_email,
    COALESCE(w.notify_sms,   FALSE)::BOOLEAN                            AS notify_sms,
    w.notification_email::TEXT,
    w.notification_phone::TEXT,
    COALESCE(w.test_mode, 'live')::TEXT                                 AS test_mode,
    w.created_at::TIMESTAMPTZ,
    w.updated_at::TIMESTAMPTZ,

    -- Computed flags
    (
      COALESCE(w.low_balance_threshold_cents, 0) > 0
      AND w.balance_cents < COALESCE(w.low_balance_threshold_cents, 0)
    )::BOOLEAN                                                          AS is_low_balance,
    (w.stripe_payment_method_id IS NOT NULL)::BOOLEAN                   AS has_payment_method,

    -- Spend summaries — SUM() returns BIGINT; cast to INTEGER explicitly
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))::INTEGER
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id    = p_tenant_id
        AND  l.amount_cents < 0
        AND  l.created_at  >= v_today_start
    ), 0)::INTEGER                                                      AS spend_today_cents,

    COALESCE((
      SELECT SUM(ABS(l.amount_cents))::INTEGER
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id    = p_tenant_id
        AND  l.amount_cents < 0
        AND  l.created_at  >= v_month_start
    ), 0)::INTEGER                                                      AS spend_this_month_cents,

    COALESCE((
      SELECT SUM(ABS(l.amount_cents))::INTEGER
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id    = p_tenant_id
        AND  l.amount_cents < 0
        AND  l.created_at  >= v_period_start
    ), 0)::INTEGER                                                      AS period_spend_cents,

    v_period_start::TIMESTAMPTZ                                         AS period_start,
    v_period_end::TIMESTAMPTZ                                           AS period_end

  FROM public.tenant_wallets w
  WHERE w.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.get_wallet_state(TEXT) IS
  'Returns the full tenant wallet row plus computed spend summaries and flags. '
  'Auto-creates a default wallet row when none exists. '
  'SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.get_wallet_state(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
