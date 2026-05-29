-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: normalise homepage slug "" → "home" in pages table
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The page-store strips leading "/" from slugs (so "/" → ""), but the
-- canonical homepage slug used by the platform, seed data, and the frontend
-- CMS lookup is "home".  Any legacy row with slug = "" represents the same
-- root page ("/") and must be normalised.
--
-- ─── Strategy ────────────────────────────────────────────────────────────────
--
--   1. DELETE rows where slug = "" AND a "home" row already exists for the
--      same tenant (true duplicate — keep the "home" authoritative row).
--
--   2. UPDATE remaining slug = "" rows to slug = "home", also fixing the slug
--      field stored inside the JSONB `page` column so all representations
--      are consistent.
--
-- Both steps are safe to re-run (idempotent): after the migration there are
-- no slug = "" rows in the table.
--
-- ─── Safety ───────────────────────────────────────────────────────────────────
--
--   The UNIQUE (tenant_id, slug) constraint prevents duplicates, so the
--   DELETE must happen before the UPDATE to avoid a constraint violation when
--   a "home" row already exists.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: remove "" duplicates where "home" already exists for the tenant.
DELETE FROM public.pages AS p_empty
WHERE p_empty.slug = ''
  AND EXISTS (
    SELECT 1
    FROM   public.pages p_home
    WHERE  p_home.tenant_id = p_empty.tenant_id
      AND  p_home.slug      = 'home'
  );

-- Step 2: rename any remaining "" slug rows to "home" (no competing row).
--   • slug column  → 'home'
--   • page JSONB   → slug field inside JSON also updated so EditablePage is consistent
--   • updated_at   → bumped so callers know the row changed
UPDATE public.pages
SET
  slug       = 'home',
  page       = jsonb_set(page, '{slug}', '"home"'::jsonb),
  updated_at = now()
WHERE slug = '';
