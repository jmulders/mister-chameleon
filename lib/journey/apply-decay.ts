/**
 * Apply Decay — Journey Engine v2
 *
 * Pure functions for applying recency-decay weights to behavioral scores.
 *
 * ─── Decay model ─────────────────────────────────────────────────────────────
 *
 *   Events decay linearly across four age buckets using weights from a
 *   DecayProfile row:
 *
 *     age < 1 day   → weight = profile.day_1  (default 1.0)  "very strong"
 *     age < 7 days  → weight = profile.day_7  (default 0.7)  "strong"
 *     age < 30 days → weight = profile.day_30 (default 0.3)  "moderate"
 *     age < 90 days → weight = profile.day_90 (default 0.1)  "weak"
 *     age ≥ 90 days → weight = 0                             "expired"
 *
 *   Within each bucket, weight is interpolated smoothly toward the next
 *   bucket's value, so scores decay gradually rather than dropping sharply
 *   at bucket boundaries.
 *
 * ─── v2 additions ────────────────────────────────────────────────────────────
 *
 *   applyDecaySmooth() — smooth linear interpolation within each bucket.
 *   getDecayLabel()    — human-readable strength label for debug.
 *   partitionEventsByAge() — split events into short-term / long-term buckets
 *                            for the short/long-term intent scoring model.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // Standard stepped decay (backward compatible):
 *   const decayed = applyDecay(40, occurredAt, standardProfile);
 *
 *   // Smooth interpolated decay:
 *   const decayed = applyDecaySmooth(40, occurredAt, standardProfile);
 *
 *   // Human-readable age label:
 *   const label = getDecayLabel(ageDays); // → "strong"
 */

import type { DecayProfile, JourneyEventRow } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Age (days) thresholds for the decay buckets. */
export const DECAY_BUCKET_DAYS = {
  VERY_STRONG: 1,
  STRONG:      7,
  MODERATE:    30,
  WEAK:        90,
} as const;

/** Human-readable label for each decay strength. */
export type DecayStrength = "very_strong" | "strong" | "moderate" | "weak" | "expired";

// ── Default profile (used when no profile is available) ───────────────────────

export const DEFAULT_DECAY_PROFILE: DecayProfile = {
  slug:  "standard",
  label: "Standard",
  day_1: 1.0,
  day_7: 0.7,
  day_30: 0.3,
  day_90: 0.1,
};

// ── Age helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the age of an event in fractional days.
 */
export function eventAgeDays(occurredAt: string, now?: Date): number {
  const nowMs   = (now ?? new Date()).getTime();
  const eventMs = new Date(occurredAt).getTime();
  return (nowMs - eventMs) / MS_PER_DAY;
}

/**
 * Returns a human-readable strength label for a given age in days.
 *
 *   < 1d  → "very_strong"
 *   < 7d  → "strong"
 *   < 30d → "moderate"
 *   < 90d → "weak"
 *   ≥ 90d → "expired"
 */
