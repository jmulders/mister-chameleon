/**
 * Migration 059 — Wallet RPCs: eliminate all ambiguous column references
 *
 * Root cause of the error:
 *   "column reference 'tenant_id' is ambiguous (code: 42702)"
 *
 *   PostgreSQL raises 42702 when a bare column name in a SQL statement inside a
 *   PL/pgSQL function could resolve to more than one thing — typically when the
 *   live function has parameter names that exactly match column names (e.g. a
 *   `tenant_id TEXT` parameter in a function that also queries a table with a
 *   `tenant_id` column).
 *
 *   The functions from migrations 043/047 (before the p_ prefix convention was
 *   established) used bare `tenant_id`, `status`, `balance_cents` as parameter
 *   names.  Any of those that survive on the live DB will produce 42702 on
 *   execution.
 *
 * Affected functions:
 *   public.credit_wallet(...)   — confirmed failing (Add Credits flow)
 *   public.debit_wallet(...)    — same pattern; audited and fixed
 *   public.get_wallet_state(...)— already uses p_ prefixes + table aliases; clean
 *
 * What this migration does:
 *   1. Rewrites credit_wallet so every SQL statement uses explicit table aliases
 *      (tw.*, wl.*) and all parameters carry the p_ prefix.
 *   2. Rewrites debit_wallet with the same discipline.
 *   3. Documents that get_wallet_state was audited and is clean.
 *
 * Idempotency:
 *   CREATE OR REPLACE FUNCTION is always safe to re-run.
 *   Both functions are SECURITY DEFINER with pinned search_path.
 *
 * ─── Ambiguity patterns fixed ─────────────────────────────────────────────────
 *
 *   OLD (ambiguous):
 *     INSERT INTO tenant_wallets (tenant_id, ...) VALUES (p_tenant_id, ...)
 *     ON CONFLICT (tenant_id) DO UPDATE
 *       SET balance_cents = tenant_wallets.balance_cents + EXCLUDED.balance_cents
 *       -- PostgreSQL's planner can confuse `tenant_wallets.balance_cents`
 *       -- with a local variable when a prior version used `balance_cents` as
 *       -- a parameter name.  The RETURNING clause without an alias can also
 *       -- collide with PL/pgSQL SELECT-INTO targets.
 *
 *   NEW (unambiguous):
 *     All table references fully qualified with alias: tw.balance_cents, wl.*
 *     All parameters uniformly p_-prefixed.
 *     RETURNING clause uses alias-qualified column: tw.balance_cents.
 *     SELECT INTO uses alias: FROM public.tenant_wallets tw WHERE tw.tenant_id = p_tenant_id.
 */

-- ── credit_wallet — fully unambiguous rewrite ────────────────────────────────
-- Drop all overloads first so we can safely change return type.
DROP FUNCTION IF EXISTS public.credit_wallet(text, integer, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.credit_wallet(text, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_entry_type     TEXT    DEFAULT 'top_up_manual',
  p_reference_type TEXT    DEFAULT 'manual',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT 'topup'
)
RETURNS INTEGER          -- new balance_cents after the credit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_after INTEGER;
  v_is_simulated  BOOLEAN;
BEGIN
  -- Derive simulated flag from entry_type prefix — never from a bare column check.
  v_is_simulated := (p_entry_type LIKE 'sim_%');

  -- ── Upsert wallet row ────────────────────────────────────────────────────────
  --
  -- Uses explicit table aliases throughout so no bare column name can shadow
  -- a function parameter.
  --
  -- tw = the existing (or newly inserted) row.
  -- EXCLUDED = the proposed row from the VALUES clause.
  --
  -- On INSERT  : writes p_amount_cents as the starting balance.
  -- On CONFLICT: adds p_amount_cents to the existing balance; reactivates if
  --              the wallet was suspended.
  --
  -- RETURNING tw.balance_cents → unambiguous: refers to the column in the table,
  -- not any local variable.

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

  -- ── Ledger entry ─────────────────────────────────────────────────────────────
  --
  -- All column names are unambiguous because we are not in an ON CONFLICT context
  -- here.  Still using explicit column list (no SELECT *) for clarity.

  INSERT INTO public.wallet_ledger (
    tenant_id,
    entry_type,
    category,
    amount_cents,
    balance_after_cents,
    reference_type,
    reference_id,
    note,
    simulated,
    created_at
  ) VALUES (
    p_tenant_id,
    p_entry_type,
    p_category,
    p_amount_cents,
    v_balance_after,
    p_reference_type,
    p_reference_id,
    p_note,
    v_is_simulated,
    now()
  );

  RETURN v_balance_after;
END;
$$;

COMMENT ON FUNCTION public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Atomically credit tenant wallet and append a ledger entry. '
  'Parameters: p_tenant_id, p_amount_cents, p_entry_type, p_reference_type, '
  'p_reference_id, p_note, p_category. '
  'Reactivates suspended wallets. Returns new balance_cents. '
  'SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- ── debit_wallet — fully unambiguous rewrite ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_reference_type TEXT    DEFAULT 'enrichment_usage',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT NULL
)
RETURNS INTEGER          -- new balance_cents after the debit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before INTEGER;
  v_balance_after  INTEGER;
  v_status         TEXT;
