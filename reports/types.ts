/**
 * Report Model Types
 *
 * Types for the customer-facing reporting system. A Report is a structured
 * snapshot of platform performance over a given period, organized into six
 * named sections that map to the key reporting themes in a client QBR or
 * monthly check-in:
 *
 *   summary              Executive overview — headline metric, wins, watch-list.
 *   context-segments     Traffic sources and how the adaptive engine served each.
 *   variant-performance  Which content variants drove the most engagement.
 *   conversion-metrics   KPI-aligned outcomes: CTR, coverage, submission rate.
 *   ai-rules-insights    How the decision engine (rules / AI) behaved.
 *   recommendations      Prioritised next actions with rationale and ownership.
 *
 * ─── Model hierarchy ──────────────────────────────────────────────────────────
 *
 *   ReportTemplate    Structural definition: sections, their titles, and
 *                     required/optional status. Defined once, reused per report.
 *
 *   ReportConfig      Per-report configuration: tenant, period, which sections
 *                     are active, who prepared it, and when.
 *
 *   ReportSectionData The actual data payload — one typed field per section.
 *                     Each field is optional; absent fields mean the section
 *                     was not included in this report.
 *
 *   Report            The assembled report: config + section data + metadata.
 *                     This is the final object that gets rendered or exported.
 *
 * ─── Reporting cadence ────────────────────────────────────────────────────────
 *
 *   monthly     30-day window — standard client check-in cadence.
 *   quarterly   90-day window — QBR / strategic review cadence.
 *
 *   Both cadences use identical section types. The period label communicates
 *   the cadence to readers: "March 2025" for monthly, "Q1 2025" for quarterly.
 *
 * ─── Connection to analytics module ──────────────────────────────────────────
 *
 *   ConversionMetricRow.kpiId   → KpiId in analytics/kpi-types.ts
 *   RecommendationRow.relatedKpiId → same
 *
 *   The assembler in reports/templates/default-report.ts bridges the analytics
 *   module (KPI definitions + values) and the report types here.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   reports/types.ts                      ← YOU ARE HERE
 *   reports/templates/default-report.ts   ← template definition + assembler
 *   reports/index.ts                      ← barrel re-export
 */

import type { KpiId, KpiFormat } from "@/analytics/kpi-types";

// ─────────────────────────────────────────────────────────────────────────────
// PERIOD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reporting cadence — the time window over which a report is generated.
 *
 * monthly     30-day window. Standard client check-in.
 * quarterly   90-day window. QBR or strategic review.
 */
export type ReportCadence = "monthly" | "quarterly";

/**
 * The time window a report covers.
 *
 * startDate / endDate are ISO date strings (YYYY-MM-DD), not ISO timestamps.
 * The label is the human-readable form used in headings and file names.
 *
 * @example
 *   { cadence: "monthly", startDate: "2025-03-01", endDate: "2025-03-31", label: "March 2025" }
 *   { cadence: "quarterly", startDate: "2025-01-01", endDate: "2025-03-31", label: "Q1 2025" }
 */
export interface ReportPeriod {
  cadence:   ReportCadence;
  /** ISO date string: first day of the period, e.g. "2025-03-01" */
  startDate: string;
  /** ISO date string: last day of the period, e.g. "2025-03-31" */
  endDate:   string;
  /**
   * Human-readable period label.
   * Used in report headings, file names, and the report ID slug.
   * Examples: "March 2025", "Q1 2025", "January–March 2025"
   */
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION IDENTIFIERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for each report section.
 *
 * These IDs appear in template configs, route parameters, and may be stored
 * in report records. Never rename them without a migration.
 *
 * summary              One-page executive overview.
 * context-segments     Traffic source breakdown + per-source variant alignment.
 * variant-performance  Best/worst performing variants per adaptive slot.
 * conversion-metrics   KPI-aligned outcomes: CTR, coverage, submission rate.
 * ai-rules-insights    Decision engine behaviour — rules fired, AI coverage.
 * recommendations      Prioritised next actions with rationale and ownership.
 */
export type ReportSectionId =
  | "summary"
  | "context-segments"
  | "variant-performance"
  | "conversion-metrics"
  | "ai-rules-insights"
  | "recommendations";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DATA TYPES  (one interface per section)
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Executive Summary ──────────────────────────────────────────────────────

/**
 * Top-line summary for the reporting period.
 *
 * Designed to be readable in 60 seconds — one headline, a handful of wins,
 * and a focused watch-list. The data is derived from the broader metrics;
 * account managers should feel free to rewrite the generated text.
 */
export interface ReportSummarySection {
  /**
   * One-sentence characterisation of the period.
   * Should be specific enough to be meaningful without being verbose.
   *
   * Example: "Steady growth month — CTA click rate held at 12% with 842 sessions."
   */
  headline: string;

