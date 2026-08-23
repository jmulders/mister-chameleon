-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0170 — ip_company_cache: drop the raw ip column
--
-- Step 2 of 2 (see migration 0169). On dev the table was empty, so this simply
-- finalises the key. For PROD, follow docs/prod-sql/ip-company-cache-hmac.prod.sql
-- (empties the cache, then applies 169 + 170 in one transaction). It:
--   1. deletes any rows still missing ip_hash (safe to drop — they just re-query
--      on next lookup),
--   2. makes ip_hash NOT NULL (it is now the sole key; the UNIQUE index from
--      0169 enforces uniqueness and serves as the upsert onConflict target),
--   3. drops the raw `ip` column, so no raw IP remains in the database.
--
--   Idempotent (IF EXISTS). Service-role only (RLS unchanged).
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM public.ip_company_cache
  WHERE ip_hash IS NULL;

ALTER TABLE public.ip_company_cache
  ALTER COLUMN ip_hash SET NOT NULL;

ALTER TABLE public.ip_company_cache
  DROP COLUMN IF EXISTS ip;
