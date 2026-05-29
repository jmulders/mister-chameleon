/**
 * Migration 055 — get_wallet_state RPC
 *
 * Adds public.get_wallet_state(p_tenant_id TEXT) — a single RPC that returns
 * the full tenant wallet row plus pre-computed spend summaries and flags, so
 * the billing page dashboard can load wallet state in one round-trip instead
 * of four separate queries (ensureWallet + getCreditBalance + 2× getWalletSpend).
 *
 * ─── What it returns ──────────────────────────────────────────────────────────
 *
 *   All tenant_wallets columns (passthrough — no shape change for callers that
 *   already consume TenantWallet):
 *     balance_cents, currency, status, low_balance_threshold_cents,
 *     monthly_credit_cap_cents, fallback_mode,
 *     auto_reload_enabled, auto_reload_trigger_cents, auto_reload_amount_cents,
 *     auto_reload_monthly_limit_cents, auto_reload_spent_this_month_cents,
 *     auto_reload_month_reset_at, stripe_payment_method_id,
 *     stripe_test_customer_id, stripe_test_payment_method_id,
 *     notify_email, notify_sms, notification_email, notification_phone,
 *     test_mode, created_at, updated_at
 *
 *   Computed extensions:
 *     is_low_balance          — balance < low_balance_threshold_cents
 *                               (and threshold is > 0)
 *     has_payment_method      — stripe_payment_method_id IS NOT NULL
 *     spend_today_cents       — wallet debits since midnight UTC
 *     spend_this_month_cents  — wallet debits since the 1st of the current month UTC
 *     period_spend_cents      — wallet debits since billing period start
 *                               (falls back to month start when no subscription)
 *     period_start            — current_period_start from subscriptions (or month start)
 *     period_end              — current_period_end from subscriptions (or null)
 *
 * ─── Wallet initialization ────────────────────────────────────────────────────
 *
 *   Like ensure_wallet (migration 054), this function inserts a default wallet
 *   row when one does not yet exist (INSERT … ON CONFLICT DO NOTHING), so a
 *   single call to get_wallet_state is safe for billing page views on any tenant.
 *
 * ─── Spend summaries ──────────────────────────────────────────────────────────
 *
 *   Spend is computed from wallet_ledger (negative amount_cents rows) using
 *   three correlated sub-queries:
 *     • today:   created_at >= date_trunc('day',   now() AT TIME ZONE 'UTC')
 *     • month:   created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')
 *     • period:  created_at >= billing period start (from subscriptions or month)
 *
 *   Each sub-query is safe when the tenant has no ledger rows yet — COALESCE
 *   defaults to 0.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   SECURITY DEFINER — runs with the function owner's privileges so the caller
 *   doesn't need direct SELECT access to wallet_ledger or subscriptions.
 *   search_path is pinned to `public` to prevent injection.
 */

-- ── get_wallet_state ──────────────────────────────────────────────────────────

