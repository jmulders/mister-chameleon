/**
 * Sequence Detection — Journey Engine v2 (production-grade)
 *
 * Detects fully-matched behavioral sequences from a chronological list of
 * journey events against a set of sequence pattern definitions.
 *
 * ─── Algorithm ────────────────────────────────────────────────────────────────
 *
 *   For each active pattern (sorted by priority asc):
 *     1. Walk through events in chronological order.
 *     2. Track a "cursor" into the pattern's step array.
 *     3. When an event matches the current step (event_type + optional
 *        event_value / page_path / page_category), advance the cursor.
 *        Record the event's timestamp and event_id as "last match".
 *     4. Before advancing, check that the gap between the previous match
 *        and this event does not exceed max_gap_minutes.
 *     5. If the cursor reaches the end of the step array — the pattern is
 *        fully matched.  Record completion timestamp, reset cursor.
 *     6. If any gap is exceeded, reset the cursor to 0 and re-try matching
 *        the current event from the beginning.
 *
 * ─── Step matching ────────────────────────────────────────────────────────────
 *
 *   A step matches when ALL provided matchers agree (null/undefined = wildcard):
 *     event_type     — required; exact match
 *     event_value    — optional; exact match when provided
 *     page_path      — optional; exact match when provided
 *     page_category  — optional; exact match when provided
 *
 * ─── is_active filtering ─────────────────────────────────────────────────────
 *
 *   Patterns with is_active === false are silently skipped.
 *   Patterns with is_active null/undefined default to active.
 *
 * ─── Priority ordering ────────────────────────────────────────────────────────
 *
 *   Patterns are sorted by priority (ascending, default 100) before evaluation
 *   so high-priority patterns appear first in matchDetails and debug output.
 *
 * ─── Cross-session patterns ───────────────────────────────────────────────────
 *
 *   Patterns with cross_session=true are skipped when `allowCrossSession` is
 *   false (default) — they require a visitor_id-keyed multi-session event set
 *   that must be explicitly provided via the input.
 *
 * ─── Partial match handling ───────────────────────────────────────────────────
 *
 *   When the cursor is > 0 but the pattern is not yet complete at the end
 *   of the event stream, the sequence is "partially matched".
 *   Returned separately in `nearMisses` for debug; not counted in score.
 *
 * ─── Multiple completions ─────────────────────────────────────────────────────
 *
 *   A sequence matched multiple times results in one slug entry (deduped via Set).
 *   The score is added once.  `latestCompletedAt` records the MOST RECENT
 *   completion for recency-based sequence confidence.
 *
 * ─── confidence_contribution ─────────────────────────────────────────────────
 *
 *   Each matched pattern contributes its `confidence_contribution` (default 0.10)
 *   to the `totalConfidenceContribution` in the result.  This feeds directly
 *   into `computeSequenceConfidence()` via `JourneyState.sequenceConfidenceContribution`.
 *
 * ─── Debug detail ────────────────────────────────────────────────────────────
 *
 *   matchDetails:   per-slug, completion timestamp, step count, score,
 *                   confidence contribution, and per-step match path with timing.
 *   nearMisses:     partial-match detail including blocked reason
 *                   (why the sequence couldn't complete).
 */

import type { JourneyEventRow, SequencePattern, SequenceStep } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default per-pattern confidence contribution when confidence_contribution is null. */
const DEFAULT_CONFIDENCE_CONTRIBUTION = 0.10;

/** Default pattern priority when priority is null/undefined. */
const DEFAULT_PRIORITY = 100;

// ── Result types ──────────────────────────────────────────────────────────────

/**
 * Record of which event matched a single step in a sequence.
 * Used for debug visualization of the match path.
 */
export interface SequenceStepMatch {
  /** Step index in the pattern (0-based). */
  stepIndex:    number;
  /** The step definition that was matched. */
  step:         SequenceStep;
  /** event_id of the event that satisfied this step. */
  eventId:      string;
  /** ISO-8601 timestamp of the matching event. */
  occurredAt:   string;
  /** Gap from the previous step match in minutes (null for the first step). */
  gapMinutes:   number | null;
}

/**
 * Detail for a single fully-matched sequence occurrence.
 */
