-- Migration 169 (prod): ip_company_cache — key by IP hash, step 1 of 2
--
-- Run this against prod, then deploy the app code (reads/writes ip_hash), then
-- run the backfill, then run the 170 prod SQL. Full order:
--
--   1. Run this SQL (adds ip_hash, unique index, drops the raw-ip PK/NOT NULL).
--   2. Deploy the app code that reads/writes ip_hash.
--   3. Backfill existing rows (digest cannot be computed in SQL — needs the app
--      key), pointing the script at prod with the SAME IP_HASH_KEY the app uses:
--
--        IP_HASH_KEY=<hex> \
--        NEXT_PUBLIC_SUPABASE_URL=<prod-url> \
--        SUPABASE_SERVICE_ROLE_KEY=<prod-service-role> \
--          npx tsx scripts/backfill-ip-hash.ts --apply
--
--   4. Run the 170 prod SQL (drops the raw ip column).
--
-- Set IP_HASH_KEY (64-char hex) in the prod app environment before step 2, so the
-- digest is keyed. Without it the app falls back to unkeyed SHA-256 (still works,
-- but the digest is not unforgeable) — the backfill must then also run unkeyed.
--
-- Idempotent (IF NOT EXISTS / IF EXISTS). Service-role only (RLS unchanged).

ALTER TABLE public.ip_company_cache
  ADD COLUMN IF NOT EXISTS ip_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS ip_company_cache_ip_hash_key
  ON public.ip_company_cache (ip_hash);

ALTER TABLE public.ip_company_cache
  DROP CONSTRAINT IF EXISTS ip_company_cache_pkey;

ALTER TABLE public.ip_company_cache
  ALTER COLUMN ip DROP NOT NULL;
