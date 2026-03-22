/**
 * KPI Model Types
 *
 * A typed vocabulary for defining what success looks like per use case /
 * product module. KPI definitions sit at the intersection of:
 *
 *   Product model    (product/types.ts)      — which module does this KPI belong to?
 *   Tracking model   (tracking/event-types.ts) — which events drive this metric?
 *   Data model       (data/repositories/)     — which tables power the query?
 *
 * ─── Three-tier design ────────────────────────────────────────────────────────
 *
 *   KpiDefinition   A single measurable metric: label, formula, source, cadence.
 *   KpiSet          A named collection of KpiDefinitions for one use case.
 *   KpiSetId        Stable slug for each use-case context.
 *
 * ─── Implementation tiers ─────────────────────────────────────────────────────
 *
 *   implemented     All required events and tables exist today. The metric can
 *                   be queried against the live database with the formula below.
 *
 *   partial         The underlying events exist but additional joins, payload
 *                   fields, or filtering logic are needed before the metric is
 *                   fully reliable. Marked as such so engineers know it needs
 *                   care before it goes into a client-facing report.
 *
 *   planned         Requires events, integrations, or CRM data that do not yet
 *                   exist. Defined now so the full picture is visible and the
 *                   engineering roadmap is informed.
 *
 * ─── SQL formula convention ───────────────────────────────────────────────────
 *
 *   KpiFormula documents the key derivation pattern against the live schema.
 *   Tables in scope:
 *     sessions         — one row per adaptive page visit
 *     served_variants  — one row per decision (hero_key, proof_key, cta_key, reason)
 *     events           — named events: page_view, variant_served, cta_click,
 *                        scroll_depth, contact_form_submit
 *
 *   All column names are as defined in the Supabase migration files.
 *   Payload JSONB fields are accessed with the ->> operator.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   analytics/kpi-types.ts   ← YOU ARE HERE — all type definitions
 *   analytics/kpi-sets.ts    ← concrete KPI set definitions for each use case
 *   analytics/index.ts       ← barrel re-export
 */

import type { EventType } from "@/tracking/event-types";
import type { ProductModuleId } from "@/product/types";

// ── Stable identifier types ────────────────────────────────────────────────────

/**
 * Stable identifier for every defined KPI metric.
 *
 * Convention: {use-case-prefix}-{metric-slug}
 * e.g. "adaptive-cta-click-rate", "followup-n8n-dispatch-rate"
 */
export type KpiId =
  // ── Adaptive Website ────────────────────────────────────────────────────────
  | "adaptive-cta-click-rate"
  | "adaptive-personalisation-coverage"
  | "adaptive-source-rule-alignment"
  | "adaptive-scroll-depth-p75"
  | "adaptive-return-visit-rate"
  // ── Adaptive Landing Page ────────────────────────────────────────────────────
  | "landing-cta-click-rate"
  | "landing-variant-diversity"
  | "landing-campaign-conversion-rate"
  | "landing-direct-conversion-rate"
  // ── Adaptive Follow-up ───────────────────────────────────────────────────────
  | "followup-submission-rate"
  | "followup-n8n-dispatch-rate"
  | "followup-context-richness"
  | "followup-pipeline-conversion-rate"
  // ── Known-User Experience ────────────────────────────────────────────────────
  | "known-user-returning-cta-escalation-rate"
  | "known-user-history-utilisation-rate"
  | "known-user-engagement-escalation-rate"
  | "known-user-multi-touch-depth";

/**
 * The four use-case contexts for which KPI sets are defined.
 *
 * These align with the four product modules most relevant to client reporting
 * and map directly to the ProductModuleId vocabulary in product/types.ts.
 */
export type KpiSetId =
  | "adaptive-website"
  | "adaptive-landing-page"
  | "adaptive-follow-up"
  | "known-user-experience";

// ── Enumeration types ──────────────────────────────────────────────────────────

/**
 * How the KPI value should be displayed.
 *
 * percentage   0–100 value (e.g. 23.4%): divide by 100 before formatting.
 * count        Absolute integer (e.g. 1,842 sessions).
 * ratio        Numerator:denominator (e.g. 3:1 scroll depth).
 * score        Composite index (e.g. context richness 0–4).
 * duration     Average time in seconds (e.g. session duration).
 */
export type KpiFormat =
  | "percentage"
  | "count"
  | "ratio"
  | "score"
  | "duration";

/**
 * The nature of what a KPI measures.
 *
 * engagement      How actively visitors interact with the page.
 * conversion      Funnel actions that progress visitors toward pipeline.
 * personalisation How effectively the adaptive engine is serving relevant content.
 * pipeline        Downstream revenue and CRM outcomes (often external).
 * reliability     How trustworthy the underlying data and infrastructure are.
 */
export type KpiCategory =
  | "engagement"
  | "conversion"
  | "personalisation"
  | "pipeline"
  | "reliability";

/**
 * Recommended reporting cadence for this metric.
 *
 * real-time   Monitor continuously (ops/alerting use).
 * daily       Review every business day (campaign flight, active launch).
 * weekly      Standard cadence for most product metrics.
 * monthly     Strategic review — trend analysis, QBR.
 */
