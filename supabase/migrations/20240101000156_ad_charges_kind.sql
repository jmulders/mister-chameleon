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

ALTER TABLE public.ad_profiling_charges
  ADD CONSTRAINT ad_profiling_charges_dedup_key
  UNIQUE (ad_tenant_id, session_id, charge_date, kind);
