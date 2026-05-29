-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add title column to pages table
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Adds a top-level `title` column to the pages table.
--
-- Rationale
-- ─────────
-- The title was previously stored only inside the `page` JSONB column.
-- Having it as a dedicated column enables indexed lookups, clearer audit
-- logs, and avoids a JSON extraction on every query that only needs the
-- title.  The application layer already carries EditablePage.title; this
-- change aligns the DB schema with the application model.
--
-- Backfill
-- ────────
-- Existing rows have their title extracted from the `page` JSONB so the
-- column can be set NOT NULL without a default value.  Any row whose JSONB
-- lacks a `title` key falls back to the slug (which is always present and
-- non-null), keeping the migration safe to run against production data.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add the column as nullable so the backfill can run first.
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS title text;

-- 2. Backfill from the JSONB column; fall back to slug when title is absent.
UPDATE public.pages
   SET title = COALESCE(
     page->>'title',   -- EditablePage.title stored in JSONB
     slug,             -- slug is always non-null; use as last resort
     '(untitled)'      -- ultimate safety net (slug should never be null)
   )
 WHERE title IS NULL;

-- 3. Now that every row has a value, enforce NOT NULL.
ALTER TABLE public.pages
  ALTER COLUMN title SET NOT NULL;

-- ── Index ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pages_title
  ON public.pages (title);

-- ── Comment ───────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.pages.title IS
  'Human-readable page title, mirrors EditablePage.title. '
  'Kept in sync by the application layer on every upsert.';
