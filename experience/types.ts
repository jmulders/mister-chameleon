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
 *     └─ CMSProvider.get*Variant()
 *
 *   HomepageExperience        ← YOU ARE HERE
 *     └─ composeHomepageExperience()
 */

import type { ExperiencePlan } from "@/decision/types";
import type { HeroBlockData, ProofBlockData, CTABlockData } from "@/cms/types";

/**
 * The fully resolved, render-ready experience for the homepage.
 *
 * All block fields are non-null: the composer guarantees that fallback
 * content is applied before this type is constructed.
 *
 * @example
 * const experience = await composeHomepageExperience(context, decision, cms);
 * // experience.hero, experience.proof, experience.cta are always defined
 */
export interface HomepageExperience {
  /** The hero section content for this visitor. */
  hero: HeroBlockData;

  /** The proof/social-proof section content for this visitor. */
  proof: ProofBlockData;

  /** The call-to-action section content for this visitor. */
  cta: CTABlockData;

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
    heroKey: string;
    proofKey: string;
    ctaKey: string;
  };
}

/**
 * Combined output returned by composeHomepageExperience when the caller
 * needs both the experience and the composer metadata.
 */
export interface ComposedHomepageExperience {
  experience: HomepageExperience;
  meta: ExperienceComposerMeta;
}
