-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 083 — tenant_wallets column ensure
--
-- ─── Why this exists ─────────────────────────────────────────────────────────
--
--   Migration 035 created tenant_wallets with a minimal schema:
--     balance_cents, currency, status, created_at, updated_at
--
--   Migration 043 tried to add all the auto_reload_*, stripe_*, notify_*,
--   and test_mode columns via CREATE TABLE IF NOT EXISTS — which is a no-op
--   when the table already exists.  It did NOT include ALTER TABLE ADD COLUMN
--   fallback blocks, so on any DB where migration 035 ran first (including
--   production), all those columns were never created.
--
--   get_wallet_state (migration 055) references w.auto_reload_monthly_limit_cents
--   and ~15 other columns, causing a 42703 "column does not exist" error that
--   prevents the billing page from loading at all.
--
-- ─── What this migration does ─────────────────────────────────────────────────
--
--   A. Add all columns migration 043 intended to create, idempotently.
--   B. Add fallback_mode / monthly_credit_cap_cents (migration 051).
--   C. Add balance NUMERIC(14,4) (migration 065/076) and backfill.
--   D. Add the fallback_mode CHECK constraint (idempotent via EXCEPTION guard).
--   E. Reload PostgREST schema cache.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   ADD COLUMN IF NOT EXISTS — safe to re-run.
--   Constraint add wrapped in DO $$ EXCEPTION WHEN duplicate_object THEN NULL.
--   Backfill UPDATE guarded by WHERE balance IS NULL.
--
-- ─────────────────────────────────────────────────────────────────────────────


-- ── A + B + C. Add all missing columns ───────────────────────────────────────

ALTER TABLE public.tenant_wallets
  -- Low-balance alert threshold (migration 043)
  ADD COLUMN IF NOT EXISTS low_balance_threshold_cents        INTEGER      NOT NULL DEFAULT 500,

  -- Auto-reload settings (migration 043)
  ADD COLUMN IF NOT EXISTS auto_reload_enabled                BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reload_trigger_cents          INTEGER      NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS auto_reload_amount_cents           INTEGER      NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS auto_reload_monthly_limit_cents    INTEGER      NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS auto_reload_spent_this_month_cents INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_reload_month_reset_at         TIMESTAMPTZ,

  -- Stripe integration (migration 043)
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id           TEXT,
  ADD COLUMN IF NOT EXISTS stripe_test_customer_id            TEXT,
  ADD COLUMN IF NOT EXISTS stripe_test_payment_method_id      TEXT,

  -- Notification preferences (migration 043)
  ADD COLUMN IF NOT EXISTS notify_email                       BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms                         BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_email                 TEXT,
  ADD COLUMN IF NOT EXISTS notification_phone                 TEXT,

  -- Billing mode (migration 043)
  ADD COLUMN IF NOT EXISTS test_mode                          TEXT         NOT NULL DEFAULT 'live',

  -- Monthly credit cap and fallback mode (migration 051)
  ADD COLUMN IF NOT EXISTS monthly_credit_cap_cents           INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fallback_mode                      TEXT         NOT NULL DEFAULT 'smart_lite',

  -- Decimal balance (migration 065 / 076) — nullable; backfilled below
  ADD COLUMN IF NOT EXISTS balance                            NUMERIC(14, 4),

  -- Timestamps — no-op if already present
  ADD COLUMN IF NOT EXISTS created_at                         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at                         TIMESTAMPTZ  NOT NULL DEFAULT now();


-- ── D. fallback_mode CHECK constraint ────────────────────────────────────────

DO $$
BEGIN
  ALTER TABLE public.tenant_wallets
    ADD CONSTRAINT tenant_wallets_fallback_mode_check
      CHECK (fallback_mode IN ('full_adaptive', 'smart_lite', 'default'));
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- constraint already exists, skip
END $$;


-- ── Backfill decimal balance for existing rows ────────────────────────────────

UPDATE public.tenant_wallets
SET balance = balance_cents::NUMERIC
WHERE balance IS NULL;


-- ── E. Reload PostgREST schema cache ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
