-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant Assets — Storage Provider Columns (Migration 081)
--
-- Extends tenant_assets with per-asset storage backend tracking:
--
--   storage_backend  — which storage provider holds this asset's binary data
--   provider_bucket  — the bucket/dataset name within that provider
--
-- ─── Why these columns exist ─────────────────────────────────────────────────
--
--   The platform now supports three asset storage backends:
--     cloudflare_r2   — Cloudflare R2 (zero-egress, S3-compatible)
--     supabase_storage — Supabase Storage (legacy, used before R2 migration)
--     sanity_assets    — Sanity CDN-hosted assets (read-only, CMS-sourced)
--
--   The storage_backend column is the routing key for delete operations:
--   deleting an asset must route to the correct provider SDK.
--
--   The provider_bucket column records the specific bucket or dataset within
--   the provider, enabling multi-bucket deployments and audit trails.
--
--   Both columns are NULLABLE — existing rows without them default to NULL
--   which is treated as the legacy Supabase Storage backend at the application
--   layer.  New uploads explicitly set both columns on insert.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
--   ADD COLUMN IF NOT EXISTS is idempotent — safe to re-run.
--   The CHECK constraint is guarded with a DO block to avoid duplicate errors.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add storage_backend column ────────────────────────────────────────────

ALTER TABLE public.tenant_assets
  ADD COLUMN IF NOT EXISTS storage_backend text;

-- ── 2. Add CHECK constraint (idempotent guard) ────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.tenant_assets
    ADD CONSTRAINT tenant_assets_storage_backend_check
      CHECK (
        storage_backend IS NULL OR
        storage_backend IN ('cloudflare_r2', 'supabase_storage', 'sanity_assets')
      );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.tenant_assets.storage_backend IS
  'Storage provider that holds the asset binary: cloudflare_r2 | supabase_storage | sanity_assets. NULL = legacy Supabase Storage (pre-migration).';

-- ── 3. Add provider_bucket column ─────────────────────────────────────────────
--
-- Records the bucket or dataset name within the provider.
-- Examples:
--   cloudflare_r2:   "mister-chameleon-assets"
--   supabase_storage: "tenant-assets"
--   sanity_assets:    "production" (Sanity dataset name)

ALTER TABLE public.tenant_assets
  ADD COLUMN IF NOT EXISTS provider_bucket text;

COMMENT ON COLUMN public.tenant_assets.provider_bucket IS
  'Bucket or dataset name within the storage provider (e.g. R2 bucket name, Supabase bucket name, Sanity dataset).';

-- ── 4. Index for provider-scoped queries ─────────────────────────────────────
--
-- Supports queries like: "list all R2 assets for cleanup" or
-- "count assets per backend for the storage dashboard".

CREATE INDEX IF NOT EXISTS tenant_assets_storage_backend_idx
  ON public.tenant_assets (storage_backend)
  WHERE storage_backend IS NOT NULL;

-- ── 5. Ensure platform_settings can store the storage config ─────────────────
--
-- platform_settings stores per-key JSONB blobs.
-- The "storage" key will hold the active provider and provider credentials.
-- This table was created in an earlier migration; ensure it exists.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
