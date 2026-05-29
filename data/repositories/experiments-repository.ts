/**
 * Experiments Repository
 *
 * Data access layer for the A/B testing tables:
 *   experiments             — defines what is being tested
 *   experiment_assignments  — records which bucket each session received
 *
 * All public functions return `RepositoryResult<T>` — they never throw.
 * The caller (ExperimentDecisionProvider) treats errors as "skip the
 * experiment" rather than surfacing them to the visitor.
 *
 * ─── Key functions ────────────────────────────────────────────────────────────
 *
 *   getActiveExperiments()
 *     Fetches all rows with status = "active".
 *     Called once per page request; result is small (usually 0-5 rows).
 *
 *   saveExperimentAssignment(input)
 *     Writes an (session_id, experiment_id, bucket, variant_key) row.
 *     Uses ON CONFLICT DO NOTHING — safe to call on every request.
 *     Fire-and-forget from the decision provider (errors logged, not thrown).
 *
 *   getAssignmentsForSession(sessionId)
 *     Returns all assignment rows for a session.
 *     Used by the Session Inspector dashboard page.
 *
 *   listAllExperiments()
 *     Returns all experiments regardless of status. Dashboard use only.
 *
 *   createExperiment(input)
 *     Inserts a new experiment row. ID is a user-supplied stable slug.
 *     Returns a 409-style error message when the slug already exists.
 *
 *   updateExperiment(id, patch)
 *     Partially updates a single experiment by its slug ID.
 *     Only the fields present in `patch` are modified.
 */

import { getDb } from "@/data/db";
import type {
  ExperimentRow,
  ExperimentInsert,
  ExperimentAssignmentRow,
  ExperimentAssignmentInsert,
} from "@/data/types";
import type { RepositoryResult } from "./sessions-repository";
import { logger } from "@/lib/logger";

// ── Type assertion helper (same pattern as analytics-repository) ───────────────
// Supabase's auto-generated discriminant is absent in our hand-authored
// Database type, causing .select() to resolve to `never[]` when columns are
// named explicitly.  Casting through unknown is safe here — the shape is
// verified at write time via the Insert interfaces above.

type SelectResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

function asRows<T>(result: unknown): SelectResult<T> {
  return result as SelectResult<T>;
}

// ── Mutable patch type ─────────────────────────────────────────────────────────

/**
 * Fields that the dashboard editor is allowed to change on an existing
 * experiment. Slot and ID are immutable after creation; ended_at is
 * managed server-side by the actions layer (not by the UI directly).
 */
export interface ExperimentUpdatePatch {
  name?:             string;
  status?:           "active" | "paused" | "ended";
  traffic_fraction?: number;
  variants?:         string[];
  ended_at?:         string | null;
}

// ── getActiveExperiments ──────────────────────────────────────────────────────

/**
 * Returns all experiments whose status is "active".
 *
 * This is the hot-path function — called on every homepage request that has
 * at least one active experiment.  The result set is expected to be tiny
 * (single digits) so no pagination is applied.
 *
 * @returns RepositoryResult wrapping an array of ExperimentRow.
 *          Returns an empty array (ok: true) when there are no active experiments.
 */
