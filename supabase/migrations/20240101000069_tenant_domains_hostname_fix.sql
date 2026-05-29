-- migration 069: tenant_domains_hostname_fix
--
-- The tenant_domains table was created before migration 012 was applied (or the
-- table was created by an earlier schema version that used a different column name).
-- Migration 012 failed with:
--
--   ERROR: column "hostname" does not exist (SQLSTATE 42703)
--
-- This migration idempotently ensures the hostname column and its indexes exist.

-- 1. Add hostname column if missing.
ALTER TABLE tenant_domains
  ADD COLUMN IF NOT EXISTS hostname text;

-- 2. Add remaining columns that may also be missing from the early schema.
ALTER TABLE tenant_domains
  ADD COLUMN IF NOT EXISTS is_primary          boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status              text        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS vercel_domain_id    text,
  ADD COLUMN IF NOT EXISTS vercel_verification jsonb,
  ADD COLUMN IF NOT EXISTS created_at          timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- 3. Add the CHECK constraint on status only if hostname is now non-null.
--    This is a best-effort step; failure here is acceptable.
DO $$
BEGIN
  -- Add NOT NULL constraint on hostname if all existing rows have a value.
  -- (If rows exist with NULL hostname, this will be skipped gracefully.)
  IF NOT EXISTS (
    SELECT 1 FROM tenant_domains WHERE hostname IS NULL
  ) THEN
    BEGIN
      ALTER TABLE tenant_domains ALTER COLUMN hostname SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- ignore if constraint cannot be added
    END;
  END IF;
END $$;

-- 4. Create indexes (safe to re-run with IF NOT EXISTS).
CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_hostname_unique
  ON tenant_domains (hostname)
  WHERE hostname IS NOT NULL;

CREATE INDEX IF NOT EXISTS tenant_domains_tenant_id_idx
  ON tenant_domains (tenant_id);

CREATE INDEX IF NOT EXISTS tenant_domains_status_idx
  ON tenant_domains (status);
