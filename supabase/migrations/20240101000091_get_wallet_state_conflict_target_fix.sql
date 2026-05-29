-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 091 — get_wallet_state: fix ON CONFLICT target for tenant_id
--
-- ─── Root cause ──────────────────────────────────────────────────────────────
--
--   Migrations 085–089 defined the INSERT guard inside get_wallet_state as:
--
--     INSERT INTO public.tenant_wallets (tenant_id)
--     VALUES (p_tenant_id)
--     ON CONFLICT ON CONSTRAINT tenant_wallets_pkey DO NOTHING;
--
--   This targets the PK constraint by name.  On some deployments the
--   tenant_wallets table was created (or later altered) with tenant_id as a
--   UNIQUE column backed by a separate named constraint
--   ("uq_tenant_wallets_tenant_id") rather than — or in addition to — the
--   primary key.  In that schema layout the PK constraint does NOT cover
--   tenant_id, so the ON CONFLICT clause silently mismatches and the INSERT
--   raises:
--
--     ERROR 23505: duplicate key value violates unique constraint
--                  "uq_tenant_wallets_tenant_id"
--
--   This causes getWalletState() to throw, which surfaces as "Wallet could
--   not be loaded." on the tenant billing page.
--
-- ─── Fix ─────────────────────────────────────────────────────────────────────
--
--   Replace the named-constraint form with the column-based form:
--
--     ON CONFLICT (tenant_id) DO NOTHING
--
--   PostgreSQL resolves this against any unique index on the column — whether
--   that is the PK index or a separate UNIQUE index — so the INSERT is safe
--   regardless of how the constraint is named.
--
-- ─── Other changes ───────────────────────────────────────────────────────────
--
--   No changes to RETURNS TABLE, logic, or any other behaviour.
--   All columns, spend sub-queries, flags, and period logic are identical to
--   migration 089.
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
  -- Use ON CONFLICT (tenant_id) — column-based target — instead of the
  -- named-constraint form ON CONFLICT ON CONSTRAINT tenant_wallets_pkey.
  --
  -- The column-based form resolves against any unique index on tenant_id
  -- (PK or a separate UNIQUE constraint such as "uq_tenant_wallets_tenant_id"),
  -- making the INSERT safe regardless of how the constraint is named in the
  -- live database.  The named-constraint form only catches conflicts on the
  -- specific named PK and silently lets other unique-constraint conflicts
  -- through as 23505 errors.

  INSERT INTO public.tenant_wallets (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

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
  -- amount_cents (INTEGER) to preserve sub-credit precision.
  -- balance (NUMERIC, migration 076) is included alongside legacy balance_cents.

  RETURN QUERY
  SELECT
    w.tenant_id::TEXT,
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

    -- spend_today: NUMERIC sum of debits since midnight UTC
    COALESCE((
      SELECT SUM(ABS(l.amount))
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id  = p_tenant_id
        AND  l.amount     < 0
        AND  l.created_at >= v_today_start
    ), 0)::NUMERIC,

    -- spend_this_month: NUMERIC sum of debits since 1st of current month UTC
    COALESCE((
      SELECT SUM(ABS(l.amount))
      FROM   public.wallet_ledger l
      WHERE  l.tenant_id  = p_tenant_id
        AND  l.amount     < 0
        AND  l.created_at >= v_month_start
    ), 0)::NUMERIC,

    -- period_spend: NUMERIC sum of debits since billing period start
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
  'and convenience flags.  Uses ON CONFLICT (tenant_id) DO NOTHING (column-based) '
  'rather than ON CONFLICT ON CONSTRAINT tenant_wallets_pkey to safely handle '
  'deployments where tenant_id is backed by a named UNIQUE constraint rather than '
  'the primary key (fixes 23505 "uq_tenant_wallets_tenant_id" errors).  '
  'balance NUMERIC (migration 076) is included alongside legacy balance_cents. '
  'Spend computed from wallet_ledger.amount (NUMERIC) not amount_cents (INTEGER). '
  'SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.get_wallet_state(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
