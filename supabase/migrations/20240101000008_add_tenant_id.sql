-- Migration: add tenant_id to events and served_variants
--
-- Scopes visitor history (page views, CTA clicks, served variants) by tenant so
-- that metrics for different tenants on the same platform are never commingled.
--
-- ── Strategy ──────────────────────────────────────────────────────────────────
--
--   Both columns are nullable so existing rows remain valid after the migration
--   and the platform continues to serve correctly without a data backfill.
--
--   Queries filter with:
--     tenant_id = $tenantId  OR  tenant_id IS NULL
--
--   This means legacy rows (tenant_id IS NULL) are visible to all tenants until
--   the next write cycle replaces them with tenant-scoped rows — backward-
--   compatible degradation rather than a hard cut-over.
--
-- ── events ─────────────────────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS tenant_id text;

-- Index to make per-tenant event count queries fast.
CREATE INDEX IF NOT EXISTS idx_events_tenant_id
  ON events (tenant_id);

-- ── served_variants ────────────────────────────────────────────────────────────

ALTER TABLE served_variants
  ADD COLUMN IF NOT EXISTS tenant_id text;

CREATE INDEX IF NOT EXISTS idx_served_variants_tenant_id
  ON served_variants (tenant_id);
