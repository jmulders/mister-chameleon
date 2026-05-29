-- ============================================================================
-- Migration 047: Billing & Wallet — Ensure Complete
--
-- Purpose
-- ───────
-- A single idempotent migration that guarantees the entire billing + wallet
-- schema is present and correct, regardless of which prior migrations (35–46)
-- ran successfully or partially.
--
-- Critical fix included
-- ─────────────────────
-- Migration 046 contained a FK bug:
--
--   tenant_id TEXT REFERENCES public.tenant_settings(id)  ← WRONG
--
-- The tenant_settings primary key is `tenant_id`, not `id`.  Postgres
-- rejected the constraint, causing migration 046 to FAIL and leaving
-- wallet_webhook_events uncreated on every database.
--
-- This migration creates wallet_webhook_events correctly (no FK — consistent
-- with the subscriptions table, which also avoids cross-table FK coupling).
--
-- Design principles
-- ─────────────────
-- • All statements use IF NOT EXISTS / OR REPLACE — safe to re-run on any DB.
-- • No DROP statements — never destroys existing data.
-- • Covers: enums, tables, columns, indexes, triggers, RPCs, views, RLS.
-- • Mirrors the structure of migration 042 (billing ensure-complete) for the
--   wallet system.
--
-- Tables covered
-- ──────────────
--   subscriptions            (credit billing)
--   credit_balance           (credit billing)
--   credit_transactions      (credit billing)
--   usage_events             (credit billing)
--   tenant_wallets           (wallet billing)
--   wallet_ledger            (wallet billing)
--   enrichment_usage         (wallet billing)
--   enrichment_pricing       (wallet billing)
--   wallet_reload_attempts   (wallet billing)
--   wallet_webhook_events    (stripe audit log — fixed from migration 046)
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — Enums
-- ════════════════════════════════════════════════════════════════════════════

