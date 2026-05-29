-- ============================================================================
-- Migration 058: demo_instances — comprehensive column ensure
--
-- Root cause:
--   PGRST204 "Could not find the 'favicon_url' column of 'demo_instances'"
--
--   The table exists (earlier migration created it) but the live database is
--   missing the favicon_url column.  This happens when:
--     • The table was created by a partial or pre-favicon_url version of
--       migration 048, or
--     • Migration 052 was applied before the ADD COLUMN IF NOT EXISTS block
--       was stable on the live instance.
--
-- Fix:
--   Re-apply ADD COLUMN IF NOT EXISTS for every column that createDemoInstance
--   writes, so the schema is guaranteed to match the application code regardless
--   of which prior migrations actually ran.
--
-- Idempotency:
--   ADD COLUMN IF NOT EXISTS is safe to run repeatedly — it is a no-op when
--   the column already exists.  This migration can be applied in any order
--   relative to 048 and 052.
--
-- Schema contract (must stay in sync with demo/store.ts createDemoInstance):
--
--   Written by createDemoInstance:
--     id              TEXT PK           — 12-char random ID used in /demo/[id] URL
--     source_url      TEXT NOT NULL     — URL the demo was generated from
--     site_name       TEXT              — extracted from <title> / og:title
--     site_description TEXT             — extracted from meta description
--     site_category   TEXT              — detected industry
--     primary_color   TEXT              — hex color for theming
--     secondary_color TEXT              — darker variant
--     logo_url        TEXT (nullable)   — og:image or detected logo
--     favicon_url     TEXT (nullable)   ← MISSING in affected environments
--     scenarios       JSONB             — DemoScenario[]
--     expires_at      TIMESTAMPTZ NOT NULL
--     generated_by    TEXT (nullable)   — admin email or 'system'
--     generation_ms   INTEGER (nullable) — wall-clock generation time
--
--   Set by DB defaults (not written by app):
--     created_at      TIMESTAMPTZ DEFAULT now()
--     view_count      INTEGER DEFAULT 0
-- ============================================================================

-- ── Ensure table exists (no-op if 048/052 already ran) ───────────────────────

CREATE TABLE IF NOT EXISTS public.demo_instances (
  id              text        PRIMARY KEY,
  source_url      text        NOT NULL,
  site_name       text        NOT NULL DEFAULT '',
  site_description text       NOT NULL DEFAULT '',
  site_category   text        NOT NULL DEFAULT 'general',
  primary_color   text        NOT NULL DEFAULT '#3b82f6',
  secondary_color text        NOT NULL DEFAULT '#1e3a8a',
  logo_url        text,
  favicon_url     text,
  scenarios       jsonb       NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  view_count      integer     NOT NULL DEFAULT 0,
  generated_by    text,
  generation_ms   integer
);

-- ── Ensure all columns exist — idempotent backfill ────────────────────────────
--
-- Guards against the live table having been created with a different column set.
-- Each ADD COLUMN IF NOT EXISTS is a no-op when the column already exists.

ALTER TABLE public.demo_instances
  ADD COLUMN IF NOT EXISTS source_url       text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_name        text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_description text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_category    text        NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS primary_color    text        NOT NULL DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS secondary_color  text        NOT NULL DEFAULT '#1e3a8a',
  ADD COLUMN IF NOT EXISTS logo_url         text,
  ADD COLUMN IF NOT EXISTS favicon_url      text,
  ADD COLUMN IF NOT EXISTS scenarios        jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_at       timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at       timestamptz,
  ADD COLUMN IF NOT EXISTS view_count       integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generated_by     text,
  ADD COLUMN IF NOT EXISTS generation_ms    integer;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS demo_instances_expires_idx
  ON public.demo_instances (expires_at);

CREATE INDEX IF NOT EXISTS demo_instances_source_url_idx
  ON public.demo_instances (source_url);

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.demo_instances IS
  'Temporary prospect demo sites generated from a URL. One row per demo. '
  'Auto-expires — safe to purge after expires_at passes. '
  'Readable publicly via /api/demo/[id] (expiry enforced in code). '
  'No RLS — service-role key is required for all writes.';

COMMENT ON COLUMN public.demo_instances.favicon_url IS
  'Favicon href extracted from the source site. Nullable — many sites omit a favicon.';

COMMENT ON COLUMN public.demo_instances.scenarios IS
  'JSON array of 5 DemoScenario objects. '
  'Shape: [{ id, label, description, context{...}, experience{ hero, proof, cta } }]';
