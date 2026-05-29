/**
 * Journey — Public API
 *
 * Re-exports the public surface of the behavioral personalization system.
 * Import from "@/lib/journey" rather than individual files.
 */

// Core types
export type {
  JourneyState,
  JourneyEventInput,
  JourneyEventType,
  JourneyFunnelStage,
  JourneyEventRow,
  ScoringRule,
  SequencePattern,
  DecayProfile,
  BehaviorStateRow,
} from "./types";
export { emptyJourneyState, rowToJourneyState } from "./types";

// Event recording
export { recordJourneyEvent }    from "./record-event";

// State reads
export { fetchJourneyState, fetchRecentJourneyEvents } from "./fetch-journey-state";

// State rebuild (call fire-and-forget)
export { updateBehaviorState }   from "./update-behavior-state";

// Pure computation utilities (available for tests and server-side derivation)
export {
  applyDecay,
  applyDecaySmooth,
  computeRecencyScore,
  computeRepeatSessionBonus,
  partitionEventsByAge,
  getDecayLabel,
  eventAgeDays,
  DEFAULT_DECAY_PROFILE,
  MS_PER_DAY,
  DECAY_BUCKET_DAYS,
} from "./apply-decay";
export type { AgeBuckets, DecayStrength }  from "./apply-decay";
export { detectSequences }       from "./detect-sequences";
export type { SequenceMatchDetail, SequencePartialDetail, SequenceDetectionResult } from "./detect-sequences";
export { deriveFunnelStage }     from "./derive-funnel-stage";
export type { FunnelStageInput, FunnelStageResult } from "./derive-funnel-stage";
export { deriveBehaviorState }   from "./derive-behavior-state";

// Confidence and gating
export {
  computeBehaviorConfidence,
  gateAdaptiveDecisions,
  meetsConfidenceThreshold,
  meetsSequenceConfidenceThreshold,
  meetsIntentConfidenceThreshold,
  // v2 rule engine helpers
  hasMatchedSequence,
  meetsShortTermIntentThreshold,
  meetsLongTermAffinityThreshold,
  meetsIntentFreshnessThreshold,
} from "./compute-confidence";
