/**
 * Sanity GROQ Queries — barrel export
 *
 * Import from "@/cms/queries/sanity" to access all Sanity queries
 * and their corresponding raw response types.
 */

// Query builder — shared predicate helper for building new variant queries
export { buildVariantQuery } from "./query-builder";

// Hero
export { HERO_BY_KEY_QUERY } from "./hero-queries";
export type { SanityHeroRaw } from "./hero-queries";

// Proof
export { PROOF_BY_KEY_QUERY } from "./proof-queries";
export type { SanityProofRaw, SanityProofItemRaw } from "./proof-queries";

// CTA
export { CTA_BY_KEY_QUERY } from "./cta-queries";
export type { SanityCTARaw } from "./cta-queries";

// Site Settings
export { SITE_SETTINGS_QUERY } from "./site-settings-query";
export type { SanitySiteSettingsRaw, SanityNavItemRaw } from "./site-settings-query";

// Page
export { PAGE_BY_SLUG_QUERY } from "./page-query";
export type {
  SanityPageRaw,
  SanityPageSectionRaw,
  SanityTextSectionRaw,
  SanityFeatureGridRaw,
  SanityTestimonialSectionRaw,
  SanityFaqSectionRaw,
  SanityCtaSectionRaw,
  SanityContextConfigRaw,
  SanityContextSlotConfigRaw,
} from "./page-query";
