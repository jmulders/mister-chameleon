-- Migration 161 — email_sends (adaptive email send log + idempotency)
--
-- One row per adaptive-email send attempt: audit trail + idempotency. A triggered
-- send (e.g. after a form submit) passes a dedupe_key (the submission id) so a
-- retry can't send twice; ad-hoc/test sends leave it NULL (Postgres treats NULLs
-- as distinct, so repeated test sends are allowed).
--
-- Service-role only: RLS enabled, no policies.

CREATE TABLE IF NOT EXISTS public.email_sends (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL,
  template_key    text NOT NULL,
  recipient_email text NOT NULL,
  dedupe_key      text,
  subject         text,
  status          text NOT NULL DEFAULT 'sent',   -- sent | failed | skipped
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key, recipient_email, dedupe_key)
);

CREATE INDEX IF NOT EXISTS email_sends_tenant_idx ON public.email_sends (tenant_id, created_at);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
