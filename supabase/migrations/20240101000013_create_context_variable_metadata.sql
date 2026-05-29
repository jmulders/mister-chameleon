-- ── context_variable_metadata ─────────────────────────────────────────────────
--
-- Stores editable metadata for both built-in and custom context variables.
--
-- ─── Design intent ────────────────────────────────────────────────────────────
--
--   The static context/registry.ts defines the immutable system fields for
--   every built-in variable (key, type, source, operators, allowedValues).
--   This table holds the operator-editable overlay:
--
--     label          — human-readable display name (overrides registry default)
--     description    — longer explanation (overrides registry default)
--     enabled        — when false the variable is hidden from rules/AI selection
--     usable_in_rules — runtime gate in addition to availableToRules flag
--     usable_in_ai   — runtime gate in addition to availableToAI flag
--     category       — optional grouping label for admin UI
--     sort_order     — display order within a category or source group
--     is_custom      — true only for variables created via the admin UI;
--                      built-in (registry) variables always have is_custom = false
--
-- ─── Custom variables ─────────────────────────────────────────────────────────
--
--   When is_custom = true the row must also supply:
--     custom_type    — the ContextVarType for this variable
--     custom_source  — the ContextVarSource for this variable
--
--   These fields are null for built-in variables (type/source come from registry).
--
-- ─── Row lifecycle ────────────────────────────────────────────────────────────
--
--   Built-in variables: rows are created on first edit / first admin page visit.
--     key must match an entry in CONTEXT_VARIABLES.
--   Custom variables: rows are created via the admin UI.
--     key must NOT match any existing CONTEXT_VARIABLES entry.
--   Deleting a built-in row is forbidden at the application layer; the DB only
--   enforces NOT NULL on key.
--   Deleting a custom row removes it entirely — no soft delete needed.

CREATE TABLE IF NOT EXISTS context_variable_metadata (
  -- Primary key — matches the `key` field in ContextVariableDef for built-ins,
  -- or a slug chosen by the operator for custom variables.
  key                 text        NOT NULL PRIMARY KEY,

  -- Editable display fields (nullable — when null, registry defaults are used
  -- for built-ins; required when is_custom = true).
  label               text        NULL,
  description         text        NULL,

  -- Availability gates (nullable — when null, registry availableToRules /
  -- availableToAI values are used for built-ins).
  -- For custom variables these must be set explicitly on creation.
  usable_in_rules     boolean     NULL,
  usable_in_ai        boolean     NULL,

  -- Soft-disable flag: when false the variable is hidden from rules / AI
  -- selection but remains in the DB.  Defaults to true.
  enabled             boolean     NOT NULL DEFAULT true,

  -- Optional grouping and ordering for admin UI display.
  category            text        NULL,
  sort_order          integer     NOT NULL DEFAULT 0,

  -- Origin flag.
  is_custom           boolean     NOT NULL DEFAULT false,

  -- Type / source overrides — required when is_custom = true.
  -- Must be null for built-in variables (they use registry values).
  custom_type         text        NULL CHECK (custom_type IN ('string','enum','number','boolean')),
  custom_source       text        NULL CHECK (custom_source IN ('request','session','history','tenant','page','enrichment')),

  -- Timestamps.
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current automatically.
CREATE OR REPLACE FUNCTION set_context_variable_metadata_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_context_variable_metadata_updated_at ON context_variable_metadata;
CREATE TRIGGER trg_context_variable_metadata_updated_at
  BEFORE UPDATE ON context_variable_metadata
  FOR EACH ROW EXECUTE FUNCTION set_context_variable_metadata_updated_at();

-- Index for listing/filtering by category (admin UI group-by).
CREATE INDEX IF NOT EXISTS idx_context_variable_metadata_category
  ON context_variable_metadata (category)
  WHERE category IS NOT NULL;

-- Index for listing only custom variables.
CREATE INDEX IF NOT EXISTS idx_context_variable_metadata_custom
  ON context_variable_metadata (is_custom)
  WHERE is_custom = true;
