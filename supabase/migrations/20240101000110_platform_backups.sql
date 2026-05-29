-- ── Migration 110: Platform Backups ──────────────────────────────────────────
--
-- Creates the platform_backups table, which stores versioned snapshots of all
-- platform configuration tables.  Unlike filesystem-based backups (scripts/
-- backup.ts), these snapshots are stored in Supabase itself, making them
-- available whether the app runs locally or on Vercel.
--
-- ─── What is backed up ────────────────────────────────────────────────────────
--
--   Configuration tables only — not analytics/event data (sessions, events, etc.)
--   The full list is defined in the backup API route.
--
-- ─── Versioning ───────────────────────────────────────────────────────────────
--
--   Each backup gets a monotonically-increasing version number.
--   Restoring from version N creates a new backup entry labelled
--   "Restored from v{N}" so the history is always append-only and auditable.
--
-- ─── Schema note ──────────────────────────────────────────────────────────────
--
--   `data` is a JSONB object keyed by table name, with an array of rows as
--   the value.  E.g.:
--
--     {
--       "tenants": [ { "id": "...", "name": "..." }, ... ],
--       "platform_settings": [ ... ]
--     }
--
--   For large datasets this column may grow large.  The first 20 backups are
--   kept automatically; older ones are pruned when a new backup is created
--   (enforced in the backup API route, not by DB trigger, to avoid surprises).
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_backups (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL    DEFAULT now(),
  created_by   text        NOT NULL    DEFAULT 'admin',
  label        text,                               -- optional human-readable description
  version      integer     NOT NULL,               -- sequential; set by INSERT
  status       text        NOT NULL    DEFAULT 'complete'
                           CHECK (status IN ('pending', 'complete', 'failed')),
  error        text,                               -- set when status = 'failed'
  tables       text[]      NOT NULL    DEFAULT '{}',
  row_count    integer     NOT NULL    DEFAULT 0,
  restored_from_version integer,                   -- set when this entry IS a restore
  data         jsonb       NOT NULL    DEFAULT '{}'
);

-- Unique, ascending version per backup
CREATE UNIQUE INDEX IF NOT EXISTS platform_backups_version_idx
  ON platform_backups (version);

-- Fast lookup of recent backups for the admin UI
CREATE INDEX IF NOT EXISTS platform_backups_created_at_idx
  ON platform_backups (created_at DESC);

-- RLS: only service-role key can read/write (admin API uses service role)
ALTER TABLE platform_backups ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated user can access this table — service role bypasses RLS
DROP POLICY IF EXISTS "deny all for non-service-role" ON platform_backups;
CREATE POLICY "deny all for non-service-role"
  ON platform_backups
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE platform_backups IS
  'Versioned platform configuration snapshots. Created via the admin system page or POST /api/admin/backup.';
