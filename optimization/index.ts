/**
 * Optimization Module — Barrel Export
 *
 * Re-exports all public types and runtime values from the optimization layer.
 *
 * ─── Consumers ────────────────────────────────────────────────────────────────
 *
 *   import type { OptimizationCycle, CycleInstance } from "@/optimization";
 *   import { OPTIMIZATION_CATALOG, getCycle }        from "@/optimization";
 *   import { MONTHLY_PERFORMANCE_REVIEW }            from "@/optimization";
 *
 * ─── Module map ───────────────────────────────────────────────────────────────
 *
 *   optimization/types.ts   — all type definitions
 *   optimization/cycles.ts  — four concrete cycle definitions + catalog
 *   optimization/index.ts   ← YOU ARE HERE — barrel re-export
 */

// ── Type exports ───────────────────────────────────────────────────────────────

export type {
  // Identifier types
  OptimizationCycleId,
  OptimizationCadence,
  CycleRole,
  CycleTrigger,
  CycleInputType,
  CycleOutputType,
  CycleStatus,

  // Structural types
  CycleInputRequirement,
  CycleOutput,
  CyclePhase,
  OptimizationCycleRole,
  LinkedDashboard,

  // Core entity
  OptimizationCycle,

  // Catalog
  OptimizationCatalog,

  // Runtime tracking (forward-looking)
  CycleInstance,

  // Summary / display
  CycleSummary,
} from "./types";

// ── Runtime exports ────────────────────────────────────────────────────────────

export {
  /** The four concrete optimization cycle definitions. */
  MONTHLY_PERFORMANCE_REVIEW,
  QUARTERLY_STRATEGY_REVIEW,
  EXPERIMENT_REVIEW,
  CONTENT_REFRESH,

  /** The complete optimization catalog — all cycles in one typed structure. */
  OPTIMIZATION_CATALOG,

  /** Look up a single cycle by ID. */
  getCycle,

  /** Find all cycles that can be triggered by a given trigger type. */
  getCyclesByTrigger,

  /** Find all cycles linked to a given product module. */
  getCyclesByModule,

  /** Get all client-deliverable outputs, optionally filtered by cycle. */
  getDeliverables,

  /** Lightweight CycleSummary for each cycle — for list and calendar views. */
  summarizeCycles,
} from "./cycles";
