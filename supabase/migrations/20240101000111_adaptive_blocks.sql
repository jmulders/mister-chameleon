-- ── Migration 111: Adaptive Blocks (Content Matrix) ─────────────────────────
--
-- Creates the `adaptive_blocks` table, which stores the full Content Matrix
-- documents for the ChameleonHero component.
--
-- Each row represents one "adaptive hero block" — a container holding a
-- defaultVariant (SEO-safe fallback) and an array of adaptiveVariants
-- (personalised versions selected by the rule engine at render time).
--
-- ─── Why a separate table (not platform_cms_content) ─────────────────────────
--
--   platform_cms_content stores simple, flat variant records.
--   adaptive_blocks stores a hierarchical document (one default + N variants)
--   that requires a richer schema.  Keeping them in separate tables avoids
--   wide JSONB blobs in platform_cms_content and makes queries/edits cleaner.
--
-- ─── Tenant scope ────────────────────────────────────────────────────────────
--
--   tenant_id NULL  → platform-wide block (visible to all tenants as fallback)
--   tenant_id set   → tenant-specific override; takes precedence over the
--                     platform-wide block with the same key
--
-- ─── CMS provider routing ────────────────────────────────────────────────────
--
--   Sanity     → getAdaptiveBlock reads from the `adaptiveHero` Sanity document type
--   Storyblok  → getAdaptiveBlock reads from this table (platform-managed)
--   Statamic   → getAdaptiveBlock reads from this table (platform-managed)
--   Platform   → getAdaptiveBlock reads from this table
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS adaptive_blocks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL    DEFAULT now(),
  updated_at          timestamptz NOT NULL    DEFAULT now(),

  -- Routing key — matches the `key` used in getAdaptiveBlock() calls.
  -- E.g. "hero_matrix_homepage", "hero_matrix_about"
  key                 text        NOT NULL,

  -- Optional tenant scope.  NULL = platform-wide; set = tenant override.
  tenant_id           text,

  -- Human-readable label for the admin UI.
  label               text,

  -- When false, ChameleonHero renders nothing (block disabled).
  is_active           boolean     NOT NULL    DEFAULT true,

  -- SEO-safe fallback content.  Never contains {{tokens}}.
  -- Shape: { title, subtitle, tag?, ctas?, imageUrl?, imageAlt? }
  default_variant     jsonb       NOT NULL,

  -- Array of personalized variants.
  -- Shape: [{ variantKey, label?, content: { title, subtitle, tag?, ctas?, imageUrl?, imageAlt? } }]
  adaptive_variants   jsonb       NOT NULL    DEFAULT '[]'::jsonb,

  -- Uniqueness: one (key, tenant_id) combination per block.
  -- NULL tenant_id = platform block; two NULL tenant_ids should coexist if keys differ.
  CONSTRAINT adaptive_blocks_key_tenant_unique
    UNIQUE NULLS NOT DISTINCT (key, tenant_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- getAdaptiveBlock() always filters by key; include is_active to help skip
-- inactive blocks early without loading the JSONB columns.
CREATE INDEX IF NOT EXISTS adaptive_blocks_key_active_idx
  ON adaptive_blocks (key, is_active);

-- Admin UI: list all blocks for a given tenant quickly.
CREATE INDEX IF NOT EXISTS adaptive_blocks_tenant_id_idx
  ON adaptive_blocks (tenant_id);

-- ── Updated-at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_adaptive_blocks_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS adaptive_blocks_updated_at ON adaptive_blocks;
CREATE TRIGGER adaptive_blocks_updated_at
  BEFORE UPDATE ON adaptive_blocks
  FOR EACH ROW EXECUTE PROCEDURE set_adaptive_blocks_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
--
-- RLS is intentionally NOT enabled on this table.  Access is controlled at
-- the application layer (Next.js server actions + admin-only route guards),
-- identical to the other platform tables (platform_cms_content, tenants, etc.).
