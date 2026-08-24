-- Migration 171: Design Effect Sets (reusable declarative-effect library)
--
-- Creates the `design_effect_sets` table: a persistent library of named block
-- effect payloads (design-system/effects) that an operator can save, reuse, and
-- assign to blocks (via BlockEffectRef.effectSet). Mirrors design_token_sets
-- (migration 166) exactly, including scope and RLS posture.
--
-- Scoping:
--   tenant_id NULL  -> platform-wide, reusable by any tenant
--   tenant_id set   -> tenant-specific set
--
-- `effects` stores an array of declarative BlockEffectConfig objects
--   [{ effect: "reveal", params: { duration: 600 } }, ...]
-- validated against the effect registry in the application layer. There is no
-- raw-JS field by design: effects are declarative references only.
--
-- Access is controlled at the application layer (admin-only server actions).
-- RLS is enabled with no policy so only the service role can read/write.
--
-- Tenant-wide DEFAULT effects (applied to blocks with no own effect ref) are
-- stored on tenant_settings.design.defaultEffects (JSON) and need no schema.

CREATE TABLE IF NOT EXISTS design_effect_sets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL    DEFAULT now(),
  updated_at  timestamptz NOT NULL    DEFAULT now(),

  -- Optional tenant scope. NULL = platform-wide; set = tenant-specific.
  tenant_id   text,

  -- Human-readable set name, unique within its scope.
  name        text        NOT NULL,

  -- Array of declarative BlockEffectConfig objects.
  effects     jsonb       NOT NULL    DEFAULT '[]'::jsonb,

  -- Optional block-type scope (e.g. ["hero"]); empty/absent = any block type.
  slots       jsonb,

  CONSTRAINT design_effect_sets_tenant_name_unique
    UNIQUE NULLS NOT DISTINCT (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS design_effect_sets_tenant_id_idx
  ON design_effect_sets (tenant_id);

CREATE OR REPLACE FUNCTION set_design_effect_sets_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_effect_sets_updated_at ON design_effect_sets;
CREATE TRIGGER design_effect_sets_updated_at
  BEFORE UPDATE ON design_effect_sets
  FOR EACH ROW EXECUTE PROCEDURE set_design_effect_sets_updated_at();

ALTER TABLE design_effect_sets ENABLE ROW LEVEL SECURITY;
