/**
 * Experiment Layer Types
 *
 * Defines the vocabulary for the A/B experiment system that layers on top
 * of the rules-based decision engine.
 *
 * ─── Relationship to ExperiencePlan ──────────────────────────────────────────
 *
 *   Rules engine:      VisitorContext → ExperiencePlan (heroKey, proofKey, ctaKey)
 *   Experiment layer:  ExperiencePlan + ActiveExperiment[] → ExperiencePlan
 *                      (one or more slot keys may be overridden)
 *
 * The experiment layer never replaces the rules engine — it only mutates
 * specific slots in the plan it receives as input.
 */

import type { HeroVariantKey, ProofVariantKey, CTAVariantKey } from "@/decision/types";
import type { ExperimentRow } from "@/data/types";

// ── Slot typing ───────────────────────────────────────────────────────────────

/** The page sections an experiment can target */
export type ExperimentSlot = "hero" | "proof" | "cta";

// ── Resolved assignment ───────────────────────────────────────────────────────

/**
 * The outcome of running one experiment against one session.
 * Produced by ExperimentDecisionProvider and used to:
 *  1. Override the relevant plan slot.
 *  2. Persist the assignment to `experiment_assignments` (fire-and-forget).
 *  3. Annotate the `reason` string on the returned ExperiencePlan.
 */
export interface ResolvedAssignment {
  /** The experiment that was applied */
  experimentId: string;
  /** Human-readable experiment name (for the reason string) */
  experimentName: string;
  /** Which slot was overridden */
  slot: ExperimentSlot;
  /** 0-based bucket index */
  bucket: number;
  /** The variant key selected for this bucket */
  variantKey: string;
}

// ── Typed slot overrides ──────────────────────────────────────────────────────

/**
 * Maps an ExperimentRow's `slot` field to the correct typed variant key union.
 * Used inside ExperimentDecisionProvider to override the right ExperiencePlan field
 * with full type safety.
 */
export type SlotVariantKey<S extends ExperimentSlot> =
  S extends "hero"  ? HeroVariantKey  :
  S extends "proof" ? ProofVariantKey :
  S extends "cta"   ? CTAVariantKey   :
  never;

// Re-export for convenience so consumers only need one import
export type { ExperimentRow };