export interface SequenceMatchDetail {
  /** Pattern slug. */
  slug:          string;
  /** Human-readable name (name ?? label). */
  name:          string;
  /** ISO-8601 timestamp of the event that completed the final step. */
  completedAt:   string;
  /** Number of steps in the pattern. */
  stepCount:     number;
  /** Score from this pattern. */
  score:         number;
  /**
   * This pattern's contribution to `sequenceConfidence` (0–1).
   * Sourced from pattern.confidence_contribution ?? DEFAULT_CONFIDENCE_CONTRIBUTION.
   */
  confidenceContribution: number;
  /**
   * Per-step match path — which event matched each step, with timing.
   * Empty when step-level debug is not supported (should always be populated now).
   */
  matchPath:     SequenceStepMatch[];
}

/**
 * Detail for a partially-matched sequence (debug only).
 *
 * Replaces the legacy `SequencePartialDetail` with richer near-miss information.
 */
export interface SequenceNearMiss {
  slug:          string;
  /** Human-readable name (name ?? label). */
  name:          string;
  stepsMatched:  number;
  totalSteps:    number;
  /** 0.0–1.0 progress ratio. */
  progress:      number;
  /**
   * Human-readable reason why the sequence didn't complete.
   * Examples:
   *   "event stream ended — 2/3 steps matched"
   *   "step 2 gap exceeded: 480 min > 60 min allowed — cursor reset"
   */
  blockedReason: string | null;
  /** ISO-8601 timestamp of the last step that matched (null if none matched yet). */
  lastMatchedAt: string | null;
  /** Steps matched so far, with timing detail. */
  matchPath:     SequenceStepMatch[];
}

/**
 * @deprecated Use SequenceNearMiss — kept for backward compatibility with
 * existing consumers that read `partialDetail`.
 */
export interface SequencePartialDetail {
  slug:         string;
  stepsMatched: number;
  totalSteps:   number;
  progress:     number;
}

export interface SequenceDetectionResult {
  /** Slugs of fully-matched patterns (deduplicated). */
  matched:        string[];
  /**
   * Per-match details including completion timestamps, match path, and
   * confidence contributions.  Sorted by most-recent completion first.
   * Multiple completions of the same slug are deduplicated; the most recent is kept.
   */
  matchDetails:   SequenceMatchDetail[];
  /**
   * ISO-8601 timestamp of the most recent sequence completion.
   * Null when no sequences have been matched.
   */
  latestMatchAt:  string | null;
  /** Combined score from all matched patterns (each counted once). */
  totalScore:     number;
  /**
   * Sum of confidence_contribution from all matched patterns (0–1, capped).
   * Use this to populate JourneyState.sequenceConfidenceContribution.
   */
  totalConfidenceContribution: number;
  /**
   * Near-miss detail for incomplete sequences (debug only).
   * Replaces the legacy `partial` + `partialDetail` fields with richer info.
   */
  nearMisses:     SequenceNearMiss[];
  /**
   * @deprecated Use `nearMisses[].slug` — kept for backward compatibility.
   */
  partial:        string[];
  /**
   * @deprecated Use `nearMisses` — kept for backward compatibility.
   */
  partialDetail:  SequencePartialDetail[];
}

// ── Step matching ─────────────────────────────────────────────────────────────

/**
 * Returns true when `event` satisfies `step`.
 *
 * All matchers beyond event_type are optional wildcards:
 *   null / undefined  → match any value for that dimension
 *   string            → exact equality required
 */
function matchesStep(event: JourneyEventRow, step: SequenceStep): boolean {
  if (event.event_type !== step.event_type) return false;
  if (step.event_value   != null && event.event_value   !== step.event_value)   return false;
  if (step.page_path     != null && event.page_path     !== step.page_path)     return false;
  if (step.page_category != null && event.page_category !== step.page_category) return false;
  return true;
}

// ── Pattern preparation ───────────────────────────────────────────────────────

/**
 * Filters and sorts patterns before detection:
 *   1. Remove inactive patterns (is_active === false).
 *   2. Skip cross-session patterns when cross-session events are not provided.
 *   3. Sort by priority ascending (lower = evaluated first), then by slug for stability.
 */
