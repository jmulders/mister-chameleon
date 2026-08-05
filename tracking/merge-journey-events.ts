/**
 * Journey Event Merge Algorithm
 *
 * Provides a deterministic, conflict-free strategy for combining the client-side
 * optimistic event store with the persisted backend event log.
 *
 * ─── Why merging is necessary ─────────────────────────────────────────────────
 *
 *   The local store (window.__journey) reflects events immediately.
 *   The backend reflects events only after the async DB write + state rebuild.
 *   Without merging: the debug panel flips back to "No data" after a refetch
 *   that arrives before the DB write completes, and local events disappear.
 *
 * ─── Merge algorithm (O(n)) ──────────────────────────────────────────────────
 *
 *   1. Index all backend events by event_id → Map<eventId, MergedEvent>
 *   2. For each local event:
 *      a. If event_id is in the backend index → mark source as "both",
 *         update sync status to "confirmed" (DB write completed).
 *      b. If not in index → add as local-only (source: "local").
 *   3. Collect all backend events not seen locally (source: "backend").
 *   4. Sort final list by occurred_at ascending (stable).
 *
 *   Invariants:
 *   • Each event_id appears at most once in the output.
 *   • Backend events are never discarded — they represent durable truth.
 *   • Local events are never discarded on fetch — they stay until explicitly
 *     replaced or the session ends.
 *   • Source = "both" means the event is confirmed in both places.
 *
 * ─── Client-side state derivation ────────────────────────────────────────────
 *
 *   `deriveClientState()` recomputes behavioral state from the merged event
 *   list without any DB calls.  It can compute:
 *
 *     ✓ Flags: hasVisitedPricing, hasVisitedAbout, etc.
 *     ✓ Counts: pageViewCount, ctaClickCount, etc.
 *     ✓ engagementScore (pure formula)
 *     ✓ recencyScore (from last_seen_at, uses apply-decay)
 *     ✓ funnelStage (from flags + available scores)
 *     ✓ confidence (from deriveFunnelStage + intentConfidence heuristic)
 *
 *   It CANNOT compute without DB data:
 *     ✗ intentScore (needs scoring rules + decay profiles)
 *     ✗ sequenceScore (needs sequence pattern definitions)
 *     ✗ matchedSequences (same)
 *
 *   Strategy for server-provided scores:
 *     → intentScore:    keep server value if available; else 0
 *     → sequenceScore:  keep server value if available; else 0
 *     → matchedSequences: keep server value if available; else []
 *
 *   Scores NEVER regress: if derived values exceed server values, take the max.
 *
 * ─── Pure functions — no I/O ──────────────────────────────────────────────────
 *
 *   All exports are pure.  Safe to call in both server and client contexts.
 *   Imports only pure lib functions (apply-decay, derive-funnel-stage,
 *   compute-confidence) which themselves have no DB calls.
 */

import type { JourneyEventRow, JourneyState, JourneyFunnelStage } from "@/lib/journey/types";
import type { LocalJourneyEvent, SyncStatus }                     from "@/tracking/journey-store";
import {
  computeRecencyScore,
  computeRepeatSessionBonus,
  partitionEventsByAge,
} from "@/lib/journey/apply-decay";
import { deriveFunnelStage }     from "@/lib/journey/derive-funnel-stage";
import { computeBehaviorConfidence } from "@/lib/journey/compute-confidence";

// ── Merged event type ─────────────────────────────────────────────────────────

/** Where the event originated: local store only, backend only, or both. */
export type EventSource = "local" | "backend" | "both";

/**
 * Sync status from the perspective of the merged view.
 *
 *   pending    — sent to server, waiting for response
 *   synced     — 201 received; in the DB
 *   failed     — network error or 5xx; not in DB; eligible for retry
 *   suppressed — server returned suppressed=true (consent denied); not in DB; no retry
 *   confirmed  — present in the backend event log (source is "backend" or "both")
 */
export type MergedSyncStatus = SyncStatus | "confirmed";
// "confirmed" = event is present in the DB (source is "backend" or "both")

/** Canonical unified event shape used by the merge algorithm and debug panel. */
export interface MergedEvent {
  /** Canonical dedup UUID — same field as visitor_journey_events.event_id. */
  eventId:      string;
  eventType:    string;
  occurredAt:   string;
  eventValue:   string | null;
  pagePath:     string | null;
  pageCategory: string | null;
  /** Where this event came from. */
  source:       EventSource;
  /** Lifecycle status relative to the DB. */
  syncStatus:   MergedSyncStatus;
  /** Full payload from the local store (undefined for backend-only events). */
  localPayload?: Record<string, unknown>;
}

// ── Merge algorithm ───────────────────────────────────────────────────────────

