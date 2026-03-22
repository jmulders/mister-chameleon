/**
 * Analytics Module — Barrel Export
 *
 * Re-exports all public types and runtime values from the analytics layer.
 *
 * ─── Consumers ────────────────────────────────────────────────────────────────
 *
 *   import type { KpiDefinition, KpiValue } from "@/analytics";
 *   import { KPI_CATALOG, getKpiSet, getKpiHealthStatus } from "@/analytics";
 *
 * ─── Module map ───────────────────────────────────────────────────────────────
 *
 *   analytics/kpi-types.ts   — all KPI type definitions (static)
 *   analytics/kpi-sets.ts    — concrete KPI set definitions + lookup helpers
 *   analytics/index.ts       ← YOU ARE HERE — barrel re-export
 */

// ── Type exports ───────────────────────────────────────────────────────────────

export type {
  // Identifier types
  KpiId,
  KpiSetId,

  // Enumeration types
  KpiFormat,
  KpiCategory,
  ReportingCadence,
  KpiImplementationTier,
  KpiDataSource,

  // Structural types
  KpiThresholds,
  KpiFormula,
  KpiDefinition,
  KpiSet,
  KpiCatalog,

  // Lookup index types
  KpiSetIndex,
  KpiIndex,

  // Runtime value types
  KpiValue,
  KpiSetReport,
} from "./kpi-types";

// ── Runtime value exports ──────────────────────────────────────────────────────

export {
  /** The full KPI catalog — all four use-case KPI sets. */
  KPI_CATALOG,

  /** Returns a KpiSet by its stable ID. */
  getKpiSet,

  /** Returns a single KpiDefinition by its ID, searching across all sets. */
  getKpi,

  /** Returns all KPI definitions with the given implementation tier. */
  getKpisByTier,

  /** Returns all KPI definitions for a given category. */
  getKpisByCategory,

  /** Returns the primary KpiDefinition for a KPI set. */
  getPrimaryKpi,

  /**
   * Applies performance thresholds to a raw KPI value and returns the health
   * status ("good" | "warning" | "critical"). Returns undefined if the KPI
   * has no thresholds defined.
   */
  getKpiHealthStatus,
} from "./kpi-sets";
