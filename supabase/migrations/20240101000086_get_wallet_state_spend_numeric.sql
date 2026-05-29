-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 086 — get_wallet_state: use NUMERIC amount for spend queries
--
-- ─── Root cause ──────────────────────────────────────────────────────────────
--
--   The spend sub-queries in get_wallet_state (migration 085) read
--   wallet_ledger.amount_cents (INTEGER):
--
--     SELECT SUM(ABS(l.amount_cents)) … WHERE l.amount_cents < 0
--
--   The debit_wallet RPC (migration 076) writes both columns:
--
--     amount        = -p_credit_cost              -- NUMERIC (e.g. -0.0100)
--     amount_cents  = -ROUND(p_credit_cost)::INTEGER  -- e.g. ROUND(0.01) = 0
--
--   For sub-credit prices (credit_cost < 0.5 in the enrichment_pricing table),
--   ROUND(credit_cost) = 0.  Therefore amount_cents = 0, the WHERE clause
--   `amount_cents < 0` is FALSE for every debit row, and all spend totals
--   return 0 — regardless of how many enrichments have been charged.
--
--   This is the same root cause that makes today/this-month always show 0 on
--   the billing dashboard even when the wallet balance has been decremented.
--
-- ─── Fix ─────────────────────────────────────────────────────────────────────
--
--   Replace amount_cents with amount (NUMERIC) in all three spend sub-queries.
--   The return types of spend_today_cents / spend_this_month_cents /
--   period_spend_cents are changed from INTEGER to NUMERIC so that sub-credit
--   totals (e.g. 100 × 0.01 = 1.00) are preserved exactly.
--
--   Downstream TypeScript reads these as `number` (WalletState interface) — no
--   type change needed.  The dashboard's toLocaleString() handles decimals fine.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   DROP FUNCTION IF EXISTS … CASCADE + CREATE OR REPLACE.  Safe to re-run.
--
-- ─────────────────────────────────────────────────────────────────────────────

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
  -- ── Spend summaries (NUMERIC — supports sub-credit precision) ───────────────
  --
  -- Changed from INTEGER (migration 055/060/084/085) to NUMERIC so that
  -- sub-credit debit amounts (e.g. credit_cost=0.01) are not rounded to 0.
  -- TypeScript WalletState.spend_today_cents is typed as `number` and accepts
  -- both INTEGER and NUMERIC from PostgREST without modification.
  spend_today_cents                   NUMERIC,
  spend_this_month_cents              NUMERIC,
  period_spend_cents                  NUMERIC,
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
  -- ON CONFLICT ON CONSTRAINT avoids the 42702 "column reference is ambiguous"
  -- error that arises when "tenant_id" is both a table column and a RETURNS TABLE
  -- OUT parameter inside this function body.

  INSERT INTO public.tenant_wallets (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT ON CONSTRAINT tenant_wallets_pkey DO NOTHING;

  -- ── Step 2: Compute time boundaries (all UTC) ────────────────────────────────
  v_today_start := date_trunc('day',   now() AT TIME ZONE 'UTC');
  v_month_start := date_trunc('month', now() AT TIME ZONE 'UTC');

  -- ── Step 3: Billing period from subscriptions ────────────────────────────────
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

  -- ── Step 4: Return wallet row with computed extensions ───────────────────────
  --
  -- Spend sub-queries use wallet_ledger.amount (NUMERIC) instead of
  -- amount_cents (INTEGER).  This is critical for sub-credit prices:
  --   debit_wallet writes  amount = -0.0100  (NUMERIC — exact)
  --   debit_wallet writes  amount_cents = ROUND(-0.01) = 0  (INTEGER — loses data)
  -- If we sum amount_cents, all sub-credit debits appear as 0 spend.

  RETURN QUERY
  SELECT
    w.tenant_id::TEXT,
    w.balance_cents::INTEGER,
    COALESCE(w.currency,      'EUR')::TEXT,
    COALESCE(w.status,        'active')::TEXT,
    COALESCE(w.low_balance_threshold_cents,        0)::INTEGER,
    COALESCE(w.monthly_credit_cap_cents,           0)::INTEGER,
    COALESCE(w.fallback_mode, 'smart_lite')::TEXT,
    COALESCE(w.auto_reload_enabled,                FALSE)::BOOLEAN,
    COALESCE(w.auto_reload_trigger_cents,          0)::INTEGER,
    COALESCE(w.auto_reload_amount_cents,           0)::INTEGER,
    COALESCE(w.auto_reload_monthly_limit_cents,    0)::INTEGER,
    COALESCE(w.auto_reload_spent_this_month_cents, 0)::INTEGER,
    w.auto_reload_month_reset_at::TIMESTAMPTZ,
    w.stripe_payment_method_id::TEXT,
    w.stripe_test_customer_id::TEXT,
    w.stripe_test_payment_method_id::TEXT,
    COALESCE(w.notify_email, FALSE)::BOOLEAN,
    COALESCE(w.notify_sms,   FALSE)::BOOLEAN,
    w.notification_email::TEXT,
    w.notification_phone::TEXT,
    COALESCE(w.test_mode, 'live')::TEXT,
    w.created_at::TIMESTAMPTZ,
    w.updated_at::TIMESTAMPTZ,

    -- Flags
    (
      COALESCE(w.low_balance_threshold_cents, 0) > 0
      AND w.balance_cents < COALESCE(w.low_balance_threshold_cents, 0)
    )::BOOLEAN,
    (w.stripe_payment_method_id IS NOT NULL)::BOOLEAN,

    -- spend_today: sum of NUMERIC amounts for debits since midnight UTC.
    -- COALESCE handles the case where no ledger rows exist yet → 0.
    COALESCE((
      SELECT SUM(ABS(l.amount))
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id  = p_tenant_id
        AND  l.amount     < 0
        AND  l.created_at >= v_today_start
    ), 0)::NUMERIC,

    -- spend_this_month: debits since the 1st of the current month UTC.
    COALESCE((
      SELECT SUM(ABS(l.amount))
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id  = p_tenant_id
        AND  l.amount     < 0
        AND  l.created_at >= v_month_start
    ), 0)::NUMERIC,

    -- period_spend: debits since billing period start (or month start).
    COALESCE((
      SELECT SUM(ABS(l.amount))
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id  = p_tenant_id
        AND  l.amount     < 0
        AND  l.created_at >= v_period_start
    ), 0)::NUMERIC,

    v_period_start::TIMESTAMPTZ,
    v_period_end::TIMESTAMPTZ

  FROM public.tenant_wallets w
  WHERE w.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.get_wallet_state(TEXT) IS
  'Returns the full tenant wallet row plus pre-computed NUMERIC spend summaries '
  'and convenience flags.  Spend is computed from wallet_ledger.amount (NUMERIC) '
  'not amount_cents (INTEGER) to preserve sub-credit precision (e.g. 0.01 credits). '
  'Auto-creates a default wallet row when none exists. '
  'SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.get_wallet_state(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
