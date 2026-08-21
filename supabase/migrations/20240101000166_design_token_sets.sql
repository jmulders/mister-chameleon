-- Migration 166: Design Token Sets (reusable token-override library)
--
-- Creates the `design_token_sets` table: a persistent library of named design
-- token payloads (the tenant design-token upload format) that an operator can
-- save, reuse, and apply to a tenant's design.tokenOverrides.
--
-- Scoping mirrors `adaptive_blocks` (migration 111):
--
--   tenant_id NULL  -> platform-wide, reusable by any tenant
--   tenant_id set   -> tenant-specific set
--
-- Each row stores a validated token upload payload (validateDesignTokenUpload
-- in tenant/design-token-validator.ts). `base_theme` and `typography_override`
-- map to the upload's `theme` and `typography` fields.
--
-- Access is controlled at the application layer (admin-only server actions).
-- RLS is enabled with no policy so only the service role can read/write, the
-- same posture applied to adaptive_blocks and friends in migration 148.

CREATE TABLE IF NOT EXISTS design_token_sets (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL    DEFAULT now(),
  updated_at          timestamptz NOT NULL    DEFAULT now(),

  -- Optional tenant scope. NULL = platform-wide; set = tenant-specific.
  tenant_id           text,

  -- Human-readable set name, unique within its scope.
  name                text        NOT NULL,

  -- Validated token upload payload (DesignTokenUploadInput shape).
  tokens              jsonb       NOT NULL    DEFAULT '{}'::jsonb,

  -- Optional base theme key (maps to the upload `theme`).
  base_theme          text,

  -- Optional typography override group (maps to the upload `typography`).
  typography_override jsonb,

  -- One (tenant_id, name) per scope. NULLS NOT DISTINCT so two platform sets
  -- (tenant_id NULL) with the same name collide, while different names coexist.
  CONSTRAINT design_token_sets_tenant_name_unique
    UNIQUE NULLS NOT DISTINCT (tenant_id, name)
);

-- Admin UI: list all sets for a given tenant quickly.
CREATE INDEX IF NOT EXISTS design_token_sets_tenant_id_idx
  ON design_token_sets (tenant_id);

-- Updated-at trigger (mirrors adaptive_blocks).
CREATE OR REPLACE FUNCTION set_design_token_sets_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_token_sets_updated_at ON design_token_sets;
CREATE TRIGGER design_token_sets_updated_at
  BEFORE UPDATE ON design_token_sets
  FOR EACH ROW EXECUTE PROCEDURE set_design_token_sets_updated_at();

-- RLS: enable with no policy (service-role-only), matching migration 148's
-- posture for the other application-guarded platform tables.
ALTER TABLE design_token_sets ENABLE ROW LEVEL SECURITY;
