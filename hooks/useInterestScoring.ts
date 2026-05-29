"use client";

/**
 * hooks/useInterestScoring.ts
 *
 * React hook for the behavioral interest scoring engine.
 *
 * ─── Responsibilities ────────────────────────────────────────────────────────
 *
 *   • Load state from localStorage on mount, applying exponential decay.
 *   • Fire a page_view event for the current pathname on mount.
 *   • Expose `track(event)` for callers to emit behavioral events.
 *   • Derive and expose: activeProfiles, dominant, contextVars, snapshot.
 *   • Persist updated state to localStorage after every event.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   const { track, activeProfiles, dominant, snapshot } = useInterestScoring();
 *
 *   // Fire a CTA click:
 *   track({ type: "cta_click", label: "pricing", at: Date.now() });
 *
 *   // Fire a form start (uses current pathname automatically):
 *   track({ type: "form_start" });
 *
 * ─── Page view ───────────────────────────────────────────────────────────────
 *
 *   The hook fires a page_view event automatically on mount using
 *   window.location.pathname.  It detects repeat visits (same pathname
 *   already in visitedUrls) and upgrades the event type to repeat_visit.
 *
 * ─── Auto-track ──────────────────────────────────────────────────────────────
 *
 *   Pass `autoTrack: false` to suppress the automatic page_view on mount.
 *   Useful when the parent component wants to control when the first event fires.
 *
 * ─── Relationship to useAdaptiveUpdate ───────────────────────────────────────
 *
 *   useAdaptiveUpdate  — journey-store model (server-rendered confidence bands)
 *   useInterestScoring — behavioral event model (client-side interest profiles)
 *
 *   They run independently.  Combine them when you need both confidence gating
 *   AND interest-profile personalisation.
 *
 * ─── Pure scoring engine ─────────────────────────────────────────────────────
 *
 *   All scoring logic lives in interest-profiles/behavioral-scoring.ts (pure).
 *   Signal resolution lives in interest-profiles/signal-map.ts (pure).
 *   This hook owns only lifecycle (mount, effect, setState) and localStorage I/O.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

import {
  applySignals,
  recordUrlVisit,
  getActiveProfiles,
  getDominantProfile,
  buildDebugSnapshot,
  behavioralScoresToContextVars,
  type BehavioralScoreState,
  type BehavioralEvent,
  type ActiveProfile,
  type ScoringDebugSnapshot,
} from "@/interest-profiles/behavioral-scoring";

import { resolveSignals }               from "@/interest-profiles/signal-map";
import { loadState, saveState }          from "@/interest-profiles/session-store";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InterestScoringState {
  /** Profiles above the WEAK threshold (≥ 15 pts), sorted by score descending. */
  activeProfiles:  ActiveProfile[];
  /** Key of the highest-scoring active profile, or null. */
  dominant:        string | null;
  /**
   * Context variable bridge — same shape as scoring.ts output.
   * Feed into the decision engine or use directly in personalisation logic.
   */
  contextVars: {
    interestPrimary:    string;
    interestSecondary:  string;
    interestConfidence: number;
    /** Per-profile score as a 0–1 fraction of MAX_SCORE_PER_PROFILE. */
    perProfile:         Record<string, number>;
  };
  /**
   * Full debug snapshot — all scored profiles, contributions, decay note.
   * Rendered by InterestDebugPanel.
   */
  snapshot: ScoringDebugSnapshot | null;
  /**
   * Fire a behavioral event.
   *
   * If `url` is omitted for page_view / repeat_visit / form_start / form_submit,
   * window.location.pathname is used automatically.
   *
   * `at` defaults to Date.now() when omitted.
   */
  track: (event: Omit<BehavioralEvent, "at"> & { at?: number }) => void;
}

