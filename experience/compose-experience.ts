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
 *   fallback across four tiers — each tier only reached if the previous fails:
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
 *   Tier 2 — hardcoded FALLBACK_PLAN (platform defaults, CMS-backed)
 *     Used when no CMS fallback keys are provided, or when the CMS fallback
 *     keys themselves resolve to null.  Keys are the most neutral, brand-led
 *     variants — safe for any tenant and any visitor type.
 *
 *       hero:  hero_direct_brand
 *       proof: proof_platform
 *       cta:   cta_meeting
 *
 *     These shared variants are provisioned by `npx tsx cms/seed/platform-seed.ts`.
 *     When they resolve successfully, the page always renders — even for tenants
 *     with no CMS content of their own.
 *
 *   Tier 3 — STATIC_EMERGENCY_EXPERIENCE (in-code, no CMS required)
 *     If even the FALLBACK_PLAN keys cannot be fetched (e.g. platform seed was
 *     not run, or the CMS dataset is temporarily unreachable), the composer
 *     serves a fully in-code experience whose content mirrors the seed documents.
 *     This tier logs an actionable error and NEVER crashes the page.
 *     Action: run `npx tsx cms/seed/platform-seed.ts` to restore Tier 2.
 *
 *   This is intentionally an all-or-nothing fallback: a mixed experience
 *   (e.g. google hero + fallback CTA) produces incoherent messaging.
 *
 * ─── Error handling ──────────────────────────────────────────────────────────
 *
 *   - CMSProvider errors propagate upward; the caller (page / route) is
 *     responsible for deciding whether to show a 500 or a static fallback page.
 *   - DecisionProvider errors also propagate; the provider itself wraps
 *     individual rule errors (see RulesDecisionProvider).
 *   - Fallback fetch failures are logged at error level and resolved with the
 *     static emergency experience — the function never throws.
 */

import { logger }                          from "@/lib/logger";
import { isNonNull }                        from "@/lib/assert";
import type { DecisionInput, ExperiencePlan, HeroVariantKey, ProofVariantKey, CTAVariantKey } from "@/decision/types";
import type { DecisionProvider }            from "@/decision/providers/decision-provider";
import { CachingDecisionProvider }          from "@/decision/providers/caching-decision-provider";
import type { CMSProvider }                 from "@/cms/providers/cms-provider";
import type { HeroBlockData, ProofBlockData, CTABlockData, FeatureBlockData, ConversionBlockData, NotificationBlockData } from "@/cms/types";
import { buildDecisionTrace }               from "@/decision/trace";
import { runFieldFill }                     from "@/ai/field-fill";
import type { FieldFillAdapter }            from "@/ai/field-fill";
import type { TenantFieldFillSettings, TenantAiPolicies } from "@/tenant/types";
import type { FieldFillTrace }              from "@/ai/field-fill/types";
import { resolveAiPolicy, getPlatformAiPolicy } from "@/ai/policy/resolve-policy";
import type { AiPhasePolicies }             from "@/ai/policy/types";
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
  heroKey?:       string;
  proofKey?:      string;
  ctaKey?:        string;
  /** Extended slot fallback keys — not subject to 4-tier fallback cascade. */
  featureKey?:    string;
  conversionKey?: string;
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

// ── Static emergency experience ───────────────────────────────────────────────

/**
 * A fully in-code experience served when the CMS is completely unavailable —
 * i.e. when even the hardcoded FALLBACK_PLAN keys cannot be fetched.
 *
 * This is the fourth and final tier of the fallback strategy:
 *
 *   Tier 1 — Decision engine primary plan  (CMS fetch)
 *   Tier 2 — CMS-defined fallback keys     (CMS fetch, tenant-specific)
 *   Tier 3 — Hardcoded FALLBACK_PLAN keys  (CMS fetch, platform-wide)
 *   Tier 4 — STATIC_EMERGENCY_EXPERIENCE   (no CMS, never fails)
 *
 * Content mirrors the shared platform seed documents so that the page is
 * coherent and on-brand even without any CMS connectivity.
 *
 * NOTE: Re-seeding the platform (npx tsx cms/seed/platform-seed.ts) after
 * fixing the key format will restore Tier 3 and this tier will never be
 * reached under normal operating conditions.
 */
