/**
 * Migration 054 — ensure_wallet RPC
 *
 * Adds the public.ensure_wallet(p_tenant_id TEXT) function that atomically
 * creates a tenant_wallets row with safe defaults when one does not yet exist,
 * or returns the existing row if it does.
 *
 * ─── Why a dedicated RPC? ─────────────────────────────────────────────────────
 *
 *   Application code that calls UPDATE on tenant_wallets silently does nothing
 *   when no row exists yet (no error, 0 rows affected).  Billing flows that
 *   save wallet cap / auto-reload / notification settings all follow this pattern
 *   and would lose the user's changes for tenants whose wallets haven't been
 *   lazily initialized.
 *
 *   ensure_wallet() fixes this by guaranteeing a row exists before any UPDATE
 *   is attempted.  It is:
 *     • Idempotent   — safe to call multiple times; subsequent calls are no-ops.
 *     • Race-safe    — uses INSERT … ON CONFLICT DO NOTHING so two concurrent
 *                      calls don't both try to INSERT.
 *     • Non-disruptive — never overwrites an existing row's data.
 *
 * ─── Defaults ─────────────────────────────────────────────────────────────────
 *
 *   When a new row is created the tenant_wallets DB defaults apply:
 *     balance_cents                  = 0
 *     status                         = 'active'
 *     monthly_credit_cap_cents        = 0      (unlimited)
 *     fallback_mode                  = 'smart_lite'
 *     auto_reload_enabled            = false
 *     low_balance_threshold_cents     = 0
 *     notify_email / notify_sms      = false
 *     (all other columns at their column-level defaults)
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   SELECT * FROM public.ensure_wallet('tenant-uuid-here');
 *   -- Returns exactly one row: the existing or newly created wallet.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   SECURITY DEFINER so it can INSERT into tenant_wallets from a service-role
 *   context without exposing a raw INSERT privilege to callers.
 *   search_path is pinned to `public` to prevent search-path injection.
 */

-- ── ensure_wallet ─────────────────────────────────────────────────────────────

-- Drop any existing version regardless of return type.
-- CREATE OR REPLACE FUNCTION cannot change the return type (Postgres 42P13),
-- so we drop first. CASCADE covers any dependent objects that reference this
-- function's signature (e.g. views, other functions calling it).
DROP FUNCTION IF EXISTS public.ensure_wallet(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_wallet(
  p_tenant_id TEXT
)
RETURNS SETOF public.tenant_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert with column-level defaults if no row exists.
  -- ON CONFLICT DO NOTHING is race-safe: a concurrent INSERT wins, and the
  -- SELECT below returns whichever row was committed first.
  INSERT INTO public.tenant_wallets (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Always return the current row (existing or just created).
  RETURN QUERY
  SELECT * FROM public.tenant_wallets
  WHERE tenant_id = p_tenant_id;
END;
$$;

-- Allow the service role to call this function.
GRANT EXECUTE ON FUNCTION public.ensure_wallet(TEXT) TO service_role;
