-- migration 147 — lead suppression list (unsubscribe / opt-out / consent withdrawal)
--
-- When someone unsubscribes in an ESP or withdraws consent, their email is
-- suppressed: excluded from retargeting audiences (the segment resolver skips
-- them) and immediately removed from the ad platforms. Keyed by lowercased
-- email per tenant. Fed by the inbound suppression webhook
-- (POST /api/webhooks/suppression) or GDPR erasure.

CREATE TABLE IF NOT EXISTS lead_suppressions (
  tenant_id  TEXT        NOT NULL,
  email      TEXT        NOT NULL,          -- lowercased
  reason     TEXT,
  source     TEXT,                          -- mailchimp | manual | consent_withdrawal | ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, email)
);

ALTER TABLE lead_suppressions ENABLE ROW LEVEL SECURITY;
