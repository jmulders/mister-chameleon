-- ============================================================================
-- Migration 052: Ensure demo_instances table exists
--
-- Safety net for environments where migration 048 was written but never pushed.
-- Every statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so this is
-- fully idempotent — safe to apply even after migration 048 has already run.
--
-- Root cause this fixes:
--   PGRST205 "Could not find the table 'public.demo_instances' in the schema
--   cache" — PostgREST returns this when the table is absent from the DB.
--   Running this migration creates the table (or verifies it exists) and
--   reloads the PostgREST schema cache.
--
-- Schema contract (must stay in sync with demo/store.ts):
--   • id              TEXT PK           — 12-char random ID used in /demo/[id] URL
--   • source_url      TEXT NOT NULL     — URL the demo was generated from
--   • site_name       TEXT NOT NULL DEFAULT ''
--   • site_description TEXT NOT NULL DEFAULT ''
--   • site_category   TEXT NOT NULL DEFAULT 'general'
--   • primary_color   TEXT NOT NULL DEFAULT '#3b82f6'
--   • secondary_color TEXT NOT NULL DEFAULT '#1e3a8a'
--   • logo_url        TEXT (nullable)
--   • favicon_url     TEXT (nullable)
--   • scenarios       JSONB NOT NULL DEFAULT '[]'  — DemoScenario[]
--   • created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
--   • expires_at      TIMESTAMPTZ NOT NULL
--   • view_count      INTEGER NOT NULL DEFAULT 0
--   • generated_by    TEXT (nullable)
--   • generation_ms   INTEGER (nullable)
-- ============================================================================

-- ── 1. Create table ───────────────────────────────────────────────────────────
--
-- Identical to migration 048.  IF NOT EXISTS makes this a no-op when 048 was
-- already applied.

CREATE TABLE IF NOT EXISTS public.demo_instances (

  -- Identity
  id              text        PRIMARY KEY,

  -- Source site metadata
  source_url      text        NOT NULL,
  site_name       text        NOT NULL DEFAULT '',
  site_description text       NOT NULL DEFAULT '',
  site_category   text        NOT NULL DEFAULT 'general',

  -- Brand signals
  primary_color   text        NOT NULL DEFAULT '#3b82f6',
  secondary_color text        NOT NULL DEFAULT '#1e3a8a',
  logo_url        text,
  favicon_url     text,

  -- Generated content (5 DemoScenario objects)
  scenarios       jsonb       NOT NULL DEFAULT '[]',

  -- Lifecycle
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  view_count      integer     NOT NULL DEFAULT 0,

  -- Generator metadata
  generated_by    text,
  generation_ms   integer
);

-- ── 2. Ensure all columns exist (idempotent backfill) ─────────────────────────
--
-- Guards against partial application of migration 048 or manual table creation
-- with a different column set.  ADD COLUMN IF NOT EXISTS is safe on any PG ≥ 9.6.

ALTER TABLE public.demo_instances
  ADD COLUMN IF NOT EXISTS source_url      text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_name       text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_description text       NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_category   text        NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS primary_color   text        NOT NULL DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS secondary_color text        NOT NULL DEFAULT '#1e3a8a',
  ADD COLUMN IF NOT EXISTS logo_url        text,
  ADD COLUMN IF NOT EXISTS favicon_url     text,
  ADD COLUMN IF NOT EXISTS scenarios       jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at      timestamptz,
  ADD COLUMN IF NOT EXISTS view_count      integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generated_by    text,
  ADD COLUMN IF NOT EXISTS generation_ms   integer;

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS demo_instances_expires_idx
  ON public.demo_instances (expires_at);

CREATE INDEX IF NOT EXISTS demo_instances_source_url_idx
  ON public.demo_instances (source_url);

-- ── 4. Table/column comments ──────────────────────────────────────────────────

COMMENT ON TABLE public.demo_instances IS
  'Temporary prospect demo sites generated from a URL. One row per demo. '
  'Auto-expires — safe to purge after expires_at passes. '
  'Readable publicly via /api/demo/[id] (expiry enforced in code). '
  'No RLS — service-role key is required for all writes.';

COMMENT ON COLUMN public.demo_instances.id IS
  'Short random ID (12 alphanumeric chars) used in /demo/[id] URL.';

COMMENT ON COLUMN public.demo_instances.scenarios IS
  'JSON array of 5 DemoScenario objects. '
  'Shape: [{ id, label, description, context{...}, experience{ hero, proof, cta } }]';

COMMENT ON COLUMN public.demo_instances.site_category IS
  'Detected industry: b2b_saas | agency | ecommerce | recruitment | general';
