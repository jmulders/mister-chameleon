-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 101 — Rate limiting counters
--
-- Provides a Supabase-backed sliding-window rate limiter for the Next.js
-- middleware.  Each row tracks the request count for an (identifier, window)
-- pair.  Expired windows are cleaned up by a scheduled DELETE or pg_cron.
--
-- Table: rate_limit_counters
--   identifier  — IP address or tenant_id or API key hash
--   window_key  — Truncated timestamp string, e.g. "2026-04-28T20:15" (1-minute window)
--   count       — Requests seen in this window
--   created_at  — When the window was first seen (for TTL cleanup)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  identifier  TEXT        NOT NULL,
  window_key  TEXT        NOT NULL,
  count       INTEGER     NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, window_key)
);

-- Index for TTL cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at
  ON public.rate_limit_counters (created_at);

COMMENT ON TABLE public.rate_limit_counters IS
  'Sliding-window request counters for API rate limiting. '
  'Rows older than 10 minutes are safe to delete.';

-- ── increment_rate_limit ──────────────────────────────────────────────────────
--
-- Atomically increments the counter for (identifier, window_key) and returns
-- the new count.  Uses INSERT … ON CONFLICT DO UPDATE for atomicity.
--
-- Usage in middleware:
--   SELECT public.increment_rate_limit('ip:1.2.3.4', '2026-04-28T20:15')
--   → returns 3  (third request in this window)

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_identifier TEXT,
  p_window_key TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limit_counters (identifier, window_key, count, created_at)
  VALUES (p_identifier, p_window_key, 1, NOW())
  ON CONFLICT (identifier, window_key)
  DO UPDATE SET count = rate_limit_counters.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

-- ── cleanup_rate_limit_counters ───────────────────────────────────────────────
--
-- Deletes counters older than 10 minutes.  Call from a pg_cron job or a
-- scheduled server action to keep the table small.
--
-- pg_cron example (run every 5 minutes):
--   SELECT cron.schedule('rate-limit-cleanup', '*/5 * * * *',
--     'SELECT public.cleanup_rate_limit_counters()');

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_counters()
RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limit_counters
  WHERE created_at < NOW() - INTERVAL '10 minutes';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.increment_rate_limit       IS 'Atomically increment a rate limit counter, returning the new count';
COMMENT ON FUNCTION public.cleanup_rate_limit_counters IS 'Purge expired rate limit windows (older than 10 minutes)';
