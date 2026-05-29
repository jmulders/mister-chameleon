/**
 * Fetch Journey State
 *
 * Reads the pre-computed visitor_behavior_state row for a (tenant, session).
 * Single PK-lookup — lightweight enough for the request-time critical path.
 *
 * ─── Never throws ─────────────────────────────────────────────────────────────
 *
 *   Returns emptyJourneyState() on any DB error so the request always
 *   receives a valid struct.
 *
 * ─── Why not re-derive on every request? ─────────────────────────────────────
 *
 *   Derivation reads all raw events + all scoring rules + all sequence patterns
 *   for the session.  That can be 5–10 queries.  The state table collapses all
 *   that into a single, indexed row.  updateBehaviorState() keeps it fresh by
 *   running async after each journey event is written.
 *
 * ─── Confidence ───────────────────────────────────────────────────────────────
 *
 *   After loading the DB row, fetchJourneyState() calls
 *   computeBehaviorConfidence() and attaches the result to journey.confidence.
 *   This is the canonical place where confidence is computed — it is available
 *   to all downstream consumers (rules, debug panel, decision pipeline).
 */

import { getDb }             from "@/data/db";
import { logger }            from "@/lib/logger";
import { emptyJourneyState, rowToJourneyState } from "./types";
import type { JourneyState, BehaviorStateRow }  from "./types";
import { computeBehaviorConfidence }             from "./compute-confidence";

// New journey tables are not yet in generated Supabase types — cast to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbAny() { return getDb() as any; }

// ── Type helper ───────────────────────────────────────────────────────────────

type DbResult<T> = { data: T | null; error: { message: string } | null };
type DbResultMany<T> = { data: T[] | null; error: { message: string } | null };

function asResult<T>(r: unknown): DbResult<T> {
  return r as DbResult<T>;
}

function asResultMany<T>(r: unknown): DbResultMany<T> {
  return r as DbResultMany<T>;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Fetches the aggregated journey/behavior state for a visitor session.
 * Attaches computed confidence metrics before returning.
 *
 * Uses `.limit(1)` ordered by `updated_at DESC` instead of `.maybeSingle()` so
 * the function is resilient to duplicate rows that can accumulate when migration
 * 0125 (UNIQUE (tenant_id, session_id) constraint) has not been applied yet.
 * `.maybeSingle()` returns a PGRST116 error when multiple rows match, causing
 * this function to silently return emptyJourneyState() and leaving journey.*
 * context variables null in the decision pipeline.
 *
 * @param sessionId  The visitor's mc_session_id UUID.
 * @param tenantId   Active tenant slug.
 * @returns          JourneyState with fromDatabase=true and populated confidence,
 *                   or emptyJourneyState() on failure.
 */
export async function fetchJourneyState(
  sessionId: string,
  tenantId:  string,
): Promise<JourneyState> {
  try {
    const db = dbAny();

    // Use limit(1) + updated_at DESC instead of maybeSingle() so that duplicate
    // rows (pre-migration 0125) don't cause a PGRST116 error that silently
    // returns empty state.  The most recently updated row is always the freshest.
    const result = asResultMany<BehaviorStateRow>(
      await db
        .from("visitor_behavior_state")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("session_id", sessionId)
        .order("updated_at", { ascending: false })
        .limit(1),
    );

    if (result.error) {
      logger.debug("[fetch-journey-state] DB query failed", {
        sessionId,
        tenantId,
        error: result.error.message,
      });
      return emptyJourneyState();
    }

    const row = result.data?.[0] ?? null;

    if (!row) {
      // No state yet — visitor hasn't generated journey events that have been processed.
      return emptyJourneyState();
    }

    // Map DB row to JourneyState (confidence is set to emptyConfidence() placeholder).
    const state = rowToJourneyState(row);

    // Attach real computed confidence — overwrites the placeholder set in rowToJourneyState().
    state.confidence = computeBehaviorConfidence(state);

    return state;
  } catch (err) {
    logger.debug("[fetch-journey-state] Unexpected error", {
      sessionId,
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return emptyJourneyState();
  }
}

// ── Recent events fetch (for debug panel) ─────────────────────────────────────

/**
 * Fetches the most recent N journey events for a (tenant, session).
 * Used only by the debug panel and /api/journey/state — never on the hot path.
 *
 * Includes event_id so the client can deduplicate against its local store.
 */
export async function fetchRecentJourneyEvents(
  sessionId: string,
  tenantId:  string,
  limit = 20,
): Promise<import("./types").JourneyEventRow[]> {
  try {
    const db = dbAny();

    type Rows = { data: import("./types").JourneyEventRow[] | null; error: { message: string } | null };
    const result = (await db
      .from("visitor_journey_events")
      .select([
        "id",
        "event_id",   // ← migration 0031: client-generated dedup key
        "tenant_id",
        "session_id",
        "occurred_at",
        "event_type",
        "event_value",
        "page_path",
        "page_category",
        "page_keywords",
        "source",
        "medium",
        "campaign",
        "metadata",
      ].join(", "))
      .eq("tenant_id", tenantId)
      .eq("session_id", sessionId)
      .order("occurred_at", { ascending: false })
      .limit(limit)) as Rows;

    if (result.error || !result.data) return [];
    return result.data.slice().reverse(); // chronological order
  } catch {
    return [];
  }
}
