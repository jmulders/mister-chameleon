-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0102 — personalization_sessions
--
-- Creates the table that tracks unique personalised visitor sessions per tenant
-- per calendar month.  This is the source of truth for session-based billing.
--
-- Design decisions:
--   • PK is (tenant_id, month_key, session_id) — one row per unique session
--     per month per tenant.  The unique constraint also serves as the
--     ON CONFLICT DO NOTHING target so inserts are idempotent.
--   • month_key is "YYYY-MM" (e.g. "2026-04") — natural tumbling window.
--     No cron reset needed: queries always filter by the current month key.
--     Old rows from previous months are retained for analytics/funnel queries.
--   • session_id is TEXT (not UUID) to match the cookie value type and to
--     allow hashed/opaque tokens without UUID validation overhead.
--   • No RLS — this table is only accessed via the service-role key from
--     server-only code (plan-enforcement.ts, analytics RPCs).
--   • created_at is used by the analytics funnel migration (099) for
--     time-range queries (get_analytics_daily, get_analytics_funnel).
--
-- Related objects (created in other migrations):
--   session_credit_balances / session_credit_ledger  (migration 097)
--   get_analytics_funnel / get_analytics_daily / get_analytics_variants (migration 099)
--   deduct_session_credit()                           (migration 097)
--   increment_rate_limit()                            (migration 101)
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + idempotent index creation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS personalization_sessions (
  -- The tenant that served the personalised content.
  tenant_id   text        NOT NULL,

  -- Calendar month in "YYYY-MM" format (UTC).
  -- Queries always filter by the current month key so old rows are retained
  -- without affecting billing counts.
  month_key   text        NOT NULL,

  -- Stable, opaque visitor session token.  In practice this is the value of
  -- the mc_session_id cookie (a UUID string), but stored as text so that
  -- hashed or differently-formatted tokens can be used without schema changes.
  session_id  text        NOT NULL,

  -- When this session was first recorded in this month.
  -- Used by analytics RPCs (get_analytics_daily) for date-bucketed queries.
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Each (tenant, month, session) triple is counted exactly once.
  -- INSERT … ON CONFLICT DO NOTHING makes recordPersonalizedSession idempotent.
  PRIMARY KEY (tenant_id, month_key, session_id)
);

COMMENT ON TABLE personalization_sessions IS
  'One row per unique visitor session served a personalised experience per tenant per calendar month. '
  'Used for session-based billing (plan cap enforcement) and funnel analytics. '
  'Idempotent: inserting the same (tenant_id, month_key, session_id) is a no-op.';

COMMENT ON COLUMN personalization_sessions.month_key IS
  'Calendar month in YYYY-MM format (UTC). Filter by currentMonthKey() for billing; '
  'retain old rows for historical analytics.';

COMMENT ON COLUMN personalization_sessions.session_id IS
  'Visitor session token from mc_session_id cookie. Stored as text — no UUID validation.';

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Fast per-tenant monthly count (used by getMonthlySessionCount + checkSessionSoftCap).
CREATE INDEX IF NOT EXISTS idx_personalization_sessions_tenant_month
  ON personalization_sessions (tenant_id, month_key);

-- Fast per-tenant time-range scan (used by get_analytics_daily, get_analytics_funnel).
CREATE INDEX IF NOT EXISTS idx_personalization_sessions_tenant_created
  ON personalization_sessions (tenant_id, created_at DESC);
