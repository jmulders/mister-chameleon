-- Migration 159 — ad_publisher_accounts
--
-- Platform-wide publisher accounts for the ad network's revenue-share side.
-- A publisher is identified by its domain (the same `publisher_domain` string
-- recorded on ad_events / ad_stats_daily when an ad is served on that site).
-- Unlike the per-advertiser `ad_publishers` table (an advertiser's approved
-- domains), this is ONE row per publisher across all advertisers — the entity
-- that earns a revenue share and (later) gets paid out.
--
-- revshare_pct: this publisher's cut of the ad revenue they generate, as a
-- percentage (0–100). NULL = inherit the platform default (platform ad-pricing
-- settings, revsharePct). Set by a platform super-admin only.
--
-- Service-role only: RLS enabled, no policies (matches the other ad tables).

CREATE TABLE IF NOT EXISTS public.ad_publisher_accounts (
  publisher_domain text PRIMARY KEY,
  name             text,
  revshare_pct     numeric,                 -- NULL = inherit platform default
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_publisher_accounts ENABLE ROW LEVEL SECURITY;
-- No policies → only the service-role key (getDb) can read/write.
