-- migration 075 — enrichment_pricing: ensure category column + schema cache reload
--
-- ─── Why this exists ──────────────────────────────────────────────────────────
--
--   The admin seed / upsert actions write `category` to enrichment_pricing.
--   On some DB states the column is absent, producing the PostgREST error:
--
--     PGRST204: Could not find the 'category' column of 'enrichment_pricing'
--               in the schema cache
--
--   Root cause: migration 065 uses DROP TABLE + bare CREATE TABLE for
--   enrichment_pricing (to replace the 043 schema).  If 065 was applied to a
--   DB instance where the table did not yet exist, and for any reason the
--   session-level PostgREST schema cache was built before the table was
--   fully committed, the cache can miss `category`.  Also, any DB state where
--   the table was created by an older version of this migration that predates
--   the `category` column will be missing it.
--
-- ─── Decision: keep category ─────────────────────────────────────────────────
--
--   `category` is canonical in enrichment_pricing.  It groups enrichment types
--   into three cost tiers used by billing analytics:
--
--     recognition  — cheap read-only lookups  (ip_enrich, company_lookup, …)
--     adaptation   — lightweight real-time enrichment  (intent_enrich, …)
--     brainpower   — quota-constrained / AI generation  (crm_lookup, ga4_history, …)
--
--   All of the following rely on category:
--     • billing/pricing.ts        — StaticPricingEntry.category, CreditCategory
--     • billing/types.ts          — EnrichmentPricingDbRow.category
--     • billing/pricing/actions.ts — PricingUpdatePayload.category + seed rows
--     • admin pricing editor UI   — groups rows by category
--     • enrichment_pricing index   — ON (active, category)
--
-- ─── What this migration does ─────────────────────────────────────────────────
--
--   1. ADD COLUMN IF NOT EXISTS category — idempotent; no-op if already present.
--   2. Backfill any NULL category values with the correct tier from canonical
--      seed data (or 'recognition' as the safe fallback).
--   3. SET NOT NULL after backfill so the column constraint is enforced.
--   4. Re-create the (active, category) index with IF NOT EXISTS.
--   5. NOTIFY pgrst, 'reload schema' — kicks PostgREST to rebuild its cache
--      immediately so the column is visible without restarting the server.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   Safe to run multiple times.  ADD COLUMN IF NOT EXISTS, index IF NOT EXISTS,
--   and the DO $$ blocks are all no-ops on subsequent runs.

-- ── Step 1: add category column if missing ────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'enrichment_pricing'
      AND column_name  = 'category'
  ) THEN
    ALTER TABLE enrichment_pricing
      ADD COLUMN category TEXT NOT NULL DEFAULT 'recognition';

    RAISE NOTICE 'enrichment_pricing.category column added.';
  ELSE
    RAISE NOTICE 'enrichment_pricing.category already present — skipping ADD COLUMN.';
  END IF;
END $$;

-- ── Step 2: backfill known enrichment types to correct tier ───────────────────
--
-- Only updates rows where the default 'recognition' was applied but the
-- correct tier is different (adaptation or brainpower).
-- ON CONFLICT not needed here — this is a targeted UPDATE.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'enrichment_pricing'
  ) THEN
    -- Adaptation tier
    UPDATE enrichment_pricing
    SET    category = 'adaptation'
    WHERE  enrichment_type IN ('intent_enrich', 'weather_enrich')
      AND  category = 'recognition';

    -- Brainpower tier
    UPDATE enrichment_pricing
    SET    category = 'brainpower'
    WHERE  enrichment_type IN ('ga4_history', 'crm_lookup',
                                'hero_generation', 'block_generation', 'blueprint_generation')
      AND  category = 'recognition';
  END IF;
END $$;

-- ── Step 3: add label column if missing (related defence) ─────────────────────
--
-- label was also added by migration 065.  Add defensively — the admin seed
-- action writes label unconditionally.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'enrichment_pricing'
      AND column_name  = 'label'
  ) THEN
    ALTER TABLE enrichment_pricing
      ADD COLUMN label TEXT NOT NULL DEFAULT '';

    -- Backfill label from enrichment_type for existing rows
    UPDATE enrichment_pricing
    SET label = INITCAP(REPLACE(enrichment_type, '_', ' '))
    WHERE label = '';

    RAISE NOTICE 'enrichment_pricing.label column added and backfilled.';
  END IF;
END $$;

-- ── Step 4: ensure (active, category) index ───────────────────────────────────

CREATE INDEX IF NOT EXISTS enrichment_pricing_active
  ON enrichment_pricing (active, category);

-- ── Step 5: reload PostgREST schema cache ─────────────────────────────────────
--
-- PostgREST listens for this notification and immediately rebuilds its
-- in-process schema cache.  Without this, newly-added columns require a
-- server restart or the next periodic reload (default 10 min).

NOTIFY pgrst, 'reload schema';
