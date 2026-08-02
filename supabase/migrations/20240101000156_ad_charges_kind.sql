-- ============================================================================
-- ad_profiling_charges → generalise to per-visitor/day ad charges by "kind"
-- ============================================================================
--
-- The per-visitor/day charge table now covers more than behavioural profiling:
-- geo targeting (and later firmographic) each add a separately-priced fee. A
-- `kind` column distinguishes them so a visitor can incur, e.g., a profiling fee
-- AND a geo fee on the same day. The dedup key becomes
-- (ad_tenant_id, session_id, charge_date, kind).
--
-- Additive and idempotent.

ALTER TABLE public.ad_profiling_charges
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'profiling';

-- Swap the old 3-column unique for a kind-aware 4-column unique.
ALTER TABLE public.ad_profiling_charges
  DROP CONSTRAINT IF EXISTS ad_profiling_charges_ad_tenant_id_session_id_charge_date_key;

-- ADD CONSTRAINT has no IF NOT EXISTS, so guard it: skip when the constraint
-- already exists (e.g. a prior partial run), which otherwise raises 42P07.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ad_profiling_charges_dedup_key'
      AND conrelid = 'public.ad_profiling_charges'::regclass
  ) THEN
    ALTER TABLE public.ad_profiling_charges
      ADD CONSTRAINT ad_profiling_charges_dedup_key
      UNIQUE (ad_tenant_id, session_id, charge_date, kind);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