BEGIN
  -- ── Lock wallet row for update ───────────────────────────────────────────────
  --
  -- Alias `tw` makes it explicit that balance_cents and status are table columns,
  -- not local variables.  FOR UPDATE ensures atomicity under concurrent debits.

  SELECT tw.balance_cents,
         tw.status::TEXT
  INTO   v_balance_before,
         v_status
  FROM   public.tenant_wallets tw
  WHERE  tw.tenant_id = p_tenant_id
  FOR UPDATE;

  -- ── Guard: wallet must exist ─────────────────────────────────────────────────

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found for tenant %', p_tenant_id;
  END IF;

  -- ── Guard: wallet must be active ─────────────────────────────────────────────

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'wallet_not_active: status=% for tenant %', v_status, p_tenant_id;
  END IF;

  -- ── Guard: sufficient balance ─────────────────────────────────────────────────

  IF v_balance_before < p_amount_cents THEN
    RAISE EXCEPTION
      'insufficient_wallet_balance: balance=% requested=% for tenant %',
      v_balance_before, p_amount_cents, p_tenant_id;
  END IF;

  v_balance_after := v_balance_before - p_amount_cents;

  -- ── Deduct from wallet ───────────────────────────────────────────────────────
  --
  -- Alias `tw` used in WHERE so `tenant_id = p_tenant_id` is unambiguous.

  UPDATE public.tenant_wallets AS tw
  SET    balance_cents = v_balance_after,
         updated_at    = now()
  WHERE  tw.tenant_id = p_tenant_id;

  -- ── Ledger entry — negative amount for debits ────────────────────────────────

  INSERT INTO public.wallet_ledger (
    tenant_id,
    entry_type,
    category,
    amount_cents,
    balance_after_cents,
    reference_type,
    reference_id,
    note,
    simulated,
    created_at
  ) VALUES (
    p_tenant_id,
    'enrichment_debit',
    p_category,
    -p_amount_cents,      -- stored negative so SUM on ledger = net balance movement
    v_balance_after,
    p_reference_type,
    p_reference_id,
    p_note,
    FALSE,                -- enrichment debits are never simulated via this path
    now()
  );

  RETURN v_balance_after;
END;
$$;

COMMENT ON FUNCTION public.debit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT) IS
  'Atomically debit tenant wallet with row-level lock and append a ledger entry. '
  'Parameters: p_tenant_id, p_amount_cents, p_reference_type, p_reference_id, '
  'p_note, p_category. '
  'Raises: wallet_not_found | wallet_not_active | insufficient_wallet_balance. '
  'Returns new balance_cents. SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.debit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- ── get_wallet_state — audit result: clean, no changes needed ────────────────
--
-- Audited against the 42702 ambiguity pattern:
--   ✓ All parameters use p_ prefix (p_tenant_id).
--   ✓ All table references use alias w.* for tenant_wallets and l.* for wallet_ledger.
--   ✓ No bare column references in WHERE or SET clauses.
--   ✓ RETURNS TABLE columns shadow nothing — all declared with distinct names.
--   ✓ No INSERT or ON CONFLICT clauses that could produce ambiguity.
--
-- No DDL change needed.  Documented here for audit trail completeness.

-- ── ensure_wallet — audit result: clean, no changes needed ───────────────────
--
-- Uses only `p_tenant_id` as a parameter.
-- INSERT uses (tenant_id) column with VALUES (p_tenant_id) — unambiguous.
-- RETURN QUERY SELECT * FROM tenant_wallets WHERE tenant_id = p_tenant_id — unambiguous.
-- No change needed.

-- ── get_wallet_breakdown — audit result: clean, no changes needed ─────────────
--
-- Only parameter is p_tenant_id, p_period_key — both p_-prefixed.
-- All column references via alias `eu.*`.
-- EXECUTE (dynamic SQL) used to read enrichment_usage — fully qualified.
-- No change needed.

-- ── get_wallet_ledger — audit result: clean, no changes needed ───────────────
--
-- Only parameters p_tenant_id, p_limit, p_offset — all p_-prefixed.
-- Dynamic SQL block uses $1/$2/$3 positional params inside EXECUTE — no name clash.
-- No change needed.
