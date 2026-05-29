/**
 * Variant Candidate Resolver
 *
 * Merges the platform variant registry with tenant-specific CMS variants to
 * produce the final list of `SlotCandidates` the AI prompt builder uses.
 *
 * ─── Resolution rules ────────────────────────────────────────────────────────
 *
 *   1. Start with all platform-defined variants (always aiReady).
 *   2. For each CMS tenant variant:
 *       a. If its key already exists in the platform registry, OVERRIDE the
 *          decisionMeta with the tenant's version (tenant-first principle).
 *          The variant's aiReady status is re-computed from the CMS meta.
 *       b. If the key is new (tenant-only variant), add it as an additional
 *          candidate.  aiReady is computed from the CMS meta.
 *   3. Any variant with aiReady === false is included in the resolved list
 *      for auditing but is filtered out by the prompt builder before the AI
 *      ever sees it.
 *
 * ─── CMS raw shape ───────────────────────────────────────────────────────────
 *
 *   CMS GROQ queries return raw Sanity documents.  The decisionMeta field is
 *   an embedded object whose shape matches VariantDecisionMeta, but Sanity may
 *   return extra _type / _key fields and some values may be null/undefined when
 *   a field was never populated.  We normalise these via sanitiseCmsMeta().
 */

import type { SlotCandidates, VariantCandidate, VariantDecisionMeta } from "@/ai/variant-meta";
import { isMetaComplete } from "@/ai/variant-meta";
import {
  PLATFORM_HERO_CANDIDATES,
  PLATFORM_PROOF_CANDIDATES,
  PLATFORM_CTA_CANDIDATES,
} from "@/ai/variant-registry";

// ─── CMS raw types ────────────────────────────────────────────────────────────

/**
 * The subset of a CMS variant document that the resolver needs.
 * Matches the fields returned by variant-candidates-query.ts GROQ queries.
 */
export interface CmsVariantRaw {
  key: string;
  isActive: boolean;
  /** Raw decisionMeta object from Sanity — may have partial/null fields. */
  decisionMeta?: Partial<VariantDecisionMeta> | null;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Strip Sanity internal fields and coerce any null/undefined array fields
 * to empty arrays so isMetaComplete() can evaluate them correctly.
 */
function sanitiseCmsMeta(
  raw: Partial<VariantDecisionMeta> | null | undefined,
): Partial<VariantDecisionMeta> | null {
  if (!raw) return null;

  // Strip Sanity internals (_type, _key, etc.)
  const {
    decisionLabel,
    decisionSummary,
    whatThisVariantCommunicates,
    intendedAudience,
    intentLevel,
    funnelStages,
    bestForSources,
    tone,
    primaryGoal,
    supportingGoals,
    exclusions,
  } = raw as Record<string, unknown> & Partial<VariantDecisionMeta>;

  return {
    ...(decisionLabel               !== undefined ? { decisionLabel }               : {}),
    ...(decisionSummary             !== undefined ? { decisionSummary }             : {}),
    ...(whatThisVariantCommunicates !== undefined ? { whatThisVariantCommunicates } : {}),
    ...(intendedAudience            !== undefined ? { intendedAudience }            : {}),
    ...(intentLevel                 !== undefined ? { intentLevel }                 : {}),
    funnelStages:   Array.isArray(funnelStages)   ? funnelStages   : [],
    bestForSources: Array.isArray(bestForSources) ? bestForSources : [],
    ...(tone        !== undefined ? { tone }        : {}),
    ...(primaryGoal !== undefined ? { primaryGoal } : {}),
    supportingGoals: Array.isArray(supportingGoals) ? supportingGoals : [],
    exclusions:      Array.isArray(exclusions)      ? exclusions      : [],
  };
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

function mergeCmsVariants(
  platformCandidates: VariantCandidate[],
  cmsVariants: CmsVariantRaw[],
  slotType: VariantCandidate["slotType"],
): VariantCandidate[] {
  // Build mutable map: key → candidate (start from platform)
  const map = new Map<string, VariantCandidate>(
    platformCandidates.map((c) => [c.key, { ...c }]),
  );

  for (const raw of cmsVariants) {
    if (!raw.isActive) continue; // Inactive CMS variants are never candidates

    const cleanMeta = sanitiseCmsMeta(raw.decisionMeta);
    const metaComplete = isMetaComplete(cleanMeta);

    if (map.has(raw.key)) {
      // OVERRIDE platform candidate with tenant meta
      const existing = map.get(raw.key)!;
      map.set(raw.key, {
        ...existing,
        // Tenant meta takes priority over platform meta when complete
        decisionMeta: metaComplete
          ? (cleanMeta as VariantDecisionMeta)
          : existing.decisionMeta,
        // aiReady: tenant meta overrides only if complete; otherwise inherits platform readiness
        aiReady: metaComplete ? true : existing.aiReady,
        source: "tenant",
      });
    } else {
      // NEW tenant-only variant
      map.set(raw.key, {
        key: raw.key,
        slotType,
        aiReady: metaComplete,
        decisionMeta: metaComplete ? (cleanMeta as VariantDecisionMeta) : null,
        source: "tenant",
      });
    }
  }

  return Array.from(map.values());
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ResolveVariantCandidatesInput {
  /** Active CMS hero variant documents for this tenant. Pass [] if none. */
  heroVariants: CmsVariantRaw[];
  /** Active CMS proof variant documents for this tenant. Pass [] if none. */
  proofVariants: CmsVariantRaw[];
  /** Active CMS cta variant documents for this tenant. Pass [] if none. */
  ctaVariants: CmsVariantRaw[];
}

/**
 * Resolves the full set of variant candidates for all three personalisation
 * slots by merging the platform registry with the tenant's CMS variants.
 *
 * Tenant variants with complete decisionMeta take precedence over platform
 * defaults.  New tenant-only keys are appended.  Inactive CMS variants are
 * excluded.
 *
 * The returned `SlotCandidates` includes ALL candidates (aiReady or not).
 * The prompt builder is responsible for filtering to `aiReady === true`.
 */
export function resolveVariantCandidates(
  input: ResolveVariantCandidatesInput,
): SlotCandidates {
  return {
    hero:  mergeCmsVariants(PLATFORM_HERO_CANDIDATES,  input.heroVariants,  "hero"),
    proof: mergeCmsVariants(PLATFORM_PROOF_CANDIDATES, input.proofVariants, "proof"),
    cta:   mergeCmsVariants(PLATFORM_CTA_CANDIDATES,   input.ctaVariants,   "cta"),
  };
}

/**
 * Fallback: returns platform-only candidates when no CMS data is available.
 * All platform variants are aiReady — safe to pass directly to the AI prompt.
 */
export function platformOnlyCandidates(): SlotCandidates {
  return {
    hero:  [...PLATFORM_HERO_CANDIDATES],
    proof: [...PLATFORM_PROOF_CANDIDATES],
    cta:   [...PLATFORM_CTA_CANDIDATES],
  };
}

/**
 * Returns only the AI-eligible candidates (aiReady === true) for a given slot.
 * Use this before building the AI prompt.
 */
export function filterAiReady(candidates: VariantCandidate[]): VariantCandidate[] {
  return candidates.filter((c) => c.aiReady && c.decisionMeta !== null);
}
