-- migration 137 — abm_settings.webhook_secret
--
-- Optional per-tenant shared secret. When set, outbound Lead Base webhooks are
-- signed (HMAC-SHA256 over `${timestamp}.${rawBody}`) and sent with
-- X-MC-Timestamp + X-MC-Signature headers so the receiver (Zapier / n8n / custom)
-- can verify authenticity and reject replays. See docs/lead-base-design.md.

ALTER TABLE abm_settings ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