const STATIC_EMERGENCY_PLAN: ExperiencePlan = {
  heroKey:  "hero_direct_brand",
  proofKey: "proof_platform",
  ctaKey:   "cta_meeting",
  reason:   "Emergency static fallback: CMS unavailable for all fallback tiers.",
};

const STATIC_EMERGENCY_EXPERIENCE = {
  hero: {
    id:       "hero_direct_brand",
    tag:      "Adaptive websites, without the complexity",
    title:    "Your website, tailored to every visitor.",
    subtitle:
      "Mister Chameleon delivers the right message to the right person — automatically. " +
      "No A/B testing required. No engineering sprints. No excuses.",
    ctas: [
      { label: "Start for free",   href: "/signup",       variant: "primary"   as const },
      { label: "See how it works", href: "/how-it-works", variant: "secondary" as const },
    ],
  } satisfies HeroBlockData,

  proof: {
    id:    "proof_platform",
    title: "Infrastructure you can trust",
    items: [
      {
        title: "Edge-native decision engine",
        text:
          "Context detection and experience resolution happen at the CDN edge — " +
          "sub-5ms latency with no origin round-trip, regardless of visitor location.",
      },
      {
        title: "99.99% uptime SLA",
        text:
          "Deployed across a global active-active edge network with automatic failover, " +
          "zero-downtime deployments, and a public status page.",
      },
      {
        title: "GDPR & CCPA compliant by default",
        text:
          "No PII is collected or stored. Every signal is evaluated ephemerally, in " +
          "memory, in real time. Your visitors' privacy is preserved automatically.",
      },
    ],
  } satisfies ProofBlockData,

  cta: {
    id:    "cta_meeting",
    title: "See Mister Chameleon in action",
    text:
      "Book a 20-minute live demo. We'll show you exactly how your homepage would " +
      "look to your three most important visitor segments.",
    cta: { label: "Book a demo", href: "/demo" },
  } satisfies CTABlockData,
} as const;

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
 * @param options           Optional caching hints and field fill config.
 *   sessionId       — When provided, the decision provider is wrapped with
 *                     `CachingDecisionProvider` so the resolved plan is reused
 *                     for subsequent page views in the same session.
 *   tenantId        — Used to tag the cached plan for tenant-scoped eviction.
 *   fieldFillConfig — When provided, Phase 2 AI field fill is run after CMS
 *                     fetch.  Each slot's fields may be AI-rewritten per the
 *                     config.  Pass null/undefined to skip field fill entirely.
 *   fieldFillAdapter — The AI adapter for field fill calls.  Pass null when
 *                      AI is globally disabled or field fill is not configured.
 * @returns                 The resolved experience and composer metadata.
 *                          Never rejects — if all CMS tiers fail, the static
 *                          emergency experience is returned and an error is logged.
 *
 * @example
 * const { experience, meta } = await composeHomepageExperience(
 *   context,
 *   new RulesDecisionProvider(),
 *   cmsProvider,
 *   { heroKey: "hero_workengine_default", proofKey: "proof_workengine_default", ctaKey: "cta_workengine_default" },
 *   { sessionId, tenantId, fieldFillConfig: tenant.fieldFill, fieldFillAdapter: adapter },
 * );
 */
