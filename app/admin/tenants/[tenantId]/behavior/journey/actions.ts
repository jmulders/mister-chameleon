"use server";

/**
 * Journey Insight Admin — Server Actions
 *
 * Provides data for the behavioral visualization layer at:
 *   /admin/tenants/[tenantId]/behavior/journey
 *
 * Two actions:
 *   fetchRecentJourneySessionsAction  — list sessions with journey activity
 *   fetchSessionJourneyAction         — fetch full state + events for one session
 *
 * All reads are tenant-scoped and require admin authentication.
 */

import {
  getRequiredAdminSession,
  assertTenantAccess,
} from "@/lib/admin-auth/authorization";
import { fetchJourneyState, fetchRecentJourneyEvents } from "@/lib/journey/fetch-journey-state";
import { getCrmIdentityBySession } from "@/data/repositories/crm-identity-repository";
import { detectSequences }         from "@/lib/journey/detect-sequences";
import { getDb }   from "@/data/db";
import { logger }  from "@/lib/logger";
import type { JourneyState, JourneyEventRow, SequencePattern } from "@/lib/journey/types";
import type { SequenceDetectionResult }        from "@/lib/journey/detect-sequences";
import type { VisitorCrmIdentity }             from "@/lib/crm/types";

// ── DB helper ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbAny() { return getDb() as any; }

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Summary of a session that has generated journey data.
 * Used to populate the "recent sessions" picker.
 */
export interface JourneySessionSummary {
  sessionId:       string;
  funnelStage:     string;
  intentScore:     number;
  frictionScore:   number;
  confidenceBand:  string;
  pageViewCount:   number;
  firstSeenAt:     string | null;
  lastSeenAt:      string | null;
  matchedSequences:string[];
  /** Traffic source from the originating sessions row, e.g. "google", "linkedin", "direct" */
  source:          string | null;
  /** Device class from the originating sessions row: "mobile" | "desktop" */
  device:          string | null;
}

export interface SessionJourneyPayload {
  sessionId:    string;
  journey:      JourneyState;
  events:       JourneyEventRow[];
  /** CRM identity mapping for this session — null when not yet resolved. */
  crmIdentity:  VisitorCrmIdentity | null;
  /**
   * Rich sequence detection result computed from ALL session events + active patterns.
   * Contains matchDetails (with matchPath + timing) and nearMisses (with blockedReason).
   * Null when no sequence patterns are defined for this tenant.
   */
  sequenceDetection: SequenceDetectionResult | null;
}

// ── Action: recent sessions ───────────────────────────────────────────────────

/**
 * Returns the most recently active sessions that have behavior state rows
 * for this tenant.  Used to populate the session picker.
 */
