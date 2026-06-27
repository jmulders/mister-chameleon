/**
 * Adaptive blocks → AI variant candidates
 *
 * Bridges the admin-managed adaptive-block system (DB) into the AI variant
 * candidate pipeline. Each adaptive block carries an authored `decisionMeta`
 * (see EditBlockDrawer → "AI / Decision"); this module converts the tenant's
 * blocks into the `ResolveVariantCandidatesInput` shape that
 * `resolveVariantCandidates()` consumes, so admin-authored variants with
 * complete metadata become aiReady and selectable by the live AI.
 *
 * Slot is derived from the block `key` prefix (e.g. "hero_careers_default" →
 * hero). Only the three AI-personalised slots are relevant — hero, proof, cta;
 * feature/conversion blocks are ignored here.
 */

import "server-only";

import type { AdaptiveBlockData } from "@/cms/types";
import type {
  ResolveVariantCandidatesInput,
  CmsVariantRaw,
} from "@/ai/resolve-variant-candidates";

type CandidateSlot = "hero" | "proof" | "cta";

/** Map a variant key to its candidate slot via the key prefix, or null. */
function slotForKey(key: string): CandidateSlot | null {
  const prefix = key.split("_")[0]?.toLowerCase();
  return prefix === "hero" || prefix === "proof" || prefix === "cta" ? prefix : null;
}

/**
 * Convert a tenant's adaptive blocks into per-slot CMS variant candidates.
 * Blocks whose key does not map to hero/proof/cta are skipped.
 */
export function adaptiveBlocksToResolveInput(
  blocks: readonly AdaptiveBlockData[],
): ResolveVariantCandidatesInput {
  const heroVariants:  CmsVariantRaw[] = [];
  const proofVariants: CmsVariantRaw[] = [];
  const ctaVariants:   CmsVariantRaw[] = [];

  for (const block of blocks) {
    const slot = slotForKey(block.key);
    if (!slot) continue;

    const raw: CmsVariantRaw = {
      key:          block.key,
      isActive:     block.isActive,
      decisionMeta: block.defaultVariant.decisionMeta ?? null,
    };

    if      (slot === "hero")  heroVariants.push(raw);
    else if (slot === "proof") proofVariants.push(raw);
    else                       ctaVariants.push(raw);
  }

  return { heroVariants, proofVariants, ctaVariants };
}

/** True when any candidate carries authored decision metadata. */
export function hasAnyDecisionMeta(input: ResolveVariantCandidatesInput): boolean {
  const any = (v: CmsVariantRaw) => Boolean(v.decisionMeta && Object.keys(v.decisionMeta).length);
  return input.heroVariants.some(any) || input.proofVariants.some(any) || input.ctaVariants.some(any);
}
