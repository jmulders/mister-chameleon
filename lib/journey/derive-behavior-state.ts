/**
 * Derive Behavior State — Journey Engine v3
 *
 * Computes the full visitor_behavior_state from a set of raw journey events,
 * scoring rules, sequence patterns, and decay profiles.
 *
 * ─── v3: Anti-false-positive layer ────────────────────────────────────────────
 *
 *   Events are pre-processed by analyzeNoise() before scoring:
 *
 *   • Deduplication: repeated identical events within DEDUP_WINDOW_MS (30s)
 *     receive a weight of 0.10 instead of 1.0.  Scoring rules use this weight
 *     as a multiplier, dramatically reducing the impact of page-refresh spam.
 *
 *   • Signal diversity: the count of DISTINCT high-value signal types that
 *     have fired (pricing, about, contact, CTA, form, download, sequence,
 *     return-visit) — capped at 10 slots.  Scoring 1 type 20 times ≠ scoring
 *     20 distinct types once.
 *
 *   • Burst detection: ≥4 events within 60s with <3 distinct signal keys
 *     triggers a burst penalty (0–0.5) that is fed into compute-confidence.
 *
 *   • Friction score: composite 0–100 reflecting repetition, no-progression,
 *     burst echo, and single-signal dominance.  High friction suppresses
 *     intentConfidence and blocks funnel-stage promotion.
 *
 * ─── Computation steps ────────────────────────────────────────────────────────
 *
 *   1. Aggregate counts and boolean flags from raw events.
 *   2. Run analyzeNoise() → weightedEvents, burst, diversity, frictionScore.
 *   3. Compute intent_score using WEIGHTED events (dedup-aware).
 *   4. Compute short_term_intent_score (events < 24h, weighted).
 *   5. Compute long_term_affinity_score (events 7–90d, weighted).
 *   6. Compute intent_freshness.
 *   7. Detect sequences; compute sequence_score and sequence_matched_at.
 *   8. Compute repeat_session_bonus.
 *   9. Compute engagement_score from depth of interaction.
 *  10. Compute recency_score from last_seen_at.
 *  11. Clamp all scores to [0, 100].
 *  12. Derive funnel_stage (with noise-aware progression gates).
 *
 * ─── Performance ─────────────────────────────────────────────────────────────
 *
 *   CPU-only — no I/O.  Always called fire-and-forget from updateBehaviorState().
 */

import type {
  JourneyEventRow,
  ScoringRule,
  SequencePattern,
  DecayProfile,
  BehaviorStateRow,
  ScoringRuleContribution,
  ScoringDebugPayload,
} from "./types";
import {
  applyDecaySmooth,
  computeRecencyScore,
  computeRepeatSessionBonus,
  partitionEventsByAge,
  DEFAULT_DECAY_PROFILE,
} from "./apply-decay";
import { detectSequences }  from "./detect-sequences";
import { deriveFunnelStage } from "./derive-funnel-stage";
import { analyzeNoise }      from "./detect-noise";
import type { SignalSlotInput } from "./detect-noise";

// ── Page path detection helpers ───────────────────────────────────────────────

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

// ── Score clamping ────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

// ── Derivation input ──────────────────────────────────────────────────────────

export interface DeriveBehaviorStateInput {
  tenantId:  string;
  sessionId: string;
  events:    JourneyEventRow[];
  rules:     ScoringRule[];
  patterns:  SequencePattern[];
  /** Map from decay_profile slug → DecayProfile. */
  profiles:  Map<string, DecayProfile>;
  now?:      Date;
}

// ── Main function ─────────────────────────────────────────────────────────────

/** Return type of deriveBehaviorState — DB row + scoring debug payload. */
export interface DeriveResult {
  row:          Omit<BehaviorStateRow, "id" | "updated_at">;
  scoringDebug: ScoringDebugPayload;
}

