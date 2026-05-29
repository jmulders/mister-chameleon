-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 093: Subscription pending plan + tenant active status override
--
-- Adds three columns to `subscriptions` to support deferred monthly plan
-- switches: when a tenant on a monthly plan requests a plan change, the new
-- plan is stored here and applied automatically when the next invoice.paid
-- webhook fires (start of the new billing period).
--
-- Also adds `is_active_override` to `tenant_settings` so super-admins can
-- manually activate or deactivate a tenant independent of subscription status.
-- The column is also set automatically when Stripe marks a subscription as
-- "unpaid" (all payment retries exhausted).
--
-- ─── New columns ──────────────────────────────────────────────────────────────
--
--   subscriptions.pending_plan              TEXT
--     The plan ID to switch to at the next period start.
--     Set by the change-plan API for monthly non-upgrade switches.
--     Cleared by the invoice.paid webhook handler after applying the switch.
--
--   subscriptions.pending_plan_billing_cycle  TEXT
--     The billing cycle for the pending plan ("monthly" | "annual").
--
--   subscriptions.pending_plan_effective_date  TIMESTAMPTZ
--     The earliest date the pending plan should take effect.
--     Populated with current_period_end at the time of the change request.
--     Informational only — actual application is triggered by invoice.paid.
--
--   tenant_settings.is_active_override  BOOLEAN (nullable)
--     NULL  = auto (access gated by subscription status — default behaviour)
--     TRUE  = force active (super-admin override; bypasses subscription check)
--     FALSE = force disabled (admin lock; also auto-set on terminal payment failure)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── subscriptions: pending plan columns ───────────────────────────────────────

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan                TEXT,
  ADD COLUMN IF NOT EXISTS pending_plan_billing_cycle  TEXT,
  ADD COLUMN IF NOT EXISTS pending_plan_effective_date TIMESTAMPTZ;

COMMENT ON COLUMN public.subscriptions.pending_plan
  IS 'Plan ID to activate at the next billing period start (monthly switches only). Cleared by the invoice.paid webhook handler.';

COMMENT ON COLUMN public.subscriptions.pending_plan_billing_cycle
  IS 'Billing cycle for the pending plan (''monthly'' | ''annual'').';

COMMENT ON COLUMN public.subscriptions.pending_plan_effective_date
  IS 'Earliest date the pending plan takes effect — set to current_period_end at time of change request.';

-- ── tenant_settings: active status override ───────────────────────────────────

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS is_active_override BOOLEAN;

COMMENT ON COLUMN public.tenant_settings.is_active_override
  IS 'Super-admin override for tenant active status. NULL = auto (subscription-driven). TRUE = force active. FALSE = force disabled (set automatically on terminal payment failure).';
