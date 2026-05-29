/**
 * Plan Experiments Repository
 *
 * Data access layer for the plan-based A/B testing tables:
 *   plan_experiments             — defines what is being tested
 *   plan_experiment_assignments  — records which bucket each session received
 *
 * Plan experiments differ from the old slot-based experiments in that each
 * experiment targets a specific rule (via rule_id) and tests a complete
 * challenger plan against the rule's control plan.  Bucket 0 receives the
 * control plan unchanged; bucket 1 receives the challenger_plan merged on top.
 *
 * All public functions return `RepositoryResult<T>` — they never throw.
 * The caller (ExperimentDecisionProvider) degrades gracefully on error.
 *
 * ─── Key functions ────────────────────────────────────────────────────────────
 *
 *   getActivePlanExperimentsForRule(ruleId)
 *     Returns active plan experiments for the given rule ID.
 *     Hot-path: called once per request when a rule matches.
 *     At most one experiment per rule should be active; the provider uses
 *     the first one in creation order if multiple exist.
 *
 *   savePlanExperimentAssignment(input)
 *     Writes a (session_id, experiment_id, bucket) row.
 *     Uses ON CONFLICT DO NOTHING — idempotent across requests.
 *
 *   getAssignmentsForSession(sessionId)
 *     Returns all plan experiment assignment rows for a session.
 *     Used by the Session Inspector page.
 *
 *   listAllPlanExperiments()
 *     Returns all plan experiments regardless of status.
 *     Dashboard use only.
 *
 *   createPlanExperiment(input)
 *     Inserts a new plan experiment row.
 *
 *   updatePlanExperiment(id, patch)
 *     Partially updates a plan experiment by its slug ID.
 *
 *   deletePlanExperiment(id)
 *     Permanently deletes a plan experiment (cascade deletes assignments).
 */

import { getDb } from "@/data/db";
import type {
  PlanExperimentRow,
  PlanExperimentInsert,
  PlanExperimentAssignmentRow,
  PlanExperimentAssignmentInsert,
} from "@/data/types";
import type { RepositoryResult } from "./sessions-repository";
import { logger } from "@/lib/logger";

// ── Type assertion helper ──────────────────────────────────────────────────────

type SelectResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };
type SingleResult<T> = { data: T | null; error: { message: string; code?: string } | null };

function asRows<T>(result: unknown): SelectResult<T> {
  return result as SelectResult<T>;
}
function asSingle<T>(result: unknown): SingleResult<T> {
  return result as SingleResult<T>;
}

// ── Mutable patch type ─────────────────────────────────────────────────────────

/**
 * Fields the dashboard is allowed to change on an existing plan experiment.
 * Only `id` and `tenant_id` are immutable after creation.
 */
export interface PlanExperimentUpdatePatch {
  name?:             string;
  rule_id?:          string;
  challenger_plan?:  PlanExperimentRow["challenger_plan"];
  status?:           "draft" | "active" | "paused" | "ended";
  traffic_fraction?: number;
  ended_at?:         string | null;
}

// ── getActivePlanExperimentsForRule ───────────────────────────────────────────

/**
 * Returns all active plan experiments for the given rule ID, scoped to a tenant.
 *
 * Hot-path: called on every homepage request where a rule matched.
 * Result is expected to be 0 or 1 row (at most one active experiment per rule).
 *
 * @param ruleId    The rule ID from RulesDecisionProvider.lastMatchedRuleInfo.
 * @param tenantId  The active tenant ID — filters out experiments from other tenants.
 */
