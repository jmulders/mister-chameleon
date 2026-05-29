/**
 * Journey Types
 *
 * Core type definitions for the behavioral personalization system.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   Page render / API event
 *        │
 *        ▼
 *   recordJourneyEvent()  ← writes to visitor_journey_events (fast, non-blocking)
 *        │
 *        ▼  (async, after response)
 *   updateBehaviorState() ← reads all events, derives state, upserts visitor_behavior_state
 *        │
 *        ▼  (next request)
 *   fetchJourneyState()   ← single PK lookup on visitor_behavior_state
 *        │
 *        ▼
 *   JourneyState          ← attached to VisitorHistory.journey
 *        │
 *        ▼
 *   Rules / AI / Debug
 *
 * ─── Privacy ──────────────────────────────────────────────────────────────────
 *
 *   All data is derived from first-party in-session signals only.
 *   session_id = the mc_session_id cookie (UUID, 30-day maxAge).
 *   No cross-device stitching. No PII. No third-party data.
 */

// ── Funnel stage ──────────────────────────────────────────────────────────────

/**
 * Five-stage funnel derived from intent scores, milestone events, and sequences.
 *
 *   awareness     — first visit, no strong signals
 *   consideration — exploring content, visiting product/about pages
 *   intent        — pricing views, form starts, matched sequences
 *   high_intent   — multiple intent signals, form starts, engagement depth
 *   customer      — form submitted (conversion event)
 */
export type JourneyFunnelStage =
  | "awareness"
  | "consideration"
  | "intent"
  | "high_intent"
  | "customer";

// ── Journey event ─────────────────────────────────────────────────────────────

/**
 * A single behavioral event to record.
 * Written to visitor_journey_events.
 */
export interface JourneyEventInput {
  /**
   * Client-generated UUID for this event.
   * Used to deduplicate across the optimistic local store and the DB log.
   * When null/undefined the DB generates a random UUID via DEFAULT.
   */
  eventId?:      string | null;
  tenantId:      string;
  sessionId:     string;
  eventType:     JourneyEventType;
  /** Semantic value, e.g. pathname for page_view, element ID for cta_click. */
  eventValue?:   string | null;
  pagePath?:     string | null;
  pageCategory?: string | null;
  pageKeywords?: string[];
  source?:       string | null;
  medium?:       string | null;
  campaign?:     string | null;
  metadata?:     Record<string, unknown>;
  /**
   * ISO-8601 timestamp of when the event actually occurred on the client.
   * When provided, used as occurred_at in the DB instead of server receive time.
   *
   * Critical for events in the retry queue — without it, occurred_at would
   * reflect when the retry was sent (potentially minutes later), distorting
   * recency scoring and sequence analysis.
   *
   * When null/undefined, the server falls back to `new Date().toISOString()`.
   */
  occurredAt?:   string | null;
  /**
   * Stable visitor UUID from localStorage (mc_visitor_id).
   * Stored in event metadata to enable cross-session behavioral analysis
   * without server-side session stitching.
   *
   * Null when the client didn't provide one (e.g. server-side events, old clients).
   */
  visitorId?:    string | null;
}

/** Named event types tracked by the journey system. */
export type JourneyEventType =
  | "page_view"
  | "cta_click"
  | "form_start"
  | "form_submit"
  | "download";

// ── Raw event row ─────────────────────────────────────────────────────────────

/** Row shape returned from visitor_journey_events queries. */
export interface JourneyEventRow {
  /** DB primary key (auto-generated sequential UUID). */
  id:             string;
  /**
   * Client-generated canonical event identity UUID.
   * The deduplication key used by the merge algorithm.
   * Set by migration 0031 — pre-migration rows have a random UUID.
   */
  event_id:       string;
  tenant_id:      string;
  session_id:     string;
  occurred_at:    string;
  event_type:     string;
  event_value:    string | null;
  page_path:      string | null;
  page_category:  string | null;
  page_keywords:  string[] | null;
  source:         string | null;
  medium:         string | null;
  campaign:       string | null;
  metadata:       Record<string, unknown>;
}

// ── Scoring rule contribution (debug) ─────────────────────────────────────────

