/**
 * Migration 060 — get_wallet_state: fix ambiguous tenant_id (code 42702)
 *
 * ─── Root cause ───────────────────────────────────────────────────────────────
 *
 *   The function is declared as:
 *
 *     CREATE OR REPLACE FUNCTION public.get_wallet_state(p_tenant_id TEXT)
 *     RETURNS TABLE (
 *       tenant_id TEXT,   ← output column
 *       ...
 *     )
 *
 *   In PostgreSQL, RETURNS TABLE columns are implemented as implicit OUT
 *   parameters.  Inside the function body "tenant_id" therefore refers to
 *   BOTH the OUT parameter AND any table column named tenant_id.
 *
 *   The crash occurs at:
 *
 *     INSERT INTO public.tenant_wallets (tenant_id)   -- column list: OK
 *     VALUES (p_tenant_id)                            -- parameter:   OK
 *     ON CONFLICT (tenant_id) DO NOTHING;             -- AMBIGUOUS ← 42702
 *
 *   PostgreSQL cannot determine whether the conflict-target "tenant_id"
 *   refers to the table column or the OUT parameter.
 *
 * ─── Fix ──────────────────────────────────────────────────────────────────────
 *
 *   Replace the inline INSERT … ON CONFLICT DO NOTHING with:
 *
 *     PERFORM public.ensure_wallet(p_tenant_id);
 *
 *   ensure_wallet (migration 054) performs the same idempotent upsert.
 *   Because it is a separate function it has its own scope — its body does
 *   not see get_wallet_state's OUT parameters, so there is no ambiguity.
 *
 *   All other references in get_wallet_state already use qualified aliases
 *   (w.tenant_id, l.tenant_id, s.tenant_id) and are unaffected.
 *
 * ─── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   CREATE OR REPLACE FUNCTION is always safe to re-run.
 *   Behaviour is identical to migration 055 except Step 1 delegates to
 *   ensure_wallet instead of inlining the INSERT.
 */

-- Drop any existing version regardless of OUT parameters (avoids 42P13).
-- Migration 055 may have applied a different column set; drop before replacing.
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
  -- ── Step 1: Ensure wallet row exists ──────────────────────────────────────────
  --
  -- Delegates to ensure_wallet() instead of inlining INSERT … ON CONFLICT.
  --
  -- Why: RETURNS TABLE declares "tenant_id TEXT" as an OUT parameter.
  -- PostgreSQL resolves bare "tenant_id" inside this function body as ambiguous
  -- between the OUT parameter and any table column of the same name (error 42702).
  -- An inline "ON CONFLICT (tenant_id)" triggers this at runtime.
  --
  -- ensure_wallet() performs the identical idempotent upsert in its own scope
  -- where no OUT parameter named "tenant_id" exists — no ambiguity.
  --
  -- PERFORM discards the SETOF return value; we only need the side-effect
  -- (wallet row created if absent).

  PERFORM public.ensure_wallet(p_tenant_id);

  -- ── Step 2: Compute time boundaries (all UTC) ──────────────────────────────

  v_today_start := date_trunc('day',   now() AT TIME ZONE 'UTC');
  v_month_start := date_trunc('month', now() AT TIME ZONE 'UTC');

  -- ── Step 3: Fetch billing period dates from subscriptions ─────────────────
  --
  -- s.tenant_id qualified with alias — unambiguous vs the OUT parameter.

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
  --
  -- All column references use the alias w.* (tenant_wallets) or l.* (ledger).
  -- No bare "tenant_id" appears — the OUT parameter is never shadowed.

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

    -- spend_today_cents: debits (negative entries) since midnight UTC
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))
      FROM public.wallet_ledger l
      WHERE l.tenant_id   = p_tenant_id
        AND l.amount_cents < 0
        AND l.created_at  >= v_today_start
    ), 0)::INTEGER                                                    AS spend_today_cents,

    -- spend_this_month_cents: debits since the 1st of the current month UTC
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))
      FROM public.wallet_ledger l
      WHERE l.tenant_id   = p_tenant_id
        AND l.amount_cents < 0
        AND l.created_at  >= v_month_start
    ), 0)::INTEGER                                                    AS spend_this_month_cents,

    -- period_spend_cents: debits since billing period start (or month start)
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))
      FROM public.wallet_ledger l
      WHERE l.tenant_id   = p_tenant_id
        AND l.amount_cents < 0
        AND l.created_at  >= v_period_start
    ), 0)::INTEGER                                                    AS period_spend_cents,

    v_period_start                                                    AS period_start,
    v_period_end                                                      AS period_end

  FROM public.tenant_wallets w
  WHERE w.tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_state(TEXT) TO service_role;