export interface UseInterestScoringOptions {
  /**
   * Whether to fire a page_view automatically on mount.
   * Default: true.
   */
  autoTrack?: boolean;
  /**
   * Override the pathname used for the auto page_view.
   * Defaults to window.location.pathname on mount.
   */
  pathname?: string;
  /**
   * Keys of profiles that are enabled for this tenant.
   * When provided, only these profiles appear in activeProfiles, contextVars,
   * and the active sections of the debug snapshot.  Disabled profiles that
   * have accumulated scores are visible in snapshot.disabledProfiles with
   * activation = "disabled", but they do NOT appear as dominant, do NOT
   * contribute to interestPrimary/Secondary, and are excluded from perProfile.
   *
   * Load from listActiveInterestProfiles(tenantId) server-side and pass here.
   * Omit (or pass undefined) to include all profiles (default, no filtering).
   */
  enabledProfileKeys?: string[];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInterestScoring(
  options: UseInterestScoringOptions = {},
): InterestScoringState {
  const { autoTrack = true, pathname: pathnameOverride, enabledProfileKeys } = options;

  // Stable Set reference — only rebuilds when the array contents change.
  // Using join(",") as a cheap serialization avoids rebuilding on every render
  // when the array is recreated inline (e.g. enabledProfileKeys={["a","b"]}).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const enabledKeys = useMemo<ReadonlySet<string> | undefined>(
    () => enabledProfileKeys ? new Set(enabledProfileKeys) : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabledProfileKeys?.join(",")],
  );

  // Internal mutable state ref — single source of truth.
  // We derive the exposed React state from this ref after every mutation.
  const stateRef = useRef<BehavioralScoreState | null>(null);

  // React state for triggering re-renders.
  const [activeProfiles, setActiveProfiles] = useState<ActiveProfile[]>([]);
  const [dominant,       setDominant]       = useState<string | null>(null);
  const [contextVars,    setContextVars]     = useState<InterestScoringState["contextVars"]>({
    interestPrimary:    "",
    interestSecondary:  "",
    interestConfidence: 0,
    perProfile:         {},
  });
  const [snapshot, setSnapshot] = useState<ScoringDebugSnapshot | null>(null);

  // ── Derived state sync ─────────────────────────────────────────────────────

  const syncDerivedState = useCallback((state: BehavioralScoreState) => {
    const now = Date.now();
    setActiveProfiles(getActiveProfiles(state, enabledKeys));
    setDominant(getDominantProfile(state, enabledKeys));
    setContextVars(behavioralScoresToContextVars(state, enabledKeys));
    setSnapshot(buildDebugSnapshot(state, now, enabledKeys));
  }, [enabledKeys]);

  // ── track ──────────────────────────────────────────────────────────────────

  const track = useCallback(
    (partial: Omit<BehavioralEvent, "at"> & { at?: number }) => {
      if (typeof window === "undefined") return;

      const now      = partial.at ?? Date.now();
      const pathname = partial.url ?? window.location.pathname;

      // Load current state (hydrate lazily if not yet loaded).
      let state = stateRef.current ?? loadState(now);

      // ── URL visit tracking ─────────────────────────────────────────────────
      //
      // For URL-based events, record the visit to detect repeats.
      // Upgrade page_view → repeat_visit automatically.
      const urlEvent = partial.type !== "cta_click";
      let eventType  = partial.type;

      if (urlEvent && partial.type === "page_view") {
        const { state: nextState, isRepeat } = recordUrlVisit(state, pathname, now);
        state     = nextState;
        eventType = isRepeat ? "repeat_visit" : "page_view";
      } else if (urlEvent) {
        const { state: nextState } = recordUrlVisit(state, pathname, now);
        state = nextState;
      }

      // ── Signal resolution ──────────────────────────────────────────────────
      const event: BehavioralEvent = {
        type:  eventType,
        url:   urlEvent ? pathname : partial.url,
        label: partial.label,
        at:    now,
      };
      const signals = resolveSignals(event);

      if (signals.length > 0) {
        state = applySignals(state, signals, now);
      }

      // Persist and sync.
      stateRef.current = state;
      saveState(state);
      syncDerivedState(state);
    },
    [syncDerivedState],
  );

  // ── Mount effect ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load + decay on mount.
    const now   = Date.now();
    const state = loadState(now);
    stateRef.current = state;
    syncDerivedState(state);

    // Auto page_view.
    if (autoTrack) {
      const pathname = pathnameOverride ?? window.location.pathname;
      // Use track() directly — it handles repeat detection and persistence.
      track({ type: "page_view", url: pathname, at: now });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Note: intentionally empty deps — only runs on mount.
  // `track` and `syncDerivedState` are stable (useCallback with no deps).

  return {
    activeProfiles,
    dominant,
    contextVars,
    snapshot,
    track,
  };
}
