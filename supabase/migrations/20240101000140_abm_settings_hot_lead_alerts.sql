-- migration 140 — abm_settings hot-lead Slack alerts
--
-- Optional per-tenant Slack incoming-webhook URL + a minimum hot-lead score.
-- When set, a qualifying lead whose score >= the threshold triggers a built-in
-- Slack alert — no Make/Zapier required. See docs/lead-base-design.md.

ALTER TABLE abm_settings ADD COLUMN IF NOT EXISTS notify_slack_url TEXT;
ALTER TABLE abm_settings ADD COLUMN IF NOT EXISTS notify_min_score INT;
