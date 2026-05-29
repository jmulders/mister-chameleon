-- ============================================================================
-- Migration 049: Billing Page — Schema Safety Net
--
-- Purpose
-- ───────
-- This migration patches any remaining column-level gaps that cause the
-- billing page to surface "schema missing" (42703) errors even when the
-- tables themselves exist.
--
-- All statements are fully idempotent — safe to run on any database in any
-- state.  No DROP statements are used.
--
-- Background
-- ──────────
-- Migration 047 created / ensured all billing tables.  However, a database
-- that applied earlier migrations (35–46) and then ran 047 can end up with
-- tables that are missing specific columns added later:
--
--   usage_events        — `cache_hit`  (added by migration 041)
--   usage_events        — `idempotency_key` unique index (migration 040/041)
--   subscriptions       — `stripe_price_id`, `trial_end`  (migration 040)
--   tenant_wallets      — `test_mode`, `stripe_test_customer_id`,
--                          `stripe_test_payment_method_id` (migrations 045/046)
--   enrichment_usage    — `wallet_blocked` (migration 043)
--   wallet_webhook_events — idempotency unique index (migration 046)
--
-- This migration adds any missing columns and indexes using ADD COLUMN IF NOT
-- EXISTS / CREATE INDEX IF NOT EXISTS so re-running on a complete database
-- is a pure no-op.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- usage_events — columns that may be missing from pre-041 schemas
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE public.usage_events ADD COLUMN cache_hit boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.usage_events ADD COLUMN idempotency_key text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.usage_events ADD COLUMN session_id text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.usage_events ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

-- Idempotency unique index (partial — only non-null keys are indexed)
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_idempotency_uidx
  ON public.usage_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- subscriptions — columns that may be missing from pre-040 schemas
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD COLUMN stripe_price_id text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD COLUMN trial_end timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD COLUMN stripe_customer_id text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- tenant_wallets — columns added by migrations 045 and 046
-- ════════════════════════════════════════════════════════════════════════════

-- wallet_test_mode enum (guard in case 047 hasn't run yet)
DO $$ BEGIN
  CREATE TYPE public.wallet_test_mode AS ENUM ('live', 'test_simulated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tenant_wallets
    ADD COLUMN test_mode public.wallet_test_mode NOT NULL DEFAULT 'live';
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tenant_wallets
    ADD COLUMN stripe_test_customer_id text DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tenant_wallets
    ADD COLUMN stripe_test_payment_method_id text DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- enrichment_usage — columns that may be missing from pre-043 schemas
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE public.enrichment_usage ADD COLUMN wallet_blocked boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.enrichment_usage ADD COLUMN billable boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.enrichment_usage ADD COLUMN idempotency_key text UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.enrichment_usage ADD COLUMN error_code text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.enrichment_usage ADD COLUMN request_id text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.enrichment_usage ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- wallet_webhook_events — idempotency index and missing columns
-- ════════════════════════════════════════════════════════════════════════════

-- The wallet_webhook_events table should exist from migration 047.
-- If for any reason it doesn't (e.g. 047 failed mid-run), create it now.
CREATE TABLE IF NOT EXISTS public.wallet_webhook_events (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  text         NOT NULL,
  event_type       text         NOT NULL,
  livemode         boolean      NOT NULL DEFAULT true,
  tenant_id        text,          -- informational; no FK
  handled          boolean      NOT NULL DEFAULT false,
  action           text,
  error            text,
  received_at      timestamptz  NOT NULL DEFAULT now()
);

-- Idempotency: second delivery of same Stripe event → no new row
CREATE UNIQUE INDEX IF NOT EXISTS wallet_webhook_events_stripe_event_uidx
  ON public.wallet_webhook_events (stripe_event_id);

CREATE INDEX IF NOT EXISTS wallet_webhook_events_tenant_received_idx
  ON public.wallet_webhook_events (tenant_id, received_at DESC)
  WHERE tenant_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- credit_transactions — columns that may be missing
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE public.credit_transactions ADD COLUMN stripe_payment_intent text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.credit_transactions ADD COLUMN bundle_id text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.credit_transactions ADD COLUMN feature text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.credit_transactions ADD COLUMN description text;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table  THEN NULL;
END $$;

-- Unique index on stripe_event_id (idempotency for webhook re-delivery)
CREATE UNIQUE INDEX IF NOT EXISTS credit_txn_stripe_event_uidx
  ON public.credit_transactions (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- RLS — ensure enabled on all billing tables (idempotent)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_balance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_wallets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_ledger          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enrichment_usage       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enrichment_pricing     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_reload_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_webhook_events  ENABLE ROW LEVEL SECURITY;
