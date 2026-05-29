-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 094: set_tenant_active_override RPC + schema cache reload
--
-- Migrations 092 and 093 changed the database schema (new credit_wallet()
-- signature with p_credit_type; new is_active_override column on
-- tenant_settings) but neither sent a PostgREST schema-reload notification.
-- PostgREST caches the schema at startup and only refreshes on NOTIFY.
-- Without the NOTIFY the REST layer returns:
--   PGRST202 — "function not found in schema cache"  (credit_wallet)
--   PGRST204 — "column not found in schema cache"    (is_active_override)
--
-- Fixes:
--   1. Re-adds the is_active_override column (IF NOT EXISTS — safe no-op if
--      migration 093 already ran).
--   2. Creates set_tenant_active_override() — a SECURITY DEFINER function
--      callable via .rpc().  RPC calls resolve functions at call time and are
--      immune to schema-cache staleness, so this works even if PostgREST
--      still has not reloaded.
--   3. Sends NOTIFY pgrst, 'reload schema' so PostgREST reloads its cache
--      immediately when this migration is applied, fixing all future REST
--      calls including credit_wallet() calls from addCredits().
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Ensure column exists (no-op if migration 093 already ran) ──────────────

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS is_active_override BOOLEAN;

COMMENT ON COLUMN public.tenant_settings.is_active_override
  IS 'Super-admin override for tenant active status. NULL = auto (subscription-driven). TRUE = force active. FALSE = force disabled.';

-- ── 2. RPC function: set_tenant_active_override ───────────────────────────────
--
-- Called by POST /api/billing/admin/set-tenant-status.
-- SECURITY DEFINER runs as the function owner (postgres) so it can bypass RLS.
-- Accepts NULL explicitly (to reset to auto mode).

CREATE OR REPLACE FUNCTION public.set_tenant_active_override(
  p_tenant_id TEXT,
  p_value     BOOLEAN   -- NULL = auto, TRUE = force active, FALSE = force disabled
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tenant_settings
     SET is_active_override = p_value,
         updated_at         = NOW()
   WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.set_tenant_active_override(TEXT, BOOLEAN)
  IS 'Set (or clear) the is_active_override flag on tenant_settings. Callable via Supabase RPC to bypass PostgREST schema-cache staleness.';

-- ── 3. Drop the stale legacy credit_wallet overload ──────────────────────────
--
-- Migration 092 added the new 6-param credit_wallet via CREATE OR REPLACE with
-- a different parameter list.  In Postgres this creates a NEW overload instead
-- of replacing the old 7-param function, leaving both in pg_catalog.
-- PostgREST sees ambiguity or — if it loaded before 092 ran — only the old one.
-- Dropping the old signature here forces unambiguous resolution after reload.

-- Drop all overloads so return type change doesn't fail.
DROP FUNCTION IF EXISTS public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT);

-- ── 4. Re-ensure the new credit_wallet signature exists (idempotent) ──────────

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id    TEXT,
  p_amount_cents INTEGER,
  p_reference    TEXT    DEFAULT NULL,
  p_note         TEXT    DEFAULT NULL,
  p_entry_type   TEXT    DEFAULT 'top_up_manual',
  p_credit_type  TEXT    DEFAULT 'purchased'
)
RETURNS TABLE (
  success             BOOLEAN,
  balance_after_cents INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_after INTEGER;
BEGIN
  INSERT INTO public.tenant_wallets (
    tenant_id, balance_cents, subscription_credits, purchased_credits,
    status, currency, updated_at
  )
  VALUES (
    p_tenant_id,
    p_amount_cents,
    CASE WHEN p_credit_type = 'subscription' THEN p_amount_cents ELSE 0 END,
    CASE WHEN p_credit_type = 'purchased'    THEN p_amount_cents ELSE 0 END,
    'active', 'EUR', now()
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents        = public.tenant_wallets.balance_cents + p_amount_cents,
        subscription_credits = public.tenant_wallets.subscription_credits
          + CASE WHEN p_credit_type = 'subscription' THEN p_amount_cents ELSE 0 END,
        purchased_credits    = public.tenant_wallets.purchased_credits
          + CASE WHEN p_credit_type = 'purchased'    THEN p_amount_cents ELSE 0 END,
        status               = CASE
                                 WHEN public.tenant_wallets.status = 'suspended'
                                 THEN 'active'::public.wallet_status
                                 ELSE public.tenant_wallets.status
                               END,
        updated_at           = now()
  RETURNING balance_cents INTO v_balance_after;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, note, created_at
  ) VALUES (
    p_tenant_id, p_entry_type::public.wallet_entry_type, p_amount_cents,
    v_balance_after, p_reference, p_note, now()
  );

  RETURN QUERY SELECT TRUE, v_balance_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

-- ── 5. Reload PostgREST schema cache ──────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
