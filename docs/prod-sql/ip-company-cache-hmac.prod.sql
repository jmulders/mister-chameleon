-- ═════════════════════════════════════════════════════════════════════════════
-- PROD RUNBOOK — ip_company_cache HMAC key (migrations 169 + 170), EMPTY variant
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Target: PROD project kdhfpvjeriszteqhpgll (Supabase SQL editor, runs as owner,
-- bypasses RLS). Do NOT run against dev — dev already has 169 + 170 applied.
--
-- Why the empty variant:
--   ip_company_cache is a cost-saving cache (avoids re-paying Leadinfo). Prod
--   holds only ~5 rows, all disposable — dropping them costs at most a handful of
--   re-lookups as those IPs reappear. Emptying the table lets 169's UNIQUE index
--   build on a clean table and removes the need to run a backfill script against
--   prod. (A default UNIQUE index treats NULLs as distinct, so the 5 null-ip_hash
--   rows would not actually collide — but emptying avoids leaving zombie rows that
--   read as misses until dropped.)
--
-- The store methods (enrichment/ip-company-store.ts) are wrapped in try/catch and
-- never throw: while the schema and the live code are briefly mismatched, cache
-- reads/writes just fail silently and fall through to a live Leadinfo lookup.
-- That is cost-only — never a user-facing error. Because we are emptying the
-- cache anyway, this window is equivalent to the cache miss we already accept.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ORDER OF OPERATIONS (do this, then this)
-- ─────────────────────────────────────────────────────────────────────────────
--
--   1. SET THE KEY FIRST. In Vercel → Project → Settings → Environment
--      Variables, add for the Production environment:
--        IP_HASH_KEY = <64-char hex>
--      Generate with:
--        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
--      Do NOT redeploy manually — the merge in step 3 triggers the deploy that
--      picks this up. Setting it now does not affect the currently-live code
--      (the old code does not read IP_HASH_KEY). Setting it BEFORE the deploy
--      means every hashed write is keyed from the very first lookup.
--
--   2. RUN THIS SQL (below) against PROD, before merging. It empties the cache,
--      applies 169 + 170 in one transaction, and records both in the ledger. The
--      old code is still live at this point; its cache ops now no-op (caught) and
--      fall back to live Leadinfo until the new code is live — cost-only.
--
--   3. MERGE THE PR. Vercel builds and deploys the new code, which reads/writes
--      ip_hash keyed by IP_HASH_KEY. Once live, the cache works again and refills
--      keyed from the first lookup.
--
--   4. VERIFY (see the SELECTs at the bottom).
--
-- Running the SQL BEFORE the merge (step 2 before step 3) is deliberate: it means
-- the schema is already correct when the new code goes live, so there is no
-- "new code hitting an old schema" phase and no race to run SQL the instant the
-- deploy finishes. The only cost is the old code running uncached during the
-- build window (a few minutes), which is caught and harmless.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Empty the ~5 disposable cache rows so the new key is built on a clean table.
DELETE FROM public.ip_company_cache;

-- ── Migration 169: introduce the hashed key ──────────────────────────────────
ALTER TABLE public.ip_company_cache
  ADD COLUMN IF NOT EXISTS ip_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS ip_company_cache_ip_hash_key
  ON public.ip_company_cache (ip_hash);

ALTER TABLE public.ip_company_cache
  DROP CONSTRAINT IF EXISTS ip_company_cache_pkey;

ALTER TABLE public.ip_company_cache
  ALTER COLUMN ip DROP NOT NULL;

-- ── Migration 170: drop the raw ip column (table is empty → no backfill) ──────
-- DELETE ... WHERE ip_hash IS NULL is a no-op on the emptied table; kept for
-- parity with the migration file.
DELETE FROM public.ip_company_cache
  WHERE ip_hash IS NULL;

ALTER TABLE public.ip_company_cache
  ALTER COLUMN ip_hash SET NOT NULL;

ALTER TABLE public.ip_company_cache
  DROP COLUMN IF EXISTS ip;

-- ── Ledger: record both migrations so `npm run db:migrate` skips them on prod ──
INSERT INTO public._migrations (filename) VALUES
  ('20240101000169_ip_company_cache_ip_hash.sql'),
  ('20240101000170_ip_company_cache_drop_raw_ip.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFY (run after COMMIT, and again after step 3's deploy)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Schema: ip_hash present, raw ip gone.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'ip_company_cache'
--   ORDER BY column_name;
--
-- Ledger: both filenames recorded.
--   SELECT filename FROM public._migrations
--   WHERE filename LIKE '20240101000169%' OR filename LIKE '2024010100017%';
--
-- After some live traffic (post-deploy): the table refills with 64-hex digests,
-- never raw IPs.
--   SELECT count(*) AS rows, bool_and(ip_hash ~ '^[0-9a-f]{64}$') AS all_hex
--   FROM public.ip_company_cache;
-- ═════════════════════════════════════════════════════════════════════════════