export type ReportingCadence =
  | "real-time"
  | "daily"
  | "weekly"
  | "monthly";

/**
 * Implementation tier — how ready this metric is for production reporting.
 *
 * implemented   All required events and DB columns exist. Metric is queryable today.
 * partial       Events exist but the query needs additional joins or payload parsing.
 *               Safe to show internally but label clearly in client-facing views.
 * planned       Requires new events, integrations, or external data. Not yet queryable.
 */
export type KpiImplementationTier =
  | "implemented"
  | "partial"
  | "planned";

/**
 * The primary data source for a metric.
 *
 * These map to actual tables in the Supabase database, or flag that the
 * metric depends on an external system.
 */
export type KpiDataSource =
  | "events"          // The events table (page_view, cta_click, scroll_depth, etc.)
  | "sessions"        // The sessions table (source, device, visit_type, utm_*)
  | "served_variants" // The served_variants table (hero_key, proof_key, cta_key, reason)
  | "external.ga4"    // Google Analytics 4 (page-level metrics, bounce rate)
  | "external.n8n"    // n8n workflow execution logs
  | "external.crm";   // CRM system (HubSpot, Salesforce, etc.)

// ── Threshold type ─────────────────────────────────────────────────────────────

/**
 * Colour-coded performance thresholds for dashboard display.
 *
 * Values are in the same unit as the KpiFormat:
 *   percentage → 0–100 (not 0–1)
 *   count      → raw integer
 *   score      → score scale (e.g. 0–4)
 *
 * Interpretation:
 *   value ≥ good    → green
 *   value ≥ warning → amber
 *   value <  warning → red
 *
 * Thresholds are intentionally conservative and industry-agnostic.
 * Clients should calibrate against their own baseline after 30 days of data.
 */
export interface KpiThresholds {
  /** Value at or above which the metric is considered healthy. */
  good: number;
  /** Value at or above which the metric is acceptable but needs attention. */
  warning: number;
  /** Optional: label for what "good" means in context. */
  goodLabel?: string;
  /** Optional: label for what the warning threshold represents. */
  warningLabel?: string;
}

// ── SQL formula type ───────────────────────────────────────────────────────────

/**
 * Documents the SQL derivation pattern for a metric against the live schema.
 *
 * Not executable directly — these are illustrative query patterns that the
 * analytics-repository functions should implement. Written against the
 * Supabase Postgres schema (sessions, served_variants, events tables).
 *
 * All queries assume service-role access (RLS bypassed).
 * Payload JSONB fields use the ->> text extraction operator.
 *
 * When denominatorSql is absent, the metric is an absolute count.
 */
export interface KpiFormula {
  /**
   * SQL expression or query fragment that computes the numerator (or the
   * full metric value if no denominator).
   *
   * Example for cta_click_rate numerator:
   *   SELECT COUNT(DISTINCT session_id) FROM events
   *   WHERE event_type = 'cta_click'
   */
  numeratorSql: string;

  /**
   * SQL expression for the denominator when the metric is a ratio/percentage.
   *
   * Example for cta_click_rate denominator:
   *   SELECT COUNT(*) FROM sessions
   */
  denominatorSql?: string;

  /**
   * Additional SQL context — filters, joins, or window functions needed
   * to make the query correct. Written as a comment or WHERE clause example.
   *
   * Example:
   *   -- Filter to the relevant time window with:
   *   -- WHERE created_at >= NOW() - INTERVAL '7 days'
   */
  notes?: string;
}

// ── KPI definition ─────────────────────────────────────────────────────────────

/**
 * A single measurable KPI with its full context: what it measures, where
 * the data comes from, how to compute it, and how often to review it.
 */
export interface KpiDefinition {
  /**
   * Stable, URL-safe slug. Used as the primary key across the KPI system.
   * Never change — analytics events and reports may reference this ID.
   */
  id: KpiId;

  /**
   * Short, client-facing metric label.
   * 2–5 words. Suitable for chart axes and dashboard tiles.
   * Example: "CTA Click Rate"
   */
  label: string;

  /**
   * One to two sentence plain-English description of what this metric measures
   * and why it matters. Written for account managers and clients, not engineers.
   */
  description: string;

  /**
   * What type of outcome this metric tracks.
   */
  category: KpiCategory;

  /**
   * How the metric value should be formatted for display.
   */
  format: KpiFormat;

  /**
   * The authoritative data source for this metric.
   * When this is an `external.*` source, the metric cannot be queried from
   * the platform database alone.
   */
  primarySource: KpiDataSource;

  /**
   * Additional data sources that must be joined to compute this metric.
   * For example, a personalisation rate needs both sessions and served_variants.
   */
  relatedSources?: readonly KpiDataSource[];

  /**
   * First-party tracking events that feed this metric.
   * References the EventType union from tracking/event-types.ts.
   * Empty or absent for metrics derived from session/variant metadata rather
   * than named events.
   */
  relatedEvents?: readonly EventType[];

  /**
   * The Postgres tables queried to compute this metric.
   * Useful for impact analysis when the schema evolves.
   */
  relatedTables: readonly string[];

