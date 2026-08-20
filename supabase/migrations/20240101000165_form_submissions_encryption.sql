-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0165 — form_submissions: at-rest payload encryption
--
-- Problem:
--   form_submissions.payload stores submitted personal data (email addresses,
--   contact messages) as plaintext JSONB. There is no application-level
--   encryption at rest, so a database read exposes the raw personal data.
--
-- Fix:
--   Add two columns so the repository can store the payload encrypted and look a
--   submission up by email without decrypting rows:
--     payload_enc  — whole-payload AES-256-GCM ciphertext (lib/forms-crypto.ts,
--                    "enc:v1:..." format, or "plain:..." when no key is set).
--                    New rows keep payload = '{}'::jsonb (NOT NULL preserved) and
--                    put the real data only here.
--     email_hash   — deterministic keyed hash of the submitted email (HMAC-SHA256
--                    under a sub-key derived from FORMS_ENCRYPTION_KEY, or
--                    unkeyed SHA-256 without a key) for lookup by email.
--
--   Idempotent (ADD COLUMN IF NOT EXISTS). Both columns are nullable: existing
--   rows read via the legacy plaintext `payload` until the backfill runs
--   (scripts/encrypt-form-submissions.ts), which fills payload_enc + email_hash
--   and blanks payload to '{}'.
--
-- Columns added:
--   payload_enc  text  — encrypted whole-payload blob (nullable during transition)
--   email_hash   text  — deterministic email lookup hash (nullable)
--
-- Index:
--   form_submissions_email_hash_idx on (tenant_id, email_hash) — scoped email
--   lookup that replaces the old ilike payload::text content search.
--
-- Run manually via `npm run db:migrate` (scripts/migrate.ts, ledger
-- public._migrations on filename). Do NOT rely on supabase db push.
-- Rollout order on prod (kdhfpvjeriszteqhpgll): set FORMS_ENCRYPTION_KEY ->
-- run this migration -> deploy code -> run the backfill with --apply -> verify.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS payload_enc text,
  ADD COLUMN IF NOT EXISTS email_hash  text;

CREATE INDEX IF NOT EXISTS form_submissions_email_hash_idx
  ON public.form_submissions (tenant_id, email_hash);