export async function getActiveExperiments(): Promise<RepositoryResult<ExperimentRow[]>> {
  try {
    const db = getDb();
    const result = asRows<ExperimentRow>(
      await db.from("experiments").select().eq("status", "active").order("created_at"),
    );

    if (result.error) {
      logger.error("[experiments] Failed to fetch active experiments", { error: result.error.message });
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.data ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[experiments] Unexpected error fetching active experiments", { error: message });
    return { ok: false, error: message };
  }
}

// ── saveExperimentAssignment ──────────────────────────────────────────────────

/**
 * Persists an experiment assignment row.
 *
 * Uses ON CONFLICT DO NOTHING on the (session_id, experiment_id) unique
 * constraint.  This means:
 *  - First call: inserts the row.
 *  - Subsequent calls with the same pair: silently no-ops.
 *
 * The deterministic hash guarantees the bucket is always the same, so
 * not re-inserting is correct behaviour.
 *
 * This function is called fire-and-forget from ExperimentDecisionProvider.
 * Failures are logged but do not affect the variant served to the visitor.
 *
 * @param input - The assignment to record.
 * @returns RepositoryResult<ExperimentAssignmentRow | null>
 *          Returns null when the row already existed (conflict, no-op).
 */
export async function saveExperimentAssignment(
  input: ExperimentAssignmentInsert,
): Promise<RepositoryResult<ExperimentAssignmentRow | null>> {
  try {
    const db = getDb();

    // Supabase JS v2 does not expose ON CONFLICT DO NOTHING directly in the
    // typed client.  `upsert` with `ignoreDuplicates: true` achieves the same
    // semantic: insert if not exists, do nothing on conflict.
    //
    // The `as never` cast works around the same Supabase PostgREST v12
    // type-discrimination bug that affects all write operations in this codebase
    // (the Insert type is inferred as `never` because the hand-authored
    // Database type lacks the required `PostgrestVersion` discriminant field).
    // Runtime behaviour is correct; this is purely a TS type-level workaround.
    const { data, error } = await db
      .from("experiment_assignments")
      .upsert(input as never, { onConflict: "session_id,experiment_id", ignoreDuplicates: true })
      .select()
      .maybeSingle();

    if (error) {
      logger.warn("[experiments] Failed to save experiment assignment", {
        sessionId: input.session_id,
        experimentId: input.experiment_id,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }

    logger.debug("[experiments] Assignment saved", {
      sessionId: input.session_id,
      experimentId: input.experiment_id,
      bucket: input.bucket,
      variantKey: input.variant_key,
    });

    return { ok: true, data: data ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[experiments] Unexpected error saving assignment", { error: message });
    return { ok: false, error: message };
  }
}

// ── getAssignmentsForSession ──────────────────────────────────────────────────

/**
 * Returns all experiment assignment rows for a given session.
 *
 * Used by the Session Inspector dashboard page to show which experiments
 * the session was enrolled in.
 *
 * @param sessionId - The session UUID.
 * @returns RepositoryResult wrapping an array of ExperimentAssignmentRow.
 */
export async function getAssignmentsForSession(
  sessionId: string,
): Promise<RepositoryResult<ExperimentAssignmentRow[]>> {
  try {
    const db = getDb();
    const result = asRows<ExperimentAssignmentRow>(
      await db
        .from("experiment_assignments")
        .select()
        .eq("session_id", sessionId)
        .order("created_at"),
    );

    if (result.error) {
      logger.error("[experiments] Failed to fetch assignments for session", {
        sessionId,
        error: result.error.message,
      });
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.data ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[experiments] Unexpected error fetching assignments", { error: message });
    return { ok: false, error: message };
  }
}

// ── listAllExperiments ────────────────────────────────────────────────────────

/**
 * Returns all experiments regardless of status.
 * Used by the dashboard Variants / AI pages for a full catalogue view.
 */
export async function listAllExperiments(): Promise<RepositoryResult<ExperimentRow[]>> {
  try {
    const db = getDb();
    const result = asRows<ExperimentRow>(
      await db.from("experiments").select().order("created_at", { ascending: false }),
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

// ── createExperiment ──────────────────────────────────────────────────────────

/**
 * Inserts a new experiment row.
 *
 * The `id` is a user-supplied stable slug (e.g. "hero_q2_2025_test") — it
 * is the primary key and cannot be changed after creation.
 *
 * @param input - Validated ExperimentInsert from the dashboard actions layer.
 * @returns The created ExperimentRow, or an error if the slug already exists.
 */
export async function createExperiment(
  input: ExperimentInsert,
): Promise<RepositoryResult<ExperimentRow>> {
  try {
    const db = getDb();

    const { data, error } = await db
      .from("experiments")
      .insert(input as never)
      .select()
      .maybeSingle();

    if (error) {
      // PostgreSQL unique-constraint violation — the slug is already taken.
      if (error.code === "23505") {
        return { ok: false, error: `An experiment with ID "${input.id}" already exists.` };
      }
      logger.error("[experiments] Failed to create experiment", { id: input.id, error: error.message });
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: false, error: "Insert returned no data." };
    }

    logger.debug("[experiments] Experiment created", { id: input.id });
    return { ok: true, data: data as unknown as ExperimentRow };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[experiments] Unexpected error creating experiment", { error: message });
    return { ok: false, error: message };
  }
}

// ── updateExperiment ──────────────────────────────────────────────────────────

/**
 * Partially updates a single experiment by its slug ID.
 *
 * Only the fields present in `patch` are sent to Supabase — absent keys are
 * left untouched in the database. The `slot` and `id` fields are immutable
 * and must never appear in `patch`.
 *
 * The actions layer is responsible for setting `ended_at` to
 * `new Date().toISOString()` when the status transitions to "ended".
 *
 * @param id    - The experiment slug (primary key).
 * @param patch - Subset of mutable fields to change.
 * @returns The full updated ExperimentRow on success.
 */
export async function updateExperiment(
  id: string,
  patch: ExperimentUpdatePatch,
): Promise<RepositoryResult<ExperimentRow>> {
  try {
    const db = getDb();

    const { data, error } = await db
      .from("experiments")
      .update(patch as never)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      logger.error("[experiments] Failed to update experiment", { id, error: error.message });
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: false, error: `Experiment "${id}" not found.` };
    }

    logger.debug("[experiments] Experiment updated", { id });
    return { ok: true, data: data as unknown as ExperimentRow };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[experiments] Unexpected error updating experiment", { error: message });
    return { ok: false, error: message };
  }
}

// ── deleteExperiment ──────────────────────────────────────────────────────────

/**
 * Permanently deletes a single experiment by its slug ID.
 *
 * Assignments (experiment_assignments rows) are NOT cascade-deleted here —
 * the DB should have ON DELETE CASCADE on experiment_assignments.experiment_id
 * if you want historical assignment rows cleaned up automatically.  Otherwise
 * they become orphaned rows referencing a deleted experiment slug.
 *
 * @param id  The experiment slug (primary key).
 */
export async function deleteExperiment(id: string): Promise<RepositoryResult<void>> {
  try {
    const db = getDb();

    const { error } = await db
      .from("experiments")
      .delete()
      .eq("id", id as never);

    if (error) {
      logger.error("[experiments] Failed to delete experiment", { id, error: (error as { message: string }).message });
      return { ok: false, error: (error as { message: string }).message };
    }

    logger.debug("[experiments] Experiment deleted", { id });
    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[experiments] Unexpected error deleting experiment", { error: message });
    return { ok: false, error: message };
  }
}

// ── Re-export types for consumers ─────────────────────────────────────────────

export type { ExperimentRow, ExperimentAssignmentRow, ExperimentAssignmentInsert };
