/**
 * Experience Composer
 *
 * Combines the three platform layers — context, decision, and CMS — into a
 * single, render-ready HomepageExperience.
 *
 * ─── Composition flow ────────────────────────────────────────────────────────
 *
 *   1. Call DecisionProvider.getHomepagePlan(context)
 *      → resolves the variant keys appropriate for this visitor
 *
 *   2. Call CMSProvider.get*Variant() for each key in parallel
 *      → fetches hero, proof, and cta block data from the CMS
 *
 *   3. Validate that all three blocks are non-null
 *      → if any block is null, substitute the fallback plan and re-fetch
 *
 *   4. Return HomepageExperience + ExperienceComposerMeta
 *      → both the rendered shape and the observability metadata
 *
 * ─── Fallback strategy ───────────────────────────────────────────────────────
 *
 *   If ANY of the three CMS fetches returns null (unknown key, CMS error,
 *   schema mismatch), the composer discards the partial result and attempts
 *   fallback in two tiers:
 *
 *   Tier 1 — CMS fallback keys (tenant-specific, optional)
 *     Provided via the optional `cmsFallbackKeys` argument, extracted from the
 *     page document's `contextConfig.*.fallbackVariantKey` fields.  When a key
 *     is present it is preferred over the corresponding hardcoded key.  Missing
 *     keys fall through to the hardcoded tier.
 *
 *     Example: WorkEngine's Sanity page document declares
 *       contextConfig.hero.fallbackVariantKey = "hero_workengine_default"
 *     so the composer serves that variant instead of the generic "hero_direct_brand".
 *
 *   Tier 2 — hardcoded FALLBACK_PLAN (platform defaults)
 *     Used when no CMS fallback keys are provided, or when the CMS fallback
 *     keys themselves resolve to null.  Keys are the most neutral, brand-led
 *     variants — safe for any tenant and any visitor type.
 *
 *       hero:  hero_direct_brand
 *       proof: proof_platform
 *       cta:   cta_meeting
 *
 *   This is intentionally an all-or-nothing fallback: a mixed experience
 *   (e.g. google hero + fallback CTA) produces incoherent messaging.
 *
 *   If even the hardcoded fallback plan cannot be fetched, the function throws —
 *   there is no sensible degradation below "the default experience doesn't exist."
 *
 * ─── Error handling ──────────────────────────────────────────────────────────
 *
 *   - CMSProvider errors propagate upward; the caller (page / route) is
 *     responsible for deciding whether to show a 500 or a static fallback page.
 *   - DecisionProvider errors also propagate; the provider itself wraps
 *     individual rule errors (see RulesDecisionProvider).
 *   - Fallback fetch failures throw immediately with a clear error message.
 */

import { logger } from "@/lib/logger";
import { isNonNull } from "@/lib/assert";
import type { DecisionInput, ExperiencePlan, HeroVariantKey, ProofVariantKey, CTAVariantKey } from "@/decision/types";
import type { DecisionProvider } from "@/decision/providers/decision-provider";
import type { CMSProvider } from "@/cms/providers/cms-provider";
import type { HeroBlockData, ProofBlockData, CTABlockData } from "@/cms/types";
import type {
  HomepageExperience,
  ExperienceComposerMeta,
  ComposedHomepageExperience,
} from "./types";

// ── CMS fallback keys ─────────────────────────────────────────────────────────

/**
 * Tenant-specific fallback variant keys extracted from the CMS page document's
 * `contextConfig.*.fallbackVariantKey` fields.
 *
 * When provided to `composeHomepageExperience`, these keys are tried as the
 * first fallback tier when the decision engine's primary plan cannot be
 * resolved from the CMS.  If they also fail, the hardcoded `FALLBACK_PLAN`
 * is tried as a last resort.
 *
 * All fields are optional; undefined fields fall through to the corresponding
 * hardcoded FALLBACK_PLAN key.
 *
 * @example
 * // From WorkEngine's Sanity page document:
 * const cmsFallbackKeys: CmsFallbackKeys = {
 *   heroKey:  "hero_workengine_default",
 *   proofKey: "proof_workengine_default",
 *   ctaKey:   "cta_workengine_default",
 * };
 */
export interface CmsFallbackKeys {
  heroKey?:  string;
  proofKey?: string;
  ctaKey?:   string;
}

// ── Fallback plan ─────────────────────────────────────────────────────────────

/**
 * The last-resort fallback experience plan used when both the primary plan AND
 * any CMS-defined fallback keys cannot be resolved from the CMS.
 *
 * Keys are the most neutral, brand-led variants — safe for any tenant and any
 * visitor type.
 */
const FALLBACK_PLAN: ExperiencePlan = {
  heroKey:  "hero_direct_brand",
  proofKey: "proof_platform",
  ctaKey:   "cta_meeting",
  reason:   "Fallback: one or more primary CMS variants were unavailable.",
};

// ── Core composer ─────────────────────────────────────────────────────────────

