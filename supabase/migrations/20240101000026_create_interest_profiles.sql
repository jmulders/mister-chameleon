-- ── interest_profiles ────────────────────────────────────────────────────────
--
-- Platform-managed interest profiles.
-- Operators configure profiles in /admin/interest-profiles.
-- The scoring engine reads active profiles to compute per-visitor interest scores.
--
-- Each row stores:
--   key         — URL-safe slug identifier; used as the context variable suffix
--   name        — human-readable label shown in admin UI
--   description — optional operator notes
--   tags        — JSONB array of { keyword: string, weight: number }
--   is_active   — only active profiles are evaluated at runtime
--
-- Consumed by:
--   interest-profiles/repository.ts  — CRUD and listing functions
--   interest-profiles/scoring.ts     — runtime scoring engine
--   context/registry.ts              — declares derived context variables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interest_profiles (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  key         text        NOT NULL,
  name        text        NOT NULL,
  description text,
  tags        jsonb       NOT NULL DEFAULT '[]',
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT interest_profiles_pkey      PRIMARY KEY (id),
  CONSTRAINT interest_profiles_key_uniq  UNIQUE (key)
);

-- Index for active-profile lookups (used on every page request with interest scoring).
CREATE INDEX IF NOT EXISTS interest_profiles_is_active_idx
  ON public.interest_profiles (is_active)
  WHERE is_active = true;

-- Enable Row Level Security.
ALTER TABLE public.interest_profiles ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically (used by server-only admin actions and the
-- scoring engine via getDb(), which uses SUPABASE_SERVICE_ROLE_KEY).
-- No explicit policies are required — authenticated web clients never access this table
-- directly; all reads/writes go through server-only Next.js routes.
