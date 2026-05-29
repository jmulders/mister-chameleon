/**
 * Journey Store — client-side optimistic event store
 *
 * Maintains a lightweight in-memory event log in `window.__journey` so that
 * behavioral events are visible *immediately* — before the async DB write
 * completes.
 *
 * ─── Event identity ───────────────────────────────────────────────────────────
 *
 *   Every event gets a client-generated UUID (`eventId`) before it is sent
 *   to the server.  The same UUID is persisted in the DB (migration 0031:
 *   `visitor_journey_events.event_id`).  This lets the merge algorithm
 *   deduplicate by `eventId` rather than by timestamp+type heuristics.
 *
 *   The UUID is produced by `generateEventId()`, which uses the Web Crypto
 *   API (crypto.randomUUID) when available, and falls back to a
 *   mathematically equivalent RFC-4122 v4 construction using Math.random().
 *   Both variants produce strings that pass the server-side UUID regex.
 *
 * ─── Sync status ──────────────────────────────────────────────────────────────
 *
 *   Each local event tracks a `syncStatus`:
 *     pending    — POST /api/events sent, awaiting response
 *     synced     — 201 response received; event is confirmed in the DB
 *     failed     — non-2xx or network error; event may not be in the DB
 *     suppressed — 200 with suppressed=true; consent denied server-side;
 *                  event is NOT in the DB and will NOT be retried
 *
 *   `markSynced(eventId)` / `markFailed(eventId)` / `markSuppressed(eventId)`
 *   are called from `trackEvent()` once the fetch resolves.
 *
 * ─── Deduplication ────────────────────────────────────────────────────────────
 *
 *   `push()` checks for an existing event with the same eventId before
 *   inserting.  Duplicate pushes (React Strict Mode, effect re-fires) are
 *   silently ignored.
 *
 * ─── Retry ────────────────────────────────────────────────────────────────────
 *
 *   `retryFailed()` returns all failed events and resets their status to
 *   `"pending"` so trackEvent can re-send them.  It does NOT retry suppressed
 *   events (consent won't change mid-session).
 *
 * ─── IDs ─────────────────────────────────────────────────────────────────────
 *
 *   visitor_id   — stable across sessions, stored in localStorage.
 *   session_id   — per-tab, stored in sessionStorage. Resets on tab close.
 *                  Client-visible companion to the httpOnly mc_session_id cookie.
 *
 * ─── Capacity ─────────────────────────────────────────────────────────────────
 *
 *   The store keeps the last 100 events per session to avoid memory bloat.
 *
 * ─── SSR safety ───────────────────────────────────────────────────────────────
 *
 *   Every exported function guards `typeof window === "undefined"`.
 *   Safe to import in Server Components.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Sync lifecycle of a local event relative to the DB. */
export type SyncStatus = "pending" | "synced" | "failed" | "suppressed";

/** A single event held in the client-side optimistic store. */
export interface LocalJourneyEvent {
  /** Canonical dedup key — same UUID sent to server and stored in DB. */
  eventId:     string;
  eventType:   string;
  payload:     Record<string, unknown>;
  occurredAt:  string; // ISO 8601
  syncStatus:  SyncStatus;
  /** Number of times this event has been re-sent after a failure. */
  retryCount:  number;
}

/** The shape of `window.__journey`. */
export interface JourneyStore {
  visitorId:   string;
  sessionId:   string;
  events:      LocalJourneyEvent[];
  /** Append an event; initial status is always "pending". Ignores duplicate eventIds. */
  push(eventId: string, eventType: string, payload: Record<string, unknown>): void;
  /** Mark an event as successfully written to the DB (HTTP 201). */
  markSynced(eventId: string): void;
  /** Mark an event as failed to write (network error or 5xx). */
  markFailed(eventId: string): void;
  /**
   * Mark an event as consent-suppressed (HTTP 200 + suppressed=true).
   * Suppressed events are NOT retried — consent won't change mid-session.
   */
  markSuppressed(eventId: string): void;
  /** Reset all `failed` events to `pending` and return them for retry. */
  retryFailed(): LocalJourneyEvent[];
  /** Snapshot of all events (defensive copy). */
  getAll(): LocalJourneyEvent[];
  /** Only events with the given status. */
  getByStatus(status: SyncStatus): LocalJourneyEvent[];
}

// ── Global type augmentation ──────────────────────────────────────────────────

