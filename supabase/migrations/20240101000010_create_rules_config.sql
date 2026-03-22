-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create rules_config table
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Replaces the file-based decision/rules/runtime-rules.json store with a
-- Supabase-backed table.  Stores the operator-authored homepage rules
-- configuration as JSONB so it survives Vercel deployments and can be
-- updated at runtime without filesystem access.
--
-- ─── Design ──────────────────────────────────────────────────────────────────
--
--   The table uses a `key` column (text PK) rather than a single-row pattern
--   so that additional rule sets can be stored in future (e.g. per-tenant or
--   per-page configurations) without a schema change.
--
--   For the current single-tenant phase, the application always reads and
--   writes the row with key = 'homepage'.
--
-- ─── Column reference ────────────────────────────────────────────────────────
--
--   key         — logical config name; currently always 'homepage'
--   config      — full StoredRulesConfig object serialised as JSONB
--   updated_at  — last write timestamp; maintained by the application layer
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rules_config (
  key        text        NOT NULL,
  config     jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rules_config_pkey PRIMARY KEY (key)
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Only the service-role key may read or write this table.

ALTER TABLE public.rules_config ENABLE ROW LEVEL SECURITY;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.rules_config           IS 'Stores operator-authored homepage rules configurations as JSONB. Replaces the local decision/rules/runtime-rules.json file.';
COMMENT ON COLUMN public.rules_config.key       IS 'Logical config name. Currently always "homepage". Reserved for future per-tenant / per-page configs.';
COMMENT ON COLUMN public.rules_config.config    IS 'Full StoredRulesConfig object serialised as JSONB. Validated via validateStoredConfig() before every write.';
COMMENT ON COLUMN public.rules_config.updated_at IS 'Last write timestamp, set server-side on every upsert.';

-- No seed row — the application falls back to SEED_RULES_CONFIG when the row
-- is absent, so an empty table is a valid initial state.
