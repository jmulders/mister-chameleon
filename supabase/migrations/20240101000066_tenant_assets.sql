-- ────────────────────────────────────────────────────────────────────────────
-- Migration 066 — Tenant Asset Library
--
-- Creates the tenant_assets metadata table and provisions the Supabase Storage
-- bucket used for tenant-scoped media uploads.
--
-- ─── Design ──────────────────────────────────────────────────────────────────
--
--   Assets are stored in Supabase Storage under bucket "tenant-assets".
--   Files are keyed at path  {tenantId}/{uuid}.{ext}  which gives natural
--   tenant isolation at the storage level.
--
--   The tenant_assets table stores per-asset metadata (title, alt text, tags,
--   file info, public URL, optional Sanity reference) and is the authoritative
--   source for the admin asset library.  It is always queried filtered by
--   tenant_id.
--
-- ─── Columns ─────────────────────────────────────────────────────────────────
--
--   id              UUID PK
--   tenant_id       TEXT NOT NULL          — tenant scope
--   storage_path    TEXT UNIQUE NOT NULL   — Supabase Storage object path
--   public_url      TEXT NOT NULL          — CDN public URL for the asset
--   file_name       TEXT NOT NULL          — original upload filename
--   file_size       INTEGER                — bytes (nullable for Sanity assets)
--   mime_type       TEXT                   — IANA media type
--   width           INTEGER                — pixels (images only)
--   height          INTEGER                — pixels (images only)
--   title           TEXT                   — human-readable label (admin use)
--   alt_text        TEXT                   — accessibility alt text
--   asset_type      TEXT                   — discriminant: "image" | "video" |
--                                            "document" | "sanity" | NULL
--   sanity_asset_id TEXT                   — Sanity asset _id for CMS-sourced
--                                            assets; NULL for direct uploads
--   tags            TEXT[] NOT NULL        — freeform tag list for filtering
--   uploaded_by     TEXT                   — admin email or "sanity-sync"
--   created_at      TIMESTAMPTZ NOT NULL
--   updated_at      TIMESTAMPTZ NOT NULL
--
-- ─── Storage bucket ───────────────────────────────────────────────────────────
--
--   Bucket name : tenant-assets
--   Public      : true  (CDN delivery via the public URL pattern)
--   Max size    : 10 MB per file (10 485 760 bytes)
--   MIME types  : images only for v1 (jpg, png, webp, gif, svg)
--
-- ─── Row-level security ───────────────────────────────────────────────────────
--
--   The admin server uses the Supabase service-role key, which bypasses RLS.
--   RLS is enabled for defence-in-depth — anon / authenticated roles cannot
--   read or write to tenant_assets or storage objects.
--   Service role: full access (implicit, always bypasses RLS).
-- ────────────────────────────────────────────────────────────────────────────

-- ── Storage bucket ─────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-assets',
  'tenant-assets',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS — block all non-service-role access ───────────────────────────

