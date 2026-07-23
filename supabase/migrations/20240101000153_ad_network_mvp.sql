-- Ad-network MVP
--
-- An "advertiser" tenant serves ads (block-variant creatives) to APPROVED
-- publisher sites that embed the snippet with the advertiser's siteKey. Each
-- served ad is an impression; the ad's CTA is a tracked click. Impressions and
-- clicks are metered here and billed asynchronously against the advertiser's
-- wallet (billing/wallet.ts — 1 credit = EUR 0.01).
--
-- The tenant role + billing mode live in tenant_settings.settings (jsonb):
--   settings.tenantRole  = "advertiser"
--   settings.billingMode = "usage_ads"
-- so no tenant_settings column change is needed.
--
-- All access is server-side via the service-role client (data/db.ts → getDb),
-- which bypasses RLS. We still ENABLE RLS with no policies (deny-all for anon /
-- authenticated) to match the platform's "RLS on every table" posture.

-- ── Approved publishers (abuse + billing gate) ───────────────────────────────
create table if not exists public.ad_publishers (
  id               uuid primary key default gen_random_uuid(),
  ad_tenant_id     text not null,
  publisher_domain text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'blocked')),
  revshare_pct     numeric not null default 0,
  created_at       timestamptz not null default now(),
  approved_at      timestamptz,
  unique (ad_tenant_id, publisher_domain)
);
create index if not exists ad_publishers_tenant_idx
  on public.ad_publishers (ad_tenant_id, status);

-- ── Ads (creative + targeting + budget + pricing) ────────────────────────────
create table if not exists public.ads (
  id            uuid primary key default gen_random_uuid(),
  ad_tenant_id  text not null,
  name          text not null,
  slot_type     text not null
                  check (slot_type in ('hero','proof','cta','feature','conversion','notification')),
  -- Block-variant data in the renderBlockHtml() shape (title/subtitle/ctas/...).
  creative      jsonb not null default '{}'::jsonb,
  -- Advertiser landing URL; the /api/ad/click redirect only sends visitors here.
  click_url     text,
  -- Optional targeting: a rules_config-style condition tree (evaluateCondition).
  targeting     jsonb not null default '{}'::jsonb,
  pricing_model text not null default 'cpm' check (pricing_model in ('cpm', 'cpc')),
  -- CPM: price per 1000 impressions (cents). CPC: price per click (cents).
  rate_cents    numeric not null default 0,
  -- Campaign budget cap (cents). 0 = unlimited.
  budget_cents  numeric not null default 0,
  spent_cents   numeric not null default 0,
  -- Rotation weight among eligible ads for the same slot.
  weight        integer not null default 1,
  status        text not null default 'active' check (status in ('active','paused','ended')),
  start_at      timestamptz,
  end_at        timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ads_serving_idx
  on public.ads (ad_tenant_id, slot_type, status);

-- ── Raw impression / click events (append-only, high volume) ─────────────────
create table if not exists public.ad_events (
  id               uuid primary key default gen_random_uuid(),
  ad_tenant_id     text not null,
  ad_id            uuid not null,
  publisher_domain text,
  event_type       text not null check (event_type in ('impression','click')),
  session_id       text,          -- the visitor's mc_vid
  -- Deterministic dedup key so the per-slot burst / retried clicks collapse to one.
  event_key        text,
  occurred_at      timestamptz not null default now(),
  -- Rollup marker: false until the billing rollup has metered this event.
  billed           boolean not null default false,
  metadata         jsonb not null default '{}'::jsonb
);
-- Non-partial unique index so `ON CONFLICT (event_key)` infers cleanly. Postgres
-- treats NULLs as distinct, so rows without a key never collide.
create unique index if not exists ad_events_dedup_idx
  on public.ad_events (event_key);
create index if not exists ad_events_rollup_idx
  on public.ad_events (billed, occurred_at);
create index if not exists ad_events_freq_idx
  on public.ad_events (session_id, ad_id, occurred_at);

-- ── Daily rollup (reporting + billed spend) ──────────────────────────────────
create table if not exists public.ad_stats_daily (
  ad_id            uuid not null,
  ad_tenant_id     text not null,
  publisher_domain text not null default '',
  date             date not null,
  impressions      bigint  not null default 0,
  clicks           bigint  not null default 0,
  spend_cents      numeric not null default 0,
  primary key (ad_id, publisher_domain, date)
);
create index if not exists ad_stats_daily_tenant_idx
  on public.ad_stats_daily (ad_tenant_id, date);

-- ── RLS: deny-all (server uses the service-role client, which bypasses RLS) ──
alter table public.ad_publishers  enable row level security;
alter table public.ads            enable row level security;
alter table public.ad_events      enable row level security;
alter table public.ad_stats_daily enable row level security;
