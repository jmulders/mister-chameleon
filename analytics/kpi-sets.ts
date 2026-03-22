/**
 * KPI Set Definitions
 *
 * Concrete KPI sets for the four core Mister Chameleon use cases:
 *
 *   1. Adaptive Website          — homepage personalisation performance
 *   2. Adaptive Landing Page     — campaign variant and conversion metrics
 *   3. Adaptive Follow-up        — contact form, n8n dispatch, and pipeline signals
 *   4. Known-User Experience     — returning visitor escalation and engagement depth
 *
 * ─── Relationship to tracking infrastructure ──────────────────────────────────
 *
 *   Every KPI marked `implementationTier: "implemented"` can be queried today
 *   against the live Supabase schema using the SQL formula in its `formula`
 *   field. The following tables are referenced:
 *
 *     sessions         id, created_at, source, device, visit_type,
 *                      pathname, utm_source, utm_medium, utm_campaign
 *
 *     served_variants  id, session_id, created_at,
 *                      hero_key, proof_key, cta_key, reason
 *
 *     events           id, session_id, created_at, event_type, payload (JSONB)
 *                      event_type values: page_view | variant_served |
 *                      cta_click | scroll_depth | contact_form_submit
 *                      payload keys per type — see tracking/event-types.ts
 *
 * ─── Adding a new KPI ─────────────────────────────────────────────────────────
 *
 *   1. Add the KpiId string literal to KpiId in kpi-types.ts.
 *   2. Add a KpiDefinition object to the appropriate KpiSet here.
 *   3. If the metric needs a new repository function, add the query to
 *      data/repositories/analytics-repository.ts.
 *   4. If the metric needs a new event type, add it to tracking/event-types.ts
 *      and fire it from the relevant component or API route.
 *
 * ─── KPI set reporting connection ─────────────────────────────────────────────
 *
 *   Each set has a `repositoryHint` per KPI pointing to the existing
 *   analytics-repository function that computes (or could compute) the metric.
 *   When a function doesn't yet exist, the hint describes the query pattern
 *   for the next engineer to implement.
 *
 *   See analytics/index.ts for lookup helpers: getKpiSet(), getKpi(), etc.
 */

import type { KpiSet, KpiCatalog, KpiDefinition } from "./kpi-types";

// ── Shared defaults ────────────────────────────────────────────────────────────

/** Default time-range filter note included in all SQL formula comments. */
const TIME_WINDOW_NOTE =
  "-- Filter by time window with: WHERE created_at >= NOW() - INTERVAL '30 days'\n" +
  "-- Remove the filter entirely for all-time totals.";

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADAPTIVE WEBSITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KPI set for the adaptive homepage / site experience.
 *
 * Goal: measure whether personalisation is driving meaningful engagement and
 * conversion uplift vs. a generic, un-adapted experience.
 *
 * The primary signal is CTA click rate — the adaptive page's whole purpose is
 * to serve the right call-to-action to the right visitor. Supporting metrics
 * verify that personalisation is actually happening (coverage), that it is
 * happening correctly (source alignment), and that visitors are engaged enough
 * to scroll past the hero (scroll depth).
 */