  /** Total sessions in the reporting period (≈ page views). */
  sessionCount: number;

  /** Total variant decisions served (one per adaptive page render). */
  variantsServed: number;

  /**
   * Overall CTA click rate for the period: ctaClicks / sessions × 100.
   * Null when session count is zero or click data is unavailable.
   */
  overallCtaClickRate: number | null;

  /**
   * 2–4 specific wins from the period.
   * Written as bullet points — present tense, data-backed where possible.
   * Example: "LinkedIn is the dominant source at 61% of sessions — variant alignment is strong."
   */
  keyWins: string[];

  /**
   * 1–3 focus areas — observations worth attention but not yet problems.
   * Written constructively: what to watch, not what failed.
   * Example: "CTA click rate (4.2%) is just below the 5% benchmark — review CTA copy."
   */
  focusAreas: string[];

  /**
   * Optional data quality or coverage caveat for this period.
   * Use when the data window is partial or a tracking gap affects accuracy.
   *
   * Example: "Scroll depth tracking added 15 March — depth data covers second half only."
   */
  dataQualityNote?: string;
}

// ── 2. Context Segments ───────────────────────────────────────────────────────

/**
 * One row in the context segments table — a single traffic source and how
 * the platform served its sessions.
 *
 * Rows are ordered by sessionCount descending (highest-volume source first).
 */
export interface ContextSegmentRow {
  /**
   * Human-readable source label for display.
   * Example: "LinkedIn", "Google", "Direct", "Email"
   */
  sourceLabel: string;

  /**
   * Raw source key as stored in sessions.source.
   * Example: "linkedin", "google", "direct", "unknown"
   */
  sourceKey: string;

  /** Session count for this source in the period. */
  sessionCount: number;

  /**
   * This source's share of total sessions in the period.
   * Expressed as a percentage: 0–100, one decimal place.
   */
  sessionShare: number;

  /**
   * The hero variant most frequently served to sessions from this source.
   * Confirms the engine is routing source-specific content correctly.
   * Example: "hero_google_problem" for Google-sourced traffic.
   */
  topHeroVariant: string;

  /**
   * The CTA variant most frequently served to sessions from this source.
   * Example: "cta_meeting" for high-intent returning visitors.
   */
  topCtaVariant: string;

  /**
   * CTA click rate for sessions from this source, as a percentage.
   * Null when click data cannot be segmented by source from available queries.
   */
  ctaClickRate?: number | null;

  /**
   * One-sentence qualitative observation about this segment.
   * Generated by the assembler — account managers should review and customise.
   *
   * Example: "LinkedIn traffic is growing MoM and aligns well with the problem-framing variant."
   */
  insight?: string;
}

/**
 * The context segments section: all traffic sources ranked by volume.
 */
export interface ContextSegmentsSection {
  /** Source rows, ordered by sessionCount descending. */
  rows: ContextSegmentRow[];

  /** Total sessions across all sources in the period. Used to derive shares. */
  totalSessions: number;

  /**
   * Optional note when one source is dominant (≥40% of sessions).
   * Flags the strategic risk of over-dependence on a single channel.
   *
   * Example: "LinkedIn accounts for 63% of sessions — the personalisation strategy
   *           is heavily skewed toward this audience."
   */
  dominantSourceNote?: string;
}

// ── 3. Variant Performance ────────────────────────────────────────────────────

/**
 * One row in the variant performance table — a single variant key with its
 * serve statistics and CTA engagement rate.
 */
export interface VariantPerformanceRow {
  /**
   * The CMS content key for this variant.
   * Example: "hero_google_problem", "proof_cases", "cta_meeting"
   */
  variantKey: string;

  /** Which adaptive slot this variant occupies. */
  variantType: "hero" | "proof" | "cta";

  /** Total serves of this variant in the period. */
  serves: number;

  /**
   * This variant's share of all serves in its slot.
   * 100 × serves / totalServesForSlot. One decimal place.
   */
  serveSharePct: number;

  /**
   * CTA click rate for sessions that were served this variant.
   * Defined as: sessions with ≥1 cta_click event / sessions served this variant.
   * Note: this is session-level attribution, not element-level.
   */
  ctaClickRate: number;

  /** Top traffic source among sessions served this variant. */
  topSource: string;

  /**
   * The decision rule label most commonly associated with this variant.
   * Derived from served_variants.reason (best-effort text extraction).
   * Absent when reason text doesn't clearly identify a rule.
   */
  ruleLabel?: string;

