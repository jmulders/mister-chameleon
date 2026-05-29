-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 089 — get_wallet_state: expose balance NUMERIC column
--
-- ─── Root cause ──────────────────────────────────────────────────────────────
--
--   Migration 076 added a NUMERIC balance column to tenant_wallets:
--
--     balance  NUMERIC(12,4)  — exact decimal credits (e.g. 97.2500)
--
--   debit_wallet (migration 076) keeps both columns in sync:
--
--     balance        = balance - p_credit_cost              -- NUMERIC, e.g. 97.2400
--     balance_cents  = balance_cents - ROUND(p_credit_cost) -- INTEGER, e.g. 97 for p_credit_cost=0.01
--
--   For sub-credit prices (p_credit_cost < 0.5), ROUND(p_credit_cost) = 0.
--   Therefore balance_cents NEVER changes for these debits.
--
--   get_wallet_state (migrations 055–088) returns only balance_cents INTEGER
--   from tenant_wallets, not balance NUMERIC.  Consequently:
--
--     walletState.balance        → undefined  (not in RETURNS TABLE)
--     walletState.balance_cents  → stale integer (not updated for sub-credit debits)
--
--   The TypeScript billing page reads `walletState?.balance_cents`, so the
--   displayed wallet balance never decrements for tenants using sub-credit
--   enrichment pricing (e.g. ip_enrich at 0.01 credits per call).
--
-- ─── Fix ─────────────────────────────────────────────────────────────────────
--
--   Add balance NUMERIC to RETURNS TABLE and to the inner SELECT (w.balance).
--
--   The TypeScript WalletState interface (billing/types.ts) already declares
--   balance as an optional number field (migration 076):
--
--     balance?: number;  // NUMERIC from tenant_wallets; NULL for pre-076 rows
--
--   After this migration, walletState.balance will be populated from the RPC
--   and `walletState?.balance ?? walletState?.balance_cents` will resolve to
--   the correct decimal value.
--
-- ─── Backward compatibility ───────────────────────────────────────────────────
--
--   Wallets created before migration 076 have balance = NULL.  TypeScript
--   falls through to balance_cents (integer) for these rows — correct.
--
--   All other RETURNS TABLE columns are unchanged.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   DROP FUNCTION IF EXISTS … CASCADE + full recreate.  Safe to re-run.
--
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_wallet_state(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_wallet_state(p_tenant_id TEXT)
RETURNS TABLE (
  -- ── Core tenant_wallets columns ─────────────────────────────────────────────
  tenant_id                           TEXT,
  -- NUMERIC balance (migration 076) — exact decimal credits; NULL for pre-076 rows.
  -- Prefer this over balance_cents when present.
  balance                             NUMERIC,
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
  -- Changed from INTEGER (migration 055/060/084/085) to NUMERIC (migration 086)
  -- so sub-credit debit amounts (e.g. credit_cost=0.01) are not rounded to 0.
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
  --
  -- balance (NUMERIC) is now included so the TypeScript layer can use the exact
  -- decimal balance rather than the rounded integer balance_cents.

  RETURN QUERY
  SELECT
    w.tenant_id::TEXT,
    -- NUMERIC balance (migration 076) — exact decimal credits.
    -- NULL for wallets created before migration 076 (TypeScript falls back to balance_cents).
    w.balance::NUMERIC,
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
  'and convenience flags.  balance NUMERIC (migration 076) is included alongside '
  'the legacy balance_cents INTEGER so TypeScript can prefer the exact decimal '
  'value (balance ?? balance_cents).  Spend is computed from wallet_ledger.amount '
  '(NUMERIC) not amount_cents (INTEGER) to preserve sub-credit precision '
  '(e.g. 0.01 credits per enrichment call).  Auto-creates a default wallet row '
  'when none exists.  SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.get_wallet_state(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