/**
 * Records how much a specific scoring rule contributed to the total intentScore.
 * Attached to JourneyState.scoringDebug.ruleContributions for debug panel display.
 */
export interface ScoringRuleContribution {
  /** ScoringRule.key or ScoringRule.id */
  ruleKey:       string;
  /** Human-readable rule name. */
  ruleName:      string;
  /** event_type matched. */
  eventType:     string;
  /** Number of events that matched this rule. */
  eventCount:    number;
  /** Raw score contribution (before noise weight adjustment). */
  rawScore:      number;
  /** Score after decay and noise weight. */
  effectiveScore: number;
  /** Decay profile used. */
  decayProfile:  string;
}

/**
 * Scoring debug payload attached to JourneyState.
 * Only populated during full journey recomputation (update-behavior-state);
 * not stored in the DB — derived fresh each time.
 */
export interface ScoringDebugPayload {
  /** Per-rule contribution breakdown for the intentScore. */
  ruleContributions:    ScoringRuleContribution[];
  /** Total noise-weight-adjusted sum before clamping. */
  rawTotalScore:        number;
  /** How many events were deduplicated/downweighted. */
  deduplicatedCount:    number;
  /** Number of events processed (after dedup). */
  processedEventCount:  number;
}

// ── Scoring rule ──────────────────────────────────────────────────────────────

/** Row shape from behavior_scoring_rules. */
export interface ScoringRule {
  id:             string;
  tenant_id:      string;
  /** Machine-readable unique key within a tenant (e.g. "pricing_view"). */
  key:            string | null;
  /** Human-readable display name. */
  label:          string;
  /** Optional longer description shown in admin UI. */
  description:    string | null;
  event_type:     string;
  event_value:    string | null;
  /** Optional page category filter (e.g. "pricing", "blog"). */
  page_category:  string | null;
  /** Score applied when this rule fires. */
  score:          number;
  decay_profile:  string;
  /** When false the rule is skipped during scoring even if it matches. */
  is_active:      boolean;
  /** Lower number = evaluated first (useful for ordering in admin UI). */
  priority:       number;
}

// ── Sequence pattern ──────────────────────────────────────────────────────────

/**
 * A single step in a sequence pattern.
 *
 * All matchers are optional beyond `event_type`.  When a matcher is null/undefined
 * it acts as a wildcard — the step matches any value for that dimension.
 *
 * Step is matched when ALL provided matchers agree:
 *   event_type   MUST match (required)
 *   event_value  matches when provided (exact string equality)
 *   page_path    matches when provided (exact string equality)
 *   page_category matches when provided (exact string equality)
 *
 * Example — "visited /pricing after clicking a CTA":
 *   [
 *     { event_type: "cta_click" },
 *     { event_type: "page_view", page_path: "/pricing" },
 *   ]
 */
export interface SequenceStep {
  event_type:     string;
  /** Exact event_value match (null/undefined = wildcard). */
  event_value?:   string | null;
  /** Exact page_path match (null/undefined = wildcard). */
  page_path?:     string | null;
  /** Exact page_category match (null/undefined = wildcard). */
  page_category?: string | null;
}

/** Row shape from behavior_sequence_patterns. */
export interface SequencePattern {
  id:               string;
  tenant_id:        string;
  slug:             string;
  /**
   * Machine-readable unique key within a tenant (e.g. "pricing_journey").
   * Follows the same convention as ScoringRule.key.
   * Null when not set (older rows).
   */
  key?:             string | null;
  /**
   * Human-readable display name (e.g. "Pricing Journey").
   * @deprecated Use `name` going forward — `label` kept for backward compat.
   */
  label:            string;
  /** Canonical human-readable name (replaces label; preferred in new code). */
  name?:            string | null;
  /** Optional longer description shown in admin UI. */
  description?:     string | null;
  sequence:         SequenceStep[];
  max_gap_minutes:  number;
  score:            number;
  /**
   * Per-pattern contribution to `sequenceConfidence` (0–1).
   *
   * When provided, this overrides the default flat per-sequence bonus used by
   * `computeSequenceConfidence()`.  High-signal patterns (e.g. pricing→form_start)
   * should carry a higher contribution than broad awareness patterns.
   *
   * Default when null: 0.10 per matched sequence (existing behaviour).
   */
  confidence_contribution?: number | null;
  /**
   * When true, this pattern may be matched across multiple sessions for the
   * same visitor (requires cross-session event data keyed by visitor_id).
   *
   * Default: false — matched within a single session only.
   *
   * Note: cross-session matching requires `update-behavior-state` to load events
   * from all sessions sharing the same `visitor_id`.  Patterns with cross_session=true
   * are silently skipped when cross-session events are not provided.
   */
  cross_session?:   boolean | null;
  /**
   * When false, skip this pattern during detection even if present in the DB.
   * Default: true (active).
   */
  is_active?:       boolean | null;
  /**
   * Evaluation order — lower number = evaluated first.
   * Default: 100.  Useful for ensuring high-signal patterns are evaluated and
   * reported first in debug output.
   */
  priority?:        number | null;
}