  /**
   * True when this is the highest CTR variant in its slot for this period.
   * Used to visually flag the "winner" in reports.
   */
  isTopPerformer: boolean;
}

/**
 * The variant performance section: per-slot rankings of all active variants.
 */
export interface VariantPerformanceSection {
  /** Hero variants, sorted by serves descending. Top performer flagged. */
  heroRows:  VariantPerformanceRow[];
  /** Proof variants, sorted by serves descending. */
  proofRows: VariantPerformanceRow[];
  /** CTA variants, sorted by serves descending. */
  ctaRows:   VariantPerformanceRow[];

  /**
   * Optional concentration note when 2 variants dominate a slot (≥90% of serves).
   * Example: "94% of hero serves go to two variants — add a third for better coverage."
   */
  concentrationNote?: string;

  /**
   * True when the underlying served_variants query was capped at its row limit.
   * When true, serve counts and CTRs may not represent the full period accurately.
   */
  dataTruncated: boolean;
}

// ── 4. Conversion & Engagement Metrics ────────────────────────────────────────

/**
 * One row in the conversion metrics table — a single KPI with its computed
 * value, health status, and period-over-period trend.
 *
 * Aligned to the KpiDefinition model in analytics/kpi-types.ts.
 * KPI IDs cross-reference the full KPI catalog for formulas and thresholds.
 */
export interface ConversionMetricRow {
  /**
   * Stable KPI identifier.
   * Matches KpiId from analytics/kpi-types.ts wherever possible.
   * May be a free-form string for report-derived metrics not in the catalog.
   */
  kpiId: KpiId | string;

  /** Short label for display in report tables. Example: "CTA Click Rate" */
  label: string;

  /**
   * Computed metric value for the period.
   * Null when the metric cannot be computed from available data
   * (e.g. requires a CRM integration or not-yet-implemented query).
   */
  value: number | null;

  /** How the value should be formatted for display. */
  format: KpiFormat;

  /**
   * Performance assessment against the KPI's defined thresholds.
   * Absent when no thresholds are defined or when value is null.
   */
  healthStatus?: "good" | "warning" | "critical";

  /**
   * Value from the previous equivalent period (e.g. February if March is current).
   * Absent when historical data is not available.
   */
  previousPeriodValue?: number;

  /**
   * Percentage change vs. previous period.
   * Positive always means improvement, regardless of metric direction.
   * Example: +12 means "12% better than last period".
   * Absent when previousPeriodValue is not available.
   */
  trendPct?: number;

  /**
   * Short note about data quality, estimation caveats, or implementation status.
   * Example: "Estimated from session-level attribution — element-level tracking pending."
   */
  note?: string;
}

/**
 * The conversion metrics section: KPI-aligned outcomes for the period.
 */
export interface ConversionMetricsSection {
  /**
   * Metrics rows, ordered from primary (CTA click rate) to supporting (submission
   * rate) to lagging/external (pipeline conversion).
   */
  metrics: ConversionMetricRow[];

  /**
   * Note about KPI coverage — how many of the platform's metrics are computable
   * for this period vs. how many are pending data source connections.
   *
   * Example: "4 of 5 KPIs available — pipeline conversion requires CRM integration."
   */
  coverageNote?: string;
}

// ── 5. Decision Engine Insights ───────────────────────────────────────────────

/**
 * The type of decision engine that served decisions this period.
 *
 * rules      Static rule set — fully deterministic.
 * ai         AI decision provider (with optional confidence policy gate).
 * experiment A/B experiment layer — deterministic bucket assignment.
 * hybrid     Rules provider decorated with an experiment or AI layer.
 */
export type DecisionEngineType = "rules" | "ai" | "experiment" | "hybrid";

/**
 * One row in the rule fire breakdown — how often a specific decision rule
 * fired during the period.
 *
 * Implementation note: rule fire counts are derived from served_variants.reason
 * text using ILIKE pattern matching. Accuracy improves when a rule_id column
 * is added to served_variants — see kpi-sets.ts for the known limitation note.
 */
export interface RuleFiredRow {
  /**
   * The rule ID from HomepageRule.id, e.g. "homepage.returning_cta_clicked".
   * May be "inferred.{variantKey}" when derived from variant data rather than
   * the actual reason column.
   */
  ruleId: string;

  /** Human-readable rule label for display in reports. */
  ruleLabel: string;

  /**
   * Number of variant decisions where this rule fired during the period.
   * One decision = one row in served_variants.
   */
  firedCount: number;

  /**
   * firedCount / totalDecisions × 100.
   * Shows what share of the engine's work this rule accounted for.
   */
  shareOfDecisions: number;

