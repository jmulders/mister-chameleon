-- ── tenant_domains ─────────────────────────────────────────────────────────────
--
-- Stores custom domain registrations for multi-tenant routing.
--
-- Each row maps one hostname (e.g. "acme.com") to one tenant.  A UNIQUE INDEX
-- on `hostname` guarantees no two tenants can claim the same domain.
--
-- ─── Status lifecycle ────────────────────────────────────────────────────────
--
--   pending  — domain added but DNS / Vercel verification not yet confirmed.
--              DNS records shown to the operator so they can configure their
--              registrar.  Tenant resolution DOES route to this tenant even
--              while pending (operator has claimed the domain).
--
--   active   — domain is verified and fully operational.
--              Set automatically when Vercel confirms verification, or
--              immediately when Vercel integration is not configured.
--
--   error    — domain verification failed or was rejected by Vercel.
--              Operator must remove and re-add the domain to retry.
--
-- ─── Vercel integration (optional) ──────────────────────────────────────────
--
--   When VERCEL_API_TOKEN + VERCEL_PROJECT_ID are configured at deploy time,
--   adding a domain calls the Vercel Domains API.  `vercel_domain_id` stores
--   the ID returned by Vercel so the domain can be removed later.
--   `vercel_verification` stores the CNAME/TXT verification records that the
--   operator must configure at their DNS provider.
--
--   When Vercel integration is absent, `vercel_domain_id` and
--   `vercel_verification` are left NULL and the status is set to 'active'
--   immediately (the platform trusts the operator's intent).
--
-- ─── Relationship to tenant_settings.primaryDomain / additionalDomains ──────
--
--   Legacy rows written to tenant_settings JSONB before this table was created
--   continue to work: getTenantByDomain() checks tenant_domains FIRST (O(1)),
--   then falls back to the JSONB scan for backward compatibility.
--
--   New domains should be managed exclusively via tenant_domains — the JSONB
--   fields are now considered legacy and will not be actively populated by the
--   admin UI going forward.

CREATE TABLE IF NOT EXISTS tenant_domains (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            text        NOT NULL,
  hostname             text        NOT NULL,
  is_primary           boolean     NOT NULL DEFAULT false,
  status               text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'active', 'error')),
  vercel_domain_id     text        NULL,
  vercel_verification  jsonb       NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- One hostname → one tenant only.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_hostname_unique
  ON tenant_domains (hostname);

-- Fast lookups of all domains belonging to a tenant.
CREATE INDEX IF NOT EXISTS tenant_domains_tenant_id_idx
  ON tenant_domains (tenant_id);

-- Fast lookups by status (e.g. fetch only active domains for routing).
CREATE INDEX IF NOT EXISTS tenant_domains_status_idx
  ON tenant_domains (status);
