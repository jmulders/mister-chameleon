/**
 * Default Report Template
 *
 * The standard monthly / quarterly performance report for Mister Chameleon
 * clients. Assembles a complete Report from live analytics data using a
 * deterministic, data-driven approach.
 *
 * ─── Template structure ───────────────────────────────────────────────────────
 *
 *   1. Executive Summary        — headline + wins + watch-list
 *   2. Traffic & Context        — source breakdown + per-source variant alignment
 *   3. Variant Performance      — per-slot CTR rankings, top performers flagged
 *   4. Conversion Metrics       — KPI-aligned outcomes tied to analytics/kpi-sets.ts
 *   5. Decision Engine Insights — rules fired, AI coverage (when active)
 *   6. Recommendations          — data-driven, prioritised, with ownership
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { assembleReport } from "@/reports/templates/default-report";
 *
 *   const metrics     = await fetchDashboardMetrics();
 *   const variantPerf = await fetchVariantPerformance();
 *
 *   const report = assembleReport({
 *     tenant:     { tenantId: "acme-corp", name: "Acme Corp" },
 *     period:     { cadence: "monthly", startDate: "2025-03-01",
 *                   endDate: "2025-03-31", label: "March 2025" },
 *     metrics,
 *     variantPerf,
 *   });
 *
 * ─── Extension pattern ────────────────────────────────────────────────────────
 *
 *   Each section builder is a pure function — no side effects, no async.
 *   To create a custom template, import the builders you want to reuse and
 *   override the others:
 *
 *     import { buildContextSegments } from "./default-report";
 *
 * ─── Assembler design ─────────────────────────────────────────────────────────
 *
 *   The assembler is synchronous. All async data fetching belongs in the caller
 *   (server component, API route, or scheduled job). This keeps the assembly
 *   logic pure, testable, and composable.
 *
 *   Section builders receive only the data they need. They do not call the DB,
 *   do not import next.js APIs, and produce no side effects.
 */

import type {
  DashboardMetrics,
  RankedRow,
  VariantPerformanceData,
  VariantStats,
} from "@/data/repositories/analytics-repository";
import { VARIANT_FETCH_LIMIT } from "@/data/repositories/analytics-repository";

import type { KpiValue } from "@/analytics/kpi-types";

