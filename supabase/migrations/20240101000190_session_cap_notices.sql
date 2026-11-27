-- migration 190 — session_cap_notices (a tenant is warned once per threshold)
--
-- A tenant gets a mail when the personalised sessions of the month reach 80%
-- of the plan and again when the plan is used up (billing/session-cap-notice.ts).
-- The count is read on many requests at once, so "have we said this already"
-- has to be answered by the database: this table holds one row per tenant,
-- month and threshold, and the insert that creates the row is the claim. Only
-- the request whose insert created it sends the mail.
--
-- Service role only: RLS on, no policies (the pattern of the cache tables).
-- Additive and idempotent. The code works without the table: the claim fails,
-- no mail goes out, nothing else changes. Prod-SQL apart aan Jasper.

CREATE TABLE IF NOT EXISTS session_cap_notices (
  tenant_id  TEXT         NOT NULL,
  month_key  TEXT         NOT NULL,                 -- "YYYY-MM", UTC, as in personalization_sessions
  threshold  INTEGER      NOT NULL,                 -- 80 or 100 (percent of the plan)
  sent_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, month_key, threshold)
);

ALTER TABLE session_cap_notices ENABLE ROW LEVEL SECURITY;