export async function getActivePlanExperimentsForRule(
  ruleId:   string,
  tenantId: string,
): Promise<RepositoryResult<PlanExperimentRow[]>> {
  try {
    const db = getDb();
    const result = asRows<PlanExperimentRow>(
      await db
        .from("plan_experiments")
        .select()
        .eq("tenant_id", tenantId)
        .eq("rule_id", ruleId)
        .eq("status", "active")
        .order("created_at"),
    );

    if (result.error) {
      logger.error("[plan-experiments] Failed to fetch active experiments for rule", {
        ruleId,
        error: result.error.message,
      });
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.data ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[plan-experiments] Unexpected error fetching active experiments", { error: message });
    return { ok: false, error: message };
  }
}

// ── getActiveExperimentsForTenant ─────────────────────────────────────────────

/**
 * Returns all active plan experiments for a tenant, regardless of rule_id.
 *
 * Used in development/testing when forceBucket is set but no rule matched for
 * the current visitor — allows ?_expBucket=N to preview any active experiment
 * without needing to satisfy the rule conditions.
 *
 * Ordered by created_at ascending so the oldest experiment wins when multiple
 * are active (same tie-break as getActivePlanExperimentsForRule).
 */
export async function getActiveExperimentsForTenant(
  tenantId: string,
): Promise<RepositoryResult<PlanExperimentRow[]>> {
  try {
    const db = getDb();
    const result = asRows<PlanExperimentRow>(
      await db
        .from("plan_experiments")
        .select()
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("created_at"),
    );

    if (result.error) {
      logger.error("[plan-experiments] Failed to fetch active experiments for tenant", {
        tenantId,
        error: result.error.message,
      });
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.data ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[plan-experiments] Unexpected error fetching tenant experiments", { error: message });
    return { ok: false, error: message };
  }
}

// ── savePlanExperimentAssignment ──────────────────────────────────────────────

/**
 * Persists a plan experiment assignment.
 *
 * ON CONFLICT DO NOTHING on (session_id, experiment_id) — the deterministic
 * hash guarantees the same bucket every time, so duplicate inserts are safe to
 * silently discard.
 *
 * Called fire-and-forget from ExperimentDecisionProvider.
 */
export async function savePlanExperimentAssignment(
  input: PlanExperimentAssignmentInsert,
): Promise<RepositoryResult<PlanExperimentAssignmentRow | null>> {
  try {
    const db = getDb();

    const { data, error } = asSingle<PlanExperimentAssignmentRow>(
      await db
        .from("plan_experiment_assignments")
        .upsert(input as never, {
          onConflict: "session_id,experiment_id",
          ignoreDuplicates: true,
        })
        .select()
        .maybeSingle(),
    );

    if (error) {
      logger.warn("[plan-experiments] Failed to save assignment (non-blocking)", {
        sessionId:    input.session_id,
        experimentId: input.experiment_id,
        error:        error.message,
      });
      return { ok: false, error: error.message };
    }

    logger.debug("[plan-experiments] Assignment saved", {
      sessionId:    input.session_id,
      experimentId: input.experiment_id,
      bucket:       input.bucket,
    });

    return { ok: true, data: data ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[plan-experiments] Unexpected error saving assignment", { error: message });
    return { ok: false, error: message };
  }
}

// ── getAssignmentsForSession ──────────────────────────────────────────────────

/**
 * Returns all plan experiment assignment rows for a session.
 * Used by the Session Inspector dashboard page.
 */
export async function getPlanAssignmentsForSession(
  sessionId: string,
): Promise<RepositoryResult<PlanExperimentAssignmentRow[]>> {
  try {
    const db = getDb();
    const result = asRows<PlanExperimentAssignmentRow>(
      await db
        .from("plan_experiment_assignments")
        .select()
        .eq("session_id", sessionId)
        .order("created_at"),
    );

    if (result.error) {
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.data ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ── listAllPlanExperiments ────────────────────────────────────────────────────

/**
 * Returns all plan experiments for a specific tenant — ordered newest first.
 * Dashboard use only.
 *
 * @param tenantId  The tenant whose experiments to list.
 */
export async function listAllPlanExperiments(
  tenantId: string,
): Promise<RepositoryResult<PlanExperimentRow[]>> {
  try {
    const db = getDb();
    const result = asRows<PlanExperimentRow>(
      await db
        .from("plan_experiments")
        .select()
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
    );

    if (result.error) {
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.data ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ── createPlanExperiment ──────────────────────────────────────────────────────

/**
 * Inserts a new plan experiment.
 *
 * The `id` is a user-supplied stable slug — primary key, immutable.
 * `tenant_id` is required — always pass tenantId from the request context.
 * Returns a 409-style error when the slug already exists.
 */
export async function createPlanExperiment(
  input: PlanExperimentInsert,
): Promise<RepositoryResult<PlanExperimentRow>> {
  try {
    const db = getDb();

    const { data, error } = asSingle<PlanExperimentRow>(
      await db
        .from("plan_experiments")
        .insert(input as never)
        .select()
        .maybeSingle(),
    );

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: `A plan experiment with ID "${input.id}" already exists.` };
      }
      logger.error("[plan-experiments] Failed to create experiment", {
        id: input.id,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: false, error: "Insert returned no data." };
    }

    logger.debug("[plan-experiments] Experiment created", { id: input.id });
    return { ok: true, data: data as unknown as PlanExperimentRow };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[plan-experiments] Unexpected error creating experiment", { error: message });
    return { ok: false, error: message };
  }
}

// ── updatePlanExperiment ──────────────────────────────────────────────────────

/**
 * Partially updates a plan experiment by its (tenantId, id) composite key.
 *
 * Only fields present in `patch` are updated.
 * The actions layer sets ended_at when status transitions to "ended".
 *
 * @param tenantId  Scopes the update to the owning tenant — prevents cross-tenant mutation.
 * @param id        The experiment slug.
 * @param patch     Fields to update.
 */
export async function updatePlanExperiment(
  tenantId: string,
  id: string,
  patch: PlanExperimentUpdatePatch,
): Promise<RepositoryResult<PlanExperimentRow>> {
  try {
    const db = getDb();

    const { data, error } = asSingle<PlanExperimentRow>(
      await db
        .from("plan_experiments")
        .update(patch as never)
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select()
        .maybeSingle(),
    );

    if (error) {
      logger.error("[plan-experiments] Failed to update experiment", { tenantId, id, error: error.message });
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: false, error: `Plan experiment "${id}" not found.` };
    }

    logger.debug("[plan-experiments] Experiment updated", { tenantId, id });
    return { ok: true, data: data as unknown as PlanExperimentRow };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[plan-experiments] Unexpected error updating experiment", { error: message });
    return { ok: false, error: message };
  }
}

// ── deletePlanExperiment ──────────────────────────────────────────────────────

/**
 * Permanently deletes a plan experiment and its assignments.
 *
 * Assignments are deleted explicitly before the experiment because the
 * FK cascade was removed in migration 000121 (composite PK change).
 * The delete is scoped to the owning tenant — prevents cross-tenant deletion.
 *
 * @param tenantId  The owning tenant.
 * @param id        The experiment slug.
 */
export async function deletePlanExperiment(
  tenantId: string,
  id: string,
): Promise<RepositoryResult<void>> {
  try {
    const db = getDb();

    // Step 1: Delete assignments first (FK cascade was removed in migration 000121).
    const { error: assignError } = await db
      .from("plan_experiment_assignments")
      .delete()
      .eq("experiment_id", id as never);

    if (assignError) {
      const msg = (assignError as { message: string }).message;
      logger.warn("[plan-experiments] Failed to delete assignments before experiment delete", {
        tenantId, id, error: msg,
      });
      // Non-fatal: proceed with experiment delete anyway.
    }

    // Step 2: Delete the experiment, scoped to the owning tenant.
    const { error } = await db
      .from("plan_experiments")
      .delete()
      .eq("tenant_id", tenantId as never)
      .eq("id", id as never);

    if (error) {
      const msg = (error as { message: string }).message;
      logger.error("[plan-experiments] Failed to delete experiment", { tenantId, id, error: msg });
      return { ok: false, error: msg };
    }

    logger.debug("[plan-experiments] Experiment deleted", { tenantId, id });
    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[plan-experiments] Unexpected error deleting experiment", { error: message });
    return { ok: false, error: message };
  }
}

// ── Re-export types for consumers ─────────────────────────────────────────────

export type {
  PlanExperimentRow,
  PlanExperimentInsert,
  PlanExperimentAssignmentRow,
  PlanExperimentAssignmentInsert,
};
