-- Migration 160 — publisher payout layer (manual / offline; no money movement)
--
-- Extends ad_publisher_accounts with contact / tax details, and adds a payout
-- ledger. A payout row records that a publisher has been paid (manually /
-- offline) for some amount — it does NOT move money. Outstanding balance is
-- computed as: lifetime earned (settled ad revenue × revshare) − sum(payouts).
-- This is the seam where automated payouts (Stripe Connect) would plug in later.
--
-- Service-role only: RLS enabled, no policies.

ALTER TABLE public.ad_publisher_accounts
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS vat_number    text,
  ADD COLUMN IF NOT EXISTS coc_number    text,
  ADD COLUMN IF NOT EXISTS payout_notes  text;

CREATE TABLE IF NOT EXISTS public.ad_publisher_payouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_domain text NOT NULL,
  amount_cents     numeric NOT NULL,
  note             text,
  method           text,                      -- e.g. "bank transfer", "invoice"
  status           text NOT NULL DEFAULT 'paid',
  paid_at          timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_publisher_payouts_domain_idx
  ON public.ad_publisher_payouts (publisher_domain);

ALTER TABLE public.ad_publisher_payouts ENABLE ROW LEVEL SECURITY;
