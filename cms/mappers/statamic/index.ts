/**
 * Statamic Mappers — barrel export
 *
 * Exports all Statamic → internal type mapper functions.
 * Import from "@/cms/mappers/statamic" to access all Statamic mappers.
 *
 * ─── Mapper functions ──────────────────────────────────────────────────────
 *
 *   mapStatamicHero(entry)         — StatamicHeroEntry → HeroBlockData
 *   mapStatamicProof(entry)        — StatamicProofEntry → ProofBlockData
 *   mapStatamicCTA(entry)          — StatamicCTAEntry → CTABlockData
 *   mapStatamicFeature(block)      — StatamicFeatureReplicatorSet → FeatureBlockData
 *   mapStatamicConversion(block)   — StatamicConversionReplicatorSet → ConversionBlockData
 */

export {
  mapStatamicHero,
  mapStatamicProof,
  mapStatamicCTA,
  mapStatamicFeature,
  mapStatamicConversion,
  mapStatamicAdaptiveVariantContent,
  mapStatamicAdaptiveBlock,
  mapStatamicPageBlocksToSections,
} from "./statamic-mappers";