export function getDecayLabel(ageDays: number): DecayStrength {
  if (ageDays < DECAY_BUCKET_DAYS.VERY_STRONG) return "very_strong";
  if (ageDays < DECAY_BUCKET_DAYS.STRONG)      return "strong";
  if (ageDays < DECAY_BUCKET_DAYS.MODERATE)    return "moderate";
  if (ageDays < DECAY_BUCKET_DAYS.WEAK)        return "weak";
  return "expired";
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Applies a stepped recency-decay weight to a base score.
 * Uses discrete bucket weights (original behavior — backward compatible).
 *
 * @param baseScore     The raw score before decay.
 * @param occurredAt    ISO-8601 timestamp when the event occurred.
 * @param profile       The DecayProfile to use for weighting.
 * @param now           Optional override for "now" (defaults to Date.now()).
 * @returns             Decayed score, rounded to 2 decimal places. Zero if expired.
 */
export function applyDecay(
  baseScore:  number,
  occurredAt: string,
  profile:    DecayProfile,
  now?:       Date,
): number {
  const ageDays = eventAgeDays(occurredAt, now);

  let weight: number;

  if (ageDays < 1)  {
    weight = profile.day_1;
  } else if (ageDays < 7) {
    weight = profile.day_7;
  } else if (ageDays < 30) {
    weight = profile.day_30;
  } else if (ageDays < 90) {
    weight = profile.day_90;
  } else {
    weight = 0;
  }

  return Math.round(baseScore * weight * 100) / 100;
}

/**
 * Applies a smoothly interpolated recency-decay weight to a base score.
 *
 * Within each bucket, the weight is linearly interpolated from the bucket's
 * start weight toward the next bucket's weight.  This avoids sharp score
 * drops at bucket boundaries and produces more stable confidence signals.
 *
 * Example (standard profile):
 *   age = 0d  → weight = 1.00
 *   age = 0.5d → weight ≈ 0.85 (lerp 1.0→0.7 at 50%)
 *   age = 1d  → weight = 0.70
 *   age = 4d  → weight ≈ 0.51 (lerp 0.7→0.3 at 4/6=67%)
 *   age = 7d  → weight = 0.30
 *
 * @param baseScore     The raw score before decay.
 * @param occurredAt    ISO-8601 timestamp when the event occurred.
 * @param profile       The DecayProfile to use for weighting.
 * @param now           Optional override for "now".
 * @returns             Decayed score, rounded to 2 decimal places.
 */
export function applyDecaySmooth(
  baseScore:  number,
  occurredAt: string,
  profile:    DecayProfile,
  now?:       Date,
): number {
  const ageDays = eventAgeDays(occurredAt, now);

  let weight: number;

  if (ageDays < 1) {
    // Lerp: day_1 → day_7 over 1 day
    const t = ageDays / 1;
    weight = profile.day_1 + t * (profile.day_7 - profile.day_1);
  } else if (ageDays < 7) {
    // Lerp: day_7 → day_30 over 6 days
    const t = (ageDays - 1) / 6;
    weight = profile.day_7 + t * (profile.day_30 - profile.day_7);
  } else if (ageDays < 30) {
    // Lerp: day_30 → day_90 over 23 days
    const t = (ageDays - 7) / 23;
    weight = profile.day_30 + t * (profile.day_90 - profile.day_30);
  } else if (ageDays < 90) {
    // Lerp: day_90 → 0 over 60 days
    const t = (ageDays - 30) / 60;
    weight = profile.day_90 * (1 - t);
  } else {
    weight = 0;
  }

  return Math.round(baseScore * Math.max(0, weight) * 100) / 100;
}

/**
 * Calculates a recency score (0–100) based purely on the visitor's last
 * activity timestamp and the standard decay model.
 *
 * Used to populate visitor_behavior_state.recency_score independently of
 * any specific scoring rule.
 *
 *   < 1 day  → 100
 *   < 7 days → 70
 *   < 30 d   → 30
 *   < 90 d   → 10
 *   ≥ 90 d   → 0
 *
 * @param lastSeenAt  ISO-8601 timestamp of last known activity, or null.
 * @param now         Optional "now" override (testing).
 */
export function computeRecencyScore(
  lastSeenAt: string | null,
  now?: Date,
): number {
  if (!lastSeenAt) return 0;
  return Math.round(applyDecay(100, lastSeenAt, DEFAULT_DECAY_PROFILE, now));
}

// ── v2: Event age partitioning ────────────────────────────────────────────────

export interface AgeBuckets {
  /** Events occurred within the last 24 hours. */
  shortTerm:   JourneyEventRow[];
  /** Events occurred between 1–7 days ago (mid-term). */
  midTerm:     JourneyEventRow[];
  /** Events occurred between 7–90 days ago. */
  longTerm:    JourneyEventRow[];
  /** Events older than 90 days (negligible weight). */
  expired:     JourneyEventRow[];
}

/**
 * Partitions a list of events into age buckets.
 *
 * Used by derive-behavior-state.ts to compute shortTermIntentScore and
 * longTermAffinityScore separately, which feeds into the intent freshness
 * metric and confidence calculations.
 *
 * @param events  Chronological event list (any order accepted).
 * @param now     Optional "now" override (testing).
 */
export function partitionEventsByAge(
  events: JourneyEventRow[],
  now?:   Date,
): AgeBuckets {
  const buckets: AgeBuckets = {
    shortTerm: [],
    midTerm:   [],
    longTerm:  [],
    expired:   [],
  };

  for (const event of events) {
    const ageDays = eventAgeDays(event.occurred_at, now);
    if (ageDays < 1) {
      buckets.shortTerm.push(event);
    } else if (ageDays < 7) {
      buckets.midTerm.push(event);
    } else if (ageDays < 90) {
      buckets.longTerm.push(event);
    } else {
      buckets.expired.push(event);
    }
  }

  return buckets;
}

// ── v2: Repeat-session bonus ──────────────────────────────────────────────────

/**
 * Computes a 0–1 bonus reflecting return-visitor behaviour.
 *
 * Detects whether the session's events span multiple calendar days, which
 * indicates this is a returning visitor who has built up intent over time.
 *
 *   All events on same day              → 0.0 (first-time / single-session)
 *   Events span 2–3 calendar days       → 0.5 (returning visitor)
 *   Events span 4–6 calendar days       → 0.75
 *   Events spanning > 7 calendar days   → 1.0 (highly engaged returner)
 *
 * @param events  All events for the session (any order).
 * @param now     Optional "now" override (testing).
 */
export function computeRepeatSessionBonus(
  events: JourneyEventRow[],
  now?:   Date,
): number {
  if (events.length < 2) return 0;

  const timestamps = events
    .map((e) => new Date(e.occurred_at).getTime())
    .sort((a, b) => a - b);

  const firstMs = timestamps[0]!;
  const lastMs  = timestamps[timestamps.length - 1]!;
  const spanDays = (lastMs - firstMs) / MS_PER_DAY;

  if (spanDays < 1)  return 0;
  if (spanDays < 3)  return 0.5;
  if (spanDays < 7)  return 0.75;
  return 1.0;
}
