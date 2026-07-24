-- ============================================================================
-- credit_wallet — realign the RPC signature with the code + the ledger table
-- ============================================================================
--
-- Background
-- ----------
-- billing/wallet.ts calls:
--
--   rpc("credit_wallet", {
--     p_tenant_id, p_amount_cents, p_entry_type,
--     p_reference_type, p_reference_id, p_note, p_category
--   })
--
-- but the deployed function (from migrations 092/095) has a DIFFERENT signature:
--
--   credit_wallet(p_tenant_id, p_amount_cents, p_reference, p_note,
--                 p_entry_type, p_credit_type)
--
-- PostgREST could not find a function matching the parameters the code sends
-- (PGRST202), so creditWallet() threw and every credit — advertiser wallet
-- top-ups, credit-bundle purchases, refunds, manual adjustments — silently
-- failed: no balance change, no ledger row. The wallet_ledger table already has
-- reference_type / reference_id / category columns, so it is only the FUNCTION
-- that drifted.
--
-- Fix
-- ---
-- Add a NEW overload whose parameter list matches exactly what the code sends,
-- and which writes reference_type, reference_id and category to the ledger.
-- The old overload (p_reference / p_credit_type) is intentionally LEFT IN PLACE
-- — it is still used for subscription vs purchased credit splits. Because the
-- two parameter-name sets are disjoint, PostgREST resolves each call
-- unambiguously to the right overload; there is no ambiguity.
--
-- Credits routed through this overload are all "purchased" balance (top-ups,
-- bundle purchases, refunds, adjustments); subscription grants continue to use
-- the older overload with p_credit_type = 'subscription'.
--
-- Idempotent: CREATE OR REPLACE, so re-running is safe.

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id       text,
  p_amount_cents    numeric,
  p_entry_type      text DEFAULT 'top_up_manual',
  p_reference_type  text DEFAULT 'manual',
  p_reference_id    text DEFAULT NULL,
  p_note            text DEFAULT NULL,
  p_category        text DEFAULT 'topup'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance_after numeric;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'credit_wallet: p_amount_cents must be positive (got %)', p_amount_cents;
  END IF;

  -- ── Upsert wallet row ──────────────────────────────────────────────────────
  -- Credits through this overload are purchased balance. Write both the NUMERIC
  -- columns and the legacy INTEGER balance_cents for backward compatibility.
  INSERT INTO public.tenant_wallets (
    tenant_id, balance_cents, balance,
    subscription_credits, purchased_credits,
    status, currency, updated_at
  )
  VALUES (
    p_tenant_id,
    ROUND(p_amount_cents)::integer,
    p_amount_cents,
    0,
    p_amount_cents,
    'active',
    'EUR',
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents     = public.tenant_wallets.balance_cents + ROUND(p_amount_cents)::integer,
        balance           = COALESCE(public.tenant_wallets.balance, 0) + p_amount_cents,
        purchased_credits = COALESCE(public.tenant_wallets.purchased_credits, 0) + p_amount_cents,
        status            = CASE
                              WHEN public.tenant_wallets.status = 'suspended'
                              THEN 'active'
                              ELSE public.tenant_wallets.status
                            END,
        updated_at        = now()
  RETURNING COALESCE(balance, balance_cents::numeric) INTO v_balance_after;

  -- ── Append ledger row ──────────────────────────────────────────────────────
  -- Unlike the older overload this records reference_type, reference_id AND
  -- category, which is what the application relies on for idempotency
  -- (reference_id = Stripe checkout session) and for classifying entries.
  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type,
    amount_cents, amount,
    balance_after_cents, balance_after,
    reference_type, reference_id, note, category,
    created_at
  ) VALUES (
    p_tenant_id,
    p_entry_type::public.wallet_entry_type,
    ROUND(p_amount_cents)::integer,
    p_amount_cents,
    ROUND(v_balance_after)::integer,
    v_balance_after,
    p_reference_type,
    p_reference_id,
    p_note,
    p_category,
    now()
  );

  RETURN v_balance_after;
END;
$function$;
