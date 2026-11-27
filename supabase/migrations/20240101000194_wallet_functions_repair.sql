-- Six wallet functions repaired: five for the text status column, one for a counter.
--
-- The same fault as migration 192, in the functions that migration did not
-- reach. tenant_wallets.status is a text column; each of these still cast one
-- branch of a CASE to the enum wallet_status and left the other as the column:
--
--     CASE WHEN status = 'suspended' THEN 'active'::public.wallet_status
--          ELSE status END
--
-- Postgres refuses such a statement before it runs ("CASE types text and
-- wallet_status cannot be matched", 42804), so every call failed:
--
--   process_wallet_reload_success   credits a wallet after a successful
--                                   automatic top-up. With it broken, a tenant
--                                   was charged and nothing was added, with
--                                   Stripe as well as with Mollie.
--   sim_credit_wallet, sim_debit_wallet, sim_set_wallet_balance,
--   sim_trigger_reload_success      the wallet simulator of the admin.
--
-- Found while adding the automatic top-up through Mollie: the first paid one
-- on the development database failed on it.
--
-- The literals are left untyped now, so they take the type of the column.
-- Nothing else in the functions changes. CREATE OR REPLACE keeps the
-- privileges set in migration 186. debit_wallet also contains the word
-- wallet_status, but only as the name of an output column: it is not touched.

-- ── process_wallet_reload_success(uuid,text) ──

CREATE OR REPLACE FUNCTION public.process_wallet_reload_success(p_attempt_id uuid, p_stripe_payment_intent_id text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_attempt  public.wallet_reload_attempts%ROWTYPE;
  v_balance  INTEGER;
BEGIN
  -- ── 1. Lock + update attempt (idempotency gate) ──────────────────────────
  --
  -- Only transitions pending/processing → succeeded.
  -- Returns -1 if already processed (webhook delivered more than once).

  UPDATE public.wallet_reload_attempts
  SET
    status                   = 'succeeded',
    stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
    updated_at               = now()
  WHERE
    id     = p_attempt_id
    AND status IN ('pending', 'processing')
  RETURNING * INTO v_attempt;

  IF NOT FOUND THEN
    RETURN -1; -- already processed
  END IF;

  -- ── 2. Credit wallet (atomic upsert + reactivation) ─────────────────────

  INSERT INTO public.tenant_wallets (tenant_id, balance_cents, status, updated_at)
  VALUES (v_attempt.tenant_id, v_attempt.reload_amount_cents, 'active', now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET
    balance_cents = public.tenant_wallets.balance_cents + v_attempt.reload_amount_cents,
    status        = CASE
                      WHEN public.tenant_wallets.status = 'suspended'
                        THEN 'active'
                      ELSE public.tenant_wallets.status
                    END,
    updated_at    = now()
  RETURNING balance_cents INTO v_balance;

  -- ── 3. Ledger entry ───────────────────────────────────────────────────────

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
    v_attempt.tenant_id,
    'top_up_auto_reload',
    'topup',          -- auto-reload is always a top-up category
    v_attempt.reload_amount_cents,
    v_balance,
    'wallet_reload_attempt',
    v_attempt.id::TEXT,
    format('Auto-reload: €%s (intent: %s)',
           to_char(v_attempt.reload_amount_cents / 100.0, 'FM999999990.00'),
           COALESCE(p_stripe_payment_intent_id, 'unknown')),
    FALSE,            -- real payment, not simulated
    now()
  );

  RETURN v_balance;
END;
$function$;

-- ── sim_credit_wallet(text,integer,text) ──

CREATE OR REPLACE FUNCTION public.sim_credit_wallet(p_tenant_id text, p_amount_cents integer, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_new_balance INTEGER;
  v_mode        public.wallet_test_mode;
BEGIN
  SELECT test_mode INTO v_mode
    FROM public.tenant_wallets
   WHERE tenant_id = p_tenant_id;

  IF v_mode IS DISTINCT FROM 'test_simulated' THEN
    RAISE EXCEPTION 'wallet_not_in_test_mode';
  END IF;

  UPDATE public.tenant_wallets
     SET balance_cents = balance_cents + p_amount_cents,
         status        = CASE WHEN status = 'suspended' THEN 'active' ELSE status END,
         updated_at    = now()
   WHERE tenant_id     = p_tenant_id
  RETURNING balance_cents INTO v_new_balance;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, note, simulated
  ) VALUES (
    p_tenant_id, 'sim_top_up', p_amount_cents, v_new_balance, 'sim_credit',
    COALESCE(p_note, format('[SIM] Top-up +€%s', to_char(p_amount_cents / 100.0, 'FM999999990.00'))),
    TRUE
  );

  RETURN v_new_balance;
END;
$function$;

-- ── sim_debit_wallet(text,integer,text) ──

CREATE OR REPLACE FUNCTION public.sim_debit_wallet(p_tenant_id text, p_amount_cents integer, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE v_new integer; v_mode public.wallet_test_mode;
BEGIN
  SELECT test_mode INTO v_mode FROM public.tenant_wallets WHERE tenant_id = p_tenant_id;
  IF v_mode IS DISTINCT FROM 'test_simulated' THEN RAISE EXCEPTION 'wallet_not_in_test_mode'; END IF;
  UPDATE public.tenant_wallets
  SET balance_cents = GREATEST(0, balance_cents - p_amount_cents),
      status = CASE
        WHEN GREATEST(0, balance_cents - p_amount_cents) = 0 THEN 'suspended'
        ELSE status END,
      updated_at = now()
  WHERE tenant_id = p_tenant_id RETURNING balance_cents INTO v_new;
  INSERT INTO public.wallet_ledger (tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note)
  VALUES (p_tenant_id, 'sim_debit', -p_amount_cents, v_new, 'sim_debit',
          COALESCE(p_note, format('[SIM] Debit -€%s', to_char(p_amount_cents / 100.0, 'FM999999990.00'))));
  RETURN v_new;
END; $function$;

-- ── sim_set_wallet_balance(text,integer,text) ──

CREATE OR REPLACE FUNCTION public.sim_set_wallet_balance(p_tenant_id text, p_balance_cents integer, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_current_balance  INTEGER;
  v_current_mode     public.wallet_test_mode;
  v_delta            INTEGER;
  v_entry_type       public.wallet_entry_type;
BEGIN
  SELECT balance_cents, test_mode
    INTO v_current_balance, v_current_mode
    FROM public.tenant_wallets
   WHERE tenant_id = p_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    -- Lazily upsert the wallet in test_simulated mode.
    INSERT INTO public.tenant_wallets (tenant_id, balance_cents, status, test_mode, updated_at)
    VALUES (p_tenant_id, p_balance_cents, 'active', 'test_simulated', now())
    RETURNING balance_cents INTO v_current_balance;

    INSERT INTO public.wallet_ledger (
      tenant_id, entry_type, amount_cents, balance_after_cents,
      reference_type, note, simulated
    ) VALUES (
      p_tenant_id, 'sim_top_up', p_balance_cents, p_balance_cents,
      'sim_set_balance',
      COALESCE(p_note, format('[SIM] Balance set to €%s', to_char(p_balance_cents / 100.0, 'FM999999990.00'))),
      TRUE
    );

    RETURN p_balance_cents;
  END IF;

  IF v_current_mode <> 'test_simulated' THEN
    RAISE EXCEPTION 'wallet_not_in_test_mode'
      USING HINT = 'Enable test mode on this wallet before using sim_* functions';
  END IF;

  v_delta      := p_balance_cents - v_current_balance;
  v_entry_type := CASE WHEN v_delta >= 0 THEN 'sim_top_up' ELSE 'sim_debit' END;

  UPDATE public.tenant_wallets
     SET balance_cents = p_balance_cents,
         status        = CASE
                           WHEN status = 'suspended' AND p_balance_cents > 0 THEN 'active'
                           WHEN p_balance_cents = 0                          THEN 'suspended'
                           ELSE status
                         END,
         updated_at    = now()
   WHERE tenant_id = p_tenant_id;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, note, simulated
  ) VALUES (
    p_tenant_id,
    v_entry_type,
    v_delta,
    p_balance_cents,
    'sim_set_balance',
    COALESCE(p_note, format('[SIM] Balance set to €%s (delta: %s%s)',
      to_char(p_balance_cents / 100.0, 'FM999999990.00'),
      CASE WHEN v_delta >= 0 THEN '+' ELSE '' END,
      to_char(v_delta        / 100.0, 'FM999999990.00')
    )),
    TRUE
  );

  RETURN p_balance_cents;
END;
$function$;

-- ── sim_trigger_reload_success(text,integer) ──

CREATE OR REPLACE FUNCTION public.sim_trigger_reload_success(p_tenant_id text, p_amount_cents integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_wallet      public.tenant_wallets%ROWTYPE;
  v_amount      integer;
  v_new_balance integer;
  v_idem_key    text;
BEGIN
  SELECT * INTO v_wallet FROM public.tenant_wallets WHERE tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF v_wallet.test_mode <> 'test_simulated' THEN RAISE EXCEPTION 'wallet_not_in_test_mode'; END IF;

  v_amount   := COALESCE(p_amount_cents, v_wallet.auto_reload_amount_cents);
  v_idem_key := format('sim-reload:%s:%s', p_tenant_id, gen_random_uuid());

  INSERT INTO public.wallet_reload_attempts
    (tenant_id, trigger_balance_cents, reload_amount_cents, status, idempotency_key)
  VALUES (p_tenant_id, v_wallet.balance_cents, v_amount, 'succeeded', v_idem_key);

  UPDATE public.tenant_wallets
  SET balance_cents = balance_cents + v_amount,
      status = CASE WHEN status = 'suspended' THEN 'active' ELSE status END,
      auto_reload_spent_this_month_cents = auto_reload_spent_this_month_cents + v_amount,
      updated_at = now()
  WHERE tenant_id = p_tenant_id RETURNING balance_cents INTO v_new_balance;

  INSERT INTO public.wallet_ledger (tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note)
  VALUES (p_tenant_id, 'sim_auto_reload', v_amount, v_new_balance, 'sim_reload',
          format('[SIM] Auto-reload success +€%s → balance €%s',
                 to_char(v_amount / 100.0, 'FM999999990.00'),
                 to_char(v_new_balance / 100.0, 'FM999999990.00')));

  RETURN v_new_balance;
END; $function$;

-- ── process_wallet_reload_failure(uuid,reload_attempt_status,text,text) ──
--
-- A different fault, found in the same trial. The function counted the rows
-- it changed into a boolean and then asked whether that boolean was greater
-- than zero:
--
--     DECLARE v_updated boolean;
--     GET DIAGNOSTICS v_updated = ROW_COUNT;
--     RETURN v_updated > 0;        -- "operator does not exist: boolean > integer"
--
-- The error undid the update with it. A failed automatic top-up could
-- therefore never be marked failed: the attempt stayed open, and because only
-- one attempt may be open per tenant, no later top-up could start either.
-- The counter is an integer now. Nothing else changes.

CREATE OR REPLACE FUNCTION public.process_wallet_reload_failure(p_attempt_id uuid, p_new_status reload_attempt_status, p_failure_reason text DEFAULT NULL::text, p_stripe_payment_intent_id text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE v_updated integer;
BEGIN
  UPDATE public.wallet_reload_attempts
  SET status = p_new_status,
      failure_reason = p_failure_reason,
      stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
      updated_at = now()
  WHERE id = p_attempt_id AND status IN ('pending', 'processing');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END; $function$;