-- Drop any existing version regardless of OUT parameters (avoids 42P13).
DROP FUNCTION IF EXISTS public.get_wallet_state(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_wallet_state(p_tenant_id TEXT)
RETURNS TABLE (
  -- ── Core tenant_wallets columns ──────────────────────────────────────────────
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
  -- ── Computed flags ───────────────────────────────────────────────────────────
  is_low_balance                      BOOLEAN,
  has_payment_method                  BOOLEAN,
  -- ── Spend summaries ──────────────────────────────────────────────────────────
  spend_today_cents                   INTEGER,
  spend_this_month_cents              INTEGER,
  period_spend_cents                  INTEGER,
  -- ── Billing period (from subscriptions, or month boundary) ───────────────────
  period_start                        TIMESTAMPTZ,
  period_end                          TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start   TIMESTAMPTZ;
  v_month_start   TIMESTAMPTZ;
  v_period_start  TIMESTAMPTZ;
  v_period_end    TIMESTAMPTZ;
BEGIN
  -- ── Step 1: Ensure wallet row exists (idempotent) ──────────────────────────
  INSERT INTO public.tenant_wallets (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- ── Step 2: Compute time boundaries (all UTC) ──────────────────────────────
  v_today_start := date_trunc('day',   now() AT TIME ZONE 'UTC');
  v_month_start := date_trunc('month', now() AT TIME ZONE 'UTC');

  -- ── Step 3: Fetch billing period dates from subscriptions ─────────────────
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

  -- ── Step 4: Return the wallet row with computed extensions ─────────────────
  RETURN QUERY
  SELECT
    -- Core wallet columns (pass-through)
    w.tenant_id::TEXT,
    w.balance_cents,
    COALESCE(w.currency, 'EUR')::TEXT                                  AS currency,
    COALESCE(w.status, 'active')::TEXT                                 AS status,
    COALESCE(w.low_balance_threshold_cents, 0)                        AS low_balance_threshold_cents,
    COALESCE(w.monthly_credit_cap_cents, 0)                           AS monthly_credit_cap_cents,
    COALESCE(w.fallback_mode, 'smart_lite')::TEXT                     AS fallback_mode,
    COALESCE(w.auto_reload_enabled, FALSE)                            AS auto_reload_enabled,
    COALESCE(w.auto_reload_trigger_cents, 0)                          AS auto_reload_trigger_cents,
    COALESCE(w.auto_reload_amount_cents, 0)                           AS auto_reload_amount_cents,
    COALESCE(w.auto_reload_monthly_limit_cents, 0)                    AS auto_reload_monthly_limit_cents,
    COALESCE(w.auto_reload_spent_this_month_cents, 0)                 AS auto_reload_spent_this_month_cents,
    w.auto_reload_month_reset_at,
    w.stripe_payment_method_id::TEXT,
    w.stripe_test_customer_id::TEXT,
    w.stripe_test_payment_method_id::TEXT,
    COALESCE(w.notify_email, FALSE)                                   AS notify_email,
    COALESCE(w.notify_sms, FALSE)                                     AS notify_sms,
    w.notification_email::TEXT,
    w.notification_phone::TEXT,
    COALESCE(w.test_mode, 'live')::TEXT                               AS test_mode,
    w.created_at,
    w.updated_at,

    -- Computed flags
    (
      COALESCE(w.low_balance_threshold_cents, 0) > 0
      AND w.balance_cents < COALESCE(w.low_balance_threshold_cents, 0)
    )::BOOLEAN                                                        AS is_low_balance,
    (w.stripe_payment_method_id IS NOT NULL)::BOOLEAN                 AS has_payment_method,

    -- spend_today_cents: sum of debits (negative entries) since midnight UTC
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))
      FROM public.wallet_ledger l
      WHERE l.tenant_id    = p_tenant_id
        AND l.amount_cents < 0
        AND l.created_at  >= v_today_start
    ), 0)::INTEGER                                                    AS spend_today_cents,

    -- spend_this_month_cents: debits since the 1st of the current month UTC
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))
      FROM public.wallet_ledger l
      WHERE l.tenant_id    = p_tenant_id
        AND l.amount_cents < 0
        AND l.created_at  >= v_month_start
    ), 0)::INTEGER                                                    AS spend_this_month_cents,

    -- period_spend_cents: debits since billing period start (or month start)
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))
      FROM public.wallet_ledger l
      WHERE l.tenant_id    = p_tenant_id
        AND l.amount_cents < 0
        AND l.created_at  >= v_period_start
    ), 0)::INTEGER                                                    AS period_spend_cents,

    v_period_start                                                    AS period_start,
    v_period_end                                                      AS period_end

  FROM public.tenant_wallets w
  WHERE w.tenant_id = p_tenant_id;
END;
$$;

-- Allow the service role to call this function.
GRANT EXECUTE ON FUNCTION public.get_wallet_state(TEXT) TO service_role;
