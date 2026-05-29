-- ============================================================================
-- Migration 43: Wallet System
--
-- Adds an active wallet ("portemonnee") model for enrichment billing.
--
-- New tables:
--   tenant_wallets     — per-tenant spendable enrichment balance (cents)
--   wallet_ledger      — append-only audit trail of all wallet movements
--   enrichment_usage   — per-call enrichment activity log (cents-based)
--   enrichment_pricing — configurable per-type pricing in cents
--
-- New enums:
--   wallet_status      — active | suspended | frozen
--   wallet_entry_type  — top_up_manual | top_up_auto_reload | top_up_refund
--                        | enrichment_debit | manual_adjustment | failed_reload
--
-- Design:
--   • All monetary amounts are in euro cents (integer) to avoid float errors.
--   • Wallet debit is atomic via the debit_wallet() RPC (prevents double-spend).
--   • Wallet credit is atomic via the credit_wallet() RPC (upserts the row).
--   • All statements are idempotent — safe to re-run on an existing DB.
--   • No DROP statements — never destroys data that already exists.
-- ============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.wallet_status AS ENUM (
    'active',       -- normal operation; enrichment calls allowed
    'suspended',    -- balance depleted; billable enrichments blocked
    'frozen'        -- admin-frozen; all enrichments blocked regardless of balance
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_entry_type AS ENUM (
    'top_up_manual',       -- tenant/admin added funds manually
    'top_up_auto_reload',  -- auto-reload triggered by low balance
    'top_up_refund',       -- refund credited back to wallet
    'enrichment_debit',    -- enrichment API call deducted
    'manual_adjustment',   -- admin correction (positive or negative)
    'failed_reload'        -- auto-reload attempted but payment failed
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── tenant_wallets ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_wallets (
  -- Identity
  tenant_id                         text        PRIMARY KEY
                                                 REFERENCES public.tenant_settings(tenant_id)
                                                 ON DELETE CASCADE,

  -- Balance
  balance_cents                     integer     NOT NULL DEFAULT 0
                                                CHECK (balance_cents >= 0),
  currency                          text        NOT NULL DEFAULT 'EUR',

  -- Status
  status                            public.wallet_status NOT NULL DEFAULT 'active',

  -- Low-balance notifications
  low_balance_threshold_cents       integer     NOT NULL DEFAULT 500,   -- €5.00

  -- Auto-reload settings
  auto_reload_enabled               boolean     NOT NULL DEFAULT false,
  auto_reload_trigger_cents         integer     NOT NULL DEFAULT 300,   -- €3.00 → triggers reload
  auto_reload_amount_cents          integer     NOT NULL DEFAULT 2000,  -- €20.00 per reload
  auto_reload_monthly_limit_cents   integer     NOT NULL DEFAULT 10000, -- €100.00/month cap
  auto_reload_spent_this_month_cents integer    NOT NULL DEFAULT 0,
  auto_reload_month_reset_at        timestamptz,                        -- when monthly counter resets

  -- Payment method (Stripe)
  stripe_payment_method_id          text,                               -- saved card for auto-reload

  -- Notifications
  notify_email                      boolean     NOT NULL DEFAULT true,
  notify_sms                        boolean     NOT NULL DEFAULT false,
  notification_email                text,                               -- override billing email
  notification_phone                text,                               -- for SMS

  -- Timestamps
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);

-- ── wallet_ledger ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL
                                  REFERENCES public.tenant_settings(tenant_id)
                                  ON DELETE CASCADE,

  entry_type          public.wallet_entry_type NOT NULL,

  -- Positive = credit (top-up/refund), negative = debit (enrichment spend).
  amount_cents        integer     NOT NULL,
  balance_after_cents integer     NOT NULL,

  -- What caused this entry — allows cross-referencing.
  reference_type      text,       -- 'enrichment_usage' | 'stripe_payment' | 'manual' | …
  reference_id        text,       -- UUID / external ID of the referenced record

  note                text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── enrichment_usage ──────────────────────────────────────────────────────────
--
-- Per-call enrichment activity log.  One row per enrichment stage execution.
-- This is the wallet-billing source of truth; usage_events remains for legacy
-- credit reporting.

CREATE TABLE IF NOT EXISTS public.enrichment_usage (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text        NOT NULL,

  enrichment_type   text        NOT NULL,   -- maps to UsageEventType
  quantity          integer     NOT NULL DEFAULT 1 CHECK (quantity > 0),

  unit_price_cents  integer     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  total_price_cents integer     NOT NULL DEFAULT 0 CHECK (total_price_cents >= 0),

  cache_hit         boolean     NOT NULL DEFAULT false,
  billable          boolean     NOT NULL DEFAULT true,

  -- True when the call was blocked due to insufficient wallet balance.
  wallet_blocked    boolean     NOT NULL DEFAULT false,

  -- Outcome
  success           boolean     NOT NULL DEFAULT true,
  error_code        text,

  -- Correlation
  request_id        text,       -- session_id / request identifier
  idempotency_key   text        UNIQUE,

  -- Metadata (stage label, duration, etc.)
  metadata          jsonb       NOT NULL DEFAULT '{}',

  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── enrichment_pricing ────────────────────────────────────────────────────────
--
-- Per-enrichment-type pricing table.  Overrides the static ENRICHMENT_TYPE_CONFIG
-- defaults and allows price changes without a code deploy.

CREATE TABLE IF NOT EXISTS public.enrichment_pricing (
  enrichment_type   text        PRIMARY KEY,
  unit_price_cents  integer     NOT NULL DEFAULT 3 CHECK (unit_price_cents >= 0),
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
      ('ip_enrich',       3, 'IP Enrichment',    'IPinfo Lite — network ASN, org name, domain, and coordinates', true),
      ('reverse_geocode', 3, 'Reverse Geocode',  'Latitude/longitude → structured address (LocationIQ / BigDataCloud)', true),
      ('weather_enrich',  3, 'Weather',          'Open-Meteo — current weather conditions and forecast', true),
      ('company_lookup',  3, 'Company Lookup',   'Reverse-IP firmographics (OpenKvK / Clearbit)', true),
      ('intent_enrich',   3, 'Intent Enrichment','Behavioural intent and engagement signals', true),
      ('leadinfo_lookup', 3, 'Leadinfo',         'B2B company identification (billed per matched identify call)', true),
      ('ga4_history',     6, 'GA4 History',      'Google Analytics 4 visitor session history and channel data', true),
      ('crm_lookup',      6, 'CRM Lookup',       'HubSpot CRM — contact and company record matching', true)
    ON CONFLICT (enrichment_type) DO NOTHING;
  END IF;
END $$;

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS wallet_ledger_tenant_created_idx
  ON public.wallet_ledger (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS enrichment_usage_tenant_created_idx
  ON public.enrichment_usage (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS enrichment_usage_tenant_type_idx
  ON public.enrichment_usage (tenant_id, enrichment_type);

-- ── updated_at trigger for tenant_wallets ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.wallet_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_updated_at ON public.tenant_wallets;
CREATE TRIGGER wallet_updated_at
  BEFORE UPDATE ON public.tenant_wallets
  FOR EACH ROW EXECUTE FUNCTION public.wallet_set_updated_at();

-- ── debit_wallet RPC ─────────────────────────────────────────────────────────
--
-- Atomically deducts p_amount_cents from a tenant's wallet and writes a
-- ledger entry in the same transaction.
--
-- Raises 'insufficient_wallet_balance' if balance < amount or wallet is not active.
-- Returns the new balance after the debit.

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_tenant_id       text,
  p_amount_cents    integer,
  p_reference_type  text    DEFAULT NULL,
  p_reference_id    text    DEFAULT NULL,
  p_note            text    DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance_after integer;
BEGIN
  UPDATE public.tenant_wallets
  SET
    balance_cents = balance_cents - p_amount_cents,
    updated_at    = now()
  WHERE
    tenant_id     = p_tenant_id
    AND balance_cents >= p_amount_cents
    AND status    = 'active'
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
END;
$$;

-- ── credit_wallet RPC ─────────────────────────────────────────────────────────
--
-- Atomically adds p_amount_cents to a tenant's wallet (upserts the row) and
-- writes a ledger entry.  Also reactivates a 'suspended' wallet.
-- Returns the new balance.

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id       text,
  p_amount_cents    integer,
  p_entry_type      text    DEFAULT 'top_up_manual',
  p_reference_type  text    DEFAULT NULL,
  p_reference_id    text    DEFAULT NULL,
  p_note            text    DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance_after integer;
BEGIN
  INSERT INTO public.tenant_wallets (tenant_id, balance_cents, status, updated_at)
  VALUES (p_tenant_id, p_amount_cents, 'active', now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET
    balance_cents = public.tenant_wallets.balance_cents + p_amount_cents,
    -- Reactivate a suspended wallet when funds are added.
    status        = CASE
                      WHEN public.tenant_wallets.status = 'suspended' THEN 'active'::public.wallet_status
                      ELSE public.tenant_wallets.status
                    END,
    updated_at    = now()
  RETURNING balance_cents INTO v_balance_after;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, reference_id, note
  ) VALUES (
    p_tenant_id,
    p_entry_type::public.wallet_entry_type,
    p_amount_cents,
    v_balance_after,
    p_reference_type,
    p_reference_id,
    p_note
  );

  RETURN v_balance_after;
END;
$$;

-- ── Enrichment usage summary view ─────────────────────────────────────────────

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

-- ── RLS ───────────────────────────────────────────────────────────────────────
--
-- Service-role only.  No tenant-facing policies — all wallet reads/writes
-- go through server-side code using the service-role key.

ALTER TABLE public.tenant_wallets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_pricing ENABLE ROW LEVEL SECURITY;
