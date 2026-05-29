-- ── pending_trial_signups: add 'dismissed' status ──────────────────────────────
--
-- The admin Signups page lets operators dismiss stuck pending rows so they
-- no longer appear in the pending queue.  The original check constraint only
-- allowed ('pending', 'completed', 'failed'), which rejected the new status.
--
-- This migration drops the existing check constraint and recreates it with the
-- 'dismissed' value included.

ALTER TABLE public.pending_trial_signups
  DROP CONSTRAINT IF EXISTS pending_trial_signups_status_check;

ALTER TABLE public.pending_trial_signups
  ADD CONSTRAINT pending_trial_signups_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'dismissed'));
