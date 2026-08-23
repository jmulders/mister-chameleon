-- Migration 171 (prod): design_effect_sets — reusable declarative-effect library
--
-- Pure DDL (mirrors design_token_sets). Run in the Supabase SQL editor on prod
-- (kdhfpvjeriszteqhpgll), then record it in the ledger so `npm run db:migrate`
-- skips it. Safe / idempotent (IF NOT EXISTS). Service-role-only (RLS, no policy).
-- No app deploy ordering constraint: the table is only read/written by the new
-- code, so applying it before or with the deploy is both fine.

CREATE TABLE IF NOT EXISTS design_effect_sets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL    DEFAULT now(),
  updated_at  timestamptz NOT NULL    DEFAULT now(),
  tenant_id   text,
  name        text        NOT NULL,
  effects     jsonb       NOT NULL    DEFAULT '[]'::jsonb,
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

-- Ledger: record as applied so npm run db:migrate skips it on prod.
INSERT INTO public._migrations (filename) VALUES
  ('20240101000171_design_effect_sets.sql')
ON CONFLICT (filename) DO NOTHING;
