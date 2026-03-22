/**
 * ExperimentDecisionProvider
 *
 * A DecisionProvider decorator that layers controlled A/B experiments on top
 * of any other DecisionProvider implementation.
 *
 * ─── Composition pattern ──────────────────────────────────────────────────────
 *
 *   const provider = new ExperimentDecisionProvider(
 *     new RulesDecisionProvider(),   // inner provider — resolves the base plan
 *     sessionId,                     // visitor's session UUID from the cookie
 *   );
 *
 *   const plan = await provider.getHomepagePlan(context);
 *   // plan.heroKey, proofKey, ctaKey may have been overridden by an experiment
 *
 * ─── Processing order ─────────────────────────────────────────────────────────
 *
 *   1. Call inner.getHomepagePlan(context) → basePlan
 *   2. Fetch active experiments from the database (one query, small result set)
 *   3. For each active experiment in creation order:
 *        a. Check enrollment  → resolveExperimentBucket(sessionId, exp.id, …)
 *        b. If enrolled:      → override the experiment's slot in the plan
 *        c. Fire-and-forget:  → saveExperimentAssignment(…)
 *   4. Annotate reason string with all applied experiments
 *   5. Return the (potentially modified) ExperiencePlan
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   - If the database query for active experiments fails, the base plan is
 *     returned unchanged.  The visitor sees the rules-based experience.
 *   - If a specific experiment row has a malformed variants array, it is
 *     skipped with a warning.
 *   - Assignment persistence failures are logged but never surface to the visitor.
 *
 * ─── Determinism guarantee ───────────────────────────────────────────────────
 *
 *   Given the same sessionId and the same set of active experiments,
 *   getHomepagePlan() always returns the same plan.  The hash function
 *   (FNV-1a 32-bit) has no runtime state.
 *
 * ─── Conflict resolution ─────────────────────────────────────────────────────
 *
 *   If two active experiments target the same slot, the one created earlier
 *   (ORDER BY created_at ASC) wins.  The later experiment is skipped for that
 *   slot to avoid undefined/incoherent combinations.
 *   A warning is logged when this occurs.
 */

import type { ExperiencePlan, DecisionInput, HeroVariantKey, ProofVariantKey, CTAVariantKey } from "@/decision/types";
import type { DecisionProvider } from "./decision-provider";
import { getActiveExperiments, saveExperimentAssignment } from "@/data/repositories/experiments-repository";
import { resolveExperimentBucket } from "@/experiments/bucket-assignment";
import type { ResolvedAssignment, ExperimentSlot } from "@/experiments/types";
import { logger } from "@/lib/logger";

export class ExperimentDecisionProvider implements DecisionProvider {
  constructor(
    private readonly inner: DecisionProvider,
    private readonly sessionId: string,
  ) {}

  /**
   * Resolve a homepage ExperiencePlan, potentially overriding one or more
   * slots based on active A/B experiments.
   */
  async getHomepagePlan(input: DecisionInput): Promise<ExperiencePlan> {
    // ── Step 1: Get the base plan from the inner provider ──────────────────
    const basePlan = await this.inner.getHomepagePlan(input);

    // ── Step 2: Load active experiments ───────────────────────────────────
    const experimentsResult = await getActiveExperiments();

    if (!experimentsResult.ok) {
      // DB error — degrade gracefully, return the rules-based plan.
      logger.warn("[experiment] Failed to load active experiments; using base plan.", {
        sessionId: this.sessionId,
        error: experimentsResult.error,
      });
      return basePlan;
    }

    const experiments = experimentsResult.data;

    if (experiments.length === 0) {
      // Fast path: no active experiments.
      return basePlan;
    }

    // ── Step 3: Apply experiments to the plan ─────────────────────────────
    // Work on a mutable copy so we can patch slots without mutating the original.
    let plan: ExperiencePlan = { ...basePlan };
    const appliedAssignments: ResolvedAssignment[] = [];
    const overriddenSlots = new Set<ExperimentSlot>();

    for (const experiment of experiments) {
      // Validate variants array
      if (!Array.isArray(experiment.variants) || experiment.variants.length < 2) {
        logger.warn("[experiment] Experiment has invalid variants array; skipping.", {
          experimentId: experiment.id,
          variants: experiment.variants,
        });
        continue;
      }

      const slot = experiment.slot as ExperimentSlot;

      // Conflict check: a earlier experiment already owns this slot
      if (overriddenSlots.has(slot)) {
        logger.warn("[experiment] Slot conflict — two active experiments target the same slot; later one skipped.", {
          slot,
          skippedExperimentId: experiment.id,
        });
        continue;
      }

      // Resolve bucket (handles enrollment check internally)
      const bucket = resolveExperimentBucket(
        this.sessionId,
        experiment.id,
        experiment.variants.length,
        experiment.traffic_fraction,
      );

      if (bucket === null) {
        // Session is not in this experiment's traffic fraction
        logger.debug("[experiment] Session not enrolled.", {
          sessionId: this.sessionId,
          experimentId: experiment.id,
          trafficFraction: experiment.traffic_fraction,
        });
        continue;
      }

      const variantKey = experiment.variants[bucket] as string;

      // Apply the override to the plan
      plan = applySlotOverride(plan, slot, variantKey);
      overriddenSlots.add(slot);

      const assignment: ResolvedAssignment = {
        experimentId: experiment.id,
        experimentName: experiment.name,
        slot,
        bucket,
        variantKey,
      };
      appliedAssignments.push(assignment);

      logger.debug("[experiment] Bucket assigned.", {
        sessionId: this.sessionId,
        experimentId: experiment.id,
        slot,
        bucket,
        variantKey,
      });

      // ── Fire-and-forget: persist the assignment ───────────────────────
      void saveExperimentAssignment({
        session_id: this.sessionId,
        experiment_id: experiment.id,
        bucket,
        variant_key: variantKey,
      }).then((result) => {
        if (!result.ok) {
          logger.warn("[experiment] Failed to persist assignment (non-blocking).", {
            sessionId: this.sessionId,
            experimentId: experiment.id,
            error: result.error,
          });
        }
      });
    }

    // ── Step 4: Annotate the reason string ────────────────────────────────
    if (appliedAssignments.length > 0) {
      const experimentSummaries = appliedAssignments
        .map((a) => `exp:"${a.experimentId}" slot:${a.slot} bucket:${a.bucket} key:${a.variantKey}`)
        .join("; ");

      plan = {
        ...plan,
        reason: `${plan.reason} | Experiments applied: [${experimentSummaries}]`,
      };
    }

    return plan;
  }
}

// ── Slot override helper ──────────────────────────────────────────────────────

/**
 * Returns a new ExperiencePlan with the given slot replaced by variantKey.
 *
 * Type assertions are intentional — experiment variant keys come from the
 * database and must be valid keys for the slot they target (enforced by
 * the experiment configuration, not the type system).
 */
function applySlotOverride(
  plan: ExperiencePlan,
  slot: ExperimentSlot,
  variantKey: string,
): ExperiencePlan {
  switch (slot) {
    case "hero":
      return { ...plan, heroKey: variantKey as HeroVariantKey };
    case "proof":
      return { ...plan, proofKey: variantKey as ProofVariantKey };
    case "cta":
      return { ...plan, ctaKey: variantKey as CTAVariantKey };
  }
}
