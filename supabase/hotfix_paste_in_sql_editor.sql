-- ============================================================================
-- HOTFIX — paste this entire file into Supabase Dashboard → SQL Editor → Run
--
-- Fixes production blockers without requiring `supabase db push`:
--
--   1. get_wallet_state 42702 "column reference 'tenant_id' is ambiguous"
--      → Replaces Step 1 (inline INSERT ON CONFLICT) with PERFORM ensure_wallet()
--        which runs in its own scope with no conflicting OUT parameter.
--
--   2. demo_instances PGRST204 "Could not find the 'favicon_url' column"
--      → Adds all columns written by createDemoInstance that may be missing
--        from the live table (ADD COLUMN IF NOT EXISTS is safe to re-run).
--
--   3. get_wallet_breakdown — filter out null enrichment_type rows
--      → Adds IS NOT NULL guard so the billing breakdown never returns
--        unclassifiable legacy rows that crash featureName() in the UI.
--
--   4. demo_instances id — change column type from uuid to text
--      → The table was created with id uuid but the code generates short
--        alphanumeric IDs.  uuid → text cast preserves existing rows.
--
--   5. credit_wallet 42702 "column reference 'tenant_id' is ambiguous"
--      → Rewrites credit_wallet with p_-prefixed params and explicit table
--        aliases (tw.*, wl.*) so no bare column name clashes with a parameter.
--
-- After pasting: billing page loads, demos generate, Add Credits works.
-- Still run `supabase db push` afterward to apply all migrations formally.
-- ============================================================================

-- ── FIX 1: get_wallet_state — 42702 ambiguous tenant_id ──────────────────────

CREATE OR REPLACE FUNCTION public.get_wallet_state(p_tenant_id TEXT)
RETURNS TABLE (
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
  is_low_balance                      BOOLEAN,
  has_payment_method                  BOOLEAN,
  spend_today_cents                   INTEGER,
  spend_this_month_cents              INTEGER,
  period_spend_cents                  INTEGER,
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
  -- Step 1: Ensure wallet row exists.
  -- Uses ensure_wallet() in its own scope — avoids 42702 from RETURNS TABLE
  -- declaring "tenant_id TEXT" as an OUT parameter that clashes with the
  -- ON CONFLICT (tenant_id) conflict-target in an inline INSERT.
  PERFORM public.ensure_wallet(p_tenant_id);

  -- Step 2: Compute time boundaries (all UTC).
  v_today_start := date_trunc('day',   now() AT TIME ZONE 'UTC');
  v_month_start := date_trunc('month', now() AT TIME ZONE 'UTC');

  -- Step 3: Fetch billing period dates from subscriptions.
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

  -- Step 4: Return wallet row with computed extensions.
  -- All column references use qualified aliases (w.*, l.*, s.*).
  RETURN QUERY
  SELECT
    w.tenant_id::TEXT,
    w.balance_cents,
    COALESCE(w.currency, 'EUR')::TEXT,
    COALESCE(w.status, 'active')::TEXT,
    COALESCE(w.low_balance_threshold_cents, 0),
    COALESCE(w.monthly_credit_cap_cents, 0),
    COALESCE(w.fallback_mode, 'smart_lite')::TEXT,
    COALESCE(w.auto_reload_enabled, FALSE),
    COALESCE(w.auto_reload_trigger_cents, 0),
    COALESCE(w.auto_reload_amount_cents, 0),
    COALESCE(w.auto_reload_monthly_limit_cents, 0),
    COALESCE(w.auto_reload_spent_this_month_cents, 0),
    w.auto_reload_month_reset_at,
    w.stripe_payment_method_id::TEXT,
    w.stripe_test_customer_id::TEXT,
    w.stripe_test_payment_method_id::TEXT,
    COALESCE(w.notify_email, FALSE),
    COALESCE(w.notify_sms, FALSE),
    w.notification_email::TEXT,
    w.notification_phone::TEXT,
    COALESCE(w.test_mode, 'live')::TEXT,
    w.created_at,
    w.updated_at,
    (
      COALESCE(w.low_balance_threshold_cents, 0) > 0
      AND w.balance_cents < COALESCE(w.low_balance_threshold_cents, 0)
    )::BOOLEAN,
    (w.stripe_payment_method_id IS NOT NULL)::BOOLEAN,
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))
      FROM public.wallet_ledger l
      WHERE l.tenant_id   = p_tenant_id
        AND l.amount_cents < 0
        AND l.created_at  >= v_today_start
    ), 0)::INTEGER,
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))
      FROM public.wallet_ledger l
      WHERE l.tenant_id   = p_tenant_id
        AND l.amount_cents < 0
        AND l.created_at  >= v_month_start
    ), 0)::INTEGER,
    COALESCE((
      SELECT SUM(ABS(l.amount_cents))
      FROM public.wallet_ledger l
      WHERE l.tenant_id   = p_tenant_id
        AND l.amount_cents < 0
        AND l.created_at  >= v_period_start
    ), 0)::INTEGER,
    v_period_start,
    v_period_end
  FROM public.tenant_wallets w
  WHERE w.tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_state(TEXT) TO service_role;


-- ── FIX 2: demo_instances — add all columns that createDemoInstance writes ────

