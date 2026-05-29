/**
 * Statamic Queries — barrel export
 *
 * Exports all Statamic content type interfaces and collection constants.
 * Import from "@/cms/queries/statamic" to access all Statamic query helpers.
 *
 * ─── Content types ────────────────────────────────────────────────────────
 *
 *   StatamicHeroEntry       — hero_variants collection entry fields
 *   StatamicProofEntry      — proof_variants collection entry fields
 *   StatamicProofItem       — items Grid field row shape
 *   StatamicCTAEntry        — cta_variants collection entry fields
 *
 * ─── Collection constants ──────────────────────────────────────────────────
 *
 *   HERO_VARIANTS_COLLECTION   — "hero_variants"
 *   PROOF_VARIANTS_COLLECTION  — "proof_variants"
 *   CTA_VARIANTS_COLLECTION    — "cta_variants"
 */

// Hero
export type { StatamicHeroEntry, StatamicHeroMedia, StatamicHeroCTAItem } from "./hero-queries";
export { HERO_VARIANTS_COLLECTION } from "./hero-queries";

// Proof
export type { StatamicProofEntry, StatamicProofItem } from "./proof-queries";
export { PROOF_VARIANTS_COLLECTION } from "./proof-queries";

// CTA
export type { StatamicCTAEntry } from "./cta-queries";
export { CTA_VARIANTS_COLLECTION } from "./cta-queries";