const ADAPTIVE_WEBSITE_KPI_SET: KpiSet = {
  id:          "adaptive-website",
  moduleId:    "adaptive-website",
  label:       "Adaptive Website Performance",
  description:
    "Measures how effectively the adaptive homepage converts inbound traffic. " +
    "Success is defined as a meaningful CTA click rate combined with high personalisation " +
    "coverage — meaning most visitors receive a tailored variant, not the generic default.",
  primaryKpiId: "adaptive-cta-click-rate",

  kpis: [
    // ── Primary conversion metric ────────────────────────────────────────────
    {
      id:          "adaptive-cta-click-rate",
      label:       "CTA Click Rate",
      description:
        "The percentage of unique sessions that clicked at least one primary CTA. " +
        "This is the primary engagement metric for the adaptive homepage — it measures " +
        "whether the right message drove a visitor to take the intended next step.",
      category:     "conversion",
      format:       "percentage",
      primarySource: "events",
      relatedSources: ["sessions"],
      relatedEvents: ["cta_click"],
      relatedTables: ["events", "sessions"],
      recommendedCadence: "weekly",
      implementationTier: "implemented",
      repositoryHint:
        "Extend fetchDashboardMetrics() or add fetchCtaClickRate(). " +
        "Numerator: COUNT(DISTINCT session_id) FROM events WHERE event_type = 'cta_click'. " +
        "Denominator: COUNT(*) FROM sessions.",
      thresholds: {
        good:         15,
        warning:       5,
        goodLabel:    "≥15% — strong adaptive engagement",
        warningLabel: "5–15% — room for variant improvement",
      },
      formula: {
        numeratorSql:
          "SELECT COUNT(DISTINCT session_id)\n" +
          "FROM events\n" +
          "WHERE event_type = 'cta_click'",
        denominatorSql:
          "SELECT COUNT(*) FROM sessions",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- Result: (numerator / denominator) * 100 as a percentage.\n" +
          "-- Session-level attribution: one click per session maximum.\n" +
          "-- Compare against a baseline period before adaptive launch.",
      },
    } satisfies KpiDefinition,

    // ── Personalisation coverage ─────────────────────────────────────────────
    {
      id:          "adaptive-personalisation-coverage",
      label:       "Personalisation Coverage",
      description:
        "The percentage of sessions that received a personalised (non-default) hero variant. " +
        "A high coverage rate confirms the decision engine is matching traffic to relevant content. " +
        "Low coverage usually means most traffic is arriving via direct/unknown channels with no signal.",
      category:     "personalisation",
      format:       "percentage",
      primarySource: "served_variants",
      relatedSources: ["sessions"],
      relatedTables: ["served_variants", "sessions"],
      recommendedCadence: "weekly",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchPersonalisationCoverage() to analytics-repository.ts. " +
        "Query served_variants for rows where hero_key != 'hero_direct_brand'. " +
        "Denominator is total served_variants rows.",
      thresholds: {
        good:         60,
        warning:      30,
        goodLabel:    "≥60% — majority of traffic is attributed",
        warningLabel: "30–60% — consider adding more UTM-tagged campaign links",
      },
      formula: {
        numeratorSql:
          "SELECT COUNT(*)\n" +
          "FROM served_variants\n" +
          "WHERE hero_key != 'hero_direct_brand'",
        denominatorSql:
          "SELECT COUNT(*) FROM served_variants",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- hero_direct_brand is the default/fallback variant.\n" +
          "-- Adjust the filter if the tenant's default hero key differs.\n" +
          "-- Extension: join sessions to filter by traffic source.",
      },
    } satisfies KpiDefinition,

    // ── Source-rule alignment ────────────────────────────────────────────────
    {
      id:          "adaptive-source-rule-alignment",
      label:       "Source–Rule Alignment Rate",
      description:
        "The percentage of Google and LinkedIn sessions that were served their " +
        "corresponding source-specific variant (google → hero_google_problem, " +
        "linkedin → hero_linkedin_vision). Misalignment indicates a rules misconfiguration " +
        "or a source attribution gap.",
      category:     "personalisation",
      format:       "percentage",
      primarySource: "served_variants",
      relatedSources: ["sessions"],
      relatedTables: ["served_variants", "sessions"],
      recommendedCadence: "weekly",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchSourceAlignmentRate() to analytics-repository.ts. " +
        "Join served_variants on session_id, filter sessions WHERE source IN ('google','linkedin'), " +
        "then check the ratio of correct variant assignments.",
      formula: {
        numeratorSql:
          "SELECT COUNT(*)\n" +
          "FROM sessions s\n" +
          "JOIN served_variants sv ON sv.session_id = s.id\n" +
          "WHERE\n" +
          "  (s.source = 'google'   AND sv.hero_key = 'hero_google_problem')\n" +
          "  OR\n" +
          "  (s.source = 'linkedin' AND sv.hero_key = 'hero_linkedin_vision')",
        denominatorSql:
          "SELECT COUNT(*)\n" +
          "FROM sessions\n" +
          "WHERE source IN ('google', 'linkedin')",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- A low rate (< 90%) usually indicates:\n" +
          "--   (a) sessions arriving from these sources aren't being attributed correctly,\n" +
          "--   (b) the rules engine is being overridden by a higher-priority rule, or\n" +
          "--   (c) the returning-visitor rules are firing before source rules.\n" +
          "-- Cross-check against served_variants.reason to confirm which rule fired.",
      },
      thresholds: {
        good:         90,
        warning:      70,
        goodLabel:    "≥90% — rules are working correctly",
        warningLabel: "70–90% — investigate override logic or source attribution",
      },
    } satisfies KpiDefinition,

    // ── Scroll depth engagement ──────────────────────────────────────────────
    {
      id:          "adaptive-scroll-depth-p75",
      label:       "Deep Scroll Rate (75%+)",
      description:
        "The percentage of sessions that scrolled at least 75% down the page. " +
        "Indicates whether visitors are engaging with the full adaptive content stack " +
        "(hero → proof → CTA block), not just the hero section. Low rates may " +
        "signal a content quality problem in the proof or CTA sections.",
      category:     "engagement",
      format:       "percentage",
      primarySource: "events",
      relatedSources: ["sessions"],
      relatedEvents: ["scroll_depth"],
      relatedTables: ["events", "sessions"],
      recommendedCadence: "weekly",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchScrollDepthRate(threshold: number) to analytics-repository.ts. " +
        "Query: SELECT COUNT(DISTINCT session_id) FROM events " +
        "WHERE event_type = 'scroll_depth' AND (payload->>'depth')::int >= 75. " +
        "Divide by total sessions.",
      formula: {
        numeratorSql:
          "SELECT COUNT(DISTINCT session_id)\n" +
          "FROM events\n" +
          "WHERE event_type = 'scroll_depth'\n" +
          "  AND (payload->>'depth')::integer >= 75",
        denominatorSql:
          "SELECT COUNT(*) FROM sessions",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- ScrollDepthTracker fires at 25, 50, 75, 90% milestones.\n" +
          "-- Each threshold fires at most once per session (de-duped client-side).\n" +
          "-- This query counts sessions that fired any scroll_depth event with depth >= 75.\n" +
          "-- A session that reached 90% will also satisfy the 75% condition.",
      },
      thresholds: {
        good:         40,
        warning:      20,
        goodLabel:    "≥40% — strong full-page engagement",
        warningLabel: "20–40% — review proof section copy and layout",
      },
    } satisfies KpiDefinition,

    // ── Return visit rate ────────────────────────────────────────────────────
    {
      id:          "adaptive-return-visit-rate",
      label:       "Return Visit Rate",
      description:
        "The percentage of sessions marked as returning visits (visit_type = 'returning'). " +
        "Indicates organic re-engagement — visitors who came back without being re-targeted. " +
        "A rising return rate suggests the adaptive experience is memorable enough to warrant a second look.",
      category:     "engagement",
      format:       "percentage",
      primarySource: "sessions",
      relatedTables: ["sessions"],
      recommendedCadence: "monthly",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchReturnVisitRate() to analytics-repository.ts. " +
        "COUNT(*) WHERE visit_type = 'returning' / COUNT(*) FROM sessions.",
      formula: {
        numeratorSql:
          "SELECT COUNT(*)\n" +
          "FROM sessions\n" +
          "WHERE visit_type = 'returning'",
        denominatorSql:
          "SELECT COUNT(*) FROM sessions",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- visit_type is resolved from the mc_seen cookie (absent → new, present → returning).\n" +
          "-- This is a session-level signal, not a user-level one.\n" +
          "-- Benchmark: B2B SaaS sites typically see 25–40% return rate once in steady state.",
      },
      thresholds: {
        good:         25,
        warning:      10,
        goodLabel:    "≥25% — healthy organic return rate",
        warningLabel: "10–25% — consider retargeting or remarketing campaigns",
      },
    } satisfies KpiDefinition,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADAPTIVE LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KPI set for campaign-specific landing pages.
 *
 * Goal: measure whether adaptive variant selection on landing pages is
 * improving conversion rates across different campaign audiences. Landing
 * page visitors typically arrive with stronger intent than homepage visitors,
 * so the primary signal is direct conversion (contact form submit) rather
 * than CTA click.
 */
const ADAPTIVE_LANDING_PAGE_KPI_SET: KpiSet = {
  id:          "adaptive-landing-page",
  moduleId:    "adaptive-landing-pages",
  label:       "Adaptive Landing Page Performance",
  description:
    "Measures how well adaptive variant selection on campaign landing pages converts " +
    "inbound traffic. Landing visitors typically arrive with higher intent than " +
    "homepage visitors, so the primary signal is direct contact form conversion " +
    "rather than general CTA engagement.",
  primaryKpiId: "landing-direct-conversion-rate",

  kpis: [
    // ── Direct conversion rate ───────────────────────────────────────────────
    {
      id:          "landing-direct-conversion-rate",
      label:       "Landing Conversion Rate",
      description:
        "The percentage of landing page sessions that submitted the contact form. " +
        "The primary success metric for campaign landing pages — measures whether " +
        "the adaptive variant selection is driving visitors to convert.",
      category:     "conversion",
      format:       "percentage",
      primarySource: "events",
      relatedSources: ["sessions"],
      relatedEvents: ["contact_form_submit"],
      relatedTables: ["events", "sessions"],
      recommendedCadence: "daily",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchLandingConversionRate(pathname: string) to analytics-repository.ts. " +
        "Filter sessions by pathname (e.g. '/growth-team') then join events " +
        "WHERE event_type = 'contact_form_submit'.",
      formula: {
        numeratorSql:
          "SELECT COUNT(DISTINCT e.session_id)\n" +
          "FROM events e\n" +
          "JOIN sessions s ON s.id = e.session_id\n" +
          "WHERE e.event_type = 'contact_form_submit'\n" +
          "  AND s.pathname LIKE '/lp/%'  -- adjust to the tenant's landing path pattern",
        denominatorSql:
          "SELECT COUNT(*)\n" +
          "FROM sessions\n" +
          "WHERE pathname LIKE '/lp/%'",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- Replace the pathname LIKE pattern with the actual landing page paths.\n" +
          "-- contact_form_submit is written server-side by the API route — not blocked by ad blockers.\n" +
          "-- B2B SaaS landing page baseline: 2–8% conversion rate.",
      },
      thresholds: {
        good:         5,
        warning:      2,
        goodLabel:    "≥5% — strong landing page conversion",
        warningLabel: "2–5% — acceptable; review CTA copy and form friction",
      },
    } satisfies KpiDefinition,

    // ── CTA click rate on landing pages ─────────────────────────────────────
    {
      id:          "landing-cta-click-rate",
      label:       "Landing CTA Click Rate",
      description:
        "The percentage of landing page sessions that clicked a primary CTA. " +
        "Serves as an intermediate engagement signal between page view and form submit — " +
        "useful for diagnosing where visitors drop off in the landing page funnel.",
      category:     "conversion",
      format:       "percentage",
      primarySource: "events",
      relatedSources: ["sessions"],
      relatedEvents: ["cta_click"],
      relatedTables: ["events", "sessions"],
      recommendedCadence: "weekly",
      implementationTier: "partial",
      implementationNotes:
        "The cta_click event fires for all pages. To isolate landing pages, filter on " +
        "event payload.pathname (CtaClickPayload does not yet include pathname). " +
        "Short-term workaround: join via session_id and filter sessions.pathname instead.",
      repositoryHint:
        "Add fetchLandingCtaClickRate(pathname: string). Join events on session_id, " +
        "filter sessions.pathname to landing paths, count distinct sessions with cta_click.",
      formula: {
        numeratorSql:
          "SELECT COUNT(DISTINCT e.session_id)\n" +
          "FROM events e\n" +
          "JOIN sessions s ON s.id = e.session_id\n" +
          "WHERE e.event_type = 'cta_click'\n" +
          "  AND s.pathname LIKE '/lp/%'",
        denominatorSql:
          "SELECT COUNT(*) FROM sessions WHERE pathname LIKE '/lp/%'",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- Known limitation: relies on sessions.pathname being set correctly at render time.\n" +
          "-- The CtaClickPayload.position field can distinguish hero vs. cta_block clicks.\n" +
          "-- Consider adding pathname to CtaClickPayload in tracking/event-types.ts " +
          "for more precise filtering.",
      },
      thresholds: {
        good:         20,
        warning:      8,
        goodLabel:    "≥20% — strong CTA engagement before form",
        warningLabel: "8–20% — review primary CTA variant selection",
      },
    } satisfies KpiDefinition,

    // ── Variant diversity ────────────────────────────────────────────────────
    {
      id:          "landing-variant-diversity",
      label:       "Variant Combination Diversity",
      description:
        "The number of distinct (hero, proof, CTA) variant triples served on " +
        "landing pages. Low diversity means nearly all visitors see the same experience. " +
        "High diversity confirms the adaptive engine is tailoring content across different " +
        "campaign audiences arriving on the page.",
      category:     "personalisation",
      format:       "count",
      primarySource: "served_variants",
      relatedSources: ["sessions"],
      relatedTables: ["served_variants", "sessions"],
      recommendedCadence: "weekly",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchVariantDiversity(pathname?: string) to analytics-repository.ts. " +
        "SELECT COUNT(DISTINCT (hero_key, proof_key, cta_key)) FROM served_variants " +
        "optionally filtered to landing-page sessions via sessions join.",
      formula: {
        numeratorSql:
          "SELECT COUNT(DISTINCT (sv.hero_key, sv.proof_key, sv.cta_key))\n" +
          "FROM served_variants sv\n" +
          "JOIN sessions s ON s.id = sv.session_id\n" +
          "WHERE s.pathname LIKE '/lp/%'",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- Maximum possible: 3 × 3 × 3 = 27 distinct combinations.\n" +
          "-- A tenant with 3 hero, 3 proof, 3 CTA variants should see 3–9 distinct combos.\n" +
          "-- A value of 1 means the fallback plan is being served to everyone — investigate rules.",
      },
    } satisfies KpiDefinition,

    // ── Campaign conversion rate ─────────────────────────────────────────────
    {
      id:          "landing-campaign-conversion-rate",
      label:       "Campaign Conversion Rate",
      description:
        "The percentage of UTM-tagged (campaign-sourced) sessions that submitted " +
        "the contact form. Isolates paid and owned-channel performance from organic " +
        "traffic, making it the right metric for campaign ROI conversations.",
      category:     "conversion",
      format:       "percentage",
      primarySource: "events",
      relatedSources: ["sessions"],
      relatedEvents: ["contact_form_submit"],
      relatedTables: ["events", "sessions"],
      recommendedCadence: "daily",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchCampaignConversionRate() to analytics-repository.ts. " +
        "Filter sessions WHERE utm_source IS NOT NULL. " +
        "Numerator: sessions with contact_form_submit event. Denominator: all UTM sessions.",
      formula: {
        numeratorSql:
          "SELECT COUNT(DISTINCT e.session_id)\n" +
          "FROM events e\n" +
          "JOIN sessions s ON s.id = e.session_id\n" +
          "WHERE e.event_type = 'contact_form_submit'\n" +
          "  AND s.utm_source IS NOT NULL",
        denominatorSql:
          "SELECT COUNT(*)\n" +
          "FROM sessions\n" +
          "WHERE utm_source IS NOT NULL",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- Segment by utm_source to compare Google Ads, LinkedIn, email etc.\n" +
          "-- Example segmented query:\n" +
          "--   SELECT s.utm_source, COUNT(DISTINCT e.session_id) / COUNT(DISTINCT s.id)\n" +
          "--   FROM sessions s LEFT JOIN events e ON ...\n" +
          "--   GROUP BY s.utm_source",
      },
      thresholds: {
        good:         8,
        warning:      3,
        goodLabel:    "≥8% — paid/owned campaigns are converting well",
        warningLabel: "3–8% — review campaign landing variant alignment",
      },
    } satisfies KpiDefinition,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. ADAPTIVE FOLLOW-UP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KPI set for the contact capture and n8n orchestration pipeline.
 *
 * Goal: ensure that captured contacts are (a) arriving reliably, (b) enriched
 * with context signal before dispatch, and (c) converting to pipeline.
 *
 * Unlike the website KPIs which measure visitor behaviour, follow-up KPIs
 * measure the reliability and quality of the orchestration pipeline itself.
 */
const ADAPTIVE_FOLLOW_UP_KPI_SET: KpiSet = {
  id:          "adaptive-follow-up",
  moduleId:    "adaptive-follow-up",
  label:       "Adaptive Follow-up Pipeline",
  description:
    "Measures the health and effectiveness of the contact capture and n8n " +
    "orchestration pipeline. Combines submission volume, dispatch reliability, " +
    "and context signal richness — the three dimensions that determine whether " +
    "follow-up is reaching the right people with the right information.",
  primaryKpiId: "followup-submission-rate",

  kpis: [
    // ── Submission rate ──────────────────────────────────────────────────────
    {
      id:          "followup-submission-rate",
      label:       "Contact Form Submission Rate",
      description:
        "The percentage of sessions that submitted the contact form. " +
        "The primary leading indicator for pipeline volume from the adaptive site. " +
        "Track week-over-week to catch any regressions after content or configuration changes.",
      category:     "conversion",
      format:       "percentage",
      primarySource: "events",
      relatedSources: ["sessions"],
      relatedEvents: ["contact_form_submit"],
      relatedTables: ["events", "sessions"],
      recommendedCadence: "daily",
      implementationTier: "implemented",
      repositoryHint:
        "Extend fetchDashboardMetrics() to include submission rate. " +
        "Or add fetchContactSubmissionRate() using countEventsByType('contact_form_submit') " +
        "divided by total session count.",
      formula: {
        numeratorSql:
          "SELECT COUNT(DISTINCT session_id)\n" +
          "FROM events\n" +
          "WHERE event_type = 'contact_form_submit'",
        denominatorSql:
          "SELECT COUNT(*) FROM sessions",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- contact_form_submit is written server-side — reliable, not blocked by ad blockers.\n" +
          "-- Compare absolute submission count vs. rate when diagnosing traffic vs. quality issues.\n" +
          "-- Alert if rate drops > 50% vs. the prior 7-day average.",
      },
      thresholds: {
        good:         3,
        warning:      1,
        goodLabel:    "≥3% — healthy contact capture rate for B2B SaaS",
        warningLabel: "1–3% — review CTA copy and contact form placement",
      },
    } satisfies KpiDefinition,

    // ── n8n dispatch success rate ────────────────────────────────────────────
    {
      id:          "followup-n8n-dispatch-rate",
      label:       "n8n Dispatch Success Rate",
      description:
        "The percentage of contact form submissions that successfully dispatched " +
        "to the n8n workflow. A low rate means leads are being captured but not " +
        "reaching the CRM or follow-up sequence — a critical reliability failure.",
      category:     "reliability",
      format:       "percentage",
      primarySource: "events",
      relatedTables: ["events"],
      relatedEvents: ["contact_form_submit"],
      recommendedCadence: "daily",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchN8nDispatchRate() to analytics-repository.ts. " +
        "Query: COUNT(*) WHERE event_type = 'contact_form_submit' AND payload->>'n8n_dispatched' = 'true' " +
        "divided by COUNT(*) WHERE event_type = 'contact_form_submit'.",
      formula: {
        numeratorSql:
          "SELECT COUNT(*)\n" +
          "FROM events\n" +
          "WHERE event_type = 'contact_form_submit'\n" +
          "  AND (payload->>'n8n_dispatched')::boolean = true",
        denominatorSql:
          "SELECT COUNT(*)\n" +
          "FROM events\n" +
          "WHERE event_type = 'contact_form_submit'",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- n8n_dispatched is set by the /api/contact route after the webhook fires.\n" +
          "-- A dispatch failure means n8n was unreachable or the webhook URL is stale.\n" +
          "-- Alert immediately if this drops below 95% — every missed dispatch is a lost lead.\n" +
          "-- Cross-reference with n8n execution logs for the specific error.",
      },
      thresholds: {
        good:         98,
        warning:      90,
        goodLabel:    "≥98% — pipeline is reliable",
        warningLabel: "90–98% — investigate webhook failures immediately",
      },
    } satisfies KpiDefinition,

    // ── Context richness score ───────────────────────────────────────────────
    {
      id:          "followup-context-richness",
      label:       "Lead Context Richness",
      description:
        "An average score (0–4) representing how much contextual signal was captured " +
        "with each contact form submission. Richer context means the follow-up " +
        "sequence can be more precisely personalised — the right message, from the " +
        "right angle, via the right channel.",
      category:     "personalisation",
      format:       "score",
      primarySource: "events",
      relatedSources: ["sessions", "served_variants"],
      relatedTables: ["events", "sessions", "served_variants"],
      relatedEvents: ["contact_form_submit"],
      recommendedCadence: "monthly",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchLeadContextRichness(). For each contact_form_submit session, " +
        "score: +1 if source is known (≠ 'unknown'), +1 if utm_campaign IS NOT NULL, " +
        "+1 if a non-default variant was served (hero_key ≠ 'hero_direct_brand'), " +
        "+1 if cta_key = 'cta_meeting' (highest-intent escalation). Average across submissions.",
      formula: {
        numeratorSql:
          "SELECT\n" +
          "  AVG(\n" +
          "    -- +1 for known traffic source\n" +
          "    CASE WHEN s.source != 'unknown' THEN 1 ELSE 0 END\n" +
          "    -- +1 for UTM campaign attribution\n" +
          "    + CASE WHEN s.utm_campaign IS NOT NULL THEN 1 ELSE 0 END\n" +
          "    -- +1 for non-default personalised variant\n" +
          "    + CASE WHEN sv.hero_key != 'hero_direct_brand' THEN 1 ELSE 0 END\n" +
          "    -- +1 for highest-intent CTA escalation\n" +
          "    + CASE WHEN sv.cta_key = 'cta_meeting' THEN 1 ELSE 0 END\n" +
          "  ) AS context_richness_score\n" +
          "FROM events e\n" +
          "JOIN sessions s ON s.id = e.session_id\n" +
          "LEFT JOIN served_variants sv ON sv.session_id = e.session_id\n" +
          "WHERE e.event_type = 'contact_form_submit'",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- Score range: 0 (no context) to 4 (fully attributed and escalated).\n" +
          "-- A score of 2+ is a meaningful lead — source known and variant-personalised.\n" +
          "-- A score of 4 means: known source + UTM campaign + personalised + meeting intent.\n" +
          "-- Low scores indicate traffic is arriving without source attribution.",
      },
      thresholds: {
        good:         2.5,
        warning:      1.5,
        goodLabel:    "≥2.5 — well-contextualised leads",
        warningLabel: "1.5–2.5 — add UTM tagging to more campaign links",
      },
    } satisfies KpiDefinition,

    // ── Pipeline conversion rate (external) ──────────────────────────────────
    {
      id:          "followup-pipeline-conversion-rate",
      label:       "Submission → Pipeline Rate",
      description:
        "The percentage of contact form submissions that progressed to an active " +
        "sales pipeline stage in the CRM. The lagging metric that ultimately " +
        "validates whether the adaptive site and follow-up sequence are producing " +
        "qualified opportunities.",
      category:     "pipeline",
      format:       "percentage",
      primarySource: "external.crm",
      relatedSources: ["events"],
      relatedTables: ["events"],
      recommendedCadence: "monthly",
      implementationTier: "planned",
      implementationNotes:
        "Requires a CRM integration (HubSpot, Salesforce, or equivalent). " +
        "n8n should stamp the mc_session_id on the CRM contact at creation time " +
        "so submissions can be joined back to the events table. " +
        "Implementation path: (1) pass session_id in n8n contact payload, " +
        "(2) add a CRM webhook that updates a contacts table when pipeline stage changes, " +
        "(3) join contacts.session_id back to events.",
      repositoryHint:
        "Planned: add a contacts table (session_id, crm_contact_id, pipeline_stage). " +
        "fetchPipelineConversionRate() = COUNT(*) WHERE pipeline_stage IS NOT NULL / " +
        "COUNT(*) in contacts.",
    } satisfies KpiDefinition,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. KNOWN-USER EXPERIENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KPI set for the returning-visitor and context-intelligence use case.
 *
 * Goal: measure whether the platform is successfully identifying returning visitors
 * and escalating them to higher-intent experiences. The unique value here is the
 * DB-history layer — first-party behavioural signals from prior sessions informing
 * real-time decisions.
 *
 * Maps to the context-intelligence module (which includes visitor history,
 * diagnostics, and the returning-visitor decision rules).
 */
const KNOWN_USER_EXPERIENCE_KPI_SET: KpiSet = {
  id:          "known-user-experience",
  moduleId:    "context-intelligence",
  label:       "Known-User Experience Performance",
  description:
    "Measures how effectively the platform identifies returning visitors and " +
    "personalises their experience based on first-party behavioural history. " +
    "Success is defined as a high escalation rate for returning visitors — they " +
    "should be served meeting-intent CTAs and brand-vision content, not the " +
    "generic first-touch experience.",
  primaryKpiId: "known-user-returning-cta-escalation-rate",

  kpis: [
    // ── Returning CTA escalation rate ────────────────────────────────────────
    {
      id:          "known-user-returning-cta-escalation-rate",
      label:       "Returning Visitor Escalation Rate",
      description:
        "The percentage of returning visitor sessions that were served the meeting-intent " +
        "CTA (cta_meeting). Measures whether the returning-visitor rules are firing correctly " +
        "and escalating engaged visitors to the highest-commitment call to action.",
      category:     "personalisation",
      format:       "percentage",
      primarySource: "served_variants",
      relatedSources: ["sessions"],
      relatedTables: ["served_variants", "sessions"],
      recommendedCadence: "weekly",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchReturningEscalationRate() to analytics-repository.ts. " +
        "Numerator: served_variants rows with cta_key = 'cta_meeting' " +
        "joined to sessions WHERE visit_type = 'returning'. " +
        "Denominator: all sessions WHERE visit_type = 'returning'.",
      formula: {
        numeratorSql:
          "SELECT COUNT(*)\n" +
          "FROM served_variants sv\n" +
          "JOIN sessions s ON s.id = sv.session_id\n" +
          "WHERE s.visit_type = 'returning'\n" +
          "  AND sv.cta_key = 'cta_meeting'",
        denominatorSql:
          "SELECT COUNT(*)\n" +
          "FROM sessions\n" +
          "WHERE visit_type = 'returning'",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- cta_meeting is the highest-intent CTA ('Book a 20-minute intro call').\n" +
          "-- Not all returning visitors should see it — only those whose DB history\n" +
          "--   indicates prior CTA clicks or 3+ page views (RETURNING_CTA_CLICKED_RULE,\n" +
          "--   HIGH_ENGAGEMENT_RULE in decision/rules/homepage-rules.ts).\n" +
          "-- Compare alongside served_variants.reason to confirm which rule fired.\n" +
          "-- A high rate (> 50%) for returning visitors is a healthy signal.",
      },
      thresholds: {
        good:         50,
        warning:      25,
        goodLabel:    "≥50% — returning visitors are being escalated appropriately",
        warningLabel: "25–50% — check if DB history is loading correctly for returning sessions",
      },
    } satisfies KpiDefinition,

    // ── History utilisation rate ─────────────────────────────────────────────
    {
      id:          "known-user-history-utilisation-rate",
      label:       "DB History Utilisation Rate",
      description:
        "The percentage of sessions where a returning-visitor rule fired, " +
        "as determined by the decision reason text. Confirms that the database " +
        "history layer (visitor history table) is actively influencing decisions, " +
        "not just tracking passively.",
      category:     "personalisation",
      format:       "percentage",
      primarySource: "served_variants",
      relatedTables: ["served_variants"],
      recommendedCadence: "weekly",
      implementationTier: "partial",
      implementationNotes:
        "The served_variants.reason column contains the human-readable rule label " +
        "from HomepageRule.reason. Pattern matching on reason text is fragile — if the " +
        "rule reason string changes, this query breaks. " +
        "Improvement: add a rule_id column to served_variants (from HomepageRule.id) " +
        "so the query can filter on 'homepage.returning_cta_clicked' and " +
        "'homepage.high_engagement' exactly.",
      repositoryHint:
        "Add fetchHistoryUtilisationRate(). " +
        "Filter served_variants WHERE reason ILIKE '%returning%' OR reason ILIKE '%engaged%'. " +
        "Divide by total served_variants rows.",
      formula: {
        numeratorSql:
          "SELECT COUNT(*)\n" +
          "FROM served_variants\n" +
          "WHERE reason ILIKE '%returning visitor%'\n" +
          "   OR reason ILIKE '%high%engagement%'",
        denominatorSql:
          "SELECT COUNT(*) FROM served_variants",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- KNOWN LIMITATION: relies on ILIKE pattern matching against reason text.\n" +
          "-- The reason strings are defined in decision/rules/homepage-rules.ts.\n" +
          "-- Current values:\n" +
          "--   RETURNING_CTA_CLICKED_RULE.reason: 'Returning visitor who previously clicked CTA — escalated to meeting intent.'\n" +
          "--   HIGH_ENGAGEMENT_RULE.reason:       'Highly engaged returning visitor (3+ page views) — platform-confidence experience.'\n" +
          "-- To harden: add a rule_id column to served_variants and filter on exact IDs.",
      },
      thresholds: {
        good:         10,
        warning:       3,
        goodLabel:    "≥10% — history layer is actively influencing decisions",
        warningLabel: "3–10% — verify DB history is being loaded for returning sessions",
      },
    } satisfies KpiDefinition,

    // ── High-engagement identification rate ──────────────────────────────────
    {
      id:          "known-user-engagement-escalation-rate",
      label:       "High-Engagement Identification Rate",
      description:
        "The percentage of sessions identified as high-engagement visitors " +
        "(3+ prior page views) and served the platform-confidence experience. " +
        "Verifies that the high-engagement rule is firing and that the platform " +
        "is rewarding loyal visitors with escalated social proof.",
      category:     "personalisation",
      format:       "percentage",
      primarySource: "served_variants",
      relatedTables: ["served_variants"],
      recommendedCadence: "monthly",
      implementationTier: "partial",
      implementationNotes:
        "Same pattern-matching limitation as known-user-history-utilisation-rate. " +
        "Filtering on the HIGH_ENGAGEMENT_RULE reason string. " +
        "Add a rule_id column to served_variants to resolve this cleanly.",
      repositoryHint:
        "Filter served_variants.reason for the high-engagement rule reason string. " +
        "See HIGH_ENGAGEMENT_RULE.reason in decision/rules/homepage-rules.ts.",
      formula: {
        numeratorSql:
          "SELECT COUNT(*)\n" +
          "FROM served_variants\n" +
          "WHERE reason ILIKE '%3+%' OR reason ILIKE '%high%engagement%'",
        denominatorSql:
          "SELECT COUNT(*) FROM served_variants",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- See HIGH_ENGAGEMENT_RULE in decision/rules/homepage-rules.ts.\n" +
          "-- This rule fires when history.fromDatabase = true AND pageViewCount >= 3.\n" +
          "-- A low rate is expected for a new deployment — the visitor history table\n" +
          "--   needs to accumulate data over several weeks before this cohort grows.",
      },
      thresholds: {
        good:          5,
        warning:       1,
        goodLabel:    "≥5% — meaningful high-engagement cohort forming",
        warningLabel: "1–5% — expected in early deployment; review after 60 days",
      },
    } satisfies KpiDefinition,

    // ── Multi-touch depth ────────────────────────────────────────────────────
    {
      id:          "known-user-multi-touch-depth",
      label:       "Returning Visitor Page-View Depth",
      description:
        "The average number of page views per returning-visitor session cohort. " +
        "Indicates whether adaptive content is driving meaningful re-engagement " +
        "beyond a single-page bounce. A depth > 2 for returning visitors suggests " +
        "the platform is sustaining interest across multiple pages.",
      category:     "engagement",
      format:       "score",
      primarySource: "events",
      relatedSources: ["sessions"],
      relatedEvents: ["page_view"],
      relatedTables: ["events", "sessions"],
      recommendedCadence: "monthly",
      implementationTier: "implemented",
      repositoryHint:
        "Add fetchReturningVisitorDepth() to analytics-repository.ts. " +
        "Join sessions (visit_type = 'returning') with events (event_type = 'page_view'). " +
        "Average the per-session page_view count.",
      formula: {
        numeratorSql:
          "SELECT AVG(pv_count) FROM (\n" +
          "  SELECT e.session_id, COUNT(*) AS pv_count\n" +
          "  FROM events e\n" +
          "  JOIN sessions s ON s.id = e.session_id\n" +
          "  WHERE e.event_type = 'page_view'\n" +
          "    AND s.visit_type = 'returning'\n" +
          "  GROUP BY e.session_id\n" +
          ") sub",
        notes:
          TIME_WINDOW_NOTE + "\n" +
          "-- page_view is fired server-side (via React after()) so it is accurate.\n" +
          "-- Returning-visitor cohort: sessions WHERE visit_type = 'returning'.\n" +
          "-- Compare against new visitor average for context.\n" +
          "-- A depth of 1.0 means most returning visitors see only one page.\n" +
          "-- Benchmark: a healthy returning-visitor depth is 1.5–2.5 for B2B SaaS.",
      },
      thresholds: {
        good:         2.0,
        warning:      1.2,
        goodLabel:    "≥2.0 — returning visitors are exploring multiple pages",
        warningLabel: "1.2–2.0 — consider internal linking and escalation CTAs",
      },
    } satisfies KpiDefinition,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// KPI CATALOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All four KPI sets in a single catalog.
 * Ordered from core product (website) to supporting (intelligence).
 */
export const KPI_CATALOG: KpiCatalog = {
  sets: [
    ADAPTIVE_WEBSITE_KPI_SET,
    ADAPTIVE_LANDING_PAGE_KPI_SET,
    ADAPTIVE_FOLLOW_UP_KPI_SET,
    KNOWN_USER_EXPERIENCE_KPI_SET,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a KpiSet by its ID. Returns undefined if not found.
 *
 * @example
 * const websiteKpis = getKpiSet("adaptive-website");
 * websiteKpis?.kpis.forEach(kpi => console.log(kpi.label));
 */
export function getKpiSet(id: string): KpiSet | undefined {
  return KPI_CATALOG.sets.find((s) => s.id === id);
}

/**
 * Returns a single KpiDefinition by its ID, searching across all sets.
 * Returns undefined if not found.
 *
 * @example
 * const kpi = getKpi("adaptive-cta-click-rate");
 * console.log(kpi?.formula?.numeratorSql);
 */
export function getKpi(id: string): KpiDefinition | undefined {
  for (const set of KPI_CATALOG.sets) {
    const found = set.kpis.find((k) => k.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Returns all KPI definitions with the given implementation tier.
 * Useful for building a "what can be reported today?" view.
 *
 * @example
 * const readyKpis = getKpisByTier("implemented");
 * // → returns the 13 KPIs that can be queried from the live DB today
 */
export function getKpisByTier(
  tier: import("./kpi-types").KpiImplementationTier,
): KpiDefinition[] {
  return KPI_CATALOG.sets.flatMap((s) =>
    s.kpis.filter((k) => k.implementationTier === tier),
  );
}

/**
 * Returns all KPI definitions for a given category.
 *
 * @example
 * const conversionKpis = getKpisByCategory("conversion");
 */
export function getKpisByCategory(
  category: import("./kpi-types").KpiCategory,
): KpiDefinition[] {
  return KPI_CATALOG.sets.flatMap((s) =>
    s.kpis.filter((k) => k.category === category),
  );
}

/**
 * Returns the primary KPI definition for a KPI set.
 *
 * @example
 * const primary = getPrimaryKpi("adaptive-website");
 * // → returns the "CTA Click Rate" KpiDefinition
 */
export function getPrimaryKpi(setId: string): KpiDefinition | undefined {
  const set = getKpiSet(setId);
  if (!set) return undefined;
  return set.kpis.find((k) => k.id === set.primaryKpiId);
}

/**
 * Applies performance thresholds to a raw KPI value and returns the health status.
 * Returns undefined if the KPI has no thresholds defined.
 *
 * @example
 * const status = getKpiHealthStatus("adaptive-cta-click-rate", 18);
 * // → "good" (18 >= 15 threshold)
 */
export function getKpiHealthStatus(
  kpiId: string,
  value: number,
): "good" | "warning" | "critical" | undefined {
  const kpi = getKpi(kpiId);
  if (!kpi?.thresholds) return undefined;

  const { good, warning } = kpi.thresholds;
  if (value >= good)    return "good";
  if (value >= warning) return "warning";
  return "critical";
}