/**
 * Merges local optimistic events with backend DB events into a single
 * deduplicated, chronologically-sorted list.
 *
 * Algorithm is O(n + m) using a Map index on eventId.
 *
 * @param localEvents    Events from window.__journey (optimistic store).
 * @param backendEvents  Events from /api/journey/state (DB, most recent 20).
 * @returns              Deduplicated, chronologically-sorted merged list.
 */
export function mergeJourneyEvents(
  localEvents:   LocalJourneyEvent[],
  backendEvents: JourneyEventRow[],
): MergedEvent[] {

  // Step 1: Index backend events by event_id → O(m)
  const backendIndex = new Map<string, JourneyEventRow>();
  for (const ev of backendEvents) {
    backendIndex.set(ev.event_id, ev);
  }

  // Step 2: Index local events by eventId → O(n)
  const localIndex = new Map<string, LocalJourneyEvent>();
  for (const ev of localEvents) {
    localIndex.set(ev.eventId, ev);
  }

  const result = new Map<string, MergedEvent>();

  // Step 3: Process all backend events (authoritative baseline).
  for (const bev of backendEvents) {
    const localMatch = localIndex.get(bev.event_id);
    result.set(bev.event_id, {
      eventId:      bev.event_id,
      eventType:    bev.event_type,
      occurredAt:   bev.occurred_at,
      eventValue:   bev.event_value,
      pagePath:     bev.page_path,
      pageCategory: bev.page_category,
      source:       localMatch ? "both" : "backend",
      syncStatus:   "confirmed",
      localPayload: localMatch?.payload,
    });
  }

  // Step 4: Add local events that are NOT yet in the backend.
  for (const lev of localEvents) {
    if (result.has(lev.eventId)) continue; // already covered above

    // Prefer `page_path` (canonical key sent by PageTracker) over the legacy
    // `pathname` alias.  Non-page_view events (cta_click, download, etc.)
    // often carry neither key — pagePath stays null in those cases.
    const pagePath =
      typeof lev.payload["page_path"] === "string" ? lev.payload["page_path"]
      : typeof lev.payload["pathname"] === "string" ? lev.payload["pathname"]
      : null;

    result.set(lev.eventId, {
      eventId:      lev.eventId,
      eventType:    lev.eventType,
      occurredAt:   lev.occurredAt,
      eventValue:   pagePath,
      pagePath,
      pageCategory: typeof lev.payload["page_category"] === "string"
        ? lev.payload["page_category"] : null,
      source:       "local",
      syncStatus:   lev.syncStatus,
      localPayload: lev.payload,
    });
  }

  // Step 5: Sort by occurred_at ascending (stable chronological order).
  return Array.from(result.values()).sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  );
}

// ── Merge statistics ──────────────────────────────────────────────────────────

export interface MergeStats {
  /** Total unique events after deduplication. */
  total:       number;
  /** Events present only in the local store (pending/failed/suppressed). */
  localOnly:   number;
  /** Events present only in the backend (older than local store window). */
  backendOnly: number;
  /**
   * Events confirmed in the DB — either source="backend" or source="both".
   * NOTE: this used to double-count source="both" AND syncStatus="confirmed".
   * The correct metric is: how many events exist in the backend?
   */
  confirmed:   number;
  /** Local events with syncStatus = "pending". */
  pending:     number;
  /** Local events with syncStatus = "failed" (eligible for retry). */
  failed:      number;
  /** Local events with syncStatus = "suppressed" (consent denied; will not retry). */
  suppressed:  number;
}

export function computeMergeStats(merged: MergedEvent[]): MergeStats {
  let localOnly   = 0;
  let backendOnly = 0;
  let confirmed   = 0;
  let pending     = 0;
  let failed      = 0;
  let suppressed  = 0;

  for (const ev of merged) {
    // Source counts — mutually exclusive.
    if (ev.source === "local")   localOnly++;
    if (ev.source === "backend") backendOnly++;
    // "both" and "backend" both mean the event is confirmed in the DB.
    if (ev.source === "backend" || ev.source === "both") confirmed++;

    // Sync status of local events (source="local" or "both").
    if (ev.syncStatus === "pending")    pending++;
    if (ev.syncStatus === "failed")     failed++;
    if (ev.syncStatus === "suppressed") suppressed++;
    // "confirmed" syncStatus is equivalent to source="both"/"backend" — already counted above.
  }

  return { total: merged.length, localOnly, backendOnly, confirmed, pending, failed, suppressed };
}

// ── Page path helpers (mirrors derive-behavior-state.ts) ─────────────────────

function isAboutPath(path: string | null): boolean {
  if (!path) return false;
  return /^\/about(\/|$)/i.test(path) || path === "/over-ons";
}

