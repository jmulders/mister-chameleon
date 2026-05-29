-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 088 — tenant_interest_profiles
--
-- Adds a per-tenant enable/disable override table for platform-wide interest
-- profiles.  Before this migration, all platform-wide active profiles were
-- always included in scoring for every tenant.  Tenants now get per-profile
-- control without touching the platform catalog.
--
-- ─── Table ────────────────────────────────────────────────────────────────────
--
--   tenant_interest_profiles
--     tenant_id   TEXT    — FK to tenant_config.tenant_id
--     profile_key TEXT    — matches interest_profiles.key
--     enabled     BOOLEAN DEFAULT true
--
--   Sparse table: a row is only required when a tenant has explicitly set a
--   preference that differs from the default.  Absence = enabled (default).
--   To disable: INSERT / UPSERT with enabled = false.
--   To re-enable: UPDATE enabled = true  (or DELETE the row).
--
-- ─── Default behaviour ────────────────────────────────────────────────────────
--
--   No rows for a given tenant → all platform-wide active profiles are used
--   (identical to pre-migration behaviour — fully backwards-compatible).
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
--   CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS guards.  Safe to re-run.
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_interest_profiles (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   TEXT        NOT NULL,
  profile_key TEXT        NOT NULL,
  enabled     BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tenant_interest_profiles_pkey
    PRIMARY KEY (id),

  CONSTRAINT tenant_interest_profiles_tenant_key_uniq
    UNIQUE (tenant_id, profile_key)
);

COMMENT ON TABLE public.tenant_interest_profiles IS
  'Per-tenant enable/disable overrides for platform-wide interest profiles. '
  'Absence of a row means "use the default" (enabled). '
  'profile_key matches interest_profiles.key.';

COMMENT ON COLUMN public.tenant_interest_profiles.profile_key IS
  'Matches interest_profiles.key (not the UUID id). '
  'Using key instead of id means overrides survive profile recreation.';

COMMENT ON COLUMN public.tenant_interest_profiles.enabled IS
  'true = profile is active for this tenant (default). '
  'false = profile is suppressed for this tenant even if it is globally active.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tenant_interest_profiles_tenant_idx
  ON public.tenant_interest_profiles (tenant_id);

CREATE INDEX IF NOT EXISTS tenant_interest_profiles_tenant_enabled_idx
  ON public.tenant_interest_profiles (tenant_id, enabled)
  WHERE enabled = false;  -- fast lookup of disabled profiles for a tenant

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.tenant_interest_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenant_interest_profiles'
      AND policyname = 'service_role_all_tenant_interest_profiles'
  ) THEN
    CREATE POLICY "service_role_all_tenant_interest_profiles"
      ON public.tenant_interest_profiles
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── Notify PostgREST ──────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
