-- Migration 167: Admin password reset + session revocation
--
-- Adds the columns the "forgot password" flow needs to admin_users:
--
--   reset_token_hash        SHA-256 hex of a single-use reset token (raw token
--                           travels only in the emailed link); NULL when none.
--   reset_token_expires_at  Expiry of the current reset token (45 min window).
--   reset_requested_at      Last reset request time (audit + soft cooldown).
--   session_epoch           Bumped on password reset to invalidate existing
--                           JWT sessions (compared against the token's epoch
--                           claim in getRequiredAdminSession).
--
-- PROD copy: run this manually against the prod project after deploy. The dev
-- copy is supabase/migrations/20240101000167_admin_password_reset.sql.
-- Remember to record it in public._migrations (filename) after running.

alter table admin_users
  add column if not exists reset_token_hash       text,
  add column if not exists reset_token_expires_at timestamptz,
  add column if not exists reset_requested_at     timestamptz,
  add column if not exists session_epoch          integer not null default 0;

-- Lookup by token hash during reset (high-entropy token; direct index match).
create index if not exists admin_users_reset_token_hash_idx
  on admin_users (reset_token_hash);