DO $$
BEGIN
  CREATE POLICY "tenant_assets_storage_admin_only"
    ON storage.objects
    FOR ALL
    TO anon, authenticated
    USING (bucket_id = 'tenant-assets' AND false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Metadata table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_assets (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT         NOT NULL,

  -- Storage
  storage_path    TEXT         NOT NULL UNIQUE,   -- e.g. "mister-chameleon/uuid.png"
  public_url      TEXT         NOT NULL,           -- Supabase CDN public URL

  -- File info
  file_name       TEXT         NOT NULL,
  file_size       INTEGER,                         -- bytes; nullable for Sanity-sourced assets
  mime_type       TEXT,
  width           INTEGER,
  height          INTEGER,

  -- Asset classification
  --   "image"    — direct upload (jpeg, png, webp, gif, svg)
  --   "video"    — direct upload (mp4, webm, etc.)
  --   "document" — PDF or other document upload
  --   "sanity"   — mirrored from Sanity CMS asset library
  --   NULL       — legacy row before asset_type was introduced
  asset_type      TEXT,

  -- Sanity CMS integration
  --   Non-null when the asset was sourced from or mirrored to Sanity.
  --   Stores the Sanity document _id so the asset can be cross-referenced
  --   with the CMS asset library without a separate lookup.
  sanity_asset_id TEXT,

  -- Editorial metadata
  title           TEXT,                            -- human-readable label
  alt_text        TEXT,                            -- accessibility alt text
  tags            TEXT[]       NOT NULL DEFAULT '{}',
  uploaded_by     TEXT,                            -- admin email or "sanity-sync"

  -- Timestamps
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Idempotent column additions ────────────────────────────────────────────────
--
-- If tenant_assets already exists from a partial previous migration run, add
-- any columns that might be absent.
--
-- ─── NOT NULL strategy ────────────────────────────────────────────────────────
--
--   Columns originally defined as NOT NULL with no DEFAULT cannot be added
--   via ALTER TABLE to a table that already has rows (Postgres rejects it).
--   We therefore add them as nullable here — the NOT NULL constraint is only
--   enforced at INSERT/UPDATE time, and the CREATE TABLE IF NOT EXISTS above
--   already enforces it for fresh tables.  Columns that have a runtime DEFAULT
--   (timestamps, tags) are added with NOT NULL + DEFAULT so existing rows are
--   backfilled correctly.

DO $$
BEGIN
  -- storage_path — required for every asset; nullable variant safe for ADD COLUMN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN storage_path TEXT;
  END IF;

  -- public_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'public_url'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN public_url TEXT;
  END IF;

  -- file_name — used by idx_tenant_assets_file_name; must exist before index creation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'file_name'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN file_name TEXT;
  END IF;

  -- file_size
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'file_size'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN file_size INTEGER;
  END IF;

  -- mime_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN mime_type TEXT;
  END IF;

  -- width / height
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'width'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN width INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'height'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN height INTEGER;
  END IF;

  -- asset_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'asset_type'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN asset_type TEXT;
  END IF;

  -- sanity_asset_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'sanity_asset_id'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN sanity_asset_id TEXT;
  END IF;

  -- title — used by idx_tenant_assets_title; must exist before index creation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'title'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN title TEXT;
  END IF;

  -- alt_text
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'alt_text'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN alt_text TEXT;
  END IF;

  -- tags — NOT NULL with DEFAULT safe to add with backfill
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'tags'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
  END IF;

  -- uploaded_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN uploaded_by TEXT;
  END IF;

  -- created_at — NOT NULL with DEFAULT safe to add with backfill
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;

  -- updated_at — NOT NULL with DEFAULT safe to add with backfill
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tenant_assets ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Primary access pattern: list all assets for a tenant, newest first
CREATE INDEX IF NOT EXISTS idx_tenant_assets_tenant_created
  ON tenant_assets(tenant_id, created_at DESC);

-- Search by title (simple prefix search via LIKE)
-- Wrapped in DO $$ because title may be absent on partially-created tables.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'title'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'tenant_assets'
      AND indexname = 'idx_tenant_assets_title'
  ) THEN
    CREATE INDEX idx_tenant_assets_title
      ON tenant_assets(tenant_id, lower(title));
  END IF;
END $$;

-- Search by original filename
-- Wrapped in DO $$ because file_name may be absent on partially-created tables.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_assets'
      AND column_name = 'file_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'tenant_assets'
      AND indexname = 'idx_tenant_assets_file_name'
  ) THEN
    CREATE INDEX idx_tenant_assets_file_name
      ON tenant_assets(tenant_id, lower(file_name));
  END IF;
END $$;

-- Tag filtering (GIN for array containment operator @>)
CREATE INDEX IF NOT EXISTS idx_tenant_assets_tags
  ON tenant_assets USING GIN(tags);

-- Asset type filtering (only useful when filtering by type)
CREATE INDEX IF NOT EXISTS idx_tenant_assets_type
  ON tenant_assets(tenant_id, asset_type)
  WHERE asset_type IS NOT NULL;

-- Sanity asset cross-reference
CREATE INDEX IF NOT EXISTS idx_tenant_assets_sanity_id
  ON tenant_assets(sanity_asset_id)
  WHERE sanity_asset_id IS NOT NULL;

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_tenant_assets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tenant_assets_updated_at ON tenant_assets;

CREATE TRIGGER set_tenant_assets_updated_at
  BEFORE UPDATE ON tenant_assets
  FOR EACH ROW EXECUTE FUNCTION update_tenant_assets_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE tenant_assets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenant_assets'
      AND policyname = 'service_role_all_tenant_assets'
  ) THEN
    CREATE POLICY "service_role_all_tenant_assets"
      ON tenant_assets FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