// ── Decay profile ─────────────────────────────────────────────────────────────

/** Row shape from decay_profiles. */
export interface DecayProfile {
  slug:   string;
  label:  string;
  day_1:  number;
  day_7:  number;
  day_30: number;
  day_90: number;
}

// ── Confidence ────────────────────────────────────────────────────────────────

/**
 * Four confidence bands that gate which adaptive experience changes are allowed.
 *
 *   low       (<0.35)  — keep all defaults; do not personalize
 *   medium    (0.35–0.55) — allow CTA and proof adjustments only
 *   high      (0.55–0.75) — allow hero / proof / CTA changes
 *   very_high (≥0.75)  — allow full experience + theme changes
 */
export type ConfidenceBand = "low" | "medium" | "high" | "very_high";

/**
 * Per-dimension confidence scores (0.0–1.0) plus the composite band.
 * Computed by `computeBehaviorConfidence()` in lib/journey/compute-confidence.ts.
 * Attached to JourneyState by fetchJourneyState() and available to all
 * downstream consumers: rules, theme decisions, debug panel.
 */
export interface BehaviorConfidence {
  /** How certain we are about the visitor's intent signals. */
  intentConfidence:      number;
  /** How certain we are about matched behavioral sequences. */
  sequenceConfidence:    number;
  /** How certain we are about the assigned funnel stage. */
  funnelStageConfidence: number;
  /** Weighted composite of the three dimensions above (0.0–1.0). */
  overallConfidence:     number;
  /** Human-readable threshold band used for gating decisions. */
  band:                  ConfidenceBand;
  /** Explanations for why confidence is high or low (shown in debug). */
  reasons:               string[];
}

/**
 * Which adaptive experience outputs are unlocked at the current confidence.
 * Used by the debug panel and (optionally) the decision pipeline to gate
 * which keys from a matched rule are actually applied.
 */
export interface AdaptiveGating {
  /** CTA text / variant changes allowed. */
  cta:   boolean;
  /** Proof block changes allowed. */
  proof: boolean;
  /** Hero section changes allowed. */
  hero:  boolean;
  /**
   * Full theme / layout changes allowed.
   * Requires very_high confidence and remains session-stable once applied.
   */
  theme: boolean;
  /** Human-readable explanations for blocked changes (shown in debug). */
  blockedReasons: string[];
}

// ── Behavior state ────────────────────────────────────────────────────────────

/**
 * The aggregated per-(tenant, session) behavioral state.
 * Maps 1:1 to the visitor_behavior_state table row, plus computed
 * confidence metrics that are derived on-the-fly (not stored in DB).
 *
 * Returned by fetchJourneyState() and attached to VisitorHistory.journey.
 *
 * ─── Journey Engine v2 fields ──────────────────────────────────────────────────
 *
 *   shortTermIntentScore  — intent contribution from events in the last 24 hours.
 *                           High values indicate active in-session research.
 *   longTermAffinityScore — sustained affinity score from events older than 7 days.
 *                           High values indicate a returning, informed visitor.
 *   intentFreshness       — 0–1 ratio of short-term vs total intent weight.
 *                           Near 1.0 = most intent is from today.
 *                           Near 0.0 = intent built over time, not fresh.
 *   sequenceMatchedAt     — ISO-8601 timestamp of the most recent sequence
 *                           completion. Null when no sequences have been matched.
 *                           Used to decay sequence confidence over time.
 *   repeatSessionBonus    — 0–1 bonus that rises when events span multiple calendar
 *                           days (returning visitor behaviour). Feeds into confidence.
 */
