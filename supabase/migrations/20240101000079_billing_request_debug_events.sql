-- migration 079: billing_request_debug_events
--
-- Persists a full BillingRequestDebug snapshot for every enrichment pipeline run.
-- Lightweight ring-buffer: rows older than 30 days are pruned by the cleanup trigger.
--
-- PART 3 of the billing monitoring spec.
--
-- ── Table ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_request_debug_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT        NOT NULL,
  request_id          TEXT        NOT NULL,

  -- Route / origin of the request (e.g. "/", "/api/enrichment/leadinfo")
  route               TEXT,

  -- Billing mode at the time of the request
  billing_mode        TEXT        NOT NULL DEFAULT 'live'
                        CHECK (billing_mode IN ('live', 'simulated', 'disabled')),
  demo_mode           BOOLEAN     NOT NULL DEFAULT false,

  -- Wallet before/after in decimal credits (1 credit = €0.01)
  wallet_before       NUMERIC(18, 4),
  wallet_after        NUMERIC(18, 4),
  total_credits_used  NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_price         NUMERIC(18, 6) NOT NULL DEFAULT 0,  -- EUR

  -- Aggregate result bucket
  -- "charged"   → at least one stage was debited
  -- "cached"    → all billable stages were cache hits
  -- "skipped"   → billing disabled / simulated
  -- "failed"    → at least one debit failure
  -- "empty"     → no billable stages evaluated
  result              TEXT        NOT NULL DEFAULT 'empty'
                        CHECK (result IN ('charged', 'cached', 'skipped', 'failed', 'empty')),

  -- Full BillingRequestDebug.stages array serialised as JSONB
  -- Shape: BillingStageDebugEntry[] — see billing/request-debug.ts
  entries             JSONB       NOT NULL DEFAULT '[]',

  -- Human-readable anomaly strings (BillingRequestDebug.anomalies)
  anomalies           JSONB       NOT NULL DEFAULT '[]',

  -- Number of anomalies — indexed for fast "requests with anomalies" queries
  anomaly_count       INT         NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary admin query: recent requests for a tenant
CREATE INDEX IF NOT EXISTS idx_billing_request_debug_tenant_created
  ON billing_request_debug_events (tenant_id, created_at DESC);

-- Anomaly filter
CREATE INDEX IF NOT EXISTS idx_billing_request_debug_anomalies
  ON billing_request_debug_events (tenant_id, anomaly_count)
  WHERE anomaly_count > 0;

-- Request ID lookup (for deduplication)
CREATE INDEX IF NOT EXISTS idx_billing_request_debug_request_id
  ON billing_request_debug_events (request_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
--
-- This table is accessed exclusively through the service role key
-- (server-side admin routes only).  RLS is enabled but all policies
-- require the service role — client-side access is not permitted.

ALTER TABLE billing_request_debug_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default.
-- No client-facing policies are defined intentionally.

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE billing_request_debug_events IS
  'Per-request billing debug snapshots from the enrichment pipeline. '
  'Written by trackEnrichmentUsage() after every pipeline run. '
  'Entries older than 30 days should be pruned periodically.';

COMMENT ON COLUMN billing_request_debug_events.entries IS
  'JSONB array of BillingStageDebugEntry — one per evaluated enrichment stage. '
  'Includes: stageLabel, enrichmentType, billable, cacheHit, result, '
  'unitPriceEur, creditCost, centsCharged, balanceBefore/After, error.';

COMMENT ON COLUMN billing_request_debug_events.anomalies IS
  'Human-readable anomaly strings from BillingRequestDebug.anomalies. '
  'Examples: "3 stages ran but 0 credits charged", "billing disabled".';

-- ── Repair: convert tenant_id from UUID to TEXT if the table was already created ──
--
-- An earlier version of this migration used UUID for tenant_id.  The platform
-- uses text tenant slugs (e.g. "mister-chameleon"), not UUIDs, so every INSERT
-- from billing/request-debug-store.ts would fail with 22P02 (invalid UUID syntax).
-- Safe to re-run: no-op when tenant_id is already TEXT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'billing_request_debug_events'
      AND column_name  = 'tenant_id'
      AND data_type    = 'uuid'
  ) THEN
    ALTER TABLE billing_request_debug_events
      ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::TEXT;
  END IF;
END $$;
