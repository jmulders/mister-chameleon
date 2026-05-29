"use client";

/**
 * useAdaptiveUpdate — Live Adaptive Decision Hook
 *
 * Watches the client-side journey store for new events and re-derives the
 * behavioral confidence band.  Returns whether each adaptive slot (cta, proof,
 * hero, theme) is currently unlocked.
 *
 * ─── When to use ────────────────────────────────────────────────────────────
 *
 *   Use this hook in Client Components that need to update CTA / proof text
 *   after the SSR decision, driven by events fired during the current visit.
 *
 *   Example:
 *     • Visitor lands → confidence=low → server served default CTA
 *     • Visitor visits /pricing (fires page_view) → confidence rises to medium
 *     • useAdaptiveUpdate re-derives and cta=true, proof=true
 *     • A <SmartCTABlock> client component can now swap in the personalised text
 *
 * ─── Stability guarantees ──────────────────────────────────────────────────
 *
 *   Theme changes: NEVER applied live.  This hook sets `themeUnlocked` as a
 *   signal only — the theme itself remains session-locked via the mc_theme
 *   cookie and can only change on the next full navigation.  This prevents
 *   layout shifts and jarring mid-session flips.
 *
 *   CTA / proof: eligible for live updates when the confidence band rises.
 *     - Rising from low → medium:  cta and proof unlock.
 *     - Rising from medium → high: hero also unlocks.
 *     - Falling bands are NOT applied live — the experience never degrades
 *       mid-session once a slot has been unlocked.
 *
 * ─── Polling interval ──────────────────────────────────────────────────────
 *
 *   The hook polls window.__journey every POLL_MS milliseconds.
 *   This is lightweight — it reads in-memory state, no network requests.
 *   Set to null to disable polling (useful for infrequent updates).
 *
 * ─── Pure derivation — no I/O ──────────────────────────────────────────────
 *
 *   All confidence computation runs from the local event store only.
 *   The hook does NOT re-fetch the DB journey state — that is the responsibility
 *   of JourneyDebugPanel.  This hook is intentionally cheap.
 */

import { useState, useEffect, useRef } from "react";
import { getJourneyStoreEvents }  from "@/tracking/journey-store";
import type { JourneyEventRow }   from "@/lib/journey/types";
import { mergeJourneyEvents }     from "@/tracking/merge-journey-events";
import { deriveClientState }      from "@/tracking/merge-journey-events";
import { gateAdaptiveDecisions }  from "@/lib/journey/compute-confidence";

// ── Constants ─────────────────────────────────────────────────────────────────

/** How often to poll the local journey store for new events (ms). */
const POLL_MS = 2_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdaptiveUpdateState {
  /** True when the CTA slot can be personalised at current confidence. */
  ctaUnlocked:    boolean;
  /** True when the proof slot can be personalised at current confidence. */
  proofUnlocked:  boolean;
  /** True when the hero slot can be personalised at current confidence. */
  heroUnlocked:   boolean;
  /**
   * True when the confidence band would allow theme changes.
   *
   * WARNING: This is a signal only — do NOT apply theme changes live.
   * Use it to pre-fetch or pre-warm theme assets, or to log that the visitor
   * would receive a theme upgrade on next navigation.
   */
  themeUnlocked:  boolean;
  /** Current confidence band derived from local events. */
  confidenceBand: string;
  /** Overall confidence 0–1. */
  confidence:     number;
  /** Total events in the local store (pending + synced). */
  eventCount:     number;
}

const INITIAL_STATE: AdaptiveUpdateState = {
  ctaUnlocked:    false,
  proofUnlocked:  false,
  heroUnlocked:   false,
  themeUnlocked:  false,
  confidenceBand: "low",
  confidence:     0,
  eventCount:     0,
};

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook that derives live adaptive decision state from the client journey store.
 *
 * @param serverBackendEvents  Backend events from SSR props (JourneyEventRow[]).
 *                             Used as the authoritative baseline for merge.
 *                             Pass [] when unavailable (client-only derivation).
 * @param pollMs               Polling interval in ms.  Defaults to 2000.
 *                             Pass 0 to disable polling (state updates only on mount).
 */
export function useAdaptiveUpdate(
  serverBackendEvents: JourneyEventRow[] = [],
  pollMs:              number = POLL_MS,
): AdaptiveUpdateState {

  const [state, setState] = useState<AdaptiveUpdateState>(INITIAL_STATE);
  // Track the unlocked band so we never regress mid-session.
  const maxUnlockedBandRef = useRef<number>(0); // 0=low, 1=medium, 2=high, 3=very_high

  const derive = () => {
    if (typeof window === "undefined") return;

    const localEvents  = getJourneyStoreEvents();
    const merged       = mergeJourneyEvents(localEvents, serverBackendEvents);
    const derived      = deriveClientState(merged, null);
    const gating       = gateAdaptiveDecisions(derived.confidence, derived);

    const bandIndex = bandToIndex(derived.confidence.band);
    // Never let the band fall — only allow upgrades within a session.
    const effectiveBand = Math.max(bandIndex, maxUnlockedBandRef.current);
    if (effectiveBand > maxUnlockedBandRef.current) {
      maxUnlockedBandRef.current = effectiveBand;
    }

    setState({
      ctaUnlocked:    effectiveBand >= 1 ? gating.cta   : false,
      proofUnlocked:  effectiveBand >= 1 ? gating.proof : false,
      heroUnlocked:   effectiveBand >= 2 ? gating.hero  : false,
      // Theme: signal only — never apply live.
      themeUnlocked:  effectiveBand >= 3 ? gating.theme : false,
      confidenceBand: derived.confidence.band,
      confidence:     derived.confidence.overallConfidence,
      eventCount:     merged.length,
    });
  };

  // Derive on mount.
  useEffect(() => {
    derive();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll at the given interval.
  useEffect(() => {
    if (pollMs <= 0) return;
    const id = setInterval(derive, pollMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  return state;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bandToIndex(band: string): number {
  switch (band) {
    case "medium":    return 1;
    case "high":      return 2;
    case "very_high": return 3;
    default:          return 0; // "low"
  }
}
