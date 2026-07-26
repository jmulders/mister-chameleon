-- Migration 161 — per-advertiser publisher accounts + payouts
--
-- Moves the publisher revenue-share relationship from platform-wide (one row
-- per publisher_domain) to per-advertiser (advertiser ↔ publisher). Each
-- advertiser tenant now sets its own revshare %, contact details, and payout
-- ledger per publisher domain.
--
-- Additive only — the legacy platform-wide tables (ad_publisher_accounts) are
-- left untouched; the per-advertiser page uses the new table below. Safe to
-- apply without data loss.
--
-- Service-role only: RLS enabled, no policies (matches the other ad tables).

-- ── Per-advertiser publisher accounts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_publisher_tenant_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_tenant_id     text NOT NULL,             -- the advertiser tenant
  publisher_domain text NOT NULL,             -- the publisher site domain
  name             text,
  revshare_pct     numeric,                   -- NULL = inherit platform default
  contact_email    text,
  vat_number       text,
  coc_number       text,
  payout_notes     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ad_publisher_tenant_accounts_uq
  ON public.ad_publisher_tenant_accounts (ad_tenant_id, publisher_domain);

ALTER TABLE public.ad_publisher_tenant_accounts ENABLE ROW LEVEL SECURITY;

-- ── Scope payouts to the advertiser tenant ────────────────────────────────────
ALTER TABLE public.ad_publisher_payouts
  ADD COLUMN IF NOT EXISTS ad_tenant_id text;

CREATE INDEX IF NOT EXISTS ad_publisher_payouts_tenant_domain_idx
  ON public.ad_publisher_payouts (ad_tenant_id, publisher_domain);
