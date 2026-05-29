-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 099 — Analytics funnel + daily session aggregation
--
-- Creates two Postgres functions used by the analytics dashboard:
--
--   get_analytics_funnel(p_tenant_id, p_days)
--     Returns funnel stages (sessions → page_views → cta_clicks → form_submits)
--     for the last N days, with per-stage counts and drop-off percentages.
--
--   get_analytics_daily(p_tenant_id, p_days)
--     Returns daily session counts for the last N days (for sparkline / bar chart).
--
--   get_analytics_variants(p_tenant_id, p_days)
--     Returns per-variant event counts (cta_click, form_submit) for the top 20
--     variant keys seen in event payloads.
--
-- The events table (migration 003) stores session-scoped events with no
-- tenant_id column. Tenant scoping is achieved by joining through
-- personalization_sessions (tenant_id, session_id) which is the authoritative
-- record of which sessions belong to which tenant.
--
-- NOTE: session_id in personalization_sessions is TEXT; in events it is UUID.
-- The join casts events.session_id::text for compatibility.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── get_analytics_funnel ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_analytics_funnel(
  p_tenant_id TEXT,
  p_days      INT DEFAULT 30
)
RETURNS TABLE (
  stage         TEXT,
  session_count BIGINT,
  pct_of_top    NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  WITH tenant_sessions AS (
    -- Unique sessions for this tenant in the window
    SELECT DISTINCT ps.session_id
    FROM   personalization_sessions ps
    WHERE  ps.tenant_id = p_tenant_id
      AND  ps.created_at >= v_cutoff
  ),
  stage_counts AS (
    SELECT
      COUNT(DISTINCT ts.session_id)                                            AS total_sessions,
      COUNT(DISTINCT CASE WHEN e.event_type = 'page_view'   THEN ts.session_id END) AS page_views,
      COUNT(DISTINCT CASE WHEN e.event_type = 'cta_click'   THEN ts.session_id END) AS cta_clicks,
      COUNT(DISTINCT CASE WHEN e.event_type = 'form_submit' THEN ts.session_id END) AS form_submits
    FROM tenant_sessions ts
    LEFT JOIN events e
      ON  e.session_id::TEXT = ts.session_id
      AND e.created_at >= v_cutoff
  )
  SELECT 'Personalised sessions'::TEXT,
         total_sessions,
         100.0
  FROM stage_counts
  UNION ALL
  SELECT 'Engaged (page view)'::TEXT,
         page_views,
         CASE WHEN total_sessions = 0 THEN 0
              ELSE ROUND(page_views * 100.0 / total_sessions, 1) END
  FROM stage_counts
  UNION ALL
  SELECT 'Clicked CTA'::TEXT,
         cta_clicks,
         CASE WHEN total_sessions = 0 THEN 0
              ELSE ROUND(cta_clicks * 100.0 / total_sessions, 1) END
  FROM stage_counts
  UNION ALL
  SELECT 'Converted (form submit)'::TEXT,
         form_submits,
         CASE WHEN total_sessions = 0 THEN 0
              ELSE ROUND(form_submits * 100.0 / total_sessions, 1) END
  FROM stage_counts;
END;
$$;

-- ── get_analytics_daily ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_analytics_daily(
  p_tenant_id TEXT,
  p_days      INT DEFAULT 30
)
RETURNS TABLE (
  day           DATE,
  sessions      BIGINT,
  cta_clicks    BIGINT,
  form_submits  BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  WITH dates AS (
    SELECT generate_series(
      (NOW() - (p_days - 1 || ' days')::INTERVAL)::DATE,
      NOW()::DATE,
      '1 day'::INTERVAL
    )::DATE AS day
  ),
  daily_sessions AS (
    SELECT
      ps.created_at::DATE AS day,
      COUNT(DISTINCT ps.session_id) AS sessions
    FROM personalization_sessions ps
    WHERE ps.tenant_id = p_tenant_id
      AND ps.created_at >= v_cutoff
    GROUP BY 1
  ),
  daily_events AS (
    SELECT
      e.created_at::DATE AS day,
      COUNT(DISTINCT CASE WHEN e.event_type = 'cta_click'   THEN e.session_id::TEXT END) AS cta_clicks,
      COUNT(DISTINCT CASE WHEN e.event_type = 'form_submit' THEN e.session_id::TEXT END) AS form_submits
    FROM events e
    JOIN personalization_sessions ps
      ON ps.session_id = e.session_id::TEXT
     AND ps.tenant_id  = p_tenant_id
    WHERE e.created_at >= v_cutoff
    GROUP BY 1
  )
  SELECT
    d.day,
    COALESCE(ds.sessions,    0) AS sessions,
    COALESCE(de.cta_clicks,  0) AS cta_clicks,
    COALESCE(de.form_submits,0) AS form_submits
  FROM dates d
  LEFT JOIN daily_sessions ds ON ds.day = d.day
  LEFT JOIN daily_events   de ON de.day = d.day
  ORDER BY d.day;
END;
$$;

-- ── get_analytics_variants ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_analytics_variants(
  p_tenant_id TEXT,
  p_days      INT DEFAULT 30
)
RETURNS TABLE (
  variant_key  TEXT,
  impressions  BIGINT,
  cta_clicks   BIGINT,
  form_submits BIGINT,
  ctr          NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  WITH tenant_events AS (
    SELECT e.session_id::TEXT AS session_id, e.event_type,
           COALESCE(e.payload->>'variant_key', e.payload->>'variantKey', 'unknown') AS vk
    FROM   events e
    JOIN   personalization_sessions ps
      ON   ps.session_id = e.session_id::TEXT
     AND   ps.tenant_id  = p_tenant_id
    WHERE  e.created_at >= v_cutoff
  )
  SELECT
    vk AS variant_key,
    COUNT(DISTINCT CASE WHEN event_type = 'page_view'   THEN session_id END) AS impressions,
    COUNT(DISTINCT CASE WHEN event_type = 'cta_click'   THEN session_id END) AS cta_clicks,
    COUNT(DISTINCT CASE WHEN event_type = 'form_submit' THEN session_id END) AS form_submits,
    CASE
      WHEN COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) = 0 THEN 0
      ELSE ROUND(
        COUNT(DISTINCT CASE WHEN event_type = 'cta_click' THEN session_id END) * 100.0 /
        COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END), 1
      )
    END AS ctr
  FROM  tenant_events
  WHERE vk IS NOT NULL AND vk != 'unknown'
  GROUP BY vk
  ORDER BY impressions DESC
  LIMIT 20;
END;
$$;

-- Ensure personalization_sessions has created_at for time-range queries
-- (safe ALTER — only adds column if migration 020 didn't already add it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_name = 'personalization_sessions'
      AND  column_name = 'created_at'
  ) THEN
    ALTER TABLE personalization_sessions
      ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_analytics_funnel   IS 'Conversion funnel (sessions→page_view→cta_click→form_submit) for a tenant over N days';
COMMENT ON FUNCTION public.get_analytics_daily    IS 'Daily session + event counts for sparkline/bar chart';
COMMENT ON FUNCTION public.get_analytics_variants IS 'Per-variant impression and conversion counts';
