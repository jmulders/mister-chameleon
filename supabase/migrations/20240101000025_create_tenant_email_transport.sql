-- ── tenant_email_transport ────────────────────────────────────────────────────
--
-- Stores per-tenant email transport configuration.
-- One row per tenant, keyed by tenant_id.
--
-- The `config` JSONB column maps to TenantEmailTransport in tenant/types.ts.
-- SMTP credentials stored here SHOULD be encrypted at the application layer
-- before writing and decrypted after reading.  The transport layer receives
-- already-decrypted values.
--
-- Consumed by:
--   forms/mail-transport.ts           — resolveTransportConfig() reads this
--   app/admin/tenants/[tenantId]/email-transport/actions.ts  — read/write actions
--
-- Transport type is stored inside `config.transportType` ("resend"|"smtp"|"none").
-- This allows the JSONB column to evolve without schema migrations.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_email_transport (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    text        NOT NULL,
  config       jsonb       NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_email_transport_pkey         PRIMARY KEY (id),
  CONSTRAINT tenant_email_transport_tenant_id_key UNIQUE (tenant_id)
);

-- Index for fast tenant_id lookups (used on every form submission).
CREATE INDEX IF NOT EXISTS tenant_email_transport_tenant_id_idx
  ON public.tenant_email_transport (tenant_id);

-- Enable Row Level Security (mirrors the pattern used by other tenant tables).
ALTER TABLE public.tenant_email_transport ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS.
-- Application reads/writes use the service role key (server-only routes).