/**
 * Derives a complete BehaviorStateRow from raw journey data.
 * Applies event deduplication, burst detection, friction scoring, and
 * signal diversity analysis before computing scores and funnel stage.
 *
 * Returns `{ row, scoringDebug }`:
 *   row          — ready for upsert into visitor_behavior_state
 *   scoringDebug — per-rule contribution breakdown for the debug panel
 */
export function deriveBehaviorState(
  input: DeriveBehaviorStateInput,
): DeriveResult {
  const { tenantId, sessionId, events, rules, patterns, profiles, now } = input;

  // ── 1. Aggregate counts, flags, and timestamps ──────────────────────────

  let firstSeenAt: string | null  = null;
  let lastSeenAt:  string | null  = null;
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

  const viewedCategorySet = new Set<string>();
  const viewedKeywordSet  = new Set<string>();

  for (const event of events) {
    if (!firstSeenAt || event.occurred_at < firstSeenAt) firstSeenAt = event.occurred_at;
    if (!lastSeenAt  || event.occurred_at > lastSeenAt)  lastSeenAt  = event.occurred_at;

    if (event.page_category) viewedCategorySet.add(event.page_category);
    if (event.page_keywords) event.page_keywords.forEach((k) => viewedKeywordSet.add(k));

    switch (event.event_type) {
      case "page_view":
        pageViewCount++;
        if (isAboutPath(event.page_path))   hasVisitedAbout   = true;
        if (isPricingPath(event.page_path)) hasVisitedPricing = true;
        if (isCasesPath(event.page_path))   hasVisitedCases   = true;
        if (isContactPath(event.page_path)) hasVisitedContact = true;
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

  // ── 2. Repeat-session bonus (needed for signal slots) ────────────────────
  //
  // Computed before noise analysis because it's a slot input.
  const repeatSessionBonus = computeRepeatSessionBonus(events, now);

  // ── 3. Noise analysis ────────────────────────────────────────────────────
  //
  // Produces:
  //   • weightedEvents  — each event with a deduplication weight (0.1 or 1.0)
  //   • burst           — burst penalty and detection flag
  //   • diversity       — unique signal count + diversityScore
  //   • frictionScore   — composite 0–100 noise/friction signal

  const signalSlots: SignalSlotInput = {
    hasVisitedPricing,
    hasVisitedAbout,
    hasVisitedCases,
    hasVisitedContact,
    hasClickedCta,
    hasStartedForm:     formStartCount > 0,
    hasSubmittedForm,
    hasDownloaded:      downloadCount > 0,
    hasMatchedSequence: false, // will be updated after sequence detection below
    isReturnVisitor:    repeatSessionBonus > 0.4,
  };

  // Run initial noise analysis (matchedSequence slot may be updated after sequences)
  const noiseResult = analyzeNoise(events, signalSlots);
  const { weightedEvents, burst, diversity, frictionScore } = noiseResult;

  // ── 4. Intent score — weighted by deduplication ──────────────────────────
  //
  // Uses applyDecaySmooth for smooth gradient; weight multiplier collapses
  // duplicate events (pricing spam → ~1.4× instead of 5×).
  //
  // Also tracks per-rule contributions for the debug panel.

  let rawIntentScore = 0;

  // Per-rule contribution accumulator for debug
  const ruleContribMap = new Map<string, ScoringRuleContribution>();

  for (const { event, weight } of weightedEvents) {
    for (const rule of rules) {
      if (!rule.is_active) continue;
      if (rule.event_type !== event.event_type) continue;
      if (rule.event_value !== null && rule.event_value !== event.event_value) continue;
      if (rule.page_category !== null && rule.page_category !== event.page_category) continue;

      const profile       = profiles.get(rule.decay_profile) ?? DEFAULT_DECAY_PROFILE;
      const contribution  = applyDecaySmooth(rule.score * weight, event.occurred_at, profile, now);
      rawIntentScore     += contribution;

      // Accumulate debug contribution
      const ruleKey = rule.key ?? rule.id;
      const existing = ruleContribMap.get(ruleKey);
      if (existing) {
        existing.eventCount    += 1;
        existing.rawScore      += rule.score * weight;
        existing.effectiveScore += contribution;
      } else {
        ruleContribMap.set(ruleKey, {
          ruleKey,
          ruleName:      rule.label,
          eventType:     rule.event_type,
          eventCount:    1,
          rawScore:      rule.score * weight,
          effectiveScore: contribution,
          decayProfile:  rule.decay_profile,
        });
      }
    }
  }

  // ── 5. Short-term intent (events < 24h, weighted) ─────────────────────────
  //
  // Partition into age buckets using the already-weighted events for consistency.
  const ageBuckets = partitionEventsByAge(events, now);
  const shortTermIds = new Set(ageBuckets.shortTerm.map((e) => e.event_id));

  let rawShortTermIntentScore = 0;

  for (const { event, weight } of weightedEvents) {
    if (!shortTermIds.has(event.event_id)) continue;
    for (const rule of rules) {
      if (!rule.is_active) continue;
      if (rule.event_type !== event.event_type) continue;
      if (rule.event_value !== null && rule.event_value !== event.event_value) continue;
      if (rule.page_category !== null && rule.page_category !== event.page_category) continue;
      const profile = profiles.get(rule.decay_profile) ?? DEFAULT_DECAY_PROFILE;
      rawShortTermIntentScore += rule.score * profile.day_1 * weight;
    }
  }

  // ── 6. Long-term affinity (events 7–90d, weighted) ────────────────────────
  const longTermIds = new Set(ageBuckets.longTerm.map((e) => e.event_id));

  let rawLongTermAffinityScore = 0;

  for (const { event, weight } of weightedEvents) {
    if (!longTermIds.has(event.event_id)) continue;
    for (const rule of rules) {
      if (!rule.is_active) continue;
      if (rule.event_type !== event.event_type) continue;
      if (rule.event_value !== null && rule.event_value !== event.event_value) continue;
      if (rule.page_category !== null && rule.page_category !== event.page_category) continue;
      const profile = profiles.get(rule.decay_profile) ?? DEFAULT_DECAY_PROFILE;
      rawLongTermAffinityScore += applyDecaySmooth(rule.score * weight, event.occurred_at, profile, now);
    }
  }

  // ── 7. Intent freshness ───────────────────────────────────────────────────
  const intentFreshness = rawIntentScore > 0
    ? Math.min(1, rawShortTermIntentScore / rawIntentScore)
    : 0;

  // ── 8. Sequence detection ─────────────────────────────────────────────────
  //
  // Sequences use the ORIGINAL events (not weighted) — dedup is about scoring
  // weight, not about whether a step occurred.  But a sequence requires
  // genuine ordering, not just repeated visits.
  //
  // Inactive patterns and cross-session-only patterns are filtered inside
  // detectSequences() — no pre-filtering needed here.
  // Patterns are also sorted by priority inside detectSequences().
  const sequenceResult                = detectSequences(events, patterns);
  const rawSequenceScore              = sequenceResult.totalScore;
  const sequenceMatchedAt             = sequenceResult.latestMatchAt;
  const sequenceConfidenceContribution = sequenceResult.totalConfidenceContribution;

  // Update diversity slot if sequences were detected
  const finalDiversityScore = sequenceResult.matched.length > 0
    ? Math.min(1, diversity.signalDiversityScore + (1 / 10))
    : diversity.signalDiversityScore;
  const finalUniqueSignalCount = sequenceResult.matched.length > 0
    ? Math.min(10, diversity.uniqueSignalCount + 1)
    : diversity.uniqueSignalCount;

  // ── 9. Engagement score ───────────────────────────────────────────────────
  const rawEngagementScore =
    pageViewCount    * 5  +
    ctaClickCount    * 15 +
    downloadCount    * 10 +
    formStartCount   * 10;

  // ── 10. Recency score ──────────────────────────────────────────────────────
  const rawRecencyScore = computeRecencyScore(lastSeenAt, now);

  // ── 11. Clamp all scores ───────────────────────────────────────────────────
  const intentScore           = clamp(rawIntentScore);
  const shortTermIntentScore  = clamp(rawShortTermIntentScore);
  const longTermAffinityScore = clamp(rawLongTermAffinityScore);
  const sequenceScore         = clamp(rawSequenceScore);
  const engagementScore       = clamp(rawEngagementScore);
  const recencyScore          = clamp(rawRecencyScore);

  const clampedIntentFreshness = Math.min(1, Math.max(0,
    Math.round(intentFreshness * 100) / 100,
  ));

  // ── 12. Funnel stage ───────────────────────────────────────────────────────
  //
  // Passes noise signals so the funnel stage derivation can require diversity
  // and block promotion from pure repetition.
  const { stage, confidence } = deriveFunnelStage({
    intentScore,
    engagementScore,
    hasVisitedPricing,
    hasVisitedAbout,
    hasVisitedCases,
    hasVisitedContact,
    hasSubmittedForm,
    formStartCount,
    pageViewCount,
    matchedSequences:      sequenceResult.matched,
    shortTermIntentScore,
    longTermAffinityScore,
    repeatSessionBonus,
    sequenceMatchedAt,
    // v3 anti-noise
    frictionScore,
    uniqueSignalCount:     finalUniqueSignalCount,
    signalDiversityScore:  finalDiversityScore,
    burstPenalty:          burst.burstPenalty,
    now,
  });

  // ── Build debug payload ───────────────────────────────────────────────────
  const scoringDebug: ScoringDebugPayload = {
    ruleContributions: Array.from(ruleContribMap.values())
      .sort((a, b) => b.effectiveScore - a.effectiveScore),
    rawTotalScore:        rawIntentScore,
    deduplicatedCount:    noiseResult.deduplicatedCount,
    processedEventCount:  weightedEvents.length,
  };

  // ── Return row-shaped object ──────────────────────────────────────────────
  return { scoringDebug, row: {
    tenant_id:               tenantId,
    session_id:              sessionId,
    first_seen_at:           firstSeenAt,
    last_seen_at:            lastSeenAt,
    page_view_count:         pageViewCount,
    cta_click_count:         ctaClickCount,
    form_start_count:        formStartCount,
    form_submit_count:       formSubmitCount,
    download_count:          downloadCount,
    has_visited_about:       hasVisitedAbout,
    has_visited_pricing:     hasVisitedPricing,
    has_visited_cases:       hasVisitedCases,
    has_visited_contact:     hasVisitedContact,
    has_clicked_cta:         hasClickedCta,
    has_submitted_form:      hasSubmittedForm,
    viewed_categories:       Array.from(viewedCategorySet),
    viewed_keywords:         Array.from(viewedKeywordSet),
    recency_score:           recencyScore,
    engagement_score:        engagementScore,
    intent_score:            intentScore,
    sequence_score:          sequenceScore,
    funnel_stage:            stage,
    funnel_stage_confidence: confidence,
    matched_sequences:       sequenceResult.matched,
    // v2 fields
    short_term_intent_score:  shortTermIntentScore,
    long_term_affinity_score: longTermAffinityScore,
    intent_freshness:         clampedIntentFreshness,
    sequence_matched_at:      sequenceMatchedAt,
    repeat_session_bonus:     repeatSessionBonus,
    // v3 anti-noise fields
    friction_score:             frictionScore,
    signal_diversity_score:     Math.round(finalDiversityScore * 100) / 100,
    unique_signal_count:        finalUniqueSignalCount,
    burst_penalty:              burst.burstPenalty,
    deduplicated_event_count:   noiseResult.deduplicatedCount,
    // Sequence engine v2 fields
    sequence_confidence_contribution: Math.round(sequenceConfidenceContribution * 1000) / 1000,
  }};
}
