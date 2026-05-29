-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 107: Track pre-paid pending plan payment
--
-- When a platform-managed tenant (no stripe_subscription_id) upgrades their
-- plan, we collect payment immediately via a one-time Stripe Checkout session
-- (payment mode).  The pending plan is then activated at the next billing
-- period boundary by the billing-renewal cron.
--
-- This column records when the first-period payment was collected so the cron
-- knows to skip charging again at activation time (the payment was already
-- taken during the upgrade flow).
--
-- ─── New column ───────────────────────────────────────────────────────────────
--
--   subscriptions.pending_plan_paid_at  TIMESTAMPTZ (nullable)
--     Set when the tenant pays for the first period of the pending plan via
--     one-time Stripe Checkout.  NULL = no pre-payment collected yet (cron
--     will charge at renewal).  Non-NULL = payment already collected; cron
--     activates the plan without charging.
--     Cleared (reset to NULL) alongside pending_plan when the plan activates.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.subscriptions.pending_plan_paid_at
  IS 'Timestamp when the first period of the pending plan was pre-paid via one-time Stripe Checkout. NULL = not pre-paid (cron charges at renewal). Cleared when the pending plan activates.';