function preparePatterns(
  patterns:          SequencePattern[],
  allowCrossSession: boolean,
): SequencePattern[] {
  return patterns
    .filter((p) => {
      // Skip explicitly inactive patterns.
      if (p.is_active === false) return false;
      // Skip cross-session patterns when cross-session events are not provided.
      if (p.cross_session === true && !allowCrossSession) return false;
      return true;
    })
    .sort((a, b) => {
      const pa = a.priority ?? DEFAULT_PRIORITY;
      const pb = b.priority ?? DEFAULT_PRIORITY;
      if (pa !== pb) return pa - pb;
      return a.slug.localeCompare(b.slug);
    });
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Detects which sequence patterns are fully matched by the given events.
 *
 * @param events           Chronological list of journey events (oldest first).
 * @param patterns         Sequence pattern definitions to test against.
 * @param allowCrossSession When true, patterns with cross_session=true are included.
 *                          Default: false (single-session only).
 * @returns                 Detection result with matched slugs, completion timestamps,
 *                          total score, confidence contribution, and near-miss detail.
 */
export function detectSequences(
  events:             JourneyEventRow[],
  patterns:           SequencePattern[],
  allowCrossSession = false,
): SequenceDetectionResult {
  // matched: slug → most recent completedAt
  const matchedMap     = new Map<string, { completedAt: string; matchPath: SequenceStepMatch[] }>();
  const matchScores    = new Map<string, number>();   // slug → score (deduped)
  const matchContribs  = new Map<string, number>();   // slug → confidence_contribution (deduped)
  const nearMissMap    = new Map<string, {
    cursor:        number;
    totalSteps:    number;
    matchPath:     SequenceStepMatch[];
    lastBlockReason: string | null;
  }>();

  let totalScore = 0;

  const activePatterns = preparePatterns(patterns, allowCrossSession);

  for (const pattern of activePatterns) {
    const steps = pattern.sequence;
    if (!steps || steps.length === 0) continue;

    const patternName = pattern.name ?? pattern.label;
    const contribution = pattern.confidence_contribution ?? DEFAULT_CONFIDENCE_CONTRIBUTION;

    let cursor:        number = 0;
    let lastMatchTime: number | null = null;
    let lastMatchAt:   string | null = null;
    let patternMatched = false;
    let lastBlockReason: string | null = null;

    // currentMatchPath tracks the events that have matched the current
    // in-progress cursor sequence (reset on full match or gap overflow).
    const currentMatchPath: SequenceStepMatch[] = [];

    for (const event of events) {
      const step = steps[cursor];
      if (!step) continue;

      if (!matchesStep(event, step)) continue;

      const eventMs = new Date(event.occurred_at).getTime();

      // ── Gap check ──────────────────────────────────────────────────────────
      if (lastMatchTime !== null) {
        const gapMinutes = (eventMs - lastMatchTime) / (60 * 1000);

        if (gapMinutes > pattern.max_gap_minutes) {
          // Gap exceeded — emit near-miss reason and reset cursor.
          lastBlockReason =
            `step ${cursor} gap exceeded: ${Math.round(gapMinutes)} min > ` +
            `${pattern.max_gap_minutes} min allowed — cursor reset`;

          cursor        = 0;
          lastMatchTime = null;
          lastMatchAt   = null;
          currentMatchPath.length = 0;

          // Re-test event against step 0.
          const step0 = steps[0];
          if (step0 && matchesStep(event, step0)) {
            const gapMin: number | null = null;
            currentMatchPath.push({
              stepIndex:  0,
              step:       step0,
              eventId:    event.event_id,
              occurredAt: event.occurred_at,
              gapMinutes: gapMin,
            });
            cursor        = 1;
            lastMatchTime = eventMs;
            lastMatchAt   = event.occurred_at;
          }
          continue;
        }
      }

      // ── Advance cursor ─────────────────────────────────────────────────────
      const gapFromPrev = lastMatchTime !== null
        ? (eventMs - lastMatchTime) / (60 * 1000)
        : null;

      currentMatchPath.push({
        stepIndex:  cursor,
        step,
        eventId:    event.event_id,
        occurredAt: event.occurred_at,
        gapMinutes: gapFromPrev !== null ? Math.round(gapFromPrev * 10) / 10 : null,
      });

      cursor        = cursor + 1;
      lastMatchTime = eventMs;
      lastMatchAt   = event.occurred_at;

      // ── Pattern fully matched ──────────────────────────────────────────────
      if (cursor >= steps.length) {
        patternMatched  = true;
        lastBlockReason = null;

        const completedMatchPath = currentMatchPath.slice();

        // Deduplication: keep most recent completion (and its match path).
        const existing = matchedMap.get(pattern.slug);
        if (!existing || event.occurred_at > existing.completedAt) {
          matchedMap.set(pattern.slug, {
            completedAt: event.occurred_at,
            matchPath:   completedMatchPath,
          });
        }

        // Score and confidence_contribution: each slug counted once.
        if (!matchScores.has(pattern.slug)) {
          matchScores.set(pattern.slug, pattern.score);
          matchContribs.set(pattern.slug, contribution);
          totalScore += pattern.score;
        }

        // Reset for possible second completion.
        cursor        = 0;
        lastMatchTime = null;
        lastMatchAt   = null;
        currentMatchPath.length = 0;
      }
    }

    // ── Track near-misses for debug ────────────────────────────────────────
    if (!patternMatched && cursor > 0) {
      const endReason = lastBlockReason ??
        `event stream ended — ${cursor}/${steps.length} steps matched`;

      nearMissMap.set(pattern.slug, {
        cursor,
        totalSteps:      steps.length,
        matchPath:       currentMatchPath.slice(),
        lastBlockReason: endReason,
      });
    }

    // Also record near-misses for patterns that were interrupted mid-sequence
    // (cursor reset due to gap) — only if the pattern was never completed.
    if (!patternMatched && cursor === 0 && lastBlockReason !== null) {
      nearMissMap.set(pattern.slug, {
        cursor:          0,
        totalSteps:      steps.length,
        matchPath:       [],
        lastBlockReason,
      });
    }
  }

  // ── Build matchDetails sorted by most-recent completion first ──────────────
  const matchDetails: SequenceMatchDetail[] = Array.from(matchedMap.entries())
    .sort(([, a], [, b]) => (a.completedAt > b.completedAt ? -1 : a.completedAt < b.completedAt ? 1 : 0))
    .map(([slug, { completedAt, matchPath }]) => {
      const pattern = activePatterns.find((p) => p.slug === slug);
      return {
        slug,
        name:                  pattern?.name ?? pattern?.label ?? slug,
        completedAt,
        stepCount:             pattern?.sequence.length ?? 0,
        score:                 matchScores.get(slug) ?? 0,
        confidenceContribution: matchContribs.get(slug) ?? DEFAULT_CONFIDENCE_CONTRIBUTION,
        matchPath,
      };
    });

  const latestMatchAt = matchDetails[0]?.completedAt ?? null;

  // Sum of per-pattern confidence contributions, capped at 1.0.
  const totalConfidenceContribution = Math.min(
    1.0,
    Array.from(matchContribs.values()).reduce((sum, c) => sum + c, 0),
  );

  // ── Build near-miss array ──────────────────────────────────────────────────
  //
  // Exclude patterns that were also fully matched at least once — a pattern
  // that partially re-started after a full match is not a near-miss.
  const matchedSlugs = new Set(matchedMap.keys());

  const nearMisses: SequenceNearMiss[] = Array.from(nearMissMap.entries())
    .filter(([slug]) => !matchedSlugs.has(slug))
    .map(([slug, { cursor, totalSteps, matchPath, lastBlockReason }]) => {
      const pattern = activePatterns.find((p) => p.slug === slug);
      const progress = totalSteps > 0 ? Math.round((cursor / totalSteps) * 100) / 100 : 0;
      const lastMatchedAt = matchPath.length > 0
        ? matchPath[matchPath.length - 1]!.occurredAt
        : null;
      return {
        slug,
        name:          pattern?.name ?? pattern?.label ?? slug,
        stepsMatched:  cursor,
        totalSteps,
        progress,
        blockedReason: lastBlockReason,
        lastMatchedAt,
        matchPath,
      };
    });

  // ── Backward-compatible legacy arrays ──────────────────────────────────────
  const partial: string[] = nearMisses.map((nm) => nm.slug);

  const partialDetail: SequencePartialDetail[] = nearMisses.map((nm) => ({
    slug:         nm.slug,
    stepsMatched: nm.stepsMatched,
    totalSteps:   nm.totalSteps,
    progress:     nm.progress,
  }));

  return {
    matched:                     Array.from(matchedMap.keys()),
    matchDetails,
    latestMatchAt,
    totalScore,
    totalConfidenceContribution,
    nearMisses,
    partial,
    partialDetail,
  };
}