-- ── credit_tx_type ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.credit_tx_type AS ENUM (
    'purchase', 'deduction', 'grant', 'refund', 'expiry'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── usage_event_type ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.usage_event_type AS ENUM (
    'leadinfo_lookup', 'ip_enrich', 'weather_enrich', 'intent_enrich',
    'crm_lookup', 'reverse_geocode', 'ga4_history', 'company_lookup'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add any values that may be missing from a partial migration 41 run.
DO $$ BEGIN ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'reverse_geocode'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'ga4_history';     EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'company_lookup';  EXCEPTION WHEN others THEN NULL; END $$;

-- ── wallet_status ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.wallet_status AS ENUM (
    'active', 'suspended', 'frozen'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── wallet_entry_type ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.wallet_entry_type AS ENUM (
    'top_up_manual', 'top_up_auto_reload', 'top_up_refund',
    'enrichment_debit', 'manual_adjustment', 'failed_reload'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Simulated-mode variants added by migration 045.
DO $$ BEGIN ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_top_up';       EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_debit';         EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_auto_reload';   EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_failed_reload'; EXCEPTION WHEN others THEN NULL; END $$;

-- ── reload_attempt_status ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.reload_attempt_status AS ENUM (
    'pending', 'processing', 'succeeded', 'failed', 'action_required', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── wallet_test_mode ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.wallet_test_mode AS ENUM (
    'live', 'test_simulated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — Credit billing tables
-- ════════════════════════════════════════════════════════════════════════════

-- ── subscriptions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               text        NOT NULL,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  stripe_price_id         text,
  plan          text  NOT NULL DEFAULT 'starter'
                CHECK (plan IN ('starter', 'growth', 'pro')),
  status        text  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
  billing_cycle text  NOT NULL DEFAULT 'monthly'
                CHECK (billing_cycle IN ('monthly', 'annual')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  trial_end               timestamptz,
  cancel_at_period_end    boolean     NOT NULL DEFAULT false,
  canceled_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_id_uidx
  ON public.subscriptions (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_uidx
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ── credit_balance ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_balance (
  tenant_id   text        PRIMARY KEY,
  balance     integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_balance ENABLE ROW LEVEL SECURITY;

-- ── credit_transactions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                    uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text                    NOT NULL,
  type                  public.credit_tx_type   NOT NULL,
  amount                integer                 NOT NULL,
  balance_after         integer                 NOT NULL,
  stripe_event_id       text,
  stripe_payment_intent text,
  bundle_id             text,
  feature               text,
  description           text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX       IF NOT EXISTS credit_txn_tenant_time_idx
  ON public.credit_transactions (tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS credit_txn_stripe_event_uidx
  ON public.credit_transactions (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- ── usage_events ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_events (
  id               uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text                       NOT NULL,
  event_type       public.usage_event_type    NOT NULL,
  quantity         integer                    NOT NULL DEFAULT 1  CHECK (quantity > 0),
  credits_cost     integer                    NOT NULL DEFAULT 0  CHECK (credits_cost >= 0),
  success          boolean                    NOT NULL DEFAULT true,
  cache_hit        boolean                    NOT NULL DEFAULT false,
  error_code       text,
  session_id       text,
  idempotency_key  text,
  metadata         jsonb                      NOT NULL DEFAULT '{}',
  created_at       timestamptz                NOT NULL DEFAULT now()
);

-- Add cache_hit if table existed before migration 041.
DO $$ BEGIN
  ALTER TABLE public.usage_events ADD COLUMN cache_hit boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS usage_events_idempotency_uidx
  ON public.usage_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS usage_events_tenant_time_idx
  ON public.usage_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_tenant_type_time_idx
  ON public.usage_events (tenant_id, event_type, created_at DESC);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — Wallet billing tables
-- ════════════════════════════════════════════════════════════════════════════

-- ── tenant_wallets ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_wallets (
  tenant_id                           text        PRIMARY KEY
                                                   REFERENCES public.tenant_settings(tenant_id)
                                                   ON DELETE CASCADE,
  balance_cents                       integer     NOT NULL DEFAULT 0  CHECK (balance_cents >= 0),
  currency                            text        NOT NULL DEFAULT 'EUR',
  status                              public.wallet_status NOT NULL DEFAULT 'active',
  low_balance_threshold_cents         integer     NOT NULL DEFAULT 500,
  auto_reload_enabled                 boolean     NOT NULL DEFAULT false,
  auto_reload_trigger_cents           integer     NOT NULL DEFAULT 300,
  auto_reload_amount_cents            integer     NOT NULL DEFAULT 2000,
  auto_reload_monthly_limit_cents     integer     NOT NULL DEFAULT 10000,
  auto_reload_spent_this_month_cents  integer     NOT NULL DEFAULT 0,
  auto_reload_month_reset_at          timestamptz,
  stripe_payment_method_id            text,
  notify_email                        boolean     NOT NULL DEFAULT true,
  notify_sms                          boolean     NOT NULL DEFAULT false,
  notification_email                  text,
  notification_phone                  text,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now()
);

-- Columns added by migration 045 (test mode).
ALTER TABLE public.tenant_wallets
  ADD COLUMN IF NOT EXISTS test_mode public.wallet_test_mode NOT NULL DEFAULT 'live';

-- Columns added by migration 046 (Stripe test mode separation).
ALTER TABLE public.tenant_wallets
  ADD COLUMN IF NOT EXISTS stripe_test_customer_id       text DEFAULT NULL;
ALTER TABLE public.tenant_wallets
  ADD COLUMN IF NOT EXISTS stripe_test_payment_method_id text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS tenant_wallets_test_mode_idx
  ON public.tenant_wallets (test_mode)
  WHERE test_mode = 'test_simulated';

ALTER TABLE public.tenant_wallets ENABLE ROW LEVEL SECURITY;

-- ── wallet_ledger ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL
                                  REFERENCES public.tenant_settings(tenant_id)
                                  ON DELETE CASCADE,
  entry_type          public.wallet_entry_type NOT NULL,
  amount_cents        integer     NOT NULL,
  balance_after_cents integer     NOT NULL,
  reference_type      text,
  reference_id        text,
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_ledger_tenant_created_idx
  ON public.wallet_ledger (tenant_id, created_at DESC);

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

-- ── enrichment_usage ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.enrichment_usage (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text        NOT NULL,
  enrichment_type   text        NOT NULL,
  quantity          integer     NOT NULL DEFAULT 1  CHECK (quantity > 0),
  unit_price_cents  integer     NOT NULL DEFAULT 0  CHECK (unit_price_cents >= 0),
  total_price_cents integer     NOT NULL DEFAULT 0  CHECK (total_price_cents >= 0),
  cache_hit         boolean     NOT NULL DEFAULT false,
  billable          boolean     NOT NULL DEFAULT true,
  wallet_blocked    boolean     NOT NULL DEFAULT false,
  success           boolean     NOT NULL DEFAULT true,
  error_code        text,
  request_id        text,
  idempotency_key   text        UNIQUE,
  metadata          jsonb       NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enrichment_usage_tenant_created_idx
  ON public.enrichment_usage (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS enrichment_usage_tenant_type_idx
  ON public.enrichment_usage (tenant_id, enrichment_type);

ALTER TABLE public.enrichment_usage ENABLE ROW LEVEL SECURITY;

-- ── enrichment_pricing ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.enrichment_pricing (
  enrichment_type   text        PRIMARY KEY,
  unit_price_cents  integer     NOT NULL DEFAULT 3  CHECK (unit_price_cents >= 0),
  display_name      text        NOT NULL DEFAULT '',
  description       text,
  billable          boolean     NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Seed default pricing — only when the old schema (unit_price_cents column) is
-- present.  If migration 065 has already replaced the table with the fractional-EUR
-- schema, skip this seed entirely (065 / 072 seed the new rows themselves).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'enrichment_pricing'
      AND column_name  = 'unit_price_cents'
  ) THEN
    INSERT INTO public.enrichment_pricing
      (enrichment_type, unit_price_cents, display_name, description, billable)
    VALUES
      ('ip_enrich',       3, 'IP Enrichment',    'IPinfo Lite — network ASN, org, domain, coordinates',  true),
      ('reverse_geocode', 3, 'Reverse Geocode',  'Latitude/longitude → structured address',               true),
      ('weather_enrich',  3, 'Weather',          'Open-Meteo — current conditions and forecast',          true),
      ('company_lookup',  3, 'Company Lookup',   'Reverse-IP firmographics (OpenKvK / Clearbit)',          true),
      ('intent_enrich',   3, 'Intent Enrichment','Behavioural intent and engagement signals',              true),
      ('leadinfo_lookup', 3, 'Leadinfo',         'B2B company identification (billed per matched call)',   true),
      ('ga4_history',     6, 'GA4 History',      'Google Analytics 4 visitor session history',             true),
      ('crm_lookup',      6, 'CRM Lookup',       'HubSpot CRM — contact and company record matching',     true)
    ON CONFLICT (enrichment_type) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.enrichment_pricing ENABLE ROW LEVEL SECURITY;

-- ── wallet_reload_attempts ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wallet_reload_attempts (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 text        NOT NULL
                                        REFERENCES public.tenant_settings(tenant_id)
                                        ON DELETE CASCADE,
  trigger_balance_cents     integer     NOT NULL,
  reload_amount_cents       integer     NOT NULL CHECK (reload_amount_cents > 0),
  status                    public.reload_attempt_status NOT NULL DEFAULT 'pending',
  idempotency_key           text        NOT NULL UNIQUE,
  stripe_payment_intent_id  text,
  failure_reason            text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- At most one active attempt per wallet.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_reload_attempts_one_active_per_wallet_idx
  ON public.wallet_reload_attempts (tenant_id)
  WHERE status IN ('pending', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS wallet_reload_attempts_payment_intent_id_idx
  ON public.wallet_reload_attempts (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallet_reload_attempts_tenant_created_idx
  ON public.wallet_reload_attempts (tenant_id, created_at DESC);

ALTER TABLE public.wallet_reload_attempts ENABLE ROW LEVEL SECURITY;

-- ── wallet_webhook_events ─────────────────────────────────────────────────────
--
-- CRITICAL FIX: migration 046 had:
--   tenant_id TEXT REFERENCES public.tenant_settings(id) ON DELETE SET NULL
-- tenant_settings has no column named `id`; its PK is `tenant_id`.
-- That FK constraint caused migration 046 to fail with a Postgres error,
-- meaning this table was never created on any database.
--
-- Fixed here: no FK on tenant_id (consistent with the subscriptions table,
-- which also avoids cross-table FK coupling for the tenant_id text slug).
-- The value is informational only — not all webhook events carry a tenant.

CREATE TABLE IF NOT EXISTS public.wallet_webhook_events (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  text         NOT NULL,
  event_type       text         NOT NULL,
  livemode         boolean      NOT NULL DEFAULT true,
  tenant_id        text,          -- informational; no FK (see note above)
  handled          boolean      NOT NULL DEFAULT false,
  action           text,
  error            text,
  received_at      timestamptz  NOT NULL DEFAULT now()
);

-- Idempotency: second delivery of same event is silently ignored.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_webhook_events_stripe_event_id_idx
  ON public.wallet_webhook_events (stripe_event_id);

-- Per-tenant event history (admin overview).
CREATE INDEX IF NOT EXISTS wallet_webhook_events_tenant_received_idx
  ON public.wallet_webhook_events (tenant_id, received_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Per-mode event history.
CREATE INDEX IF NOT EXISTS wallet_webhook_events_livemode_received_idx
  ON public.wallet_webhook_events (livemode, received_at DESC);

ALTER TABLE public.wallet_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wallet_webhook_events IS
  'Append-only audit log of Stripe webhook events. '
  'One row per delivery. Idempotent via UNIQUE stripe_event_id. '
  'Created here because migration 046 had a broken FK and always failed.';


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — Triggers (updated_at)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.billing_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.reload_attempt_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS subscriptions_updated_at         ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();

DROP TRIGGER IF EXISTS credit_balance_updated_at        ON public.credit_balance;
CREATE TRIGGER credit_balance_updated_at
  BEFORE UPDATE ON public.credit_balance
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();

DROP TRIGGER IF EXISTS wallet_updated_at                ON public.tenant_wallets;
CREATE TRIGGER wallet_updated_at
  BEFORE UPDATE ON public.tenant_wallets
  FOR EACH ROW EXECUTE FUNCTION public.wallet_set_updated_at();

DROP TRIGGER IF EXISTS reload_attempt_updated_at        ON public.wallet_reload_attempts;
CREATE TRIGGER reload_attempt_updated_at
  BEFORE UPDATE ON public.wallet_reload_attempts
  FOR EACH ROW EXECUTE FUNCTION public.reload_attempt_set_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — RPC functions
-- ════════════════════════════════════════════════════════════════════════════

-- ── increment_credit_balance ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_credit_balance(
  p_tenant_id text,
  p_amount    integer
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_new integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_credit_balance: p_amount must be positive (got %)', p_amount;
  END IF;
  INSERT INTO public.credit_balance (tenant_id, balance)
  VALUES (p_tenant_id, p_amount)
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance = credit_balance.balance + EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO v_new;
  RETURN v_new;
END; $$;

-- ── decrement_credit_balance ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.decrement_credit_balance(
  p_tenant_id text,
  p_amount    integer
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_current integer; v_new integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'decrement_credit_balance: p_amount must be positive (got %)', p_amount;
  END IF;
  SELECT balance INTO v_current FROM public.credit_balance
  WHERE tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits: no balance row for tenant %', p_tenant_id;
  END IF;
  v_new := v_current - p_amount;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'insufficient_credits: balance % < requested %', v_current, p_amount;
  END IF;
  UPDATE public.credit_balance SET balance = v_new, updated_at = now()
  WHERE tenant_id = p_tenant_id;
  RETURN v_new;
END; $$;

-- ── debit_wallet ──────────────────────────────────────────────────────────────
--
-- Atomically deduct balance + write ledger entry.
-- Raises 'insufficient_wallet_balance' if balance < amount or wallet is not active.

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_tenant_id      text,
  p_amount_cents   integer,
  p_reference_type text    DEFAULT NULL,
  p_reference_id   text    DEFAULT NULL,
  p_note           text    DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_balance_after integer;
BEGIN
  UPDATE public.tenant_wallets
  SET balance_cents = balance_cents - p_amount_cents, updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND balance_cents >= p_amount_cents
    AND status = 'active'
  RETURNING balance_cents INTO v_balance_after;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_wallet_balance'
      USING HINT = 'balance too low or wallet not active';
  END IF;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, reference_id, note
  ) VALUES (
    p_tenant_id, 'enrichment_debit', -p_amount_cents, v_balance_after,
    p_reference_type, p_reference_id, p_note
  );

  RETURN v_balance_after;
END; $$;

-- ── credit_wallet ─────────────────────────────────────────────────────────────
--
-- Atomically add balance (upserts row) + write ledger entry.
-- Reactivates a 'suspended' wallet when funds are added.

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id      text,
  p_amount_cents   integer,
  p_entry_type     text    DEFAULT 'top_up_manual',
  p_reference_type text    DEFAULT NULL,
  p_reference_id   text    DEFAULT NULL,
  p_note           text    DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_balance_after integer;
BEGIN
  INSERT INTO public.tenant_wallets (tenant_id, balance_cents, status, updated_at)
  VALUES (p_tenant_id, p_amount_cents, 'active', now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET balance_cents = public.tenant_wallets.balance_cents + p_amount_cents,
      status = CASE
        WHEN public.tenant_wallets.status = 'suspended' THEN 'active'::public.wallet_status
        ELSE public.tenant_wallets.status
      END,
      updated_at = now()
  RETURNING balance_cents INTO v_balance_after;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, reference_id, note
  ) VALUES (
    p_tenant_id, p_entry_type::public.wallet_entry_type, p_amount_cents, v_balance_after,
    p_reference_type, p_reference_id, p_note
  );

  RETURN v_balance_after;
END; $$;

-- ── process_wallet_reload_success ─────────────────────────────────────────────
--
-- Called by webhook handler on payment_intent.succeeded.
-- In ONE transaction: marks attempt succeeded + credits wallet + writes ledger.
-- Returns new balance_cents, or -1 if already processed (idempotent).

CREATE OR REPLACE FUNCTION public.process_wallet_reload_success(
  p_attempt_id               uuid,
  p_stripe_payment_intent_id text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_attempt public.wallet_reload_attempts%ROWTYPE;
  v_balance integer;
BEGIN
  UPDATE public.wallet_reload_attempts
  SET status = 'succeeded',
      stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
      updated_at = now()
  WHERE id = p_attempt_id AND status IN ('pending', 'processing')
  RETURNING * INTO v_attempt;

  IF NOT FOUND THEN RETURN -1; END IF;   -- already processed

  INSERT INTO public.tenant_wallets (tenant_id, balance_cents, status, updated_at)
  VALUES (v_attempt.tenant_id, v_attempt.reload_amount_cents, 'active', now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET balance_cents = public.tenant_wallets.balance_cents + v_attempt.reload_amount_cents,
      status = CASE
        WHEN public.tenant_wallets.status = 'suspended' THEN 'active'::public.wallet_status
        ELSE public.tenant_wallets.status
      END,
      updated_at = now()
  RETURNING balance_cents INTO v_balance;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, reference_id, note
  ) VALUES (
    v_attempt.tenant_id, 'top_up_auto_reload', v_attempt.reload_amount_cents, v_balance,
    'wallet_reload_attempt', v_attempt.id::text,
    format('Auto-reload: €%s (intent: %s)',
           to_char(v_attempt.reload_amount_cents / 100.0, 'FM999999990.00'),
           COALESCE(p_stripe_payment_intent_id, 'unknown'))
  );

  RETURN v_balance;
END; $$;

-- ── process_wallet_reload_failure ─────────────────────────────────────────────
--
-- Called on payment_intent.payment_failed or payment_intent.requires_action.
-- Returns true if updated, false if already in a terminal state.

CREATE OR REPLACE FUNCTION public.process_wallet_reload_failure(
  p_attempt_id               uuid,
  p_new_status               public.reload_attempt_status,
  p_failure_reason           text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_updated boolean;
BEGIN
  UPDATE public.wallet_reload_attempts
  SET status = p_new_status,
      failure_reason = p_failure_reason,
      stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
      updated_at = now()
  WHERE id = p_attempt_id AND status IN ('pending', 'processing');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END; $$;

-- ── sim_set_wallet_balance ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sim_set_wallet_balance(
  p_tenant_id     text,
  p_balance_cents integer,
  p_note          text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_current_balance integer;
  v_current_mode    public.wallet_test_mode;
  v_delta           integer;
  v_entry_type      public.wallet_entry_type;
BEGIN
  SELECT balance_cents, test_mode INTO v_current_balance, v_current_mode
  FROM public.tenant_wallets WHERE tenant_id = p_tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.tenant_wallets (tenant_id, balance_cents, status, test_mode, updated_at)
    VALUES (p_tenant_id, p_balance_cents, 'active', 'test_simulated', now())
    RETURNING balance_cents INTO v_current_balance;
    INSERT INTO public.wallet_ledger (tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note)
    VALUES (p_tenant_id, 'sim_top_up', p_balance_cents, p_balance_cents, 'sim_set_balance',
            COALESCE(p_note, format('[SIM] Balance set to €%s', to_char(p_balance_cents / 100.0, 'FM999999990.00'))));
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
      status = CASE
        WHEN status = 'suspended' AND p_balance_cents > 0 THEN 'active'::public.wallet_status
        WHEN p_balance_cents = 0                          THEN 'suspended'::public.wallet_status
        ELSE status
      END,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.wallet_ledger (tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note)
  VALUES (p_tenant_id, v_entry_type, v_delta, p_balance_cents, 'sim_set_balance',
          COALESCE(p_note, format('[SIM] Balance set to €%s (delta: %s%s)',
            to_char(p_balance_cents / 100.0, 'FM999999990.00'),
            CASE WHEN v_delta >= 0 THEN '+' ELSE '' END,
            to_char(v_delta / 100.0, 'FM999999990.00'))));

  RETURN p_balance_cents;
END; $$;

-- ── sim_credit_wallet ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sim_credit_wallet(
  p_tenant_id    text,
  p_amount_cents integer,
  p_note         text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_new integer; v_mode public.wallet_test_mode;
BEGIN
  SELECT test_mode INTO v_mode FROM public.tenant_wallets WHERE tenant_id = p_tenant_id;
  IF v_mode IS DISTINCT FROM 'test_simulated' THEN RAISE EXCEPTION 'wallet_not_in_test_mode'; END IF;
  UPDATE public.tenant_wallets
  SET balance_cents = balance_cents + p_amount_cents,
      status = CASE WHEN status = 'suspended' THEN 'active'::public.wallet_status ELSE status END,
      updated_at = now()
  WHERE tenant_id = p_tenant_id RETURNING balance_cents INTO v_new;
  INSERT INTO public.wallet_ledger (tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note)
  VALUES (p_tenant_id, 'sim_top_up', p_amount_cents, v_new, 'sim_credit',
          COALESCE(p_note, format('[SIM] Top-up +€%s', to_char(p_amount_cents / 100.0, 'FM999999990.00'))));
  RETURN v_new;
END; $$;

-- ── sim_debit_wallet ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sim_debit_wallet(
  p_tenant_id    text,
  p_amount_cents integer,
  p_note         text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_new integer; v_mode public.wallet_test_mode;
BEGIN
  SELECT test_mode INTO v_mode FROM public.tenant_wallets WHERE tenant_id = p_tenant_id;
  IF v_mode IS DISTINCT FROM 'test_simulated' THEN RAISE EXCEPTION 'wallet_not_in_test_mode'; END IF;
  UPDATE public.tenant_wallets
  SET balance_cents = GREATEST(0, balance_cents - p_amount_cents),
      status = CASE
        WHEN GREATEST(0, balance_cents - p_amount_cents) = 0 THEN 'suspended'::public.wallet_status
        ELSE status END,
      updated_at = now()
  WHERE tenant_id = p_tenant_id RETURNING balance_cents INTO v_new;
  INSERT INTO public.wallet_ledger (tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note)
  VALUES (p_tenant_id, 'sim_debit', -p_amount_cents, v_new, 'sim_debit',
          COALESCE(p_note, format('[SIM] Debit -€%s', to_char(p_amount_cents / 100.0, 'FM999999990.00'))));
  RETURN v_new;
END; $$;

-- ── sim_trigger_reload_success ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sim_trigger_reload_success(
  p_tenant_id    text,
  p_amount_cents integer DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql AS $$
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
      status = CASE WHEN status = 'suspended' THEN 'active'::public.wallet_status ELSE status END,
      auto_reload_spent_this_month_cents = auto_reload_spent_this_month_cents + v_amount,
      updated_at = now()
  WHERE tenant_id = p_tenant_id RETURNING balance_cents INTO v_new_balance;

  INSERT INTO public.wallet_ledger (tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note)
  VALUES (p_tenant_id, 'sim_auto_reload', v_amount, v_new_balance, 'sim_reload',
          format('[SIM] Auto-reload success +€%s → balance €%s',
                 to_char(v_amount / 100.0, 'FM999999990.00'),
                 to_char(v_new_balance / 100.0, 'FM999999990.00')));

  RETURN v_new_balance;
END; $$;

-- ── sim_trigger_reload_failure ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sim_trigger_reload_failure(
  p_tenant_id      text,
  p_failure_reason text DEFAULT 'Simulated payment failure',
  p_status         text DEFAULT 'failed'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_wallet   public.tenant_wallets%ROWTYPE;
  v_idem_key text;
BEGIN
  SELECT * INTO v_wallet FROM public.tenant_wallets WHERE tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF v_wallet.test_mode <> 'test_simulated' THEN RAISE EXCEPTION 'wallet_not_in_test_mode'; END IF;

  v_idem_key := format('sim-reload-fail:%s:%s', p_tenant_id, gen_random_uuid());

  INSERT INTO public.wallet_reload_attempts
    (tenant_id, trigger_balance_cents, reload_amount_cents, status, idempotency_key, failure_reason)
  VALUES
    (p_tenant_id, v_wallet.balance_cents, v_wallet.auto_reload_amount_cents,
     p_status::public.reload_attempt_status, v_idem_key, p_failure_reason);

  INSERT INTO public.wallet_ledger (tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note)
  VALUES (p_tenant_id, 'sim_failed_reload', 0, v_wallet.balance_cents, 'sim_reload',
          format('[SIM] Reload %s: %s', p_status, p_failure_reason));
END; $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 6 — Summary views
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.usage_events_summary AS
SELECT
  tenant_id,
  event_type,
  date_trunc('day', created_at)             AS event_date,
  count(*)                                   AS call_count,
  count(*) FILTER (WHERE success)            AS success_count,
  count(*) FILTER (WHERE NOT success)        AS failure_count,
  count(*) FILTER (WHERE cache_hit)          AS cache_hit_count,
  count(*) FILTER (WHERE NOT cache_hit)      AS fresh_call_count,
  sum(credits_cost)                          AS total_credits
FROM public.usage_events
GROUP BY tenant_id, event_type, date_trunc('day', created_at);

CREATE OR REPLACE VIEW public.enrichment_usage_summary AS
SELECT
  tenant_id,
  enrichment_type,
  date_trunc('day', created_at)              AS usage_date,
  count(*)                                   AS call_count,
  count(*) FILTER (WHERE success)            AS success_count,
  count(*) FILTER (WHERE NOT success)        AS failure_count,
  count(*) FILTER (WHERE cache_hit)          AS cache_hit_count,
  count(*) FILTER (WHERE NOT cache_hit)      AS fresh_call_count,
  count(*) FILTER (WHERE wallet_blocked)     AS blocked_count,
  sum(total_price_cents)                     AS total_price_cents
FROM public.enrichment_usage
GROUP BY tenant_id, enrichment_type, date_trunc('day', created_at);
