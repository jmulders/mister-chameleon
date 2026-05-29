-- ── pending_trial_signups ──────────────────────────────────────────────────────
--
-- Holds the hashed password and signup details for users who have started the
-- Stripe Checkout flow but not yet completed payment.  Once Stripe fires
-- checkout.session.completed with type="trial_signup", the webhook handler
-- reads this row, creates the admin_user + tenant_settings, and marks it done.
--
-- TTL: rows older than 24 hours with status="pending" can be purged safely.
-- The stripe_session_id is populated once Stripe returns a Checkout URL so that
-- the webhook can look up the pending row by Stripe session ID.
--
-- Migration: 20240101000095_pending_trial_signups.sql

CREATE TABLE IF NOT EXISTS public.pending_trial_signups (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL,
  email             text        NOT NULL,
  company           text        NOT NULL,
  password_hash     text        NOT NULL,
  plan_id           text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'completed', 'failed')),
  stripe_session_id text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

-- Index for webhook lookup by Stripe session ID
CREATE INDEX IF NOT EXISTS pending_trial_signups_session_idx
  ON public.pending_trial_signups (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- Index for email dedup check
CREATE INDEX IF NOT EXISTS pending_trial_signups_email_idx
  ON public.pending_trial_signups (email);

-- RLS: service-role only
ALTER TABLE public.pending_trial_signups ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pending_trial_signups IS
  'Temporary store for trial signup data awaiting Stripe payment confirmation. '
  'Rows are created before redirect to Stripe and fulfilled by the webhook.';