export interface JourneyState {
  // Timestamps
  firstSeenAt:          string | null;
  lastSeenAt:           string | null;

  // Event counts
  pageViewCount:        number;
  ctaClickCount:        number;
  formStartCount:       number;
  formSubmitCount:      number;
  downloadCount:        number;

  // Boolean page-visit flags
  hasVisitedAbout:      boolean;
  hasVisitedPricing:    boolean;
  hasVisitedCases:      boolean;
  hasVisitedContact:    boolean;

  // Engagement flags
  hasClickedCta:        boolean;
  hasSubmittedForm:     boolean;

  // Content interest signals
  viewedCategories:     string[];
  viewedKeywords:       string[];

  // Scores (0–100)
  recencyScore:         number;
  engagementScore:      number;
  intentScore:          number;
  sequenceScore:        number;

  /**
   * Intent contribution from the last 24 hours only (0–100).
   * High = visitor is actively researching right now.
   * Low = intent built over days/weeks, not in this session.
   */
  shortTermIntentScore: number;

  /**
   * Sustained affinity score from events older than 7 days (0–100).
   * High = informed, returning visitor with established interest.
   */
  longTermAffinityScore: number;

  /**
   * Freshness ratio: shortTermIntentScore / (intentScore + 1).
   * 0–1; near 1.0 = all intent is from today; near 0.0 = mostly historical.
   */
  intentFreshness: number;

  /**
   * ISO-8601 timestamp of the most recent completed sequence match.
   * Null when no sequences have ever been matched.
   */
  sequenceMatchedAt: string | null;

  /**
   * 0–1 bonus reflecting return-visitor behaviour.
   * Computed from the span of event timestamps:
   *   0 = all events on same day (first-time or same-session)
   *   0.5 = events across 2–3 days
   *   1.0 = events spanning > 7 days
   */
  repeatSessionBonus: number;

  // ── Anti-false-positive signals (Journey Engine v3) ────────────────────────

  /**
   * Friction / confusion score (0–100).
   *
   * Reflects repetitive, bursty, or shallow behavior patterns that indicate
   * noise rather than genuine intent.
   *
   *   0–20  = clean signal, no friction
   *   20–40 = mild repetition, monitor
   *   40–60 = moderate noise, reduce confidence
   *   60–80 = strong friction, likely confusion
   *   80–100 = extreme noise (e.g. pricing spam)
   *
   * A high frictionScore dampens intentConfidence in compute-confidence.ts
   * and can prevent funnel stage promotion.
   */
  frictionScore: number;

  /**
   * Signal diversity score (0–1).
   *
   * Measures how many of the 10 distinct high-value signal types have fired,
   * regardless of how many times each one occurred.
   *
   *   0.0 = only one type ever fired (pure repetition)
   *   0.3 = 3 of 10 types fired (some breadth)
   *   0.6 = 6 of 10 types fired (well-rounded engagement)
   *   1.0 = all 10 types fired
   *
   * Pricing × 5 = 0.10 diversity (only 1 of 10 slots active).
   * Pricing + About + Form start = 0.30 diversity.
   */
  signalDiversityScore: number;

  /**
   * Count of distinct high-value signal types that have fired (0–10).
   * Used for funnel-stage progression gates.
   */
  uniqueSignalCount: number;

  /**
   * Burst penalty (0–0.5).
   *
   * Applied when many events occur in a short time window (BURST_WINDOW_MS)
   * with low diversity (few distinct signal keys).  Indicates rapid-fire
   * repetitive navigation rather than deliberate research.
   *
   *   0    = no burst detected
   *   0.1  = mild burst (4 events in 60s, 1–2 distinct types)
   *   0.3  = moderate burst
   *   0.5  = severe burst (many events, minimal diversity)
   */
  burstPenalty: number;

