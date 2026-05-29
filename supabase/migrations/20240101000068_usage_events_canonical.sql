-- migration 068: usage_events_canonical
--
-- Adds the three columns that make usage_events the single source of truth
-- for enrichment billing, replacing the non-existent enrichment_usage table.
--
-- New columns:
--   billable     BOOLEAN     — whether this stage was intended to be billed
--                              (false = cache hit, free tier, or blocked before running)
--   price        NUMERIC     — EUR amount charged (supports fractions: 0.001, 0.030)
--   credits_used NUMERIC     — credits deducted from wallet (supports fractions: 0.25, 3.0)
--
-- Existing column kept for backward compat:
--   credits_cost INTEGER     — integer credits cost; still written alongside credits_used
--
-- All three are idempotent (IF NOT EXISTS) — safe to re-run.
--
-- Why this is needed:
--   enrichment_usage does not exist in the live database.  All billing code
--   that previously wrote to enrichment_usage is redirected here.
--   The integer credits_cost column cannot represent fractional pricing
--   (e.g. 0.25 credits for micro-enrichments) — hence the NUMERIC columns.

ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS billable      BOOLEAN        NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price         NUMERIC(12, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_used  NUMERIC(12, 6) NOT NULL DEFAULT 0;

-- Back-fill price and credits_used from credits_cost for existing rows.
-- One-time; idempotent because rows already set to 0 stay 0 until back-filled.
UPDATE usage_events
SET
  credits_used = credits_cost,
  price        = credits_cost::numeric / 100
WHERE credits_used = 0
  AND credits_cost > 0;
