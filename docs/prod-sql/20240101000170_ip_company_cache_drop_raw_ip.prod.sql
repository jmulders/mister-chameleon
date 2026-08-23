-- Migration 170 (prod): ip_company_cache — drop the raw ip column, step 2 of 2
--
-- Run this ONLY after the 169 prod SQL, the app deploy, and a successful
-- `scripts/backfill-ip-hash.ts --apply` against prod (see the 169 prod SQL for
-- the full order). It deletes any rows still missing ip_hash, makes ip_hash the
-- required key, and drops the raw ip column so no raw IP remains in prod.
--
-- Idempotent (IF EXISTS). Service-role only (RLS unchanged).

DELETE FROM public.ip_company_cache
  WHERE ip_hash IS NULL;

ALTER TABLE public.ip_company_cache
  ALTER COLUMN ip_hash SET NOT NULL;

ALTER TABLE public.ip_company_cache
  DROP COLUMN IF EXISTS ip;