export async function composeHomepageExperience(
  input:            DecisionInput,
  decisionProvider: DecisionProvider,
  cmsProvider:      CMSProvider,
  cmsFallbackKeys?: CmsFallbackKeys,
  options?:         {
    sessionId?:        string | null;
    tenantId?:         string | null;
    fieldFillConfig?:  TenantFieldFillSettings | null;
    fieldFillAdapter?: FieldFillAdapter | null;
    /** Unified AI governance policies — Phase 3. */
    aiPolicies?:       TenantAiPolicies | null;
  },
): Promise<ComposedHomepageExperience> {
  const startedAt = Date.now();

  // ── Step 1: Resolve the experience plan ──────────────────────────────────
  //
  // When a sessionId is provided, wrap the decision provider with the
  // CachingDecisionProvider decorator so the resolved plan is reused for
  // subsequent page views in the same session without re-running rules.
  const effectiveDecisionProvider: DecisionProvider =
    options?.sessionId
      ? new CachingDecisionProvider(
          decisionProvider,
          options.sessionId,
          options.tenantId ?? null,
        )
      : decisionProvider;

  const plan = await effectiveDecisionProvider.getHomepagePlan(input);

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

  // ── Step 2: Fetch core CMS variants in parallel ──────────────────────────
  //
  // Extended slots (feature, conversion) are fetched concurrently alongside
  // core slots — but their results do NOT trigger the fallback cascade.
  // If a key is absent from the plan, the fetch is skipped (null short-circuit).
  const [hero, proof, cta, feature, conversion, notification] = await Promise.all([
    cmsProvider.getHeroVariant(plan.heroKey),
    cmsProvider.getProofVariant(plan.proofKey),
    cmsProvider.getCTAVariant(plan.ctaKey),
    // Extended slots — only fetched when the decision engine resolved a key.
    plan.featureKey      ? cmsProvider.getFeatureVariant(plan.featureKey)           : Promise.resolve(null),
    plan.conversionKey   ? cmsProvider.getConversionVariant(plan.conversionKey)     : Promise.resolve(null),
    plan.notificationKey ? cmsProvider.getNotificationVariant(plan.notificationKey) : Promise.resolve(null),
  ]);

  // ── Step 3: Validate core slots; fall back if any is missing ─────────────
  //
  // Extended slot nulls are fine — the slot is simply absent from the experience.
  const allCorePresent = isNonNull(hero) && isNonNull(proof) && isNonNull(cta);

  if (!allCorePresent) {
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

    const fallbackResult = await composeFallback(cmsProvider, startedAt, plan, cmsFallbackKeys);
    const trace = buildDecisionTrace(
      decisionProvider,
      fallbackResult.experience.plan,
      /* usedCmsFallback */ true,
      input,
      startedAt,
    );
    return { ...fallbackResult, trace };
  }

  // ── Step 4: AI field fill (Phase 2 + Phase 3 policy) ───────────────────────
  //
  // Run field fill for each core slot when configured.  This is best-effort:
  // any failure silently returns the original CMS content for that slot.
  // Field fill traces are attached to the DecisionTrace after it is built.
  const fieldFillConfig  = options?.fieldFillConfig  ?? null;
  const fieldFillAdapter = options?.fieldFillAdapter ?? null;

  // Phase 3: resolve field fill AI policies for each slot
  const tenantPolicies = options?.aiPolicies as AiPhasePolicies | null | undefined;
  const platformPolicy = getPlatformAiPolicy();

  const heroPolicyFF  = resolveAiPolicy("fieldFill", "hero",  { tenantPolicies, platformPolicy });
  const proofPolicyFF = resolveAiPolicy("fieldFill", "proof", { tenantPolicies, platformPolicy });
  const ctaPolicyFF   = resolveAiPolicy("fieldFill", "cta",   { tenantPolicies, platformPolicy });

  const [heroResult, proofResult, ctaResult] = await Promise.all([
    runFieldFill("hero",  hero  as HeroBlockData,  fieldFillConfig?.hero  ?? undefined, input, fieldFillAdapter, heroPolicyFF),
    runFieldFill("proof", proof as ProofBlockData, fieldFillConfig?.proof ?? undefined, input, fieldFillAdapter, proofPolicyFF),
    runFieldFill("cta",   cta   as CTABlockData,   fieldFillConfig?.cta   ?? undefined, input, fieldFillAdapter, ctaPolicyFF),
  ]);

  const fieldFillTraces: Partial<Record<"hero" | "proof" | "cta", FieldFillTrace>> = {
    hero:  heroResult.trace,
    proof: proofResult.trace,
    cta:   ctaResult.trace,
  };
  const anyFieldFillRan = heroResult.trace.aiUsed || proofResult.trace.aiUsed || ctaResult.trace.aiUsed;

  // ── Step 5: Build the resolved experience ────────────────────────────────
  //
  // Use field-filled block data (may be identical to original when aiUsed=false).
  // Extended slots are spread in only when non-null to keep the shape clean.
  const experience: HomepageExperience = {
    hero:  heroResult.data  as HeroBlockData,
    proof: proofResult.data as ProofBlockData,
    cta:   ctaResult.data   as CTABlockData,
    ...(isNonNull(feature)      && { feature:      feature      as FeatureBlockData      }),
    ...(isNonNull(conversion)   && { conversion:   conversion   as ConversionBlockData   }),
    ...(isNonNull(notification) && { notification: notification as NotificationBlockData }),
    plan,
  };

  const resolvedKeys: ExperienceComposerMeta["resolvedKeys"] = {
    heroKey:  plan.heroKey,
    proofKey: plan.proofKey,
    ctaKey:   plan.ctaKey,
    ...(isNonNull(feature)      && plan.featureKey      && { featureKey:      plan.featureKey      }),
    ...(isNonNull(conversion)   && plan.conversionKey   && { conversionKey:   plan.conversionKey   }),
    ...(isNonNull(notification) && plan.notificationKey && { notificationKey: plan.notificationKey }),
  };

  const meta: ExperienceComposerMeta = {
    usedFallback: false,
    composedAt:   Date.now(),
    resolvedKeys,
  };

  logger.debug("Homepage experience composed successfully.", {
    usedFallback:    false,
    durationMs:      meta.composedAt - startedAt,
    resolvedKeys:    meta.resolvedKeys,
    fieldFillActive: anyFieldFillRan,
  });

  const trace = buildDecisionTrace(
    decisionProvider,
    plan,
    /* usedCmsFallback */ false,
    input,
    startedAt,
  );

  // Attach field fill traces (field fill runs after trace is built)
  trace.fieldFill = anyFieldFillRan ? fieldFillTraces : null;

  // Attach AI governance snapshot (Phase 3)
  if (options?.aiPolicies !== undefined) {
    // Resolve selection policies for trace (selection policies themselves
    // are applied inside the AI decision provider; we just record them here)
    const heroSelPolicy  = resolveAiPolicy("selection", "hero",  { tenantPolicies, platformPolicy });
    const proofSelPolicy = resolveAiPolicy("selection", "proof", { tenantPolicies, platformPolicy });
    const ctaSelPolicy   = resolveAiPolicy("selection", "cta",   { tenantPolicies, platformPolicy });

    trace.aiGovernance = {
      selection: { hero: heroSelPolicy, proof: proofSelPolicy, cta: ctaSelPolicy },
      fieldFill:  { hero: heroPolicyFF,  proof: proofPolicyFF,  cta: ctaPolicyFF  },
    };
  }

  return { experience, meta, trace };
}