  /**
   * CTA click rate for sessions where this rule fired.
   * Indicates whether the rule is directing traffic toward high-intent content.
   * Absent when session-level click attribution is not available.
   */
  associatedCtaClickRate?: number;
}

/**
 * The AI / Rules insights section: how the decision engine behaved.
 */
export interface AiRulesInsightsSection {
  /** Which decision engine type was active for this tenant this period. */
  activeEngine: DecisionEngineType;

  /** Total variant decisions served during the period. */
  totalDecisions: number;

  /**
   * Per-rule breakdown, sorted by firedCount descending.
   * Shows which rules drove the most personalisation decisions.
   */
  ruleFiredRows: RuleFiredRow[];

  /**
   * When activeEngine includes "ai": percentage of decisions where the AI
   * provider's plan was used (vs. fallback to rules).
   * Null when AI is not active or ai_decision_logs data is unavailable.
   * Undefined when not applicable (pure rules engine).
   */
  aiCoverageRate?: number | null;

  /**
   * When activeEngine includes "ai": percentage of AI decisions that fell back
   * to the rules provider due to low confidence policy score.
   * Null when AI is not active.
   * Undefined when not applicable.
   */
  aiFallbackRate?: number | null;

  /**
   * One to two paragraph narrative about the engine's behaviour this period.
   * Covers rule distribution, confidence (if AI), and any anomalies.
   * Generated by the assembler — account managers should review and customise.
   */
  engineNarrative: string;
}

// ── 6. Recommendations ────────────────────────────────────────────────────────

/**
 * How urgently a recommendation should be acted on.
 *
 * high     Address before the next reporting period. Significant impact likely.
 * medium   Address within two reporting periods. Meaningful but not urgent.
 * low      Address when bandwidth allows. Incremental improvement.
 */
export type RecommendationPriority = "high" | "medium" | "low";

/**
 * Which aspect of the platform a recommendation addresses.
 *
 * content       Add, edit, or restructure variant content in the CMS.
 * rules         Adjust decision rules or add new routing conditions.
 * tracking      Fix or extend data collection (missing events, payload fields).
 * configuration Platform or tenant setup (variant keys, features, env vars).
 * strategy      Broader positioning, ICP, channel mix, or roadmap decisions.
 */
export type RecommendationCategory =
  | "content"
  | "rules"
  | "tracking"
  | "configuration"
  | "strategy";

/**
 * One recommendation — a specific, actionable next step with context.
 *
 * Designed for QBR and monthly review use: clear title, data-backed rationale,
 * a concrete action, and explicit ownership so nothing falls through the cracks.
 */
export interface RecommendationRow {
  /**
   * Stable identifier for this recommendation.
   * Convention: "rec-{cadence}-{zero-padded-sequence}", e.g. "rec-monthly-001".
   * Used for tracking completion across successive reports.
   */
  id: string;

  /** How urgently this should be acted on. */
  priority: RecommendationPriority;

  /** Which aspect of the platform this recommendation addresses. */
  category: RecommendationCategory;

  /**
   * Short action-oriented title.
   * 5–10 words. Written as an imperative.
   * Example: "Add a LinkedIn-specific proof variant"
   */
  title: string;

  /**
   * Why this is recommended — what data or observation supports it.
   * 1–2 sentences. Specific enough to justify the effort to a sceptical client.
   * Example: "CTA click rate for LinkedIn sessions (3.2%) is below the 5% benchmark.
   *           LinkedIn visitors typically respond better to social proof than direct CTA."
   */
  rationale: string;

  /**
   * The concrete action to take.
   * 1–2 sentences, specific enough to assign as a task in a project management tool.
   * Example: "Create a hero_linkedin_proof variant in the CMS featuring a case study
   *           relevant to LinkedIn's typical ICP. Register the key in the tenant variant config."
   */
  suggestedAction: string;

  /**
   * The KPI this recommendation is expected to improve, if applicable.
   * Links the recommendation to a measurable outcome for future validation.
   */
  relatedKpiId?: KpiId | string;

  /** The variant key most relevant to this recommendation, if applicable. */
  relatedVariantKey?: string;

  /**
   * Who is responsible for acting on this recommendation.
   *
   * client              The client's content or marketing team.
   * mister-chameleon    The MC account manager or engineer.
   * shared              Requires both parties (e.g. content strategy + CMS work).
   */
  owner: "client" | "mister-chameleon" | "shared";
}

/**
 * The recommendations section: prioritised next actions for the coming period.
 */
export interface RecommendationsSection {
  /**
   * Recommendation rows, sorted by priority (high → medium → low),
   * then by estimated impact within each priority group.
   */
  items: RecommendationRow[];

