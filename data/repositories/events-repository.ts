/**
 * Events Repository
 *
 * Encapsulates all database access for the `events` table.
 * Events are lightweight named occurrences tied to a session —
 * e.g. "page_view", "cta_click", "form_submit".
 *
 * ─── Table schema ─────────────────────────────────────────────────────────────
 *
 *   events (
 *     id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     session_id uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 *     created_at timestamptz NOT NULL DEFAULT now(),
 *     event_type text        NOT NULL,
 *     payload    jsonb       NOT NULL DEFAULT '{}'::jsonb
 *   )
 *
 * ─── Relationship ─────────────────────────────────────────────────────────────
 *
 *   events.session_id → sessions.id (FK, ON DELETE CASCADE)
 *
 *   Multiple events can be written for one session over the visitor's
 *   lifecycle — page view on load, CTA click if they engage, etc.
 *
 * ─── Payload convention ───────────────────────────────────────────────────────
 *
 *   `payload` is an open-ended JSON object. Keep keys snake_case and
 *   prefer flat structures for easy querying in Supabase / Postgres:
 *
 *     { variant_key: "hero_google_problem", position: "above_fold" }
 *
 *   The database defaults payload to {} so callers can omit it for events
 *   that carry no additional metadata.
 *
 * ─── Tenant scoping ───────────────────────────────────────────────────────────
 *
 *   Tenant ID is stored inside the `payload` JSONB under the reserved key
 *   `_tid` rather than in a dedicated `tenant_id` column.  This avoids
 *   requiring the schema migration (20240101000008) to be applied before
 *   tenant-scoped tracking works.
 *
 *   Read path: `fetchVisitorHistory` filters rows where `payload._tid`
 *   matches the active tenant, or is absent (legacy rows are visible to all).
 *
 *   Once migration 20240101000008 is applied to the project's Supabase
 *   database, the `_tid` payload key can be retired in favour of the
 *   dedicated `tenant_id` column.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   Returns a `RepositoryResult<T>` — never throws. Callers check `result.ok`.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { saveEvent } from "@/data/repositories/events-repository";
 *   import type { SaveEventInput } from "@/data/repositories/events-repository";
 */

import { getDb } from "../db";
import type { EventRow } from "../types";
import { logger } from "@/lib/logger";
import type { RepositoryResult } from "./sessions-repository";

// ── Input type ────────────────────────────────────────────────────────────────

/**
 * Data required to persist a named event for a session.
 */
export interface SaveEventInput {
  sessionId: string;
  /** Named event type. Use snake_case, e.g. "page_view" | "cta_click" */
  eventType: string;
  /**
   * Optional arbitrary metadata for the event.
   * Omit for events with no extra context — the database defaults to {}.
   */
  payload?: Record<string, unknown>;
  /**
   * Tenant slug this event belongs to, e.g. "mister-chameleon" | "workengine".
   * Stored inside the payload JSONB under the key `_tid` so no schema
   * migration is required. Omit for legacy/back-compat contexts.
   */
  tenantId?: string | null;
}

// ── Repository functions ───────────────────────────────────────────────────────

/**
 * Inserts a named event row for a given session.
 *
 * When `tenantId` is provided it is embedded in the `payload` object under
 * the reserved key `_tid`.  The `fetchVisitorHistory` function filters on
 * this key so events are correctly isolated per tenant without requiring
 * the dedicated `tenant_id` column migration to be applied first.
 *
 * @param input  Event data including the session ID and event type.
 * @returns      A `RepositoryResult` containing the created `EventRow`.
 */
export async function saveEvent(
  input: SaveEventInput,
): Promise<RepositoryResult<EventRow>> {
  // Merge tenant slug into the existing payload object under the reserved
  // "_tid" key.  This approach works on the current schema (no migration
  // required) and is transparent to callers — payload still behaves as a
  // plain event-metadata bag; "_tid" is simply an additional key.
  const payload: Record<string, unknown> = {
    ...(input.payload ?? {}),
    ...(input.tenantId ? { _tid: input.tenantId } : {}),
  };

  const { data, error } = await getDb()
    .from("events")
    .insert({
      session_id: input.sessionId,
      event_type: input.eventType,
      payload,
    })
    .select()
    .single();

  if (error) {
    logger.error("[events-repository] saveEvent failed", {
      error: error.message,
      code: error.code,
      sessionId: input.sessionId,
      eventType: input.eventType,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

/**
 * Retrieves the most recent events for a session, newest first.
 * Used by the debug page to display recent activity.
 *
 * @param sessionId  The session UUID.
 * @param limit      Maximum number of rows to return. Defaults to 10.
 */
export async function getRecentEventsBySession(
  sessionId: string,
  limit = 10,
): Promise<RepositoryResult<EventRow[]>> {
  const { data, error } = await getDb()
    .from("events")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("[events-repository] getRecentEventsBySession failed", {
      error: error.message,
      code: error.code,
      sessionId,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data ?? [] };
}
