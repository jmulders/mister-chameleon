-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create pages table
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Replaces the file-based page-store/data/pages.json store with a Supabase-
-- backed table.  Stores admin-editable page definitions as JSONB rows, one
-- row per page, enabling live content updates in serverless deployments.
--
-- ─── Column reference ────────────────────────────────────────────────────────
--
--   id          — stable page identifier (CMS _id or admin-generated UUID)
--   tenant_id   — owning tenant slug, e.g. "workengine"
--   slug        — URL slug without leading slash, e.g. "about-us" or ""
--   page        — full EditablePage object serialised as JSONB
--   created_at  — row creation timestamp
--   updated_at  — last write timestamp; maintained by the application layer
--
-- ─── Uniqueness ──────────────────────────────────────────────────────────────
--
--   (tenant_id, slug) is UNIQUE — each tenant may only have one page per slug.
--   This mirrors the application-level uniqueness enforced by the file store
--   and enables O(1) slug lookups.
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pages (
  id         text        NOT NULL,
  tenant_id  text        NOT NULL,
  slug       text        NOT NULL,
  page       jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pages_pkey PRIMARY KEY (id),

  -- One slug per tenant — prevents duplicate routes.
  CONSTRAINT pages_tenant_slug_unique UNIQUE (tenant_id, slug)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pages_tenant_id
  ON public.pages (tenant_id);

CREATE INDEX IF NOT EXISTS idx_pages_tenant_slug
  ON public.pages (tenant_id, slug);

-- GIN index on the JSONB column for any future full-document searches.
CREATE INDEX IF NOT EXISTS idx_pages_page_gin
  ON public.pages USING gin (page);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Only the service-role key may read or write this table.

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.pages           IS 'One row per admin-editable page. Stores the full EditablePage object as JSONB. Replaces the local page-store/data/pages.json file.';
COMMENT ON COLUMN public.pages.id        IS 'Stable page identifier. Matches the CMS document _id for CMS-originated pages; generated UUID for admin-created pages.';
COMMENT ON COLUMN public.pages.tenant_id IS 'Owning tenant slug, e.g. "workengine".';
COMMENT ON COLUMN public.pages.slug      IS 'URL slug without leading slash, e.g. "about-us". Empty string for the root page "/".';
COMMENT ON COLUMN public.pages.page      IS 'Full EditablePage object serialised as JSONB. Includes contextSlots, contentBlocks, seo, and audit timestamps.';
COMMENT ON COLUMN public.pages.created_at IS 'Row creation timestamp, set by the database on insert.';
COMMENT ON COLUMN public.pages.updated_at IS 'Last write timestamp, maintained by the application layer on every upsert.';
