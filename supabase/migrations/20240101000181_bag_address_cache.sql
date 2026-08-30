-- D5 Fase 1 — BAG per-address building-facts cache.
--
-- The BAG enricher looks up building year / use / area for a visitor's FORM
-- address (postcode + house number). This is the lazy cache: keyed on a SHA-256
-- hash of "postcode:huisnummer" — the raw address (personal data) is NEVER stored,
-- only the hash + the derived, non-personal building facts. Additive + idempotent.

create table if not exists public.bag_address_cache (
  addr_hash    text        primary key,   -- sha256("<POSTCODE>:<huisnummer>")
  build_year   integer,                   -- BAG oorspronkelijkBouwjaar (pand)
  building_use text,                       -- BAG gebruiksdoel (verblijfsobject)
  area_m2      integer,                    -- BAG oppervlakte (m²)
  refreshed_at timestamptz not null default now(),
  expires_at   timestamptz not null
);

comment on table public.bag_address_cache is
  'Lazy cache of BAG per-address building facts, keyed on a hash of postcode+house '
  'number (raw address never stored). Long TTL — BAG facts are very stable.';

create index if not exists bag_address_cache_expires_idx
  on public.bag_address_cache (expires_at);

-- RLS on, service-role only (no policies) — mirrors ip_company_cache / cbs_area_stats.
alter table public.bag_address_cache enable row level security;