/**
 * Compose a fully resolved HomepageExperience for the given visitor context.
 *
 * This is the main entry point for the experience layer. It is called once per
 * page request (server-side) and the result is passed directly to the homepage
 * renderer.
 *
 * @param input             The visitor context detected from the incoming request.
 * @param decisionProvider  The decision engine to use (e.g. RulesDecisionProvider).
 * @param cmsProvider       The CMS provider to use (e.g. SanityProvider).
 * @param cmsFallbackKeys   Optional CMS-defined fallback variant keys.  Extracted
 *                          from the CMS page document's contextConfig fields.
 *                          Tried as the first fallback tier before the hardcoded
 *                          FALLBACK_PLAN when the primary plan cannot be resolved.
 * @returns                 The resolved experience and composer metadata.
 *
 * @throws {Error} If neither the CMS fallback keys nor the hardcoded fallback
 *                 plan can be fetched from the CMS.
 *
 * @example
 * const { experience, meta } = await composeHomepageExperience(
 *   context,
 *   new RulesDecisionProvider(),
 *   cmsProvider,
 *   { heroKey: "hero_workengine_default", proofKey: "proof_workengine_default", ctaKey: "cta_workengine_default" },
 * );
 */
export async function composeHomepageExperience(
  input:            DecisionInput,
  decisionProvider: DecisionProvider,
  cmsProvider:      CMSProvider,
  cmsFallbackKeys?: CmsFallbackKeys,
): Promise<ComposedHomepageExperience> {
  const startedAt = Date.now();

  // ── Step 1: Resolve the experience plan ──────────────────────────────────
  const plan = await decisionProvider.getHomepagePlan(input);

  logger.debug("Experience plan resolved", {
    heroKey:       plan.heroKey,
    proofKey:      plan.proofKey,
    ctaKey:        plan.ctaKey,
    reason:        plan.reason,
    source:        input.source,
    visitType:     input.visitType,
    pageViewCount: input.history.pageViewCount,
    hasClickedCta: input.history.hasClickedCta,
  });

  // ── Step 2: Fetch all three CMS variants in parallel ─────────────────────
  const [hero, proof, cta] = await Promise.all([
    cmsProvider.getHeroVariant(plan.heroKey),
    cmsProvider.getProofVariant(plan.proofKey),
    cmsProvider.getCTAVariant(plan.ctaKey),
  ]);

  // ── Step 3: Validate; fall back if any variant is missing ────────────────
  const allPresent = isNonNull(hero) && isNonNull(proof) && isNonNull(cta);

  if (!allPresent) {
    const missingKeys: string[] = [];
    if (!isNonNull(hero))  missingKeys.push(`heroKey: "${plan.heroKey}"`);
    if (!isNonNull(proof)) missingKeys.push(`proofKey: "${plan.proofKey}"`);
    if (!isNonNull(cta))   missingKeys.push(`ctaKey: "${plan.ctaKey}"`);

    logger.warn(
      "One or more CMS variants returned null; applying fallback plan.",
      {
        missingKeys,
        originalPlan: { heroKey: plan.heroKey, proofKey: plan.proofKey, ctaKey: plan.ctaKey },
        cmsFallbackKeys,
        hardcodedFallback: {
          heroKey:  FALLBACK_PLAN.heroKey,
          proofKey: FALLBACK_PLAN.proofKey,
          ctaKey:   FALLBACK_PLAN.ctaKey,
        },
      },
    );

    return composeFallback(cmsProvider, startedAt, cmsFallbackKeys);
  }

  // ── Step 4: Build the resolved experience ────────────────────────────────
  const experience: HomepageExperience = {
    hero:  hero  as HeroBlockData,
    proof: proof as ProofBlockData,
    cta:   cta   as CTABlockData,
    plan,
  };

  const meta: ExperienceComposerMeta = {
    usedFallback: false,
    composedAt:   Date.now(),
    resolvedKeys: {
      heroKey:  plan.heroKey,
      proofKey: plan.proofKey,
      ctaKey:   plan.ctaKey,
    },
  };

  logger.debug("Homepage experience composed successfully.", {
    usedFallback: false,
    durationMs:   meta.composedAt - startedAt,
    resolvedKeys: meta.resolvedKeys,
  });

  return { experience, meta };
}

// ── Fallback helper ───────────────────────────────────────────────────────────

/**
 * Fetch and assemble the fallback experience using a two-tier strategy:
 *
 *   Tier 1 — CMS fallback keys (tenant-specific, when provided)
 *     Merges CMS keys with FALLBACK_PLAN: for each slot, the CMS key is used
 *     when present, otherwise the hardcoded FALLBACK_PLAN key is used.
 *     If any variant is still missing, falls through to tier 2.
 *
 *   Tier 2 — hardcoded FALLBACK_PLAN (platform defaults)
 *     Used when no CMS fallback keys are provided, or when the merged plan
 *     from tier 1 still cannot be fully resolved.
 *     Throws if any variant is missing — this indicates a misconfigured CMS.
 *
 * @internal
 */
