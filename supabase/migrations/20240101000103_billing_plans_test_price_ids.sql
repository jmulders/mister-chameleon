-- migration 103 — add test Stripe price ID columns to billing_plans
--
-- Adds stripe_test_monthly_price_id and stripe_test_yearly_price_id so that
-- the platform can store separate price IDs for Stripe test mode (sandbox) and
-- live mode.  getResolvedPlanStripePriceId() selects the correct column based
-- on the resolved Stripe mode (inferred from the publishable/secret key prefix).
--
-- This means admins enter their test prices once under "Test Price IDs" and live
-- prices under "Live Price IDs" — no switching required when toggling modes.

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS stripe_test_monthly_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_test_yearly_price_id  TEXT;

COMMENT ON COLUMN billing_plans.stripe_test_monthly_price_id IS
  'Stripe test-mode monthly price ID (price_... from Stripe sandbox). '
  'Used when the platform Stripe key is a test key (sk_test_ / pk_test_).';

COMMENT ON COLUMN billing_plans.stripe_test_yearly_price_id IS
  'Stripe test-mode annual price ID (price_... from Stripe sandbox). '
  'Used when the platform Stripe key is a test key (sk_test_ / pk_test_).';
