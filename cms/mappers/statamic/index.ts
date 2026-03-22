/**
 * Statamic Mappers — barrel export
 *
 * Exports all Statamic → internal type mapper functions.
 * Import from "@/cms/mappers/statamic" to access all Statamic mappers.
 *
 * ─── Mapper functions ──────────────────────────────────────────────────────
 *
 *   mapStatamicHero(entry)   — StatamicHeroEntry → HeroBlockData
 *   mapStatamicProof(entry)  — StatamicProofEntry → ProofBlockData
 *   mapStatamicCTA(entry)    — StatamicCTAEntry → CTABlockData
 */

export { mapStatamicHero, mapStatamicProof, mapStatamicCTA } from "./statamic-mappers";
