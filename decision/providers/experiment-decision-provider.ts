/**
 * ExperimentDecisionProvider
 *
 * A DecisionProvider decorator that layers plan-based A/B experiments on top
 * of any other DecisionProvider implementation.
 *
 * ─── Composition pattern ──────────────────────────────────────────────────────
 *
 *   const provider = new ExperimentDecisionProvider(
 *     new RulesDecisionProvider(config), // inner provider — resolves the base plan
 *     sessionId,                          // visitor's session UUID from the cookie
 *   );
 *
 *   const plan = await provider.getHomepagePlan(context);
 *   // plan may have challenger_plan slots merged in if an experiment was active
 *
 * ─── How plan experiments work ────────────────────────────────────────────────
 *
 *   Unlike the old slot-based system, plan experiments do not override
 *   individual slots in isolation.  Instead:
 *
 *   1. The inner provider resolves a base plan (the "control").
 *      For RulesDecisionProvider, this is the matched rule's complete plan.
 *
 *   2. If the inner provider matched a rule (lastMatchedRuleId != null), we
 *      look up active plan_experiments for that rule_id.
 *
 *   3. Bucket assignment (FNV-1a hash, deterministic):
 *        bucket 0 → control   (base plan unchanged)
 *        bucket 1 → challenger (challenger_plan keys merged onto base plan)
 *
 *   4. Fire-and-forget: assignment persisted to plan_experiment_assignments.
 *
 *   5. The reason string is annotated with the experiment outcome.
 *
 * ─── No matched rule → no experiment ─────────────────────────────────────────
 *
 *   When no rule matched (visitor got the default plan), plan experiments are
 *   skipped entirely.  This is intentional: experiments target specific
 *   audiences (rule segments), not the default-plan population.
 *
 * ─── Multiple active experiments for one rule ─────────────────────────────────
 *
 *   At most one active experiment per rule is expected.  If multiple exist,
 *   the one created earliest wins; the rest are skipped with a warning.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   DB errors → base plan returned unchanged (graceful degradation).
 *   Assignment persistence failures → logged, never surfaced to the visitor.
 *
 * ─── Determinism guarantee ───────────────────────────────────────────────────
 *
 *   Same sessionId + same active experiment → same bucket on every request.
 *   FNV-1a 32-bit hash has no runtime state.
 */

import type { ExperiencePlan, DecisionInput } from "@/decision/types";
import type { DecisionProvider }              from "./decision-provider";
import {
  getActivePlanExperimentsForRule,
  getActiveExperimentsForTenant,
  savePlanExperimentAssignment,
}                                             from "@/data/repositories/plan-experiments-repository";
import type { PlanExperimentRow }             from "@/data/types";
import { isEnrolled, assignBucket }           from "@/experiments/bucket-assignment";
import { logger }                             from "@/lib/logger";

// ── Duck-type helper ──────────────────────────────────────────────────────────

/**
 * Returns the last matched rule ID from the inner provider, if the provider
 * exposes a `lastMatchedRuleId` property (RulesDecisionProvider does).
 * Returns null for any other provider type.
 */