function isPricingPath(path: string | null): boolean {
  if (!path) return false;
  return /^\/pricing(\/|$)/i.test(path) || /^\/tarieven(\/|$)/i.test(path);
}

function isCasesPath(path: string | null): boolean {
  if (!path) return false;
  return /^\/cases?(\/|$)/i.test(path) || /^\/portfolio(\/|$)/i.test(path);
}

function isContactPath(path: string | null): boolean {
  if (!path) return false;
  return /^\/contact(\/|$)/i.test(path);
}

// ── Client-side state derivation ──────────────────────────────────────────────

/**
 * The state derived client-side from merged events.
 * Shape-compatible with JourneyState so the debug panel can use the same
 * display components regardless of whether state came from DB or local events.
 */
export type ClientDerivedState = JourneyState & {
  /** Always false — this state was not loaded from the DB. */
  fromDatabase: false;
  /** True when at least one event in the merged list is from the local store. */
  hasLocalEvents: boolean;
};

/**
 * Derives behavioral state from merged events without any DB calls.
 *
 * Intent score and sequence data are taken from the server state when
 * available and NEVER regressed (take max of server vs. computed).
 *
 * @param merged        Output of mergeJourneyEvents().
 * @param serverJourney Optional server-loaded journey state for intent/sequences.
 */
