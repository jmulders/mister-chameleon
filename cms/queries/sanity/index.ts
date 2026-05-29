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
export type { SanityHeroRaw, SanityHeroMediaRaw, SanityHeroCTARaw } from "./hero-queries";

// Proof
export { PROOF_BY_KEY_QUERY } from "./proof-queries";
export type { SanityProofRaw, SanityProofItemRaw } from "./proof-queries";

// CTA
export { CTA_BY_KEY_QUERY } from "./cta-queries";
export type { SanityCTARaw, SanityCTAItemRaw } from "./cta-queries";

// Feature
export { FEATURE_BY_KEY_QUERY } from "./feature-queries";
export type { SanityFeatureRaw, SanityFeatureItemRaw } from "./feature-queries";

// Conversion
export { CONVERSION_BY_KEY_QUERY } from "./conversion-queries";
export type { SanityConversionRaw, SanityConversionCTAItemRaw } from "./conversion-queries";

// Notification
export { NOTIFICATION_BY_KEY_QUERY } from "./notification-queries";
export type { SanityNotificationRaw } from "./notification-queries";

// Adaptive Hero (Content Matrix)
export { ADAPTIVE_HERO_BY_KEY_QUERY } from "./adaptive-hero-query";
export type {
  SanityAdaptiveHeroRaw,
  SanityAdaptiveVariantContent,
  SanityAdaptiveCtaLink,
} from "./adaptive-hero-query";

// Site Settings
export { SITE_SETTINGS_QUERY } from "./site-settings-query";
export type {
  SanitySiteSettingsRaw,
  SanityNavItemRaw,
  SanityNavItemChildRaw,
  SanityNavItemLeafRaw,
  SanityFooterLinkRaw,
  SanityFooterColumnRaw,
  SanityHeaderCtaRaw,
  SanitySocialLinkRaw,
  SanityLocaleEntryRaw,
  SanityLogoRaw,
  SanityMegaMenuItemRaw,
  SanityMegaMenuColumnRaw,
  SanityMegaMenuRaw,
} from "./site-settings-query";

// Page
export { PAGE_BY_SLUG_QUERY } from "./page-query";
export type {
  SanityPageRaw,
  SanityPageSectionRaw,
  SanityContextConfigRaw,
  SanityContextSlotConfigRaw,
  // Core section raw types
  SanityTextSectionRaw,
  SanityFeatureGridRaw,
  SanityTestimonialSectionRaw,
  SanityFaqSectionRaw,
  SanityCtaSectionRaw,
  SanityFormSectionRaw,
  // Listing section raw types
  SanityListingSectionRaw,
  SanityFilterBarSectionRaw,
  SanitySearchResultsSectionRaw,
  // Detail section raw types
  SanityArticleMetaSectionRaw,
  SanityArticleBodySectionRaw,
  SanityRelatedContentSectionRaw,
  SanityVacancyMetaSectionRaw,
  SanityApplyPanelSectionRaw,
  // Search section raw type
  SanitySearchSectionRaw,
  // Marketing section raw types
  SanityLogoStripSectionRaw,
  SanityTextMediaSectionRaw,
  SanityStatsSectionRaw,
  SanityAboutSectionRaw,
  SanityNewsListSectionRaw,
  // Shared sub-types
  SanityUniversalItemRaw,
  SanityFilterOptionRaw,
  SanityLogoItemRaw,
  SanityAuthorRaw,
  SanityTeamMemberRaw,
  SanityCtaButtonRaw,
  SanityCtaObjectRaw,
  // Map section raw type
  SanityMapBlockSectionRaw,
  // Cart / checkout raw types
  SanityCartSummarySectionRaw,
  SanityCheckoutBlockSectionRaw,
  // Team / process / pricing raw types
  SanityTeamSectionRaw,
  SanityProcessStepsSectionRaw,
  SanityProcessStepRaw,
  SanityPricingSectionRaw,
  SanityPricingTierRaw,
  SanityPricingFeatureRaw,
} from "./page-query";