CREATE TABLE IF NOT EXISTS public.demo_instances (
  id               text        PRIMARY KEY,
  source_url       text        NOT NULL,
  site_name        text        NOT NULL DEFAULT '',
  site_description text        NOT NULL DEFAULT '',
  site_category    text        NOT NULL DEFAULT 'general',
  primary_color    text        NOT NULL DEFAULT '#3b82f6',
  secondary_color  text        NOT NULL DEFAULT '#1e3a8a',
  logo_url         text,
  favicon_url      text,
  scenarios        jsonb       NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  view_count       integer     NOT NULL DEFAULT 0,
  generated_by     text,
  generation_ms    integer
);

ALTER TABLE public.demo_instances
  ADD COLUMN IF NOT EXISTS source_url       text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_name        text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_description text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_category    text        NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS primary_color    text        NOT NULL DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS secondary_color  text        NOT NULL DEFAULT '#1e3a8a',
  ADD COLUMN IF NOT EXISTS logo_url         text,
  ADD COLUMN IF NOT EXISTS favicon_url      text,
  ADD COLUMN IF NOT EXISTS scenarios        jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_at       timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at       timestamptz,
  ADD COLUMN IF NOT EXISTS view_count       integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generated_by     text,
  ADD COLUMN IF NOT EXISTS generation_ms    integer;

CREATE INDEX IF NOT EXISTS demo_instances_expires_idx    ON public.demo_instances (expires_at);
CREATE INDEX IF NOT EXISTS demo_instances_source_url_idx ON public.demo_instances (source_url);

-- ── FIX 3: get_wallet_breakdown — exclude null enrichment_type rows ──────────
--
-- Some legacy enrichment_usage rows have a NULL enrichment_type.
-- GROUP BY includes NULL as its own group, producing a row that crashes
-- the billing UI's featureName() call.  Adding IS NOT NULL silently drops
-- these unclassifiable rows from the breakdown result.

-- DROP required: CREATE OR REPLACE cannot change OUT parameter definitions (42P13).
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
  v_period_key := COALESCE(p_period_key, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'));
  v_from := ((v_period_key || '-01')::DATE)::TIMESTAMPTZ AT TIME ZONE 'UTC';
  v_to   := v_from + INTERVAL '1 month';

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
    AND eu.enrichment_type IS NOT NULL
  GROUP BY eu.enrichment_type
  ORDER BY SUM(eu.total_price_cents) DESC, eu.enrichment_type ASC;

EXCEPTION WHEN undefined_table THEN
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_breakdown(TEXT, TEXT) TO service_role;

-- ── FIX 4: demo_instances — change id from uuid to text ──────────────────────
--
-- The live table has `id uuid` but the code generates short alphanumeric IDs.
-- This alter lets demo/store.ts use either short IDs or UUIDs going forward.
-- uuid values cast cleanly to text — existing rows are unaffected.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'demo_instances'
      AND  column_name  = 'id'
      AND  data_type    = 'uuid'
  ) THEN
    ALTER TABLE public.demo_instances
      ALTER COLUMN id TYPE text USING id::text;
    RAISE NOTICE 'demo_instances.id changed from uuid to text';
  ELSE
    RAISE NOTICE 'demo_instances.id is already text — skipped';
  END IF;
END;
$$;

-- ── FIX 5: credit_wallet — PGRST203 ambiguous overload + 42702 ───────────────
--
-- Two problems:
--   a) 42702: old credit_wallet used bare param names that clash with column names.
--   b) PGRST203: CREATE OR REPLACE added a new overload (integer params) alongside
--      the old one (bigint params, different order) instead of replacing it, because
--      Postgres treats different parameter types as a different function signature.
--
-- Fix: DROP both overloads by their exact signatures, then CREATE the single
-- canonical version.  IF EXISTS on both DROPs makes this safe to re-run.

DROP FUNCTION IF EXISTS public.credit_wallet(TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_entry_type     TEXT    DEFAULT 'top_up_manual',
  p_reference_type TEXT    DEFAULT 'manual',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT 'topup'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_after INTEGER;
  v_is_simulated  BOOLEAN;
BEGIN
  v_is_simulated := (p_entry_type LIKE 'sim_%');

  -- Upsert wallet row with explicit alias tw so no bare column name
  -- can be confused with a parameter name.
  INSERT INTO public.tenant_wallets AS tw (tenant_id, balance_cents, status, updated_at)
  VALUES (p_tenant_id, p_amount_cents, 'active', now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents = tw.balance_cents + EXCLUDED.balance_cents,
        status        = CASE
                          WHEN tw.status = 'suspended' THEN 'active'
                          ELSE tw.status
                        END,
        updated_at    = now()
  RETURNING tw.balance_cents
  INTO v_balance_after;

  -- Ledger entry.
  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, category, amount_cents, balance_after_cents,
    reference_type, reference_id, note, simulated, created_at
  ) VALUES (
    p_tenant_id, p_entry_type, p_category, p_amount_cents, v_balance_after,
    p_reference_type, p_reference_id, p_note, v_is_simulated, now()
  );

  RETURN v_balance_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- Done. All five blockers are now fixed in the live DB.
