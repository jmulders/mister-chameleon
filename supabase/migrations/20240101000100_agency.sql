-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 100 — White-label agency mode
--
-- Two tables:
--
--   agency_memberships
--     Links an agency tenant (Pro plan, multiTenant = true) to its member
--     tenants (the agency's clients).  An agency admin can view, manage, and
--     report across all member tenants from a single login.
--
--   agency_branding
--     Per-agency customisation: name, logo, primary colour, and custom domain.
--     Used to white-label the dashboard for agency clients.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── agency_memberships ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_memberships (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The Pro tenant that owns/manages the agency relationship.
  agency_tenant_id TEXT        NOT NULL,

  -- The client tenant being managed.
  member_tenant_id TEXT        NOT NULL,

  -- 'owner' = full write access; 'viewer' = read-only.
  role             TEXT        NOT NULL DEFAULT 'viewer'
                               CHECK (role IN ('owner', 'viewer')),

  -- Which admin invited this member (for audit trail).
  invited_by       TEXT,
  invite_note      TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (agency_tenant_id, member_tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_memberships_agency
  ON public.agency_memberships (agency_tenant_id);

CREATE INDEX IF NOT EXISTS idx_agency_memberships_member
  ON public.agency_memberships (member_tenant_id);

COMMENT ON TABLE  public.agency_memberships                IS 'Agency → client tenant relationships for Pro multi-tenant management';
COMMENT ON COLUMN public.agency_memberships.agency_tenant_id IS 'The Pro agency tenant (parent)';
COMMENT ON COLUMN public.agency_memberships.member_tenant_id IS 'The client tenant (child) managed by the agency';
COMMENT ON COLUMN public.agency_memberships.role             IS 'owner = write access; viewer = read-only';

-- ── agency_branding ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agency_branding (
  tenant_id       TEXT        PRIMARY KEY,   -- agency's own tenant ID

  -- White-label identity
  agency_name     TEXT,                      -- shown in the dashboard header instead of "Mister Chameleon"
  logo_url        TEXT,                      -- absolute URL to agency logo (stored in Supabase Storage or S3)
  favicon_url     TEXT,                      -- optional custom favicon
  primary_color   TEXT DEFAULT '#006BA6',    -- CSS hex, used as brand accent

  -- Custom domain (e.g. "insights.agencyname.com")
  -- Verified via DNS TXT record — see white-label docs.
  custom_domain   TEXT,
  domain_verified BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Footer / legal
  support_email   TEXT,
  footer_text     TEXT,                      -- replaces default "© Mister Chameleon" footer

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.agency_branding              IS 'White-label branding config for Pro agency tenants';
COMMENT ON COLUMN public.agency_branding.custom_domain IS 'Custom domain for white-label dashboard access. Requires DNS verification.';

-- ── Timestamp triggers ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'agency_memberships_updated_at'
  ) THEN
    CREATE TRIGGER agency_memberships_updated_at
      BEFORE UPDATE ON public.agency_memberships
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'agency_branding_updated_at'
  ) THEN
    CREATE TRIGGER agency_branding_updated_at
      BEFORE UPDATE ON public.agency_branding
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Service role (used by server actions) bypasses RLS by default.
-- Enable RLS so anon/authenticated clients cannot read across agencies.

ALTER TABLE public.agency_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_branding    ENABLE ROW LEVEL SECURITY;