  /**
   * Suggested date for reviewing progress on these recommendations.
   * ISO date string, typically 30 days after the report period end date.
   * Example: "2025-04-30"
   */
  nextReviewDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DATA MAP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All section data in one container.
 *
 * Each field is optional because reports may omit sections based on the
 * active template config. The presence of a field means that section was
 * included in the report and its data was successfully assembled.
 *
 * Field names use camelCase versions of the ReportSectionId slugs.
 */
export interface ReportSectionData {
  /** Section 1 — Executive summary. Required in all standard templates. */
  summary?: ReportSummarySection;

  /** Section 2 — Traffic source breakdown. Required in all standard templates. */
  contextSegments?: ContextSegmentsSection;

  /** Section 3 — Per-slot variant performance. Required in all standard templates. */
  variantPerformance?: VariantPerformanceSection;

  /** Section 4 — Conversion and engagement KPIs. Required in all standard templates. */
  conversionMetrics?: ConversionMetricsSection;

  /** Section 5 — Decision engine behaviour (rules fired, AI coverage). Optional. */
  aiRulesInsights?: AiRulesInsightsSection;

  /** Section 6 — Prioritised next actions. Required in all standard templates. */
  recommendations?: RecommendationsSection;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for a single section within a report template.
 * Defines how the section is presented, and whether it can be omitted.
 */
export interface ReportSectionConfig {
  /** Which section type this config describes. */
  id: ReportSectionId;

  /**
   * Display title used in the rendered report heading and table of contents.
   * Templates set defaults; account managers can override per-report.
   */
  title: string;

  /**
   * One-sentence description of what this section covers.
   * Shown in the report table of contents and as section subheadings.
   */
  description: string;

  /**
   * Whether this section must be present for the report to be considered
   * complete. Required sections cannot be omitted from a template-based report.
   * Optional sections may be suppressed (e.g. AI insights when using rules only).
   */
  required: boolean;
}

/**
 * A report template — defines which sections a report includes and how they
 * are presented.
 *
 * Templates are reusable. The same template generates every monthly report
 * for every tenant; only the data and period differ.
 */
export interface ReportTemplate {
  /** Stable template identifier. Example: "default-monthly" */
  id: string;

  /** Human-readable template name. Example: "Standard Client Report" */
  name: string;

  /**
   * What this template is designed for — which use cases and cadences it
   * serves best. Written for account managers choosing between templates.
   */
  description: string;

  /** The cadence this template is primarily designed for. */
  defaultCadence: ReportCadence;

  /**
   * Ordered section configs. Reports are rendered in this order.
   * Required sections always appear; optional sections can be suppressed.
   */
  sections: ReportSectionConfig[];
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT CONFIG + REPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-report configuration — the metadata that scopes a report to a specific
 * tenant, period, and template combination.
 */
export interface ReportConfig {
  /** Which tenant this report covers. Matches TenantConfig.tenantId. */
  tenantId:   string;
  /** Human-readable tenant name for report headings. */
  tenantName: string;

  /** The reporting period: start date, end date, label. */
  period: ReportPeriod;

  /** Which template was used to structure this report. */
  templateId: string;

  /**
   * Which sections are included in this report.
   * A subset of the template's sections — optional sections may be excluded.
   */
  includeSections: ReportSectionId[];

  /**
   * Name or identifier of the person who generated this report.
   * Typically an account manager or a system identifier ("automated").
   */
  preparedBy?: string;

  /** ISO timestamp when this report configuration was created. */
  preparedAt: string;
}

/**
 * The complete assembled report: configuration, section data, and metadata.
 *
 * This is the final object produced by the assembler and consumed by the
 * renderer (preview page, PDF export, or external reporting tools).
 */
export interface Report {
  /**
   * Stable report identifier.
   *
   * Convention: {tenantId}-{period-label-slug}-{cadence}
   * Example: "acme-corp-march-2025-monthly"
   *
   * Used for deduplication, file naming, and linking between successive reports.
   */
  id: string;

  /** Report metadata — tenant, period, template, preparer. */
  config: ReportConfig;

  /**
   * The assembled data payload.
   * Each populated field corresponds to a section in config.includeSections.
   */
  sections: ReportSectionData;

  /** ISO timestamp when this Report object was assembled. */
  generatedAt: string;

  /**
   * Human-readable note about the data window — communicates to readers
   * exactly what period the data covers and the total session count.
   *
   * Example: "Data covers 1–31 March 2025 (UTC). Sessions in period: 842."
   */
  dataWindowNote?: string;
}