  /**
   * Count of events that were downweighted as near-duplicates.
   * An event is a near-duplicate when the same (event_type + page_path) was
   * seen within DEDUP_WINDOW_MS (default: 30 seconds).
   */
  deduplicatedEventCount: number;

  // Funnel
  funnelStage:           JourneyFunnelStage;
  funnelStageConfidence: number;

  // Matched sequence slugs
  matchedSequences:     string[];

  /**
   * Sum of `confidence_contribution` from all matched sequence patterns (0–1).
   *
   * When patterns define explicit `confidence_contribution` values, this field
   * accumulates them (capped at 1.0) so `computeSequenceConfidence()` can use
   * pattern-specific weights rather than a flat per-sequence bonus.
   *
   * 0 = no sequences matched or all patterns use the default contribution.
   */
  sequenceConfidenceContribution: number;

  /**
   * Multi-dimensional confidence model.
   * Populated by fetchJourneyState() via computeBehaviorConfidence().
   * Use this to gate adaptive experience decisions.
   */
  confidence:           BehaviorConfidence;

  /**
   * Scoring debug payload — available only when the scoring engine runs a
   * full recomputation.  Always undefined when loaded from the DB cache without
   * recomputation (i.e. most page requests).
   *
   * Use this in the debug panel to explain which rules fired and how much each
   * contributed to intentScore.
   */
  scoringDebug?:        ScoringDebugPayload;

  /** True when populated from a real DB row (false = fallback zero-value). */
  fromDatabase:         boolean;
}

// ── Safe zero value ───────────────────────────────────────────────────────────

/** Returns a safe zero-value BehaviorConfidence. */
export function emptyConfidence(): BehaviorConfidence {
  return {
    intentConfidence:      0,
    sequenceConfidence:    0,
    funnelStageConfidence: 0.5,
    overallConfidence:     0,
    band:                  "low",
    reasons:               ["No behavioral data yet."],
  };
}

/** Returns a safe zero-value JourneyState. Used on DB error or first visit. */
export function emptyJourneyState(): JourneyState {
  return {
    firstSeenAt:           null,
    lastSeenAt:            null,
    pageViewCount:         0,
    ctaClickCount:         0,
    formStartCount:        0,
    formSubmitCount:       0,
    downloadCount:         0,
    hasVisitedAbout:       false,
    hasVisitedPricing:     false,
    hasVisitedCases:       false,
    hasVisitedContact:     false,
    hasClickedCta:         false,
    hasSubmittedForm:      false,
    viewedCategories:      [],
    viewedKeywords:        [],
    recencyScore:          0,
    engagementScore:       0,
    intentScore:           0,
    sequenceScore:         0,
    shortTermIntentScore:  0,
    longTermAffinityScore: 0,
    intentFreshness:       0,
    sequenceMatchedAt:     null,
    repeatSessionBonus:    0,
    // v3 anti-noise
    frictionScore:         0,
    signalDiversityScore:  0,
    uniqueSignalCount:     0,
    burstPenalty:          0,
    deduplicatedEventCount:0,
    funnelStage:           "awareness",
    funnelStageConfidence: 0.5,
    matchedSequences:               [],
    sequenceConfidenceContribution: 0,
    confidence:            emptyConfidence(),
    fromDatabase:          false,
  };
}

// ── DB row shape ──────────────────────────────────────────────────────────────

/**
 * Row shape from visitor_behavior_state (snake_case).
 * v2 columns are optional so existing rows without them remain valid.
 */
export interface BehaviorStateRow {
  id:                      string;
  tenant_id:               string;
  session_id:              string;
  first_seen_at:           string | null;
  last_seen_at:            string | null;
  page_view_count:         number;
  cta_click_count:         number;
  form_start_count:        number;
  form_submit_count:       number;
  download_count:          number;
  has_visited_about:       boolean;
  has_visited_pricing:     boolean;
  has_visited_cases:       boolean;
  has_visited_contact:     boolean;
  has_clicked_cta:         boolean;
  has_submitted_form:      boolean;
  viewed_categories:       string[];
  viewed_keywords:         string[];
  recency_score:           number;
  engagement_score:        number;
  intent_score:            number;
  sequence_score:          number;
  funnel_stage:            string;
  funnel_stage_confidence: number;
  matched_sequences:       string[];
  updated_at:              string;

