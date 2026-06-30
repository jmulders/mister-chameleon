/**
 * Variants Repository
 *
 * Encapsulates all database access for the `served_variants` table.
 * One row is written per session immediately after the experience is
 * composed, recording which variant set was served and why.
 *
 * ─── Table schema ─────────────────────────────────────────────────────────────
 *
 *   served_variants (
 *     id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     session_id uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 *     created_at timestamptz NOT NULL DEFAULT now(),
 *     hero_key   text        NOT NULL,
 *     proof_key  text        NOT NULL,
 *     cta_key    text        NOT NULL,
 *     reason     text        NOT NULL,
 *     tenant_id  text        NOT NULL
 *   )
 *
 * ─── Relationship ─────────────────────────────────────────────────────────────
 *
 *   served_variants.session_id → sessions.id (FK, ON DELETE CASCADE)
 *
 *   One session may theoretically have multiple variant rows if the page
 *   is re-rendered with a different context (e.g. A/B overrides), but
 *   in the MVP one session yields exactly one variant record.
 *
 * ─── tenant_id requirement ────────────────────────────────────────────────────
 *
 *   tenant_id is NOT NULL in the database and is required on every insert.
 *   saveServedVariants() enforces this at the application layer:
 *     • The type requires tenantId to be a non-empty string.
 *     • A defensive guard rejects the insert and logs a warning if the value
 *       is somehow empty at runtime, preventing the NOT NULL DB error.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   Returns a `RepositoryResult<T>` — never throws. Callers check `result.ok`.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { saveServedVariants } from "@/data/repositories/variants-repository";
 *   import type { SaveServedVariantsInput } from "@/data/repositories/variants-repository";
 */

import { getDb } from "../db";
import type { ServedVariantRow } from "../types";
import { logger } from "@/lib/logger";
import type { ExperiencePlan } from "@/decision/types";
import type { RepositoryResult } from "./sessions-repository";

// ── Input type ────────────────────────────────────────────────────────────────

/**
 * Data required to persist the served variant set for a session.
 *
 * `tenantId` is required and must be a non-empty string — it maps to the
 * NOT NULL `tenant_id` column in `served_variants`.  Rows without a tenant
 * would be unqueryable per-tenant and violate the DB constraint.
 *
 * Use `servedVariantsInputFromPlan()` to build this from an `ExperiencePlan`.
 */
export interface SaveServedVariantsInput {
  sessionId: string;
  heroKey:   string;
  proofKey:  string;
  ctaKey:    string;
  reason:    string;
  /** Tenant slug, e.g. "mister-chameleon" | "workengine". Must be non-empty. */
  tenantId:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a `SaveServedVariantsInput` from an `ExperiencePlan`, a session ID,
 * and the active tenant ID.
 *
 * @param sessionId  The UUID of the session created by `createSession()`.
 * @param plan       The `ExperiencePlan` returned by the decision provider.
 * @param tenantId   The active tenant slug (e.g. "mister-chameleon").
 */
export function servedVariantsInputFromPlan(
  sessionId: string,
  plan:      ExperiencePlan,
  tenantId:  string,
): SaveServedVariantsInput {
  return {
    sessionId,
    heroKey:  plan.heroKey,
    proofKey: plan.proofKey,
    ctaKey:   plan.ctaKey,
    reason:   plan.reason,
    tenantId,
  };
}

// ── Repository functions ───────────────────────────────────────────────────────

/**
 * Inserts a `served_variants` row for a given session.
 *
 * Records the full set of variant keys that were selected by the decision
 * engine, the reason string that explains which rule fired, and the tenant
 * the row belongs to.
 *
 * ─── Defensive guard ──────────────────────────────────────────────────────────
 *
 *   If `input.tenantId` is empty at runtime (which should not happen given the
 *   typed interface, but can occur across a DB or serialisation boundary),
 *   the function returns an error result immediately without hitting the
 *   database.  This prevents the NOT NULL constraint violation and surfaces a
 *   clear warning in logs rather than a cryptic Postgres error.
 *
 * @param input  Variant data, typically built via `servedVariantsInputFromPlan()`.
 * @returns      A `RepositoryResult` containing the created `ServedVariantRow`.
 */
export async function saveServedVariants(
  input: SaveServedVariantsInput,
): Promise<RepositoryResult<ServedVariantRow>> {
  // Defensive guard — tenantId is typed as string but the value crosses runtime
  // boundaries (Supabase JSONB, cookie parsing) where TypeScript cannot help.
  // Reject the insert early rather than letting Postgres raise a NOT NULL error.
  if (!input.tenantId) {
    logger.warn(
      "[variants-repository] saveServedVariants called without tenantId — insert skipped",
      { sessionId: input.sessionId },
    );
    return { ok: false, error: "tenantId is required but was empty" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hand-written Database types lag the schema; payload is validated by the DB.
  const { data, error } = await (getDb() as any)
    .from("served_variants")
    .insert({
      session_id: input.sessionId,
      hero_key:   input.heroKey,
      proof_key:  input.proofKey,
      cta_key:    input.ctaKey,
      reason:     input.reason,
      tenant_id:  input.tenantId,
    })
    .select()
    .single();

  if (error) {
    logger.error("[variants-repository] saveServedVariants failed", {
      error:     error.message,
      code:      error.code,
      sessionId: input.sessionId,
      tenantId:  input.tenantId,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

/**
 * Retrieves the most recent served variant rows for a session, newest first.
 * Used by the debug page to display variant history for the current session.
 *
 * @param sessionId  The session UUID.
 * @param limit      Maximum number of rows to return. Defaults to 5.
 */
export async function getServedVariantsBySession(
  sessionId: string,
  limit = 5,
): Promise<RepositoryResult<ServedVariantRow[]>> {
  const { data, error } = await getDb()
    .from("served_variants")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("[variants-repository] getServedVariantsBySession failed", {
      error:     error.message,
      code:      error.code,
      sessionId,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data ?? [] };
}
