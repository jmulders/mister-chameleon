/**
 * Experience Types
 *
 * Defines the HomepageExperience shape — the fully resolved, render-ready
 * output of the experience composer.
 *
 * A HomepageExperience is produced by combining:
 *   - A VisitorContext  (signal layer)
 *   - An ExperiencePlan (decision layer)
 *   - Three *BlockData  (CMS layer)
 *
 * It is the single value passed from the server to the homepage renderer.
 * All three block fields are guaranteed non-null; the composer applies
 * fallback logic before constructing this type.
 *
 * ─── Type hierarchy ──────────────────────────────────────────────────────────
 *
 *   VisitorContext            (src/context/types.ts)
 *     └─ detectVisitorContext()
 *
 *   ExperiencePlan            (src/decision/types.ts)
 *     └─ DecisionProvider.getHomepagePlan()
 *
 *   HeroBlockData             (src/cms/types.ts)
 *   ProofBlockData            (src/cms/types.ts)
 *   CTABlockData              (src/cms/types.ts)
 *   FeatureBlockData          (src/cms/types.ts)   optional — extended slot
 *   ConversionBlockData       (src/cms/types.ts)   optional — extended slot
 *     └─ CMSProvider.get*Variant()
 *
 *   HomepageExperience        ← YOU ARE HERE
 *     └─ composeHomepageExperience()
 */

import type { ExperiencePlan } from "@/decision/types";
import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  FeatureBlockData,
  ConversionBlockData,
  NotificationBlockData,
} from "@/cms/types";
import type { DecisionTrace } from "@/decision/trace";

/**
 * The fully resolved, render-ready experience for the homepage.
 *
 * Core block fields (hero, proof, cta) are non-null: the composer guarantees
 * that fallback content is applied before this type is constructed.
 *
 * Extended block fields (feature, conversion) are optional — they are present
 * only when the page template declares the slot AND the CMS returns a document.
 * If the CMS returns null for an extended slot, it is simply absent here (no
 * fallback cascade).
 *
 * @example
 * const experience = await composeHomepageExperience(context, decision, cms);
 * // experience.hero, experience.proof, experience.cta are always defined
 * // experience.feature and experience.conversion may be undefined
 */
export interface HomepageExperience {
  /** The hero section content for this visitor. */
  hero: HeroBlockData;

  /** The proof/social-proof section content for this visitor. */
  proof: ProofBlockData;

  /** The call-to-action section content for this visitor. */
  cta: CTABlockData;

  /**
   * The feature highlights / benefit grid section content for this visitor.
   *
   * Optional — present only when the page template declares a featureSlot
   * AND the decision engine resolved a featureKey AND the CMS returned a
   * matching document.  Absent otherwise (no fallback cascade).
   */
  feature?: FeatureBlockData;

  /**
   * The conversion-focused section content for this visitor.
   *
   * Optional — present only when the page template declares a conversionSlot
   * AND the decision engine resolved a conversionKey AND the CMS returned a
   * matching document.  Absent otherwise (no fallback cascade).
   */
  conversion?: ConversionBlockData;

  /**
   * The notification overlay content for this visitor.
   *
   * Optional — present only when the decision engine resolved a notificationKey
   * AND the CMS returned a matching document.  Absent otherwise (no notification shown).
   * The overlay renders above all other page content (fixed position).
   */
  notification?: NotificationBlockData;

  /**
   * The decision plan that produced this experience.
   * Includes the variant keys, reason string, and whether a fallback was used.
   */
  plan: ExperiencePlan;
}

/**
 * Metadata emitted by the composer alongside the experience.
 * Used by debug routes and server-side logging.
 *
 * Not included in HomepageExperience itself to keep the render shape clean.
 */
export interface ExperienceComposerMeta {
  /**
   * True if any CMS fetch returned null and the fallback plan was substituted.
   * Useful for alerting / observability.
   */
  usedFallback: boolean;

  /**
   * ISO timestamp (ms since epoch) when composition completed.
   */
  composedAt: number;

  /**
   * Which variant keys were actually used (post-fallback).
   * May differ from plan.heroKey / plan.proofKey / plan.ctaKey if a
   * partial fallback was applied.
   */
  resolvedKeys: {
    heroKey:          string;
    proofKey:         string;
    ctaKey:           string;
    /** Present when a featureKey was resolved and a CMS document was found. */
    featureKey?:      string;
    /** Present when a conversionKey was resolved and a CMS document was found. */
    conversionKey?:   string;
    /** Present when a notificationKey was resolved and a CMS document was found. */
    notificationKey?: string;
  };

  /**
   * The original decision-engine plan that triggered the fallback.
   * Only present when `usedFallback` is true.
   *
   * Enables the debug panel to show exactly which variant keys the decision
   * engine chose but could not resolve from the CMS — so an editor or operator
   * can either seed the missing documents or adjust the decision rules.
   */
  primaryPlan?: {
    heroKey:  string;
    proofKey: string;
    ctaKey:   string;
    reason:   string;
  };

  /**
   * Which fallback tier was used to compose the final experience.
   * Only present when `usedFallback` is true.
   *
   *   "tier1" — CMS-defined fallback keys (tenant-specific contextConfig)
   *   "tier2" — Hardcoded FALLBACK_PLAN keys (platform-wide)
   *   "tier3" — STATIC_EMERGENCY_EXPERIENCE (in-code, no CMS dependency)
   */
  fallbackTier?: "tier1" | "tier2" | "tier3";
}

/**
 * Combined output returned by composeHomepageExperience when the caller
 * needs both the experience and the composer metadata.
 */
export interface ComposedHomepageExperience {
  experience: HomepageExperience;
  meta: ExperienceComposerMeta;
  /**
   * Decision trace capturing which path was taken and why.
   *
   * Populated by buildDecisionTrace() in composeHomepageExperience().
   * Safe to read in dev diagnostics and admin debug pages — no secrets,
   * no raw IPs, no auth tokens.
   */
  trace: DecisionTrace;
}