export function deriveClientState(
  merged:        MergedEvent[],
  serverJourney: JourneyState | null,
): ClientDerivedState {

  // ── Aggregate flags and counts ────────────────────────────────────────────

  let firstSeenAt:  string | null = null;
  let lastSeenAt:   string | null = null;
  let pageViewCount   = 0;
  let ctaClickCount   = 0;
  let formStartCount  = 0;
  let formSubmitCount = 0;
  let downloadCount   = 0;
  let hasVisitedAbout   = false;
  let hasVisitedPricing = false;
  let hasVisitedCases   = false;
  let hasVisitedContact = false;
  let hasClickedCta     = false;
  let hasSubmittedForm  = false;

  const viewedCatSet  = new Set<string>();
  const viewedKwdSet  = new Set<string>();

  for (const ev of merged) {
    if (!firstSeenAt || ev.occurredAt < firstSeenAt) firstSeenAt = ev.occurredAt;
    if (!lastSeenAt  || ev.occurredAt > lastSeenAt)  lastSeenAt  = ev.occurredAt;

    if (ev.pageCategory) viewedCatSet.add(ev.pageCategory);

    switch (ev.eventType) {
      case "page_view":
        pageViewCount++;
        if (isAboutPath(ev.pagePath))   hasVisitedAbout   = true;
        if (isPricingPath(ev.pagePath)) hasVisitedPricing = true;
        if (isCasesPath(ev.pagePath))   hasVisitedCases   = true;
        if (isContactPath(ev.pagePath)) hasVisitedContact = true;
        break;
      case "cta_click":
        ctaClickCount++;
        hasClickedCta = true;
        break;
      case "form_start":
        formStartCount++;
        break;
      case "form_submit":
        formSubmitCount++;
        hasSubmittedForm = true;
        break;
      case "download":
        downloadCount++;
        break;
    }
  }

  // Carry over keywords from server (not reconstructible from local payload).
  if (serverJourney) {
    for (const kw of serverJourney.viewedKeywords) viewedKwdSet.add(kw);
    for (const cat of serverJourney.viewedCategories) viewedCatSet.add(cat);
    // Carry flags forward (server may have seen more events than local cap).
    hasVisitedAbout   = hasVisitedAbout   || serverJourney.hasVisitedAbout;
    hasVisitedPricing = hasVisitedPricing || serverJourney.hasVisitedPricing;
    hasVisitedCases   = hasVisitedCases   || serverJourney.hasVisitedCases;
    hasVisitedContact = hasVisitedContact || serverJourney.hasVisitedContact;
    hasClickedCta     = hasClickedCta     || serverJourney.hasClickedCta;
    hasSubmittedForm  = hasSubmittedForm  || serverJourney.hasSubmittedForm;
    // NOTE: counts (pageViewCount, ctaClickCount, etc.) are intentionally NOT
    // merged from serverJourney here.  The local store reflects the current
    // browser session; showing lifetime DB totals (which can be hundreds of
    // views from past sessions) would freeze the counter at the historical
    // value and make it appear broken.  The Live State panel is a session-scoped
    // view — it shows what has accumulated in this tab since the page loaded.
  }

  // ── Compute scores ────────────────────────────────────────────────────────

  // engagementScore: pure formula, no DB needed.
  const rawEngagement =
    pageViewCount   * 5  +
    ctaClickCount   * 15 +
    downloadCount   * 10 +
    formStartCount  * 10;
  const engagementScore = Math.min(100, Math.round(rawEngagement));

  // recencyScore: pure decay from lastSeenAt.
  const recencyScore = computeRecencyScore(lastSeenAt);

  // intentScore / sequenceScore: keep server values (never regress).
  const intentScore     = Math.max(0, serverJourney?.intentScore     ?? 0);
  const sequenceScore   = Math.max(0, serverJourney?.sequenceScore   ?? 0);
  const matchedSequences= serverJourney?.matchedSequences ?? [];

  // ── v2: short/long-term scoring and repeat-session bonus ─────────────────
  // Client-side: we use server values if available (they have rules/patterns),
  // otherwise fall back to heuristics from the merged event timestamps.

  const shortTermIntentScore  = serverJourney?.shortTermIntentScore  ?? 0;
  const longTermAffinityScore = serverJourney?.longTermAffinityScore ?? 0;
  const intentFreshness       = serverJourney?.intentFreshness       ?? 0;
  const sequenceMatchedAt     = serverJourney?.sequenceMatchedAt     ?? null;

  // Repeat-session bonus can be derived client-side from merged timestamps.
  // Convert MergedEvent list to pseudo-JourneyEventRow list for partitioning.
  const asEventRows: JourneyEventRow[] = merged.map((e) => ({
    id:            e.eventId,
    event_id:      e.eventId,
    tenant_id:     "",
    session_id:    "",
    occurred_at:   e.occurredAt,
    event_type:    e.eventType,
    event_value:   e.eventValue,
    page_path:     e.pagePath,
    page_category: e.pageCategory,
    page_keywords: null,
    source:        null,
    medium:        null,
    campaign:      null,
    metadata:      {},
  }));
  const repeatSessionBonus = Math.max(
    serverJourney?.repeatSessionBonus ?? 0,
    computeRepeatSessionBonus(asEventRows),
  );

  // ── Funnel stage ──────────────────────────────────────────────────────────

  const { stage, confidence: stageConf } = deriveFunnelStage({
    intentScore,
    engagementScore,
    hasVisitedPricing,
    hasVisitedAbout,
    hasVisitedCases,
    hasVisitedContact,
    hasSubmittedForm,
    formStartCount,
    pageViewCount,
    matchedSequences,
    shortTermIntentScore,
    longTermAffinityScore,
    repeatSessionBonus,
    sequenceMatchedAt,
  });

  // ── Assemble JourneyState-shaped object ───────────────────────────────────

  const draft: Omit<ClientDerivedState, "confidence"> & { confidence?: ClientDerivedState["confidence"] } = {
    firstSeenAt,
    lastSeenAt,
    pageViewCount,
    ctaClickCount,
    formStartCount,
    formSubmitCount,
    downloadCount,
    hasVisitedAbout,
    hasVisitedPricing,
    hasVisitedCases,
    hasVisitedContact,
    hasClickedCta,
    hasSubmittedForm,
    viewedCategories:      Array.from(viewedCatSet),
    viewedKeywords:        Array.from(viewedKwdSet),
    recencyScore,
    engagementScore,
    intentScore,
    sequenceScore,
    shortTermIntentScore,
    longTermAffinityScore,
    intentFreshness,
    sequenceMatchedAt,
    repeatSessionBonus,
    funnelStage:           stage as JourneyFunnelStage,
    funnelStageConfidence: stageConf,
    matchedSequences,
    fromDatabase:          false,
    hasLocalEvents:        merged.some((e) => e.source === "local" || e.source === "both"),
    // v3 anti-noise fields — carried from serverJourney when available.
    // The client-side merge cannot recompute noise analysis (no weighted events),
    // so these values are always the server-computed values or 0.
    frictionScore:            serverJourney?.frictionScore            ?? 0,
    signalDiversityScore:     serverJourney?.signalDiversityScore     ?? 0,
    uniqueSignalCount:        serverJourney?.uniqueSignalCount        ?? 0,
    burstPenalty:             serverJourney?.burstPenalty             ?? 0,
    deduplicatedEventCount:   serverJourney?.deduplicatedEventCount   ?? 0,
    // Sequence engine v2 — carry from server; not recomputable client-side.
    sequenceConfidenceContribution: serverJourney?.sequenceConfidenceContribution ?? 0,
    // Rule-written sticky context — carry from server; the client merge never
    // writes it (sticky persistence is server-side only).
    ruleContext:              serverJourney?.ruleContext ?? {},
  };

  // Compute confidence from the derived state.
  const full = draft as ClientDerivedState;
  full.confidence = computeBehaviorConfidence(full);

  return full;
}