declare global {
  interface Window {
    __journey?: JourneyStore;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VISITOR_ID_KEY  = "mc_visitor_id";
const SESSION_ID_KEY  = "mc_client_session";
const MAX_EVENT_COUNT = 100;
/** Maximum times a failed event is retried before being abandoned. */
const MAX_RETRY_COUNT = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a UUID v4 using the Web Crypto API when available.
 *
 * Falls back to a Math.random()-based construction that produces a valid
 * RFC-4122 v4 UUID string (pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).
 * Both variants pass the server-side UUID regex `/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i`.
 *
 * IMPORTANT: the previous fallback used `${Date.now()}-${Math.random()}`
 * which does NOT match the UUID format → the server's regex rejects it →
 * the server auto-generates a new UUID → local eventId ≠ DB eventId →
 * the merge algorithm never matches, causing every event to appear as
 * "local-only" forever on older browsers.  This fallback fixes that.
 */
export function generateEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC-4122 v4 compliant fallback.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Reads key from storage; creates and persists a new UUID if absent. */
function getOrCreate(storage: Storage, key: string): string {
  let value = storage.getItem(key);
  if (!value) {
    value = generateEventId();
    storage.setItem(key, value);
  }
  return value;
}

// ── Store initialisation ──────────────────────────────────────────────────────

/**
 * Initialises `window.__journey` exactly once per page lifecycle.
 * Idempotent — safe to call multiple times.
 * No-op on the server (SSR).
 */
export function initJourneyStore(): void {
  if (typeof window === "undefined") return;
  if (window.__journey) return; // already initialised

  let visitorId: string;
  let sessionId: string;

  try {
    visitorId = getOrCreate(localStorage, VISITOR_ID_KEY);
  } catch {
    // localStorage blocked (private browsing, strict cookie policy, etc.)
    visitorId = generateEventId();
  }

  try {
    sessionId = getOrCreate(sessionStorage, SESSION_ID_KEY);
  } catch {
    sessionId = generateEventId();
  }

  window.__journey = {
    visitorId,
    sessionId,
    events: [],

    push(eventId, eventType, payload) {
      // ── Dedup: ignore pushes with a duplicate eventId ─────────────────────
      // Prevents double-counting from React Strict Mode double-invoke, or any
      // code path that calls trackEvent() twice with the same pre-generated ID.
      if (this.events.some((e) => e.eventId === eventId)) return;

      this.events.push({
        eventId,
        eventType,
        payload,
        occurredAt: new Date().toISOString(),
        syncStatus: "pending",
        retryCount: 0,
      });
      // Discard oldest events beyond the cap.
      if (this.events.length > MAX_EVENT_COUNT) {
        this.events = this.events.slice(-MAX_EVENT_COUNT);
      }
    },

    markSynced(eventId) {
      const ev = this.events.find((e) => e.eventId === eventId);
      if (ev) ev.syncStatus = "synced";
    },

    markFailed(eventId) {
      const ev = this.events.find((e) => e.eventId === eventId);
      if (ev) ev.syncStatus = "failed";
    },

    markSuppressed(eventId) {
      const ev = this.events.find((e) => e.eventId === eventId);
      if (ev) ev.syncStatus = "suppressed";
    },

    retryFailed() {
      const retryable = this.events.filter(
        (e) => e.syncStatus === "failed" && e.retryCount < MAX_RETRY_COUNT,
      );
      for (const ev of retryable) {
        ev.syncStatus = "pending";
        ev.retryCount += 1;
      }
      // Events that exceeded MAX_RETRY_COUNT stay "failed" and are abandoned.
      return retryable;
    },

    getAll() {
      return [...this.events];
    },

    getByStatus(status) {
      return this.events.filter((e) => e.syncStatus === status);
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Appends an event to the optimistic store with `pending` sync status.
 * Initialises the store on first call if needed.
 * No-op on the server.
 *
 * Duplicate eventIds are silently ignored (idempotent).
 *
 * @param eventId   The client-generated UUID (same one sent to the server).
 * @param eventType The event type string (e.g. "page_view").
 * @param payload   Arbitrary event payload.
 */
export function pushToJourneyStore(
  eventId:   string,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  initJourneyStore();
  window.__journey?.push(eventId, eventType, payload);
}

/**
 * Marks a local event as successfully written to the DB (HTTP 201).
 * No-op if the eventId is not found (e.g. store was cleared).
 */
export function markJourneyEventSynced(eventId: string): void {
  if (typeof window === "undefined") return;
  window.__journey?.markSynced(eventId);
}

/**
 * Marks a local event as failed to write to the DB.
 */
export function markJourneyEventFailed(eventId: string): void {
  if (typeof window === "undefined") return;
  window.__journey?.markFailed(eventId);
}

/**
 * Marks a local event as consent-suppressed (server returned 200 + suppressed=true).
 * Suppressed events are NOT retried.
 */
export function markJourneyEventSuppressed(eventId: string): void {
  if (typeof window === "undefined") return;
  window.__journey?.markSuppressed(eventId);
}

/**
 * Resets all `failed` events (up to MAX_RETRY_COUNT retries) to `pending`
 * and returns them so the caller can re-send them.
 *
 * Events that have already been retried MAX_RETRY_COUNT times remain "failed"
 * and are not returned.
 *
 * Returns [] on the server.
 */
export function getAndResetFailedJourneyEvents(): LocalJourneyEvent[] {
  if (typeof window === "undefined") return [];
  initJourneyStore();
  return window.__journey?.retryFailed() ?? [];
}

/**
 * Returns a snapshot of all events currently in the optimistic store.
 * Returns [] on the server.
 */
export function getJourneyStoreEvents(): LocalJourneyEvent[] {
  if (typeof window === "undefined") return [];
  return window.__journey?.getAll() ?? [];
}

/**
 * Returns events filtered by sync status.
 * Returns [] on the server.
 */
export function getJourneyStoreEventsByStatus(status: SyncStatus): LocalJourneyEvent[] {
  if (typeof window === "undefined") return [];
  return window.__journey?.getByStatus(status) ?? [];
}

/**
 * Returns the stable visitor ID held in localStorage, or null on the server.
 */
export function getJourneyStoreVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  initJourneyStore();
  return window.__journey?.visitorId ?? null;
}

/**
 * Returns the per-tab session ID held in sessionStorage, or null on the server.
 * This is a client-readable companion to the httpOnly `mc_session_id` cookie.
 */
export function getJourneyStoreSessionId(): string | null {
  if (typeof window === "undefined") return null;
  initJourneyStore();
  return window.__journey?.sessionId ?? null;
}
