-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add tenant_id to ai_decision_logs
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Adds a nullable `tenant_id` column so AI decisions can be filtered and
-- aggregated per tenant in the admin AI Logs dashboard
-- (/admin/ai-logs?tenant=<slug>).
--
-- ─── Design notes ─────────────────────────────────────────────────────────────
--
--   • Nullable (not a FK) because tenants live in a JSON store, not Postgres.
--   • Rows written before this migration will have NULL — the dashboard
--     treats NULL as "unknown tenant" and groups them under an "–" label.
--   • The application layer sends tenant_id as the TenantConfig.tenantId slug
--     (e.g. "mister-chameleon").
--   • An index is added for the common per-tenant query pattern:
--       WHERE tenant_id = $1 ORDER BY created_at DESC
--
-- ─── Never stored ─────────────────────────────────────────────────────────────
--
--   API keys are never logged — they travel through process.env only.
--   The `context` JSONB column stores only visitor signals (source, device,
--   visitType, utm*, referrer); no credentials or PII beyond session scope.
--
-- Run AFTER: 20240101000004_create_ai_decision_logs.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_decision_logs
  ADD COLUMN IF NOT EXISTS tenant_id text NULL;

-- ── Index ─────────────────────────────────────────────────────────────────────

-- Per-tenant dashboard queries:
--   SELECT * FROM ai_decision_logs WHERE tenant_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_tenant_id
  ON public.ai_decision_logs (tenant_id);

-- ── Comment ───────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.ai_decision_logs.tenant_id IS
  'Tenant slug that originated the AI decision (e.g. "mister-chameleon"). '
  'Nullable — rows written before this migration will be NULL. '
  'Not a foreign key: tenants are stored in a JSON file, not a Postgres table.';
