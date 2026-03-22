-- ── form_submissions ──────────────────────────────────────────────────────────
--
-- Stores validated form submissions from the /api/forms/[formKey] endpoint.
-- Written when FormDefinition.action.storeSubmissions is true.
--
-- Design notes:
--   - `values`     is jsonb so arbitrary field shapes are stored without schema
--                  changes when new form types are added.
--   - `session_id` is nullable so submissions are never blocked by the absence
--                  of a platform session (direct API calls, future mobile apps).
--                  ON DELETE SET NULL preserves submission data if the session
--                  row is cleaned up.
--   - `form_key`   is plain text (not a FK) so submissions survive a form being
--                  removed from the registry — the historical data remains intact.

CREATE TABLE IF NOT EXISTS form_submissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  form_key    text        NOT NULL,
  values      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  session_id  uuid        NULL REFERENCES sessions(id) ON DELETE SET NULL
);

-- Index for per-form reporting and admin queries
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_key
  ON form_submissions (form_key);

-- Index for session-linked lookups (e.g. "did this session submit a contact form?")
CREATE INDEX IF NOT EXISTS idx_form_submissions_session_id
  ON form_submissions (session_id)
  WHERE session_id IS NOT NULL;

-- Optional: Row Level Security.
-- The table is written exclusively by the service-role key (server-only).
-- Enable RLS and add a policy here when read access from the Supabase dashboard
-- or client-side code is needed.
--
-- ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