  /**
   * The SQL derivation pattern for this metric.
   * Implementors should translate this into a repository function when
   * wiring the metric to a reporting dashboard.
   * Absent for `planned` metrics where the query isn't yet definable.
   */
  formula?: KpiFormula;

  /**
   * How often this metric should be reviewed in a reporting context.
   * Not a technical sampling interval — a recommendation for the cadence
   * of meaningful review (weekly call, monthly QBR, etc.).
   */
  recommendedCadence: ReportingCadence;

  /**
   * Optional performance thresholds for dashboard colouring.
   * Thresholds are advisory and should be calibrated per client after launch.
   */
  thresholds?: KpiThresholds;

  /**
   * Whether this metric can be computed from the live platform data today.
   *
   * implemented   Full query support exists or can be added trivially.
   * partial       Queryable but with caveats (payload parsing, rough attribution).
   * planned       Requires new events, tables, or external integrations.
   */
  implementationTier: KpiImplementationTier;

  /**
   * Implementation notes for engineers — what's missing, what to build next,
   * or where the current implementation has known limitations.
   * Required for `partial` and `planned` tiers.
   */
  implementationNotes?: string;

  /**
   * Dashboard wiring hint — the analytics-repository function (existing or
   * proposed) that computes this metric, or a description of the query pattern.
   *
   * Existing functions: fetchDashboardMetrics(), fetchVariantPerformance(),
   * listRecentSessions(), fetchSessionDetail().
   */
  repositoryHint?: string;
}

// ── KPI set ────────────────────────────────────────────────────────────────────

/**
 * A named collection of KPI definitions tied to a specific use case.
 *
 * One KpiSet per use-case context. Maps to a ProductModuleId so the product
 * catalog and the KPI catalog can be cross-referenced in tooling.
 */
export interface KpiSet {
  /**
   * Stable identifier for this KPI set.
   * Matches the use-case framing used in client deliverables and QBRs.
   */
  id: KpiSetId;

  /**
   * The product module this use case maps to in the product catalog.
   * Used to cross-reference with ProductModule.useCases and feature flags.
   */
  moduleId: ProductModuleId;

  /**
   * Human-readable name for this KPI set — used in report headers and QBR slides.
   * Example: "Adaptive Website Performance"
   */
  label: string;

  /**
   * One to three sentence description of what this use case is trying to achieve
   * and what the KPIs collectively measure. Written for account managers.
   */
  description: string;

  /**
   * The single most important KPI in this set.
   * The metric that most directly indicates whether the use case is succeeding.
   * Displayed first in reporting views.
   */
  primaryKpiId: KpiId;

  /**
   * All KPI definitions for this use case, ordered by importance.
   * Primary metric first, supporting metrics after, lagging/external metrics last.
   */
  kpis: readonly KpiDefinition[];
}

// ── KPI catalog ────────────────────────────────────────────────────────────────

/**
 * The full KPI catalog — all use-case KPI sets in one typed structure.
 *
 * Defined in analytics/kpi-sets.ts and re-exported from analytics/index.ts.
 */
export interface KpiCatalog {
  /** All KPI sets, ordered from core (website) to extended (follow-up, intelligence). */
  sets: readonly KpiSet[];
}

// ── Lookup types ───────────────────────────────────────────────────────────────

/** Fast lookup index for KPI sets by ID. */
export type KpiSetIndex = Readonly<Record<KpiSetId, KpiSet>>;

/** Fast lookup index for individual KPIs by ID. */
export type KpiIndex = Readonly<Partial<Record<KpiId, KpiDefinition>>>;

// ── Runtime value types ────────────────────────────────────────────────────────
//
// Used when a KPI is computed and the value is surfaced in a dashboard.
// These are separate from the definition types — definitions are static,
// values are dynamic and time-bound.

/**
 * A computed KPI value at a point in time or over a period.
 */
export interface KpiValue {
  /** Which KPI this value is for. */
  kpiId: KpiId;

  /** The computed metric value. Units and scale depend on KpiDefinition.format. */
  value: number;

  /**
   * ISO 8601 timestamps bounding the measurement window.
   * The window over which the metric was computed.
   */
  periodStart: string;
  periodEnd:   string;

  /**
   * Whether this value meets the good/warning/red threshold.
   * Only present if KpiDefinition.thresholds is defined.
   */
  healthStatus?: "good" | "warning" | "critical";

  /**
   * Previous period value for trend display.
   * Optional — present only when period-over-period data is available.
   */
  previousValue?: number;

  /**
   * Percentage change vs. previous period (positive = improvement).
   * Positive always means "better" regardless of metric direction.
   * Present only when previousValue is available.
   */
  trend?: number;
}

/**
 * A computed KpiSet report — all KPI values for a use case over a period.
 * This is what a QBR slide or client dashboard tile would consume.
 */
export interface KpiSetReport {
  kpiSetId:   KpiSetId;
  periodStart: string;
  periodEnd:   string;
  values:      readonly KpiValue[];
  /** ISO timestamp when this report was generated. */
  generatedAt: string;
}