  // ── Journey Engine v2 columns (nullable — added via migration 0032) ──────
  /** Intent contribution from events < 24h old (0–100). */
  short_term_intent_score?:  number | null;
  /** Sustained affinity from events 7d+ old (0–100). */
  long_term_affinity_score?: number | null;
  /** shortTermIntentScore / (intentScore + 1). */
  intent_freshness?:         number | null;
  /** ISO-8601 of most recent sequence completion. */
  sequence_matched_at?:      string | null;
  /** Return-visitor bonus 0–1. */
  repeat_session_bonus?:     number | null;

  // ── Journey Engine v3 anti-noise columns (nullable — migration 0033) ──────
  /** Composite friction/confusion score 0–100. */
  friction_score?:              number | null;
  /** Signal diversity score 0–1. */
  signal_diversity_score?:      number | null;
  /** Count of distinct high-value signal types (0–10). */
  unique_signal_count?:         number | null;
  /** Burst penalty 0–0.5. */
  burst_penalty?:               number | null;
  /** Count of near-duplicate downweighted events. */
  deduplicated_event_count?:    number | null;

  // ── Sequence Engine v2 columns (nullable — migration 0034) ────────────────
  /**
   * Sum of confidence_contribution from matched sequence patterns (0–1).
   * Used by computeSequenceConfidence() when patterns define custom weights.
   * Null / absent when no custom contributions have been defined.
   */
  sequence_confidence_contribution?: number | null;
}

/**
 * Maps a BehaviorStateRow to a JourneyState (camelCase).
 * NOTE: `confidence` is intentionally set to emptyConfidence() here;
 * fetchJourneyState() overwrites it with the real computed value after
 * calling this function, avoiding a circular import with compute-confidence.ts.
 */
export function rowToJourneyState(row: BehaviorStateRow): JourneyState {
  return {
    firstSeenAt:           row.first_seen_at,
    lastSeenAt:            row.last_seen_at,
    pageViewCount:         row.page_view_count,
    ctaClickCount:         row.cta_click_count,
    formStartCount:        row.form_start_count,
    formSubmitCount:       row.form_submit_count,
    downloadCount:         row.download_count,
    hasVisitedAbout:       row.has_visited_about,
    hasVisitedPricing:     row.has_visited_pricing,
    hasVisitedCases:       row.has_visited_cases,
    hasVisitedContact:     row.has_visited_contact,
    hasClickedCta:         row.has_clicked_cta,
    hasSubmittedForm:      row.has_submitted_form,
    viewedCategories:      row.viewed_categories ?? [],
    viewedKeywords:        row.viewed_keywords ?? [],
    recencyScore:          row.recency_score,
    engagementScore:       row.engagement_score,
    intentScore:           row.intent_score,
    sequenceScore:         row.sequence_score,
    shortTermIntentScore:  row.short_term_intent_score  ?? 0,
    longTermAffinityScore: row.long_term_affinity_score ?? 0,
    intentFreshness:       row.intent_freshness         ?? 0,
    sequenceMatchedAt:     row.sequence_matched_at      ?? null,
    repeatSessionBonus:    row.repeat_session_bonus     ?? 0,
    // v3
    frictionScore:          row.friction_score             ?? 0,
    signalDiversityScore:   row.signal_diversity_score     ?? 0,
    uniqueSignalCount:      row.unique_signal_count        ?? 0,
    burstPenalty:           row.burst_penalty              ?? 0,
    deduplicatedEventCount: row.deduplicated_event_count   ?? 0,
    funnelStage:           (row.funnel_stage as JourneyFunnelStage) ?? "awareness",
    funnelStageConfidence: Number(row.funnel_stage_confidence) || 0.5,
    matchedSequences:               row.matched_sequences ?? [],
    sequenceConfidenceContribution: row.sequence_confidence_contribution ?? 0,
    confidence:            emptyConfidence(), // replaced by fetchJourneyState()
    fromDatabase:          true,
  };
}