export async function fetchRecentJourneySessionsAction(
  tenantId: string,
  limit    = 20,
): Promise<JourneySessionSummary[]> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  try {
    const db = dbAny();

    type Row = {
      session_id:        string;
      funnel_stage:      string;
      intent_score:      number;
      friction_score?:   number | null;
      funnel_stage_confidence: number;
      page_view_count:   number;
      first_seen_at:     string | null;
      last_seen_at:      string | null;
      matched_sequences: string[];
    };

    const res = (await db
      .from("visitor_behavior_state")
      .select([
        "session_id",
        "funnel_stage",
        "intent_score",
        "friction_score",
        "funnel_stage_confidence",
        "page_view_count",
        "first_seen_at",
        "last_seen_at",
        "matched_sequences",
      ].join(", "))
      .eq("tenant_id", tenantId)
      .order("last_seen_at", { ascending: false })
      .limit(limit)) as { data: Row[] | null; error: { message: string } | null };

    if (res.error || !res.data) {
      console.error("[fetchRecentJourneySessionsAction] query failed", res.error?.message);
      return [];
    }

    // ── Secondary lookup: source + device from sessions table ────────────────
    // The sessions table has source/device but no tenant_id — so we join via
    // the session UUIDs we already have.  Ignore failures (sessions may not
    // exist for older behavior rows written before the sessions table).
    const sessionIds = res.data.map((r) => r.session_id);
    type SessionRow = { id: string; source: string; device: string };
    let sessionMeta: Map<string, SessionRow> = new Map();
    try {
      const metaRes = (await db
        .from("sessions")
        .select("id, source, device")
        .in("id", sessionIds)) as { data: SessionRow[] | null; error: unknown };
      if (metaRes.data) {
        for (const s of metaRes.data) sessionMeta.set(s.id, s);
      }
    } catch {
      // Non-fatal: older rows may have no sessions entry
    }

    return res.data.map((row): JourneySessionSummary => {
      // Derive confidence band from funnel_stage_confidence stored in the row.
      // The full computeBehaviorConfidence() is not called here for perf;
      // we use a simplified band mapping for the list view.
      const fc = Number(row.funnel_stage_confidence) || 0;
      const band =
        fc >= 0.75 ? "very_high" :
        fc >= 0.55 ? "high" :
        fc >= 0.35 ? "medium" : "low";

      const meta = sessionMeta.get(row.session_id);

      return {
        sessionId:        row.session_id,
        funnelStage:      row.funnel_stage ?? "awareness",
        intentScore:      row.intent_score ?? 0,
        frictionScore:    row.friction_score ?? 0,
        confidenceBand:   band,
        pageViewCount:    row.page_view_count ?? 0,
        firstSeenAt:      row.first_seen_at ?? null,
        lastSeenAt:       row.last_seen_at ?? null,
        matchedSequences: row.matched_sequences ?? [],
        source:           meta?.source ?? null,
        device:           meta?.device ?? null,
      };
    });
  } catch (err) {
    logger.error("[journey-insight/actions] fetchRecentJourneySessions failed", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetches ALL journey events for a session (no row limit).
 * Used for sequence detection which requires the complete event stream.
 */
async function fetchAllSessionEvents(
  sessionId: string,
  tenantId:  string,
): Promise<JourneyEventRow[]> {
  try {
    const db = dbAny();
    type Rows = { data: JourneyEventRow[] | null; error: { message: string } | null };
    const result = (await db
      .from("visitor_journey_events")
      .select([
        "id", "event_id", "tenant_id", "session_id", "occurred_at",
        "event_type", "event_value", "page_path", "page_category",
        "page_keywords", "source", "medium", "campaign", "metadata",
      ].join(", "))
      .eq("tenant_id", tenantId)
      .eq("session_id", sessionId)
      .order("occurred_at", { ascending: true })) as Rows;

    return result.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetches active sequence patterns for a tenant.
 * Used to re-run detect-sequences at admin-request time for rich debug output.
 */
async function fetchSequencePatterns(tenantId: string): Promise<SequencePattern[]> {
  try {
    const db = dbAny();
    type Rows = { data: SequencePattern[] | null; error: { message: string } | null };
    const result = (await db
      .from("behavior_sequence_patterns")
      .select("*")
      .eq("tenant_id", tenantId)) as Rows;
    return result.data ?? [];
  } catch {
    return [];
  }
}

// ── Action: single session journey ────────────────────────────────────────────

/**
 * Fetches the full journey state + recent events for a specific session.
 * Also runs detect-sequences on all events + patterns for rich debug output.
 * Returns null when no data exists for the session.
 */
export async function fetchSessionJourneyAction(
  tenantId:  string,
  sessionId: string,
): Promise<SessionJourneyPayload | null> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  try {
    const [journey, allEvents, recentEvents, crmResult, patterns] = await Promise.all([
      fetchJourneyState(sessionId, tenantId),
      fetchAllSessionEvents(sessionId, tenantId),    // all events for sequence detection
      fetchRecentJourneyEvents(sessionId, tenantId, 30), // recent events for timeline display
      getCrmIdentityBySession(sessionId, tenantId),
      fetchSequencePatterns(tenantId),
    ]);

    // emptyJourneyState has fromDatabase=false — treat that as "no data"
    if (!journey.fromDatabase) return null;

    const crmIdentity = crmResult.ok ? crmResult.data : null;

    // ── Rich sequence detection ───────────────────────────────────────────────
    //
    // Re-run detectSequences with ALL session events and the current pattern
    // definitions.  This gives us matchPath (step-by-step event trail) and
    // nearMisses (blocked reason) that are not persisted in visitor_behavior_state.
    //
    // Note: this re-derives the result at request time; it may differ from the
    // stored matched_sequences when patterns have been edited since the last
    // updateBehaviorState() run.
    const sequenceDetection = patterns.length > 0
      ? detectSequences(allEvents, patterns)
      : null;

    return { sessionId, journey, events: recentEvents, crmIdentity, sequenceDetection };
  } catch (err) {
    logger.error("[journey-insight/actions] fetchSessionJourney failed", {
      tenantId,
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