import type {
  Report,
  ReportConfig,
  ReportPeriod,
  ReportTemplate,
  ReportSectionData,
  ReportSectionId,
  ReportSummarySection,
  ContextSegmentsSection,
  ContextSegmentRow,
  VariantPerformanceSection,
  VariantPerformanceRow,
  ConversionMetricsSection,
  ConversionMetricRow,
  AiRulesInsightsSection,
  RuleFiredRow,
  RecommendationsSection,
  RecommendationRow,
  RecommendationPriority,
  RecommendationCategory,
  DecisionEngineType,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The default report template — all six sections in narrative order.
 *
 * Sections 1–4 and 6 are required (present in every standard report).
 * Section 5 (engine insights) is optional — suppress it for clients who
 * aren't ready to discuss decision engine behaviour.
 */
export const DEFAULT_REPORT_TEMPLATE: ReportTemplate = {
  id:          "default-monthly",
  name:        "Standard Client Report",
  description:
    "The default monthly or quarterly performance report for Mister Chameleon clients. " +
    "Covers all six reporting themes in a natural narrative order: executive overview, " +
    "traffic context, content performance, conversion outcomes, engine behaviour, and " +
    "prioritised recommendations for the next period.",
  defaultCadence: "monthly",
  sections: [
    {
      id:          "summary",
      title:       "Executive Summary",
      description: "High-level overview: headline metric, key wins, and areas to watch.",
      required:    true,
    },
    {
      id:          "context-segments",
      title:       "Traffic & Context Segments",
      description: "Top traffic sources and how the adaptive engine served each audience.",
      required:    true,
    },
    {
      id:          "variant-performance",
      title:       "Variant Performance",
      description: "Which content variants were served most and which drove the highest engagement.",
      required:    true,
    },
    {
      id:          "conversion-metrics",
      title:       "Conversion & Engagement Metrics",
      description: "KPI-aligned outcomes: CTA click rate, personalisation coverage, and submission rate.",
      required:    true,
    },
    {
      id:          "ai-rules-insights",
      title:       "Decision Engine Insights",
      description: "How the rules engine (and AI provider, if active) behaved during the period.",
      required:    false,
    },
    {
      id:          "recommendations",
      title:       "Recommendations & Next Actions",
      description: "Prioritised actions for the coming period, with rationale and clear ownership.",
      required:    true,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLER INPUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All data required to assemble a complete report.
 *
 * The caller is responsible for fetching this data asynchronously before
 * invoking assembleReport(). The assembler is synchronous.
 */
export interface AssembleReportInput {
  /** Tenant metadata — identifies who this report is for. */
  tenant: {
    tenantId: string;
    name:     string;
  };

  /** The time window this report covers. */
  period: ReportPeriod;

  /**
   * Dashboard metrics from fetchDashboardMetrics().
   * Provides page views, CTA clicks, variant totals, and ranked source/variant lists.
   */
  metrics: DashboardMetrics;

  /**
   * Variant performance data from fetchVariantPerformance().
   * Provides per-variant serve counts, CTR, and source breakdowns.
   */
  variantPerf: VariantPerformanceData;

  /**
   * Optional KPI values from the analytics module.
   * When provided, enriches the conversion metrics section with health status
   * and period-over-period trend data computed by the repository layer.
   */
  kpiValues?: KpiValue[];

  /**
   * Which decision provider was active for this tenant during the period.
   * Defaults to "rules" — the MVP default.
   * Set to "ai" to surface AI coverage and fallback metrics (requires
   * ai_decision_logs data to be populated).
   */
  decisionProvider?: "rules" | "ai";

  /**
   * Whether to include the Decision Engine Insights section (section 5).
   * Default: true. Set false for clients who prefer a simpler six-section report.
   */
  includeEngineInsights?: boolean;

  /**
   * Name of the person generating this report — shown in the report metadata.
   * Examples: "Jane Smith", "automated"
   */
  preparedBy?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Maps raw session.source values to human-readable display labels. */
const SOURCE_LABEL_MAP: Record<string, string> = {
  linkedin: "LinkedIn",
  google:   "Google",
  direct:   "Direct",
  organic:  "Organic",
  referral: "Referral",
  email:    "Email",
  twitter:  "Twitter / X",
  unknown:  "Unknown",
};

/** Converts a raw source key to a display label. */
function labelSource(key: string): string {
  return SOURCE_LABEL_MAP[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Rounds a float to one decimal place. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Formats a percentage value for display: 0–100, one decimal. */
function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? round1((numerator / denominator) * 100) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION BUILDERS  (pure functions — synchronous, no side effects)
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Executive Summary ──────────────────────────────────────────────────────

/**
 * Derives the executive summary section from dashboard and variant metrics.
 *
 * Generates a specific, data-backed headline, 2–4 wins, and 1–3 focus areas.
 * All generated text is meant as a starting point — account managers should
 * review and add the qualitative context that numbers alone can't capture.
 */
export function buildSummary(
  metrics:    DashboardMetrics,
  variantPerf: VariantPerformanceData,
  period:     ReportPeriod,
): ReportSummarySection {
  const { pageViews, ctaClicks, servedVariantsTotal, topSources } = metrics;

  const overallCtaClickRate: number | null =
    pageViews > 0 ? round1((ctaClicks / pageViews) * 100) : null;

  const personalisationCoverage = pct(servedVariantsTotal, pageViews);

  const topHero = variantPerf.heroVariants[0];
  const topCta  = variantPerf.ctaVariants[0];
  const topSrc  = topSources[0];

  // ── Headline ──────────────────────────────────────────────────────────────
  let headline =
    `${period.label}: ${pageViews.toLocaleString()} sessions with ` +
    `${servedVariantsTotal.toLocaleString()} adaptive decisions served.`;

  if (overallCtaClickRate !== null && overallCtaClickRate > 0) {
    headline += ` Overall CTA click rate: ${overallCtaClickRate}%.`;
  }

  // ── Key wins ─────────────────────────────────────────────────────────────
  const keyWins: string[] = [];

  if (personalisationCoverage >= 95) {
    keyWins.push(
      `Personalisation pipeline at ${personalisationCoverage}% coverage — the decision engine ` +
      `is reaching effectively every session.`,
    );
  } else if (personalisationCoverage >= 75) {
    keyWins.push(
      `${personalisationCoverage}% of sessions received a personalised experience — ` +
      `solid coverage for this stage of deployment.`,
    );
  }

  if (topSrc) {
    keyWins.push(
      `${labelSource(topSrc.value)} is the dominant traffic source with ` +
      `${topSrc.count.toLocaleString()} sessions ` +
      `(${pct(topSrc.count, pageViews)}% of total traffic).`,
    );
  }

  if (topHero && topHero.serves > 0) {
    keyWins.push(
      `Top hero variant: ${topHero.key} — served ${topHero.serves.toLocaleString()} times ` +
      `with a ${topHero.ctr}% CTA click rate.`,
    );
  }

  if (topCta && topCta.serves > 0 && topCta.ctr > 0) {
    keyWins.push(
      `Best CTA variant: ${topCta.key} — ${topCta.ctr}% click rate ` +
      `from ${topCta.serves.toLocaleString()} serves.`,
    );
  }

  if (keyWins.length === 0) {
    keyWins.push("Platform is active and collecting session data for this period.");
  }

  // ── Focus areas ───────────────────────────────────────────────────────────
  const focusAreas: string[] = [];

  if (overallCtaClickRate !== null && overallCtaClickRate < 5 && pageViews > 30) {
    focusAreas.push(
      `CTA click rate (${overallCtaClickRate}%) is below the 5% B2B SaaS benchmark — ` +
      `review CTA copy and placement as a priority.`,
    );
  }

  if (personalisationCoverage < 80 && pageViews > 20) {
    focusAreas.push(
      `Personalisation coverage at ${personalisationCoverage}% — investigate sessions ` +
      `where the decision engine did not reach a conclusion.`,
    );
  }

  if (variantPerf.heroVariants.length <= 1 && pageViews > 50) {
    focusAreas.push(
      `Only one hero variant is active — a second variant would enable comparison ` +
      `and expand personalisation reach to different audience segments.`,
    );
  }

  if (focusAreas.length === 0 && pageViews < 100) {
    focusAreas.push(
      `Session volume is still low (${pageViews.toLocaleString()}) — ` +
      `continue building traffic before treating variant performance differences as signals.`,
    );
  }

  return {
    headline,
    sessionCount:       pageViews,
    variantsServed:     servedVariantsTotal,
    overallCtaClickRate,
    keyWins:            keyWins.slice(0, 4),
    focusAreas:         focusAreas.slice(0, 3),
  };
}

// ── 2. Context Segments ───────────────────────────────────────────────────────

/** Pre-written insights for common traffic sources.  */
const SOURCE_INSIGHT_MAP: Record<string, string> = {
  linkedin:
    "LinkedIn traffic typically brings brand-aware prospects — validate that the hero " +
    "copy addresses their specific professional pain point.",
  google:
    "Google traffic tends to be intent-driven. Confirm the hero variant addresses the " +
    "search query intent (problem or solution framing based on keyword category).",
  direct:
    "Direct traffic likely includes returning visitors and referrals — the returning-visitor " +
    "rules should be escalating this segment to meeting-intent CTAs.",
  email:
    "Email traffic indicates the subscriber list is engaged. Monitor this segment for " +
    "higher-than-average CTA click rates and form submissions.",
  organic:
    "Organic social traffic is typically early-funnel. Awareness-stage hero variants " +
    "are appropriate here; avoid over-indexing on conversion CTAs.",
};

/**
 * Builds the context segments section from dashboard metrics.
 *
 * Matches each top source against variant data to show which hero and CTA
 * variants the engine selected for that source's sessions.
 */
export function buildContextSegments(
  metrics:    DashboardMetrics,
  variantPerf: VariantPerformanceData,
): ContextSegmentsSection {
  const { topSources, topHeroVariants, topCtaVariants, pageViews } = metrics;

  const rows: ContextSegmentRow[] = topSources.map((source: RankedRow) => {
    // Best-effort match: find the hero/CTA variant most associated with this source.
    // The available data is not segmented by source, so we approximate using the
    // per-variant topSources breakdowns from VariantStats.
    const heroForSource = variantPerf.heroVariants.find((v) =>
      v.topSources.some((s) => s.source === source.value),
    );
    const ctaForSource = variantPerf.ctaVariants.find((v) =>
      v.topSources.some((s) => s.source === source.value),
    );

    const sessionShare = round1(pct(source.count, pageViews));

    return {
      sourceLabel:    labelSource(source.value),
      sourceKey:      source.value,
      sessionCount:   source.count,
      sessionShare,
      topHeroVariant: heroForSource?.key ?? topHeroVariants[0]?.value ?? "—",
      topCtaVariant:  ctaForSource?.key  ?? topCtaVariants[0]?.value  ?? "—",
      insight:        SOURCE_INSIGHT_MAP[source.value],
    };
  });

  // Dominant source warning when one source > 40% of all sessions.
  const topRow = rows[0];
  const dominantSourceNote =
    topRow && topRow.sessionShare >= 40
      ? `${topRow.sourceLabel} accounts for ${topRow.sessionShare}% of sessions — ` +
        `the platform's personalisation is heavily weighted toward this single audience. ` +
        `Consider diversifying acquisition channels to broaden the data foundation.`
      : undefined;

  return {
    rows,
    totalSessions: pageViews,
    dominantSourceNote,
  };
}

// ── 3. Variant Performance ────────────────────────────────────────────────────

/**
 * Converts a VariantStats array into VariantPerformanceRow array for reporting.
 * Marks the highest-CTR variant as the top performer.
 */
function statsToRows(
  stats:       VariantStats[],
  variantType: VariantPerformanceRow["variantType"],
): VariantPerformanceRow[] {
  if (stats.length === 0) return [];

  const totalServes = stats.reduce((sum, v) => sum + v.serves, 0);
  const topCtr      = Math.max(...stats.map((v) => v.ctr));

  return stats.map((v) => ({
    variantKey:    v.key,
    variantType,
    serves:        v.serves,
    serveSharePct: round1(pct(v.serves, totalServes)),
    ctaClickRate:  v.ctr,
    topSource:     v.topSources[0]?.source ?? "unknown",
    isTopPerformer: v.ctr === topCtr && topCtr > 0,
  }));
}

/**
 * Builds the variant performance section from the raw variant performance data.
 */
export function buildVariantPerformance(
  variantPerf: VariantPerformanceData,
): VariantPerformanceSection {
  const heroRows  = statsToRows(variantPerf.heroVariants,  "hero");
  const proofRows = statsToRows(variantPerf.proofVariants, "proof");
  const ctaRows   = statsToRows(variantPerf.ctaVariants,   "cta");

  // Concentration note: top-2 hero variants accounting for ≥90% of serves.
  let concentrationNote: string | undefined;
  if (heroRows.length >= 2) {
    const top2Share = heroRows[0].serveSharePct + heroRows[1].serveSharePct;
    if (top2Share >= 90) {
      concentrationNote =
        `${top2Share.toFixed(0)}% of hero serves are concentrated in two variants (` +
        `${heroRows[0].variantKey} and ${heroRows[1].variantKey}). ` +
        `Adding a third variant would improve coverage for under-served audiences.`;
    }
  }

  return {
    heroRows,
    proofRows,
    ctaRows,
    concentrationNote,
    dataTruncated: variantPerf.rowsFetched >= VARIANT_FETCH_LIMIT,
  };
}

// ── 4. Conversion Metrics ─────────────────────────────────────────────────────

/**
 * Builds the conversion metrics section.
 *
 * Computes available metrics from dashboard data and merges in any KpiValues
 * passed from the analytics module (for health status and trend data).
 *
 * The four core metrics are:
 *   1. CTA Click Rate               — available (pageViews + ctaClicks)
 *   2. Personalisation Coverage     — available (pageViews + servedVariantsTotal)
 *   3. Contact Form Submission Rate — requires contact_form_submit event query
 *   4. Returning Visitor Escalation — requires session visit_type segmentation
 */
export function buildConversionMetrics(
  metrics:   DashboardMetrics,
  kpiValues?: KpiValue[],
): ConversionMetricsSection {
  const { pageViews, ctaClicks, servedVariantsTotal } = metrics;

  // Build a lookup map from KpiValues for O(1) enrichment.
  const kpiIndex = new Map<string, KpiValue>(
    (kpiValues ?? []).map((v) => [v.kpiId, v]),
  );

  /** Creates a metric row, merging in live KpiValue data when available. */
  function row(
    kpiId:     string,
    label:     string,
    computed:  number | null,
    format:    ConversionMetricRow["format"],
    note?:     string,
  ): ConversionMetricRow {
    const live = kpiIndex.get(kpiId);
    return {
      kpiId,
      label,
      value:               live?.value        ?? computed,
      format,
      healthStatus:        live?.healthStatus,
      previousPeriodValue: live?.previousValue,
      trendPct:            live?.trend,
      note,
    };
  }

  const ctaClickRate           = pct(ctaClicks, pageViews);
  const personalisationCoverage = pct(servedVariantsTotal, pageViews);

  const metrics_: ConversionMetricRow[] = [
    row(
      "adaptive-cta-click-rate",
      "CTA Click Rate",
      ctaClickRate,
      "percentage",
      "Sessions with ≥1 CTA click event / total sessions. Session-level attribution.",
    ),
    row(
      "adaptive-personalisation-coverage",
      "Personalisation Coverage",
      personalisationCoverage,
      "percentage",
      "Sessions that reached the adaptive decision engine / total sessions.",
    ),
    row(
      "followup-submission-rate",
      "Contact Form Submission Rate",
      null,
      "percentage",
      "Requires contact_form_submit events. See followup-submission-rate in kpi-sets.ts.",
    ),
    row(
      "known-user-returning-cta-escalation-rate",
      "Returning Visitor Escalation Rate",
      null,
      "percentage",
      "Returning visitors served the meeting-intent CTA. Requires visit_type segmentation query.",
    ),
    row(
      "adaptive-return-visit-rate",
      "Return Visit Rate",
      null,
      "percentage",
      "Sessions where visit_type = 'returning' / total sessions. Requires sessions query by visit_type.",
    ),
  ];

  const availableCount = metrics_.filter((m) => m.value !== null).length;
  const coverageNote =
    `${availableCount} of ${metrics_.length} metrics computable from available data. ` +
    `Connect KPI repository functions for full coverage (see analytics/kpi-sets.ts).`;

  return {
    metrics: metrics_,
    coverageNote,
  };
}

// ── 5. Decision Engine Insights ───────────────────────────────────────────────

/**
 * Builds the engine insights section.
 *
 * Rule fire counts are inferred from variant data (heroVariants serve counts)
 * rather than served_variants.reason text, because the latter requires a
 * direct DB query not available through the current analytics-repository API.
 *
 * This section improves significantly once:
 *   (a) rule_id is added to the served_variants table
 *   (b) a fetchRuleFireBreakdown() function is added to analytics-repository
 */
export function buildEngineInsights(
  metrics:          DashboardMetrics,
  variantPerf:      VariantPerformanceData,
  decisionProvider: "rules" | "ai" = "rules",
): AiRulesInsightsSection {
  const totalDecisions = metrics.servedVariantsTotal;
  const activeEngine: DecisionEngineType = decisionProvider;

  // Derive approximate rule fire distribution from hero variant serve counts.
  // Each hero variant is assumed to be associated with one primary rule.
  // This is intentionally approximate — label as "inferred" to be transparent.
  const ruleFiredRows: RuleFiredRow[] = variantPerf.heroVariants
    .filter((v) => v.serves > 0)
    .slice(0, 5)
    .map((v) => ({
      ruleId:       `inferred.${v.key}`,
      ruleLabel:    `Decision → ${v.key}`,
      firedCount:   v.serves,
      shareOfDecisions: round1(pct(v.serves, totalDecisions)),
      associatedCtaClickRate: v.ctr > 0 ? v.ctr : undefined,
    }));

  // Engine narrative
  const variantCount  = variantPerf.heroVariants.length;
  const engineNarrative =
    activeEngine === "rules"
      ? `The rules-based decision engine served ${totalDecisions.toLocaleString()} decisions ` +
        `across ${variantCount} hero variant${variantCount !== 1 ? "s" : ""} this period. ` +
        `All decisions were fully deterministic and auditable — each session was matched ` +
        `to a content plan by evaluating the ordered rule set against the visitor context ` +
        `(source, device, visit type, and history). No AI provider was active.\n\n` +
        `Rule fire breakdown is approximated from served variant counts. For precise ` +
        `rule-level attribution, add a rule_id column to served_variants and implement ` +
        `fetchRuleFireBreakdown() in analytics-repository.ts.`
      : `The AI decision provider was active for this period alongside the fallback rules engine. ` +
        `AI coverage rate and confidence-policy fallback metrics require the ai_decision_logs ` +
        `table to be populated. Once AiDecisionProvider is wired and decision logging is enabled, ` +
        `this section will surface model agreement rates, confidence distributions, and the ` +
        `percentage of decisions where the rules fallback was triggered.`;

  return {
    activeEngine,
    totalDecisions,
    ruleFiredRows,
    aiCoverageRate: activeEngine === "ai" ? null : undefined,
    aiFallbackRate: activeEngine === "ai" ? null : undefined,
    engineNarrative,
  };
}

// ── 6. Recommendations ────────────────────────────────────────────────────────

/**
 * Generates data-driven recommendations based on the metrics and variant data.
 *
 * Recommendations are generated by evaluating a set of threshold conditions
 * against the assembled data. Each condition that fires produces a specific,
 * actionable recommendation with rationale, a suggested action, and an owner.
 *
 * The generated list is a starting point — account managers should review,
 * reorder, and add context based on their knowledge of the client's situation.
 */
export function buildRecommendations(
  metrics:    DashboardMetrics,
  variantPerf: VariantPerformanceData,
  period:     ReportPeriod,
): RecommendationsSection {
  const { pageViews, ctaClicks, servedVariantsTotal, topSources } = metrics;
  const ctaClickRate          = pct(ctaClicks, pageViews);
  const personalisationCoverage = pct(servedVariantsTotal, pageViews);

  const items: RecommendationRow[] = [];
  let seq = 0;

  function add(
    priority:       RecommendationPriority,
    category:       RecommendationCategory,
    title:          string,
    rationale:      string,
    suggestedAction: string,
    owner:          RecommendationRow["owner"],
    extras?:        Partial<RecommendationRow>,
  ): void {
    seq++;
    items.push({
      id:       `rec-${period.cadence}-${String(seq).padStart(3, "0")}`,
      priority,
      category,
      title,
      rationale,
      suggestedAction,
      owner,
      ...extras,
    });
  }

  // ── Threshold conditions → recommendations ────────────────────────────────

  // (1) Low CTA click rate
  if (ctaClickRate < 5 && pageViews > 50) {
    add(
      "high",
      "content",
      "Review CTA copy and value proposition",
      `Overall CTA click rate is ${ctaClickRate.toFixed(1)}%, below the 5% benchmark for ` +
      `B2B SaaS adaptive pages. This is the primary lever to pull before optimising other metrics.`,
      "Audit the copy of the lowest-CTR CTA variant. Test a more specific value proposition " +
      "(e.g. 'Book a 20-min intro call' rather than a generic 'Get started'). " +
      "Update the CMS entry and monitor click rate over the next two-week window.",
      "client",
      { relatedKpiId: "adaptive-cta-click-rate" },
    );
  }

  // (2) Incomplete personalisation coverage
  if (personalisationCoverage < 80 && pageViews > 20) {
    add(
      "high",
      "configuration",
      "Investigate incomplete personalisation coverage",
      `Only ${personalisationCoverage.toFixed(0)}% of sessions received an adaptive experience. ` +
      `${(pageViews - servedVariantsTotal).toLocaleString()} sessions reached the page without a decision.`,
      "Check that the server component is calling composeExperience() on every page render. " +
      "Review the Next.js error log for any thrown exceptions during the decision pipeline. " +
      "Verify the tenant's decisionProvider config matches the active implementation.",
      "mister-chameleon",
      { relatedKpiId: "adaptive-personalisation-coverage" },
    );
  }

  // (3) Only one hero variant active
  if (variantPerf.heroVariants.length === 1 && pageViews > 50) {
    add(
      "medium",
      "content",
      "Add a second hero variant to enable audience testing",
      "Only one hero variant is currently active. Without a comparison, the platform " +
      "is personalising by routing but not by content differentiation — the full value " +
      "of the adaptive engine is not being utilised.",
      "Identify the second-largest traffic source (likely Google or Direct). " +
      "Create a hero variant tailored to that audience in the CMS. " +
      "Register the key in the tenant's variant config and add a matching rule.",
      "shared",
    );
  }

  // (4) Heavy source concentration
  const topSrc = topSources[0];
  if (topSrc && pageViews > 0) {
    const topSrcShare = pct(topSrc.count, pageViews);
    if (topSrcShare >= 60) {
      add(
        "medium",
        "strategy",
        `Diversify beyond ${labelSource(topSrc.value)} to widen the data foundation`,
        `${labelSource(topSrc.value)} accounts for ${topSrcShare.toFixed(0)}% of sessions. ` +
        `This concentration means variant performance data is heavily skewed toward one audience, ` +
        `making it difficult to draw conclusions about what works for other segments.`,
        "Review the client's channel mix with their marketing team. Identify one additional " +
        "acquisition channel (content SEO, paid search, or email nurture) to activate. " +
        "Target 3+ sources each contributing 20%+ before running variant comparisons.",
        "shared",
      );
    }
  }

  // (5) Variant concentration (hero)
  if (variantPerf.heroVariants.length >= 2) {
    const heroRows = statsToRows(variantPerf.heroVariants, "hero");
    if (heroRows.length >= 2) {
      const top2Share = heroRows[0].serveSharePct + heroRows[1].serveSharePct;
      if (top2Share >= 90) {
        add(
          "low",
          "rules",
          "Add decision rules for under-served hero variants",
          `Two hero variants account for ${top2Share.toFixed(0)}% of serves. ` +
          `If additional variants exist in the CMS, they are not being triggered — ` +
          `a gap in the decision rules is likely.`,
          "Review the active rule set in the Rules Editor (/dashboard/rules). " +
          "Check whether any hero variant keys in the CMS are not referenced by any rule. " +
          "Add routing rules for under-served variants or remove their CMS entries if they " +
          "are no longer needed.",
          "mister-chameleon",
        );
      }
    }
  }

  // (6) Low data volume — avoid over-indexing on early signals
  if (pageViews < 100) {
    add(
      "low",
      "strategy",
      "Build session volume before drawing variant conclusions",
      `Session count (${pageViews.toLocaleString()}) is below the minimum for statistically ` +
      `meaningful variant comparisons. CTR differences at this volume are likely noise.`,
      "Focus on qualified traffic acquisition before variant optimisation. " +
      "Set a milestone of 200+ sessions per active variant before comparing CTRs across rules. " +
      "Share this context with the client to manage expectations in this period's review.",
      "client",
    );
  }

  // (7) Default: tracking hygiene for new deployments
  if (pageViews < 500) {
    add(
      "low",
      "tracking",
      "Verify all first-party tracking events are firing correctly",
      "Early-stage deployments often have event coverage gaps that only surface at scale. " +
      "Confirming event coverage now prevents data quality issues in future reports.",
      "Use the Session Inspector (/dashboard/sessions) to verify that recent sessions show " +
      "all five event types: page_view, variant_served, cta_click, scroll_depth, and " +
      "contact_form_submit. Flag any gaps in the next technical check-in.",
      "mister-chameleon",
    );
  }

  // Always ensure at least one recommendation
  if (items.length === 0) {
    add(
      "low",
      "tracking",
      "Connect remaining KPI data sources for complete reporting",
      "Core platform metrics are healthy. Completing the KPI wiring would give this " +
      "report full coverage of conversion, submission, and pipeline metrics.",
      "Implement the missing repository functions listed in analytics/kpi-sets.ts: " +
      "fetchContactSubmissionRate(), fetchN8nDispatchRate(), fetchReturningEscalationRate(). " +
      "Follow the SQL formulas in each KpiDefinition.formula field.",
      "mister-chameleon",
      { relatedKpiId: "followup-submission-rate" },
    );
  }

  // Sort: high → medium → low, preserving order within each priority group.
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Next review: 30 days after period end.
  const reviewDate = new Date(period.endDate);
  reviewDate.setDate(reviewDate.getDate() + 30);

  return {
    items,
    nextReviewDate: reviewDate.toISOString().split("T")[0],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ASSEMBLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assembles a complete Report from live analytics data.
 *
 * This is a pure synchronous function. All async data fetching (fetchDashboardMetrics,
 * fetchVariantPerformance, and optionally the KPI repository functions) must be
 * completed by the caller before invoking assembleReport.
 *
 * @example
 *   const metrics     = await fetchDashboardMetrics();
 *   const variantPerf = await fetchVariantPerformance();
 *
 *   const report = assembleReport({
 *     tenant:     { tenantId: "acme-corp", name: "Acme Corp" },
 *     period:     { cadence: "monthly", startDate: "2025-03-01",
 *                   endDate: "2025-03-31", label: "March 2025" },
 *     metrics,
 *     variantPerf,
 *   });
 */
export function assembleReport(input: AssembleReportInput): Report {
  const {
    tenant,
    period,
    metrics,
    variantPerf,
    kpiValues,
    decisionProvider  = "rules",
    includeEngineInsights = true,
    preparedBy,
  } = input;

  const now      = new Date().toISOString();
  const template = DEFAULT_REPORT_TEMPLATE;

  // Determine which sections to include
  const includeSections: ReportSectionId[] = template.sections
    .filter((s) => s.required || (s.id === "ai-rules-insights" && includeEngineInsights))
    .map((s) => s.id);

  const config: ReportConfig = {
    tenantId:        tenant.tenantId,
    tenantName:      tenant.name,
    period,
    templateId:      template.id,
    includeSections,
    preparedBy,
    preparedAt:      now,
  };

  // Assemble each section
  const sections: ReportSectionData = {
    summary:           buildSummary(metrics, variantPerf, period),
    contextSegments:   buildContextSegments(metrics, variantPerf),
    variantPerformance: buildVariantPerformance(variantPerf),
    conversionMetrics: buildConversionMetrics(metrics, kpiValues),
    recommendations:   buildRecommendations(metrics, variantPerf, period),
  };

  if (includeEngineInsights) {
    sections.aiRulesInsights = buildEngineInsights(metrics, variantPerf, decisionProvider);
  }

  // Build stable report ID from tenant + period label
  const periodSlug = period.label
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  return {
    id:          `${tenant.tenantId}-${periodSlug}-${period.cadence}`,
    config,
    sections,
    generatedAt: now,
    dataWindowNote:
      `Data covers ${period.label} (UTC). ` +
      `Sessions in period: ${metrics.pageViews.toLocaleString()}.`,
  };
}

// Re-export helper so callers can format source labels consistently
export { labelSource };
