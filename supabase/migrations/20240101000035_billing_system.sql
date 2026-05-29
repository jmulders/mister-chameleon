-- ─────────────────────────────────────────────────────────────────────────────
-- Billing System
--
-- Three tables:
--   subscriptions        — one row per tenant, Stripe subscription state
--   credit_balance       — one row per tenant, current enrichment credit total
--   credit_transactions  — append-only ledger of every credit change
--
-- Design principles:
--   • Stripe is the source of truth for payment state.
--   • The app DB is the source of truth for access gating.
--   • Webhook events are idempotent: stripe_event_id prevents duplicate processing.
--   • credit_balance is a denormalized total for fast reads; the ledger is the ground truth.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Subscriptions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL,  -- FK removed: no tenants table; see migration 040

  -- Stripe identifiers
  stripe_customer_id    text        NOT NULL,
  stripe_subscription_id text       UNIQUE,

  -- Plan state (source of truth for access gating)
  plan                  text        NOT NULL DEFAULT 'starter'
                                    CHECK (plan IN ('starter', 'growth', 'pro')),
  status                text        NOT NULL DEFAULT 'active'
                                    CHECK (status IN (
                                      'active', 'trialing', 'past_due',
                                      'canceled', 'unpaid', 'paused'
                                    )),
  billing_cycle         text        NOT NULL DEFAULT 'monthly'
                                    CHECK (billing_cycle IN ('monthly', 'annual')),

  -- Billing period (synced from Stripe)
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean     NOT NULL DEFAULT false,
  canceled_at           timestamptz,

  -- Metadata
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- One subscription row per tenant
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_id_idx
  ON subscriptions(tenant_id);

-- Fast lookup by Stripe customer / subscription ID (webhook routing)
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON subscriptions(stripe_customer_id);

-- ── Credit balance ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_balance (
  tenant_id             uuid        PRIMARY KEY,  -- FK removed: no tenants table; see migration 040
  balance               integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Credit transactions (append-only ledger) ──────────────────────────────────

DO $$ BEGIN
  CREATE TYPE credit_tx_type AS ENUM (
    'purchase',          -- credits bought via checkout
    'deduction',         -- credits consumed by enrichment or feature
    'grant',             -- manual admin grant
    'refund',            -- credits returned after cancellation / error
    'expiry'             -- future: credits expired at billing cycle rollover
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS credit_transactions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL,  -- FK removed: no tenants table; see migration 040

  type                  credit_tx_type NOT NULL,
  amount                integer     NOT NULL,           -- positive for credits added, negative for deductions
  balance_after         integer     NOT NULL,           -- denormalized snapshot for audit trail

  -- Source tracking
  stripe_event_id       text        UNIQUE,             -- prevents duplicate webhook processing
  stripe_payment_intent text,
  bundle_id             text,                           -- credit bundle purchased (e.g. "credits_500")
  feature               text,                           -- feature that caused a deduction

  -- Human-readable
  description           text,

  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Fast ledger reads per tenant, chronological
CREATE INDEX IF NOT EXISTS credit_transactions_tenant_time_idx
  ON credit_transactions(tenant_id, created_at DESC);

-- Idempotency lookup for webhook deduplication
CREATE INDEX IF NOT EXISTS credit_transactions_stripe_event_idx
  ON credit_transactions(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- ── Updated-at triggers ───────────────────────────────────────────────────────

-- Reuse the platform's standard moddatetime trigger if available,
-- otherwise create a simple inline trigger function.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    EXECUTE $trigger$
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS trigger LANGUAGE plpgsql AS '
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END;';
    $trigger$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS credit_balance_updated_at ON credit_balance;
CREATE TRIGGER credit_balance_updated_at
  BEFORE UPDATE ON credit_balance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────────
-- Platform admin access only — tenants never query billing tables directly.
-- Service-role Supabase client bypasses RLS; these tables are internal only.

ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions  ENABLE ROW LEVEL SECURITY;

-- No permissive policies — service role only (RLS is restrictive by default)
-- Admins use the admin API routes; those routes use the service-role client.