function getLastMatchedRuleId(provider: DecisionProvider): string | null {
  if (
    typeof provider === "object" &&
    provider !== null &&
    "lastMatchedRuleId" in provider &&
    (typeof (provider as Record<string, unknown>).lastMatchedRuleId === "string" ||
      (provider as Record<string, unknown>).lastMatchedRuleId === null)
  ) {
    return (provider as { lastMatchedRuleId: string | null }).lastMatchedRuleId;
  }
  return null;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class ExperimentDecisionProvider implements DecisionProvider {
  /**
   * Whether experiment evaluation was enabled on the most recent
   * getHomepagePlan() call.  Reflects the constructor arg (defaults to true).
   * Read by debug panels to surface the global experiments toggle state.
   */
  public lastExperimentsEnabled: boolean;

  constructor(
    private readonly inner: DecisionProvider,
    private readonly sessionId: string,
    /**
     * Tenant-level master switch (TenantSettings.experiments.enabled).
     * When false, all plan experiment evaluation is skipped for this request.
     * Defaults to true — preserves legacy behaviour for callers that don't
     * yet pass the flag.
     */
    private readonly experimentsEnabled: boolean = true,
    /**
     * The active tenant ID.  Used to scope plan experiment lookups so that
     * experiments from other tenants cannot bleed into this tenant's traffic.
     *
     * When omitted (empty string), the query falls back to returning no rows
     * because no experiment has tenant_id = '' after the migration.
     */
    private readonly tenantId: string = "",
    /**
     * Dev-only: force a specific bucket (0 or 1) regardless of session hash.
     * Undefined in production; set via ?_expBucket=<n> in development.
     */
    private readonly forceBucket?: 0 | 1,
  ) {
    this.lastExperimentsEnabled = experimentsEnabled;
  }

  /**
   * The plan experiment applied on the most recent getHomepagePlan() call.
   *
   *   null  — provider not yet called, experiments disabled, no matched rule,
   *            or DB error before assignment phase.
   *   object — one experiment was evaluated; bucket indicates control or challenger.
   *
   * Read by buildDecisionTrace() to populate DecisionTrace.appliedPlanExperiment.
   */
  public lastAppliedPlanExperiment: {
    experimentId:   string;
    experimentName: string;
    ruleId:         string;
    bucket:         0 | 1;
    isChallenger:   boolean;
  } | null = null;

  /**
   * The inner provider wrapped by this decorator.
   * Exposed for provider-chain walking by buildDecisionTrace().
   */
  get innerProvider(): DecisionProvider {
    return this.inner;
  }

  /**
   * Resolve a homepage ExperiencePlan, potentially swapping to a challenger
   * plan when an active plan experiment targets the matched rule.
   */
  async getHomepagePlan(input: DecisionInput): Promise<ExperiencePlan> {
    // ── Step 1: Get the base plan from the inner provider ──────────────────
    const basePlan = await this.inner.getHomepagePlan(input);

    // ── Global experiments master switch ───────────────────────────────────
    if (!this.experimentsEnabled) {
      if (this.forceBucket !== undefined) {
        // eslint-disable-next-line no-console
        console.log("[plan-experiment] DEV DEBUG: experimentsEnabled=false — experiment skipped", {
          sessionId: this.sessionId, tenantId: this.tenantId, forceBucket: this.forceBucket,
        });
      }
      logger.debug("[plan-experiment] Experiments disabled at tenant level; skipping.", {
        sessionId: this.sessionId,
      });
      this.lastAppliedPlanExperiment = null;
      return basePlan;
    }

    // ── Step 2: Require a matched rule ────────────────────────────────────
    //
    // Plan experiments target rule-matched traffic.  When no rule matched
    // (visitor received the default plan), skip experiment evaluation.
    //
    // Exception (dev-only): when forceBucket is set (via ?_expBucket=N),
    // we allow experiment lookup even without a matched rule so developers
    // can preview any active experiment regardless of visitor conditions.
    const matchedRuleId = getLastMatchedRuleId(this.inner);

    if (this.forceBucket !== undefined) {
      // eslint-disable-next-line no-console
      console.log(
        `[plan-experiment] DEV DEBUG: forceBucket=${this.forceBucket} tenantId=${this.tenantId} experimentsEnabled=${this.experimentsEnabled} matchedRuleId=${matchedRuleId ?? "null"} sessionId=${this.sessionId}`,
      );
    }

    if (!matchedRuleId && this.forceBucket === undefined) {
      logger.debug("[plan-experiment] No matched rule — skipping plan experiment evaluation.", {
        sessionId: this.sessionId,
      });
      this.lastAppliedPlanExperiment = null;
      return basePlan;
    }

    // ── Step 3: Load active plan experiments ─────────────────────────────
    //
    // When a rule matched, scope to that rule.
    // When forceBucket is set and no rule matched (dev preview), fetch ALL
    // active experiments for the tenant and use the first one.
    const experimentsResult = matchedRuleId
      ? await getActivePlanExperimentsForRule(matchedRuleId, this.tenantId)
      : await getActiveExperimentsForTenant(this.tenantId);

    if (this.forceBucket !== undefined) {
      const count = experimentsResult.ok ? experimentsResult.data.length : "ERROR";
      const ids   = experimentsResult.ok
        ? experimentsResult.data.map(e => `${e.id}(tenant:${e.tenant_id},status:${e.status})`).join(", ") || "(empty)"
        : experimentsResult.error;
      // eslint-disable-next-line no-console
      console.log(
        `[plan-experiment] DEV DEBUG: query ok=${experimentsResult.ok} count=${count} tenantId=${this.tenantId} usedFallback=${!matchedRuleId} experiments=${ids}`,
      );
    }

    if (!experimentsResult.ok) {
      logger.warn("[plan-experiment] Failed to load plan experiments; using base plan.", {
        sessionId:     this.sessionId,
        matchedRuleId,
        error:         experimentsResult.error,
      });
      this.lastAppliedPlanExperiment = null;
      return basePlan;
    }

    const experiments = experimentsResult.data;

    if (experiments.length === 0) {
      // Fast path: no active experiments for this rule.
      this.lastAppliedPlanExperiment = null;
      return basePlan;
    }

    if (experiments.length > 1) {
      // Warn but still proceed with the first (oldest) experiment.
      logger.warn("[plan-experiment] Multiple active plan experiments for same rule; using oldest.", {
        matchedRuleId,
        experimentIds: experiments.map((e) => e.id),
      });
    }

    const experiment = experiments[0];

    // ── Step 4: Enrollment check ──────────────────────────────────────────
    const enrolled = isEnrolled(this.sessionId, experiment.id, experiment.traffic_fraction);

    if (!enrolled) {
      logger.debug("[plan-experiment] Session not enrolled in experiment.", {
        sessionId:     this.sessionId,
        experimentId:  experiment.id,
        trafficFraction: experiment.traffic_fraction,
      });
      this.lastAppliedPlanExperiment = null;
      return basePlan;
    }

    // ── Step 5: Bucket assignment (0 = control, 1 = challenger) ──────────
    const bucket = (this.forceBucket !== undefined
      ? this.forceBucket
      : assignBucket(this.sessionId, experiment.id, 2)) as 0 | 1;
    const isChallenger = bucket === 1;

    // ── Step 6: Apply challenger plan (or keep control) ───────────────────
    let plan: ExperiencePlan = basePlan;

    if (isChallenger) {
      plan = applyChallenger(basePlan, experiment);
    }

    // ── Step 7: Annotate reason string ────────────────────────────────────
    const bucketLabel = isChallenger ? "challenger" : "control";
    plan = {
      ...plan,
      reason: `${plan.reason} | PlanExp:"${experiment.id}" rule:${matchedRuleId} bucket:${bucket}(${bucketLabel})`,
    };

    // ── Record for trace/debug access ─────────────────────────────────────
    this.lastAppliedPlanExperiment = {
      experimentId:   experiment.id,
      experimentName: experiment.name,
      ruleId:         matchedRuleId ?? "dev-force",
      bucket,
      isChallenger,
    };

    logger.debug("[plan-experiment] Bucket assigned.", {
      sessionId:    this.sessionId,
      experimentId: experiment.id,
      ruleId:       matchedRuleId,
      bucket,
      isChallenger,
    });

    // ── Step 8: Fire-and-forget persistence ───────────────────────────────
    void savePlanExperimentAssignment({
      session_id:    this.sessionId,
      experiment_id: experiment.id,
      bucket,
    }).then((result) => {
      if (!result.ok) {
        logger.warn("[plan-experiment] Failed to persist assignment (non-blocking).", {
          sessionId:    this.sessionId,
          experimentId: experiment.id,
          error:        result.error,
        });
      }
    });

    return plan;
  }
}

// ── Challenger plan merge ─────────────────────────────────────────────────────

/**
 * Returns a new ExperiencePlan with the challenger_plan slots merged in.
 *
 * Only keys present in challenger_plan are overridden — missing keys inherit
 * from the control plan.  This preserves narrative coherence: if the
 * experiment only tests a hero variant, proof and CTA stay consistent.
 */
function applyChallenger(
  control:    ExperiencePlan,
  experiment: PlanExperimentRow,
): ExperiencePlan {
  const cp = experiment.challenger_plan;

  return {
    ...control,
    ...(cp.heroKey       ? { heroKey:       cp.heroKey       as ExperiencePlan["heroKey"]       } : {}),
    ...(cp.proofKey      ? { proofKey:      cp.proofKey      as ExperiencePlan["proofKey"]      } : {}),
    ...(cp.ctaKey        ? { ctaKey:        cp.ctaKey        as ExperiencePlan["ctaKey"]        } : {}),
    ...(cp.featureKey    ? { featureKey:    cp.featureKey    as ExperiencePlan["featureKey"]    } : {}),
    ...(cp.conversionKey ? { conversionKey: cp.conversionKey as ExperiencePlan["conversionKey"] } : {}),
    ...(cp.formVariants  ? { formVariants:  cp.formVariants  as ExperiencePlan["formVariants"]  } : {}),
  };
}