// ── Fallback helper ───────────────────────────────────────────────────────────

/**
 * Fetch and assemble the fallback experience using a three-tier strategy.
 * Never throws — always returns a valid ComposedHomepageExperience.
 *
 *   Tier 1 — CMS fallback keys (tenant-specific, when provided)
 *     Merges CMS keys with FALLBACK_PLAN: for each slot, the CMS key is used
 *     when present, otherwise the hardcoded FALLBACK_PLAN key is used.
 *     If any variant is still missing, falls through to tier 2.
 *
 *   Tier 2 — hardcoded FALLBACK_PLAN keys (CMS-backed, platform-wide)
 *     Used when no CMS fallback keys are provided, or when the merged plan
 *     from tier 1 still cannot be fully resolved.  Falls through to tier 3
 *     if these are also missing (seed not run / CMS offline).
 *
 *   Tier 3 — STATIC_EMERGENCY_EXPERIENCE (in-code, no CMS)
 *     Identical content to the platform seed documents, built in code.
 *     Logs an actionable error with the command to restore Tier 2.
 *     Never fails — ensures the page always renders.
 *
 * @internal
 */
async function composeFallback(
  cmsProvider:      CMSProvider,
  startedAt:        number,
  originalPlan:     ExperiencePlan,
  cmsFallbackKeys?: CmsFallbackKeys,
): Promise<Omit<ComposedHomepageExperience, "trace">> {

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
          primaryPlan: {
            heroKey:  originalPlan.heroKey,
            proofKey: originalPlan.proofKey,
            ctaKey:   originalPlan.ctaKey,
            reason:   originalPlan.reason,
          },
          fallbackTier: "tier1",
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

  // ── Tier 4: Static in-code emergency experience ────────────────────────────
  //
  // Even the hardcoded FALLBACK_PLAN variants are missing from the CMS.
  // This means the platform seed has not been run, or the Sanity dataset is
  // temporarily unreachable.  Rather than crashing the page, serve the
  // STATIC_EMERGENCY_EXPERIENCE — identical content to the seed documents,
  // built entirely in code with no CMS dependency.
  //
  // Action required: run `npx tsx cms/seed/platform-seed.ts` to restore
  // Tier 3 and eliminate this emergency path.
  if (!isNonNull(fallbackHero) || !isNonNull(fallbackProof) || !isNonNull(fallbackCta)) {
    const missing: string[] = [];
    if (!isNonNull(fallbackHero)) missing.push(`heroKey: "${FALLBACK_PLAN.heroKey}"`);
    if (!isNonNull(fallbackProof)) missing.push(`proofKey: "${FALLBACK_PLAN.proofKey}"`);
    if (!isNonNull(fallbackCta))  missing.push(`ctaKey: "${FALLBACK_PLAN.ctaKey}"`);

    logger.warn(
      `[composeHomepageExperience] Fallback CMS variants are missing: ${missing.join(", ")}. ` +
      `Serving static emergency experience. ` +
      `Run \`npx tsx cms/seed/platform-seed.ts\` to restore CMS-backed fallbacks.`,
      {
        missingFallbackKeys: missing,
        action:              "run `npx tsx cms/seed/platform-seed.ts`",
      },
    );

    const composedAt = Date.now();
    return {
      experience: {
        hero:  STATIC_EMERGENCY_EXPERIENCE.hero,
        proof: STATIC_EMERGENCY_EXPERIENCE.proof,
        cta:   STATIC_EMERGENCY_EXPERIENCE.cta,
        plan:  STATIC_EMERGENCY_PLAN,
      },
      meta: {
        usedFallback: true,
        composedAt,
        resolvedKeys: {
          heroKey:  STATIC_EMERGENCY_PLAN.heroKey,
          proofKey: STATIC_EMERGENCY_PLAN.proofKey,
          ctaKey:   STATIC_EMERGENCY_PLAN.ctaKey,
        },
        primaryPlan: {
          heroKey:  originalPlan.heroKey,
          proofKey: originalPlan.proofKey,
          ctaKey:   originalPlan.ctaKey,
          reason:   originalPlan.reason,
        },
        fallbackTier: "tier3",
      },
    };
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
    primaryPlan: {
      heroKey:  originalPlan.heroKey,
      proofKey: originalPlan.proofKey,
      ctaKey:   originalPlan.ctaKey,
      reason:   originalPlan.reason,
    },
    fallbackTier: "tier2",
  };

  logger.info("Fallback homepage experience composed using hardcoded FALLBACK_PLAN.", {
    durationMs:   composedAt - startedAt,
    resolvedKeys: meta.resolvedKeys,
  });

  return { experience, meta };
}
