-- migration 138 — webhook_deliveries
--
-- Audit log of outbound Lead Base webhook attempts: status, attempt count, error,
-- and the full payload (for replay from the admin). Lets you see whether events
-- reached your receiver and re-send the ones that failed. See docs/lead-base-design.md.

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  event       TEXT NOT NULL,
  target_url  TEXT NOT NULL,
  ok          BOOLEAN NOT NULL DEFAULT false,
  status_code INT,
  attempts    INT NOT NULL DEFAULT 1,
  error       TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_tenant_created_idx ON webhook_deliveries (tenant_id, created_at DESC);
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
