-- ============================================================================
-- Migration 046 — Stripe test mode columns + webhook events debug table
--
-- Adds the infrastructure for safe Stripe test mode operation:
--
--   1. stripe_test_customer_id        — Stripe test-mode customer (cus_…)
--      Stored separately from stripe_customer_id so live and test IDs
--      are never mixed.  The correct column is selected based on STRIPE_MODE.
--
--   2. stripe_test_payment_method_id  — Stripe test-mode payment method (pm_…)
--      Same separation rationale as above.
--
--   3. wallet_webhook_events          — Audit log of Stripe webhook deliveries.
--      Used for admin visibility into recent events, failed deliveries, and
--      the wallet actions triggered by each event.  Records both test and live
--      events (distinguished by the `livemode` column).
--
-- ─── Safety design ────────────────────────────────────────────────────────────
--
--   • stripe_test_* columns are DEFAULT NULL and never touched in live mode.
--   • wallet_webhook_events has a UNIQUE constraint on stripe_event_id to
--     prevent duplicate event processing (idempotency at the DB level).
--   • The livemode column lets queries/reports easily exclude test events.
--
-- ─── Rollback ────────────────────────────────────────────────────────────────
--
--   Safe to roll back: all new columns are nullable with no FK constraints.
--   Drop the table and columns if needed; existing wallet data is unaffected.
-- ============================================================================

-- ── 1. Add Stripe test customer / payment method columns ─────────────────────

ALTER TABLE public.tenant_wallets
  ADD COLUMN IF NOT EXISTS stripe_test_customer_id       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_test_payment_method_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.tenant_wallets.stripe_test_customer_id IS
  'Stripe test-mode customer ID (cus_… from sk_test_… environment). '
  'NEVER overwrite with a live customer ID. Selected by billing when STRIPE_MODE=test.';

COMMENT ON COLUMN public.tenant_wallets.stripe_test_payment_method_id IS
  'Stripe test-mode payment method ID (pm_… from sk_test_… environment). '
  'NEVER overwrite with a live payment method ID. Selected by billing when STRIPE_MODE=test.';

-- ── 2. wallet_webhook_events — audit log ─────────────────────────────────────
--
-- Records every Stripe webhook delivery processed by /api/webhooks/stripe.
-- Rows are small and append-only; old entries can be purged after 90 days.
-- The UNIQUE constraint on stripe_event_id enforces idempotency: if Stripe
-- retries a delivery, the second upsert is a no-op (ON CONFLICT DO NOTHING).

CREATE TABLE IF NOT EXISTS public.wallet_webhook_events (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stripe event fields
  stripe_event_id  TEXT         NOT NULL,
  event_type       TEXT         NOT NULL,
  livemode         BOOLEAN      NOT NULL DEFAULT true,

  -- Tenant linkage (nullable — not all events have tenant_id in metadata).
  -- No FK constraint: tenant_settings PK is `tenant_id` (not `id`), and we
  -- intentionally avoid cross-table FK coupling here (see migration 047).
  tenant_id        TEXT,

  -- Processing result
  handled          BOOLEAN      NOT NULL DEFAULT false,
  action           TEXT,          -- e.g. "wallet_auto_reload_succeeded"
  error            TEXT,          -- populated if an exception was caught

  -- Timestamps
  received_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Idempotency: second delivery of same event_id is silently ignored
CREATE UNIQUE INDEX IF NOT EXISTS wallet_webhook_events_stripe_event_id_idx
  ON public.wallet_webhook_events (stripe_event_id);

-- Query pattern: per-tenant event history, newest first
CREATE INDEX IF NOT EXISTS wallet_webhook_events_tenant_created_idx
  ON public.wallet_webhook_events (tenant_id, received_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Query pattern: per-mode event history (admin overview)
CREATE INDEX IF NOT EXISTS wallet_webhook_events_livemode_received_idx
  ON public.wallet_webhook_events (livemode, received_at DESC);

-- ── 3. RLS — service role only ───────────────────────────────────────────────
--
-- The webhook table is written by server-side API routes using the service role.
-- Public read access is not required (admin pages use service role too).

ALTER TABLE public.wallet_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no policy needed for our use case.
-- If you need anon/authenticated read, add a SELECT policy here.

COMMENT ON TABLE public.wallet_webhook_events IS
  'Append-only audit log of Stripe webhook events processed by /api/webhooks/stripe. '
  'Each row corresponds to one Stripe event delivery (idempotent via stripe_event_id UNIQUE). '
  'Covers both live and test mode events (see livemode column). '
  'Can be purged after 90 days without affecting billing state.';
