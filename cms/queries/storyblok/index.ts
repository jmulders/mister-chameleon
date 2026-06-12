/**
 * Storyblok Queries — barrel export
 *
 * Exports all Storyblok content type interfaces and slug builder functions.
 * Import from "@/cms/queries/storyblok" to access all Storyblok query helpers.
 *
 * ─── Content types ────────────────────────────────────────────────────────────
 *
 *   StoryblokHeroContent              — hero_variant component fields
 *   StoryblokProofContent             — proof_variant component fields
 *   StoryblokProofItemContent         — proof_item nested block fields
 *   StoryblokCTAContent               — cta_variant component fields
 *   StoryblokFeatureContent           — feature_variant component fields
 *   StoryblokFeatureItem              — feature item nested block fields
 *   StoryblokConversionContent        — conversion_variant component fields
 *   StoryblokConversionCTAItem        — conversion CTA nested block fields
 *   StoryblokNotificationContent      — notification_variant component fields
 *
 * ─── Slug builders ────────────────────────────────────────────────────────────
 *
 *   heroVariantSlug(key)         — "hero-variants/{key}"
 *   proofVariantSlug(key)        — "proof-variants/{key}"
 *   ctaVariantSlug(key)          — "cta-variants/{key}"
 *   featureVariantSlug(key)      — "feature-variants/{key}"
 *   conversionVariantSlug(key)   — "conversion-variants/{key}"
 *   notificationVariantSlug(key) — "notification-variants/{key}"
 *
 * ─── Folder constants ─────────────────────────────────────────────────────────
 *
 *   HERO_VARIANTS_FOLDER          — "hero-variants"
 *   PROOF_VARIANTS_FOLDER         — "proof-variants"
 *   CTA_VARIANTS_FOLDER           — "cta-variants"
 *   FEATURE_VARIANTS_FOLDER       — "feature-variants"
 *   CONVERSION_VARIANTS_FOLDER    — "conversion-variants"
 *   NOTIFICATION_VARIANTS_FOLDER  — "notification-variants"
 */

// Hero
export type { StoryblokHeroContent, StoryblokHeroMedia, StoryblokHeroCTAItem } from "./hero-queries";
export { heroVariantSlug, HERO_VARIANTS_FOLDER } from "./hero-queries";

// Proof
export type { StoryblokProofContent, StoryblokProofItemContent } from "./proof-queries";
export { proofVariantSlug, PROOF_VARIANTS_FOLDER } from "./proof-queries";

// CTA
export type { StoryblokCTAContent } from "./cta-queries";
export { ctaVariantSlug, CTA_VARIANTS_FOLDER } from "./cta-queries";

// Feature
export type { StoryblokFeatureContent, StoryblokFeatureItem } from "./feature-queries";
export { featureVariantSlug, FEATURE_VARIANTS_FOLDER } from "./feature-queries";

// Conversion
export type { StoryblokConversionContent, StoryblokConversionCTAItem } from "./conversion-queries";
export { conversionVariantSlug, CONVERSION_VARIANTS_FOLDER } from "./conversion-queries";

// Notification
export type { StoryblokNotificationContent } from "./notification-queries";
export { notificationVariantSlug, NOTIFICATION_VARIANTS_FOLDER } from "./notification-queries";

// Adaptive blocks
export type {
  StoryblokAdaptiveCTAItem,
  StoryblokAdaptiveVariantContent,
  StoryblokAdaptiveBlockContent,
} from "./adaptive-block-queries";
export { adaptiveBlockSlug, ADAPTIVE_BLOCKS_FOLDER } from "./adaptive-block-queries";
