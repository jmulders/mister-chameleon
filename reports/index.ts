/**
 * Reports Module — Barrel Export
 *
 * Re-exports all public types and runtime values from the reporting layer.
 *
 * ─── Consumers ────────────────────────────────────────────────────────────────
 *
 *   import type { Report, ReportPeriod, RecommendationRow } from "@/reports";
 *   import { assembleReport, DEFAULT_REPORT_TEMPLATE } from "@/reports";
 *
 * ─── Module map ───────────────────────────────────────────────────────────────
 *
 *   reports/types.ts                     — all report model type definitions
 *   reports/templates/default-report.ts  — default template + assembler function
 *   reports/index.ts                     ← YOU ARE HERE — barrel re-export
 */

// ── Type exports ───────────────────────────────────────────────────────────────

export type {
  // Period
  ReportCadence,
  ReportPeriod,

  // Section identifiers
  ReportSectionId,

  // Section data shapes
  ReportSummarySection,
  ContextSegmentRow,
  ContextSegmentsSection,
  VariantPerformanceRow,
  VariantPerformanceSection,
  ConversionMetricRow,
  ConversionMetricsSection,
  DecisionEngineType,
  RuleFiredRow,
  AiRulesInsightsSection,
  RecommendationPriority,
  RecommendationCategory,
  RecommendationRow,
  RecommendationsSection,

  // Top-level report model
  ReportSectionData,
  ReportSectionConfig,
  ReportTemplate,
  ReportConfig,
  Report,
} from "./types";

// ── Runtime exports ────────────────────────────────────────────────────────────

export {
  /** The standard client report template definition. */
  DEFAULT_REPORT_TEMPLATE,

  /** Assembles a complete Report from live analytics data (synchronous). */
  assembleReport,

  /** Section builders — exported individually for custom template composition. */
  buildSummary,
  buildContextSegments,
  buildVariantPerformance,
  buildConversionMetrics,
  buildEngineInsights,
  buildRecommendations,

  /** Source key → display label utility. */
  labelSource,
} from "./templates/default-report";

export type {
  /** Input shape for the assembleReport() function. */
  AssembleReportInput,
} from "./templates/default-report";
