-- ─────────────────────────────────────────────────────────────────────────────
-- Platform CMS Content
--
-- Stores variant documents for tenants using the built-in "platform" CMS
-- provider.  When an operator selects "Platform (built-in)" as their CMS,
-- all hero / proof / CTA / feature / conversion variants are read from and
-- written to this table instead of an external headless CMS.
--
-- ─── Table design ────────────────────────────────────────────────────────────
--
--   One row per (tenant_id, variant_type, variant_key) tuple.
--   The content column holds a JSONB document whose shape depends on
--   variant_type:
--
--     hero       → { title, subtitle, ctaLabel, ctaHref, badgeLabel?, mediaUrl? }
--     proof      → { headline, items: [{ text, author?, stat? }] }
--     cta        → { headline, body, ctaLabel, ctaHref, style? }
--     feature    → { headline, items: [{ icon?, title, body }] }
--     conversion → { headline, body, ctaLabel, ctaHref }
--
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists platform_cms_content (
  id           uuid         primary key default gen_random_uuid(),
  tenant_id    text         not null,
  variant_type text         not null  check (variant_type in ('hero', 'proof', 'cta', 'feature', 'conversion')),
  variant_key  text         not null,
  content      jsonb        not null default '{}'::jsonb,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- Unique: each tenant has at most one document per (type, key) pair.
create unique index if not exists platform_cms_content_tenant_type_key
  on platform_cms_content (tenant_id, variant_type, variant_key);

-- Fast lookups by tenant (primary access pattern).
create index if not exists platform_cms_content_tenant_idx
  on platform_cms_content (tenant_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

create or replace function update_platform_cms_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger platform_cms_content_updated_at
  before update on platform_cms_content
  for each row execute function update_platform_cms_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Service-role key bypasses RLS; we rely on server-side tenant_id checks in
-- application code.  Anon/authenticated roles have no direct access.

alter table platform_cms_content enable row level security;

-- No public policies — all access goes through the service role.
