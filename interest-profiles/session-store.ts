/**
 * interest-profiles/session-store.ts
 *
 * localStorage adapter for the behavioral interest scoring state.
 *
 * ─── Responsibilities ────────────────────────────────────────────────────────
 *
 *   • Stable visitor ID — generate once, store in localStorage, return on
 *     subsequent loads.  The same ID is used by the behavioral scoring engine
 *     to track state across page navigations within the same browser.
 *
 *   • State persistence — serialize / deserialize BehavioralScoreState to
 *     localStorage.  Applies version checks and decay on load.
 *
 * ─── Storage keys ────────────────────────────────────────────────────────────
 *
 *   STORAGE_KEY      = "chameleon_interest_v1"   → full scoring state (JSON)
 *   VISITOR_ID_KEY   = "chameleon_vid"            → stable visitor UUID
 *
 * ─── Isolation ───────────────────────────────────────────────────────────────
 *
 *   All functions guard for SSR (typeof window === "undefined") and for
 *   quota / security errors.  They never throw — they return null / default
 *   values so that the hook degrades gracefully when storage is unavailable.
 *
 * ─── Browser-only ────────────────────────────────────────────────────────────
 *
 *   This file uses localStorage.  Only import from Client Components or hooks.
 */

import {
  createEmptyState,
  applyDecayToState,
  type BehavioralScoreState,
} from "./behavioral-scoring";

// ── Constants ─────────────────────────────────────────────────────────────────

export const STORAGE_KEY    = "chameleon_interest_v1";
export const VISITOR_ID_KEY = "chameleon_vid";

// ── Visitor ID ────────────────────────────────────────────────────────────────

/**
 * Returns the stable visitor UUID for this browser.
 * Creates and persists a new UUID if none exists yet.
 *
 * Safe to call on every page load — returns the same ID for the lifetime of
 * the localStorage entry.
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") {
    // SSR safety: return a transient ID that will be replaced on client.
    return "ssr-transient";
  }

  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing && existing.length > 0) return existing;

    const id = generateUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private browsing quota, security policy).
    return generateUUID();
  }
}

// ── State persistence ─────────────────────────────────────────────────────────

/**
 * Load behavioral scoring state from localStorage.
 *
 * Applies exponential decay on load (lazy decay model).
 * Returns a fresh empty state if nothing is stored or the stored value is invalid.
 *
 * @param now  Current timestamp in ms (injectable for testing). Defaults to Date.now().
 */
export function loadState(now: number = Date.now()): BehavioralScoreState {
  const visitorId = getOrCreateVisitorId();

  if (typeof window === "undefined") {
    return createEmptyState(visitorId);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState(visitorId);

    const parsed = JSON.parse(raw) as Partial<BehavioralScoreState>;

    // Version check — reject states from incompatible schema versions.
    if (parsed.version !== 1) {
      console.warn(
        "[session-store] Discarding stored interest state: schema version mismatch",
        { stored: parsed.version, expected: 1 },
      );
      return createEmptyState(visitorId);
    }

    // Hydrate required fields.
    const state: BehavioralScoreState = {
      version:     1,
      visitorId:   parsed.visitorId  ?? visitorId,
      updatedAt:   parsed.updatedAt  ?? now,
      profiles:    parsed.profiles   ?? {},
      visitedUrls: parsed.visitedUrls ?? {},
    };

    // Apply decay — points accumulated before this load decay toward zero.
    return applyDecayToState(state, now);
  } catch (err) {
    console.warn("[session-store] Failed to load interest state from localStorage", err);
    return createEmptyState(visitorId);
  }
}

/**
 * Persist behavioral scoring state to localStorage.
 *
 * Silent no-op when localStorage is unavailable.
 */
export function saveState(state: BehavioralScoreState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // Quota exceeded or security error — degrade gracefully.
    console.warn("[session-store] Failed to save interest state to localStorage", err);
  }
}

/**
 * Clear all stored behavioral state and visitor ID.
 * Used for testing / resetting the scoring engine.
 */
export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Note: we intentionally leave VISITOR_ID_KEY so the same ID is preserved.
  } catch {
    /* silent */
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

/** RFC 4122 v4 UUID — crypto.randomUUID() with a Math.random() fallback. */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