async function composeFallback(
  cmsProvider:     CMSProvider,
  startedAt:       number,
  cmsFallbackKeys?: CmsFallbackKeys,
): Promise<ComposedHomepageExperience> {

  // ── Tier 1: Try CMS fallback keys (tenant-specific) ──────────────────────
  if (cmsFallbackKeys) {
    // Merge CMS-defined keys with FALLBACK_PLAN: prefer CMS key where present.
    const effectiveHeroKey  = cmsFallbackKeys.heroKey  ?? FALLBACK_PLAN.heroKey;
    const effectiveProofKey = cmsFallbackKeys.proofKey ?? FALLBACK_PLAN.proofKey;
    const effectiveCtaKey   = cmsFallbackKeys.ctaKey   ?? FALLBACK_PLAN.ctaKey;

    // Cast to branded key types: CMS fallback keys are intentionally outside
    // the closed decision-engine vocabulary (e.g. "hero_workengine_default").
    // CMSProvider.get*Variant() accepts plain string so the cast is safe.
    const effectivePlan: ExperiencePlan = {
      heroKey:  effectiveHeroKey  as HeroVariantKey,
      proofKey: effectiveProofKey as ProofVariantKey,
      ctaKey:   effectiveCtaKey   as CTAVariantKey,
      reason:   "CMS-defined fallback keys applied (tenant-specific).",
    };

    const [cmsHero, cmsProof, cmsCta] = await Promise.all([
      cmsProvider.getHeroVariant(effectiveHeroKey),
      cmsProvider.getProofVariant(effectiveProofKey),
      cmsProvider.getCTAVariant(effectiveCtaKey),
    ]);

    if (isNonNull(cmsHero) && isNonNull(cmsProof) && isNonNull(cmsCta)) {
      const composedAt = Date.now();

      logger.info("Homepage experience composed using CMS fallback keys.", {
        durationMs:   composedAt - startedAt,
        resolvedKeys: { heroKey: effectiveHeroKey, proofKey: effectiveProofKey, ctaKey: effectiveCtaKey },
      });

      return {
        experience: {
          hero:  cmsHero,
          proof: cmsProof,
          cta:   cmsCta,
          plan:  effectivePlan,
        },
        meta: {
          usedFallback: true,
          composedAt,
          resolvedKeys: {
            heroKey:  effectiveHeroKey,
            proofKey: effectiveProofKey,
            ctaKey:   effectiveCtaKey,
          },
        },
      };
    }

    // CMS fallback keys also returned null on some slots — log and try tier 2.
    const missingCms: string[] = [];
    if (!isNonNull(cmsHero))  missingCms.push(`heroKey: "${effectiveHeroKey}"`);
    if (!isNonNull(cmsProof)) missingCms.push(`proofKey: "${effectiveProofKey}"`);
    if (!isNonNull(cmsCta))   missingCms.push(`ctaKey: "${effectiveCtaKey}"`);

    logger.warn(
      "CMS fallback keys also returned null; falling through to hardcoded FALLBACK_PLAN.",
      { missingCms, triedKeys: effectivePlan },
    );
  }

  // ── Tier 2: Hardcoded FALLBACK_PLAN (last resort) ────────────────────────
  const [fallbackHero, fallbackProof, fallbackCta] = await Promise.all([
    cmsProvider.getHeroVariant(FALLBACK_PLAN.heroKey),
    cmsProvider.getProofVariant(FALLBACK_PLAN.proofKey),
    cmsProvider.getCTAVariant(FALLBACK_PLAN.ctaKey),
  ]);

  // If the fallback variants are also missing, there is nothing we can do.
  if (!isNonNull(fallbackHero) || !isNonNull(fallbackProof) || !isNonNull(fallbackCta)) {
    const missing: string[] = [];
    if (!isNonNull(fallbackHero)) missing.push(`heroKey: "${FALLBACK_PLAN.heroKey}"`);
    if (!isNonNull(fallbackProof)) missing.push(`proofKey: "${FALLBACK_PLAN.proofKey}"`);
    if (!isNonNull(fallbackCta))  missing.push(`ctaKey: "${FALLBACK_PLAN.ctaKey}"`);

    const message =
      `[composeHomepageExperience] Fallback CMS variants are missing: ${missing.join(", ")}. ` +
      `The CMS provider must always have content for the fallback plan keys.`;

    logger.error(message, { missingFallbackKeys: missing });
    throw new Error(message);
  }

  const experience: HomepageExperience = {
    hero:  fallbackHero,
    proof: fallbackProof,
    cta:   fallbackCta,
    plan:  FALLBACK_PLAN,
  };

  const composedAt = Date.now();

  const meta: ExperienceComposerMeta = {
    usedFallback: true,
    composedAt,
    resolvedKeys: {
      heroKey:  FALLBACK_PLAN.heroKey,
      proofKey: FALLBACK_PLAN.proofKey,
      ctaKey:   FALLBACK_PLAN.ctaKey,
    },
  };

  logger.info("Fallback homepage experience composed using hardcoded FALLBACK_PLAN.", {
    durationMs:   composedAt - startedAt,
    resolvedKeys: meta.resolvedKeys,
  });

  return { experience, meta };
}
