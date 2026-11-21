-- migration 188 — one read for what is stored about a returning visitor
--
-- A visitor who accepted cookies has stored history: page views, clicks, the
-- last variant served, the behaviour state and the profile. Every page read
-- these with five or six requests at once. On a database that has been quiet
-- for half a minute each request opens a connection of its own, and on
-- 21 Nov 2026 that made the five of them take up to 5.9 s together, before the
-- page could decide anything.
--
-- This function answers all of it in one request: one connection, one round
-- trip. The application reads the same columns from it that it read before
-- (context/visitor-stored-context.ts) and falls back to the separate reads
-- while this migration has not been applied.
--
-- Read-only. SECURITY INVOKER: it runs with the rights of the caller, which is
-- the service role. Migration 186 keeps new functions away from anon and
-- authenticated; the explicit revoke below says so for this one too.
--
-- Idempotent.

CREATE OR REPLACE FUNCTION public.visitor_stored_context(
  p_tenant_id  text,
  p_session_id text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH sid AS (
    -- The session columns are uuid. A value that is not one matches nothing,
    -- as it did in the separate reads, instead of failing the whole call.
    SELECT CASE
      WHEN p_session_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN p_session_id::uuid
    END AS id
  )
  SELECT jsonb_build_object(
    'page_views', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('created_at', e.created_at, 'payload', e.payload) ORDER BY e.created_at ASC)
      FROM public.events e, sid
      WHERE e.session_id = sid.id AND e.event_type = 'page_view'
    ), '[]'::jsonb),
    'cta_clicks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('created_at', e.created_at, 'payload', e.payload) ORDER BY e.created_at ASC)
      FROM public.events e, sid
      WHERE e.session_id = sid.id AND e.event_type = 'cta_click'
    ), '[]'::jsonb),
    'last_variant', (
      SELECT jsonb_build_object('hero_key', v.hero_key, 'cta_key', v.cta_key)
      FROM public.served_variants v, sid
      WHERE v.session_id = sid.id
      ORDER BY v.created_at DESC
      LIMIT 1
    ),
    'behavior_state', (
      SELECT to_jsonb(b)
      FROM public.visitor_behavior_state b, sid
      WHERE b.tenant_id = p_tenant_id AND b.session_id = sid.id
      ORDER BY b.updated_at DESC
      LIMIT 1
    ),
    'profile', (
      SELECT jsonb_build_object(
        'company_name',     p.company_name,
        'company_domain',   p.company_domain,
        'company_industry', p.company_industry,
        'company_size',     p.company_size,
        'firmographics_at', p.firmographics_at,
        'identity_level',   p.identity_level,
        'status',           p.status,
        'intent_score',     p.intent_score,
        'visit_count',      p.visit_count,
        'last_seen_at',     p.last_seen_at
      )
      FROM public.visitor_profiles p
      WHERE p.tenant_id = p_tenant_id AND p.visitor_key = p_session_id
      LIMIT 1
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.visitor_stored_context(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.visitor_stored_context(text, text) TO service_role;
