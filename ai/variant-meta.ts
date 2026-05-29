/**
 * AI Variant Decision Metadata
 *
 * Describes what each slot variant means for AI decision-making.
 * Only variants with complete metadata (aiReady === true) are offered to the AI.
 */

export type IntentLevel = "awareness" | "consideration" | "decision";

export type FunnelStage = "awareness" | "consideration" | "decision" | "retention";

export type VisitorSource = "google" | "linkedin" | "direct" | "unknown";

export type VariantTone =
  | "educational"
  | "inspiring"
  | "direct"
  | "persuasive"
  | "credibility"
  | "urgency";

export interface VariantDecisionMeta {
  /** Short human-readable label for this variant (used in logs/UI). */
  decisionLabel: string;

  /** One-sentence explanation of what this variant communicates and why. */
  decisionSummary: string;

  /**
   * Longer editorial description of what this variant communicates visually
   * and emotionally — for admin reference and documentation purposes.
   * Optional; does not affect AI-ready gating.
   */
  whatThisVariantCommunicates?: string;

  /** Description of the ideal visitor for this variant. */
  intendedAudience: string;

  /** Where the visitor likely is in the buying journey. */
  intentLevel: IntentLevel;

  /** Which funnel stages this variant fits. */
  funnelStages: FunnelStage[];

  /** Traffic sources this variant performs best for. */
  bestForSources: VisitorSource[];

  /** Emotional/rhetorical tone of the variant. */
  tone: VariantTone;

  /** Primary conversion goal this variant targets. */
  primaryGoal: string;

  /** Supporting goals (may be empty). */
  supportingGoals: string[];

  /**
   * Conditions under which this variant should NOT be chosen.
   * AI uses these as hard exclusions.
   */
  exclusions: string[];
}

/** A resolved variant candidate that the AI may choose from. */
export interface VariantCandidate {
  /** Variant key used in the stored experience plan. */
  key: string;

  /** Which slot this variant belongs to. */
  slotType: "hero" | "proof" | "cta" | "feature" | "conversion";

  /**
   * True when all required decision metadata is present.
   * Only aiReady variants are forwarded to the AI prompt.
   */
  aiReady: boolean;

  /**
   * Full decision metadata, or null when not yet described.
   * When null, aiReady must be false.
   */
  decisionMeta: VariantDecisionMeta | null;

  /** Whether the variant comes from the platform registry or the CMS. */
  source: "platform" | "tenant";
}

/** All candidate variants for the three primary personalisation slots. */
export interface SlotCandidates {
  hero: VariantCandidate[];
  proof: VariantCandidate[];
  cta: VariantCandidate[];
}

// ─── Required fields for aiReady computation ────────────────────────────────

const REQUIRED_META_FIELDS: Array<keyof VariantDecisionMeta> = [
  "decisionLabel",
  "decisionSummary",
  "intendedAudience",
  "intentLevel",
  "funnelStages",
  "bestForSources",
  "tone",
  "primaryGoal",
];

/**
 * Returns true when all required decision metadata fields are populated.
 * Used at CMS variant resolution time to gate AI access.
 */
export function isMetaComplete(meta: Partial<VariantDecisionMeta> | null | undefined): boolean {
  if (!meta) return false;
  return REQUIRED_META_FIELDS.every((field) => {
    const val = meta[field];
    if (Array.isArray(val)) return val.length > 0;
    return val !== undefined && val !== null && val !== "";
  });
}
