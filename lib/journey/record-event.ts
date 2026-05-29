/**
 * Record Journey Event
 *
 * Writes a single behavioral event to visitor_journey_events, then
 * asynchronously rebuilds visitor_behavior_state.
 *
 * ─── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   // In an API route or after() hook — fire-and-forget:
 *   void recordJourneyEvent({
 *     tenantId:   "mister-chameleon",
 *     sessionId:  "...",
 *     eventType:  "page_view",
 *     eventValue: "/pricing",
 *     pagePath:   "/pricing",
 *   });
 *
 * ─── Performance contract ─────────────────────────────────────────────────────
 *
 *   recordJourneyEvent() itself is async but should be awaited only when
 *   the caller specifically needs the insert to have completed (rare).
 *
 *   updateBehaviorState() is ALWAYS called fire-and-forget inside this function
 *   — it runs after the response and never blocks page render.
 *
 * ─── Deduplication ────────────────────────────────────────────────────────────
 *
 *   When the caller provides an `eventId`, the insert uses ON CONFLICT DO NOTHING
 *   on the `event_id` column.  This means:
 *
 *     • A retried event that already landed in the DB is silently ignored.
 *     • The 201 response still fires on the retry; the client marks it synced.
 *     • No duplicate rows in visitor_journey_events — ever.
 *
 *   When no `eventId` is provided (server-side events, old clients), the DB
 *   auto-generates one via DEFAULT and a plain insert is used.
 *
 * ─── occurred_at accuracy ─────────────────────────────────────────────────────
 *
 *   When the caller provides `occurredAt`, it is used as `occurred_at` instead
 *   of the server receive time.  This is critical for events in the retry queue:
 *
 *     Client fires event → network failure → 30 seconds later retry succeeds
 *
 *   Without client timestamp: occurred_at = retry receive time (30s later)
 *   With client timestamp:    occurred_at = actual event time     ← correct
 *
 *   Recency scoring and sequence detection both depend on accurate timestamps.
 *
 * ─── Never throws ─────────────────────────────────────────────────────────────
 *
 *   All errors are swallowed and logged at debug level.
 *   Tracking failures must never degrade the user experience.
 */

import { getDb }                from "@/data/db";
import { logger }               from "@/lib/logger";
import { updateBehaviorState }  from "./update-behavior-state";
import type { JourneyEventInput } from "./types";

// ── Type helpers ──────────────────────────────────────────────────────────────
//
// visitor_journey_events is a new table not yet in generated Supabase types.
// Cast to `any` so the typed client accepts the table name.

type InsertResult = { error?: { message: string } | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbAny() { return getDb() as any; }

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Inserts a journey event and asynchronously updates the behavior state.
 *
 * When `input.eventId` is provided, uses ON CONFLICT DO NOTHING so retries
 * are safely idempotent.  When omitted, uses a plain insert (DB generates UUID).
 *
 * @returns true on successful insert (or silent dedup), false on error.
 */
export async function recordJourneyEvent(
  input: JourneyEventInput,
): Promise<boolean> {
  try {
    const db = dbAny();

    // ── Build metadata ────────────────────────────────────────────────────────
    //
    // Merge visitor_id into metadata when provided so it can be queried even
    // without a dedicated DB column.  visitor_id is the stable localStorage UUID
    // that identifies the same person across browser sessions.
    const baseMetadata: Record<string, unknown> = input.metadata ?? {};
    const metadata: Record<string, unknown> =
      input.visitorId
        ? { ...baseMetadata, visitor_id: input.visitorId }
        : baseMetadata;

    // ── occurred_at resolution ────────────────────────────────────────────────
    //
    // Prefer the client-provided timestamp (actual event time).
    // Fall back to server receive time when unavailable.
    const occurredAt = input.occurredAt ?? new Date().toISOString();

    // ── Build the insert row ──────────────────────────────────────────────────
    //
    // visitor_id is written directly into the row (migration 0122 added it as
    // a nullable column) AND kept in metadata for backward compatibility with
    // any queries that read from metadata->>'visitor_id'.
    const row: Record<string, unknown> = {
      tenant_id:     input.tenantId,
      session_id:    input.sessionId,
      occurred_at:   occurredAt,
      event_type:    input.eventType,
      event_value:   input.eventValue   ?? null,
      page_path:     input.pagePath     ?? null,
      page_category: input.pageCategory ?? null,
      page_keywords: input.pageKeywords ?? [],
      source:        input.source       ?? null,
      medium:        input.medium       ?? null,
      campaign:      input.campaign     ?? null,
      visitor_id:    input.visitorId    ?? null,
      metadata,
    };

    let result: InsertResult;

    if (input.eventId) {
      // ── Idempotent upsert when event_id is known ──────────────────────────
      //
      // ON CONFLICT (event_id) DO NOTHING — duplicate rows are silently
      // discarded.  This handles:
      //   • Retried events that already landed on the first attempt.
      //   • React Strict Mode double-invoke (should be caught client-side too).
      //   • Any other scenario that triggers a second send with the same UUID.
      //
      // The `ignoreDuplicates: true` + `onConflict: 'event_id'` options
      // translate to `ON CONFLICT (event_id) DO NOTHING` in SQL.
      row["event_id"] = input.eventId;
      result = (await db
        .from("visitor_journey_events")
        .upsert(row, { onConflict: "event_id", ignoreDuplicates: true })) as InsertResult;
    } else {
      // ── Plain insert when no client UUID provided ─────────────────────────
      //
      // DB DEFAULT (gen_random_uuid()) fires for event_id.
      // Used for server-side events and very old client versions.
      result = (await db
        .from("visitor_journey_events")
        .insert(row)) as InsertResult;
    }

    if (result.error) {
      logger.debug("[record-journey-event] insert failed", {
        tenantId:  input.tenantId,
        sessionId: input.sessionId,
        eventType: input.eventType,
        error:     result.error.message,
      });
      return false;
    }

    logger.debug("[record-journey-event] event recorded", {
      tenantId:    input.tenantId,
      sessionId:   input.sessionId,
      eventType:   input.eventType,
      eventValue:  input.eventValue,
      occurredAt,
      hasEventId:  !!input.eventId,
      hasVisitorId: !!input.visitorId,
    });

    // ── Async state rebuild — fire-and-forget ─────────────────────────────
    //
    // updateBehaviorState runs after the insert completes but is never
    // awaited by the caller.  A failed state update is non-fatal; the next
    // event will trigger another rebuild.
    void updateBehaviorState(input.sessionId, input.tenantId).catch((err) => {
      logger.debug("[record-journey-event] state update failed", {
        tenantId:  input.tenantId,
        sessionId: input.sessionId,
        error:     err instanceof Error ? err.message : String(err),
      });
    });

    return true;
  } catch (err) {
    logger.debug("[record-journey-event] unexpected error", {
      tenantId:  input.tenantId,
      sessionId: input.sessionId,
      error:     err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
