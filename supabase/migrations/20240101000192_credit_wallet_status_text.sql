-- credit_wallet (6 arguments): the status column is text, not wallet_status.
--
-- tenant_wallets.status started as the enum wallet_status and is a text column
-- today (default 'not_initialized'). This overload still cast the reactivated
-- status to the enum:
--
--     CASE WHEN status = 'suspended' THEN 'active'::public.wallet_status
--          ELSE status END
--
-- One branch an enum, the other text: Postgres refuses the statement before it
-- runs ("CASE types text and wallet_status cannot be matched", 42804). So every
-- call failed, not only the ones that reactivate a wallet. billing/usage.ts
-- addCredits() calls this overload, which means no AI credit purchase and no
-- plan credit grant could be written. Found while adding Mollie: the first
-- paid credit bundle on the development database failed on it.
--
-- The literal is left untyped now, so it takes the type of the column, text
-- or enum. Nothing else in the function changes. CREATE OR REPLACE keeps the
-- privileges set in migration 186.

CREATE OR REPLACE FUNCTION public.credit_wallet(p_tenant_id text, p_amount_cents numeric, p_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_entry_type text DEFAULT 'top_up_manual'::text, p_credit_type text DEFAULT 'purchased'::text)
 RETURNS TABLE(success boolean, balance_after_cents numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance_after NUMERIC;
BEGIN
  -- ── Upsert wallet row ──────────────────────────────────────────────────────
  --
  -- Write both NUMERIC columns (balance, subscription_credits,
  -- purchased_credits) and the legacy INTEGER column (balance_cents) so old
  -- code reading balance_cents still gets a value close to the true balance.

  INSERT INTO public.tenant_wallets (
    tenant_id,
    balance_cents,
    balance,
    subscription_credits,
    purchased_credits,
    status,
    currency,
    updated_at
  )
  VALUES (
    p_tenant_id,
    ROUND(p_amount_cents)::INTEGER,
    p_amount_cents,
    CASE WHEN p_credit_type = 'subscription' THEN p_amount_cents ELSE 0 END,
    CASE WHEN p_credit_type = 'purchased'    THEN p_amount_cents ELSE 0 END,
    'active',
    'EUR',
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents        = public.tenant_wallets.balance_cents
                                 + ROUND(p_amount_cents)::INTEGER,
        balance              = COALESCE(public.tenant_wallets.balance, 0)
                                 + p_amount_cents,
        subscription_credits = COALESCE(public.tenant_wallets.subscription_credits, 0)
          + CASE WHEN p_credit_type = 'subscription' THEN p_amount_cents ELSE 0 END,
        purchased_credits    = COALESCE(public.tenant_wallets.purchased_credits, 0)
          + CASE WHEN p_credit_type = 'purchased'    THEN p_amount_cents ELSE 0 END,
        status               = CASE
                                 WHEN public.tenant_wallets.status = 'suspended'
                                 THEN 'active'
                                 ELSE public.tenant_wallets.status
                               END,
        updated_at           = now()
  RETURNING COALESCE(balance, balance_cents::NUMERIC) INTO v_balance_after;

  -- ── Append ledger row ──────────────────────────────────────────────────────
  --
  -- Write both NUMERIC columns (amount, balance_after) introduced by
  -- migration 076 and the legacy INTEGER columns (amount_cents,
  -- balance_after_cents) for backward compatibility.

  INSERT INTO public.wallet_ledger (
    tenant_id,
    entry_type,
    amount_cents,
    amount,
    balance_after_cents,
    balance_after,
    reference_type,
    note,
    created_at
  ) VALUES (
    p_tenant_id,
    p_entry_type::public.wallet_entry_type,
    ROUND(p_amount_cents)::INTEGER,
    p_amount_cents,
    ROUND(v_balance_after)::INTEGER,
    v_balance_after,
    p_reference,
    p_note,
    now()
  );

  RETURN QUERY SELECT TRUE, v_balance_after;
END;
$function$;
