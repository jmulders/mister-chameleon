/**
 * Update Behavior State
 *
 * Async pipeline that rebuilds visitor_behavior_state for a (tenant, session)
 * from raw journey events.
 *
 * ─── Call pattern ─────────────────────────────────────────────────────────────
 *
 *   Always called AFTER the HTTP response is sent — via Next.js `after()` or
 *   a fire-and-forget void call.  Never on the hot request path.
 *
 *   updateBehaviorState(sessionId, tenantId).catch(() => void 0);
 *
 * ─── Steps ────────────────────────────────────────────────────────────────────
 *
 *   1. Fetch all visitor_journey_events for (tenant, session).
 *   2. Fetch all behavior_scoring_rules for the tenant.
 *   3. Fetch all behavior_sequence_patterns for the tenant.
 *   4. Fetch decay_profiles.
 *   5. Derive the full BehaviorState via deriveBehaviorState() (CPU-only, no I/O).
 *   6. Upsert into visitor_behavior_state.
 *
 * ─── Failure handling ─────────────────────────────────────────────────────────
 *
 *   Never throws — all errors are logged at debug level and the function
 *   returns silently.  A failed state update is not critical; the next event
 *   will trigger another rebuild.
 */

import { getDb }               from "@/data/db";
import { logger }              from "@/lib/logger";
import { deriveBehaviorState } from "./derive-behavior-state";
import type {
  JourneyEventRow,
  ScoringRule,
  SequencePattern,
  DecayProfile,
} from "./types";

// New journey tables are not yet in generated Supabase types — cast to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbAny() { return getDb() as any; }

// ── Type helpers ──────────────────────────────────────────────────────────────

type Rows<T> = { data: T[] | null; error: { message: string } | null };

function asRows<T>(r: unknown): Rows<T> {
  return r as Rows<T>;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Rebuilds and upserts visitor_behavior_state for the given (tenant, session).
 * Always call fire-and-forget — do not await on the request path.
 */
export async function updateBehaviorState(
  sessionId: string,
  tenantId:  string,
): Promise<void> {
  // Skip for unresolved tenants (e.g. admin panel requests where tenant
  // context cannot be determined from the hostname).
  if (!tenantId || tenantId === "unknown") return;

  try {
    const db = dbAny();

    // ── Run data fetches concurrently ─────────────────────────────────────
    const [eventsResult, rulesResult, patternsResult, profilesResult] =
      await Promise.all([
        // 1. All journey events for this (tenant, session) — chronological
        asRows<JourneyEventRow>(
          await db
            .from("visitor_journey_events")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("session_id", sessionId)
            .order("occurred_at", { ascending: true }),
        ),
        // 2. Scoring rules for this tenant
        asRows<ScoringRule>(
          await db
            .from("behavior_scoring_rules")
            .select("*")
            .eq("tenant_id", tenantId),
        ),
        // 3. Sequence patterns for this tenant
        asRows<SequencePattern>(
          await db
            .from("behavior_sequence_patterns")
            .select("*")
            .eq("tenant_id", tenantId),
        ),
        // 4. Decay profiles (shared across all tenants)
        asRows<DecayProfile>(
          await db
            .from("decay_profiles")
            .select("slug, day_1, day_7, day_30, day_90"),
        ),
      ]);

    // ── Log and bail on errors ────────────────────────────────────────────
    if (eventsResult.error) {
      logger.warn("[update-behavior-state] events query failed", {
        sessionId, tenantId, error: eventsResult.error.message,
      });
      return;
    }

    if (rulesResult.error) {
      logger.warn("[update-behavior-state] scoring rules query failed", {
        sessionId, tenantId, error: rulesResult.error.message,
      });
    }

    if (patternsResult.error) {
      logger.warn("[update-behavior-state] sequence patterns query failed", {
        sessionId, tenantId, error: patternsResult.error.message,
      });
    }

    if (profilesResult.error) {
      logger.warn("[update-behavior-state] decay profiles query failed", {
        sessionId, tenantId, error: profilesResult.error.message,
      });
    }

    const events   = eventsResult.data   ?? [];
    const rules    = rulesResult.data    ?? [];
    const patterns = patternsResult.data ?? [];
    const rawProfiles = profilesResult.data ?? [];

    // ── Build profiles map ────────────────────────────────────────────────
    const profilesMap = new Map<string, DecayProfile>(
      rawProfiles.map((p) => [p.slug, p]),
    );

    // ── Derive state ──────────────────────────────────────────────────────
    const { row: derived, scoringDebug } = deriveBehaviorState({
      tenantId,
      sessionId,
      events,
      rules,
      patterns,
      profiles: profilesMap,
    });

    // scoringDebug is available here for callers that need it (e.g. debug API)
    void scoringDebug; // suppress unused warning in non-debug paths

    // ── Upsert into visitor_behavior_state ────────────────────────────────
    //
    // visitor_id: pull from the most recent event that carried one, falling
    // back to session_id as a surrogate.  The live DB has visitor_id NOT NULL
    // (schema drift); migration 0125 will drop that constraint, but until it
    // applies we must always supply a non-null UUID so the insert succeeds.
    const visitorIdFromEvents = events
      .slice()
      .reverse()
      .find((e) => (e.metadata as Record<string, unknown>)?.visitor_id)
      ?.metadata as Record<string, unknown> | undefined;
    const resolvedVisitorId =
      (visitorIdFromEvents?.visitor_id as string | undefined) ?? sessionId;

    const upsertPayload = {
      ...derived,
      visitor_id: resolvedVisitorId,
      updated_at: new Date().toISOString(),
    };

    const upsertResult = await db
      .from("visitor_behavior_state")
      .upsert(upsertPayload, {
        onConflict: "tenant_id,session_id",
        ignoreDuplicates: false,
      });

    const upsertErr = (upsertResult as { error?: { message: string } | null }).error;

    if (upsertErr) {
      logger.warn("[update-behavior-state] upsert failed", {
        sessionId,
        tenantId,
        error: upsertErr.message,
      });
      return;
    }

    logger.info("[update-behavior-state] state updated", {
      sessionId,
      tenantId,
      eventCount:                    events.length,
      intentScore:                   derived.intent_score,
      shortTermIntent:               derived.short_term_intent_score,
      longTermAffinity:              derived.long_term_affinity_score,
      intentFreshness:               derived.intent_freshness,
      funnelStage:                   derived.funnel_stage,
      matchedSeqs:                   derived.matched_sequences,
      sequenceMatchedAt:             derived.sequence_matched_at,
      sequenceConfidenceContrib:     derived.sequence_confidence_contribution,
      repeatSessionBonus:            derived.repeat_session_bonus,
    });
  } catch (err) {
    logger.warn("[update-behavior-state] unexpected error", {
      sessionId,
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
