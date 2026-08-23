-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0169 — ip_company_cache: key by IP hash, stop storing raw IPs
--
-- Problem:
--   ip_company_cache is keyed by the raw visitor IP (ip text PRIMARY KEY). An IP
--   is personal data, so the table stores personal data we never actually need to
--   read back — we only ever look a company up *by* IP, never recover the IP.
--
-- Fix (step 1 of 2):
--   Introduce a one-way keyed digest of the IP as the new key. The application
--   (lib/ip-hash.ts, HMAC-SHA256 under IP_HASH_KEY, or unkeyed SHA-256 without a
--   key) writes ip_hash and reads/upserts on it from this migration onward.
--   Company firmographics stay plaintext — only the *key* is hashed.
--
--   This migration:
--     1. adds a nullable ip_hash column,
--     2. adds a UNIQUE index on ip_hash (the upsert onConflict target),
--     3. drops the raw-ip primary key and its NOT NULL, so new rows can be
--        written with ip = NULL (the app no longer supplies a raw IP).
--
--   The raw `ip` column is kept for now so migration 0170 can back it out only
--   after scripts/backfill-ip-hash.ts has populated ip_hash for existing rows
--   (the digest cannot be computed in SQL — it needs the app key). Existing rows
--   read as misses until backfilled, which is safe: they are simply re-queried
--   and overwritten within the normal freshness window.
--
--   Idempotent (IF NOT EXISTS / IF EXISTS). Service-role only (RLS unchanged).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ip_company_cache
  ADD COLUMN IF NOT EXISTS ip_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS ip_company_cache_ip_hash_key
  ON public.ip_company_cache (ip_hash);

-- Drop the raw-IP primary key so ip becomes an ordinary nullable column. New
-- rows carry ip = NULL and are keyed solely by ip_hash.
ALTER TABLE public.ip_company_cache
  DROP CONSTRAINT IF EXISTS ip_company_cache_pkey;

ALTER TABLE public.ip_company_cache
  ALTER COLUMN ip DROP NOT NULL;
