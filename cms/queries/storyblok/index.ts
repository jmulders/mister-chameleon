/**
 * Storyblok Queries — barrel export
 *
 * Exports all Storyblok content type interfaces and slug builder functions.
 * Import from "@/cms/queries/storyblok" to access all Storyblok query helpers.
 *
 * ─── Content types ────────────────────────────────────────────────────────────
 *
 *   StoryblokHeroContent         — hero_variant component fields
 *   StoryblokProofContent        — proof_variant component fields
 *   StoryblokProofItemContent    — proof_item nested block fields
 *   StoryblokCTAContent          — cta_variant component fields
 *
 * ─── Slug builders ────────────────────────────────────────────────────────────
 *
 *   heroVariantSlug(key)   — "hero-variants/{key}"
 *   proofVariantSlug(key)  — "proof-variants/{key}"
 *   ctaVariantSlug(key)    — "cta-variants/{key}"
 *
 * ─── Folder constants ─────────────────────────────────────────────────────────
 *
 *   HERO_VARIANTS_FOLDER   — "hero-variants"
 *   PROOF_VARIANTS_FOLDER  — "proof-variants"
 *   CTA_VARIANTS_FOLDER    — "cta-variants"
 */

// Hero
export type { StoryblokHeroContent } from "./hero-queries";
export { heroVariantSlug, HERO_VARIANTS_FOLDER } from "./hero-queries";

// Proof
export type { StoryblokProofContent, StoryblokProofItemContent } from "./proof-queries";
export { proofVariantSlug, PROOF_VARIANTS_FOLDER } from "./proof-queries";

// CTA
export type { StoryblokCTAContent } from "./cta-queries";
export { ctaVariantSlug, CTA_VARIANTS_FOLDER } from "./cta-queries";
