/**
 * CMS module — barrel export
 *
 * Public API for the CMS abstraction layer.
 * Import from "@/cms" for types, the provider interface, and implementations.
 *
 * Internal module structure:
 *
 *   types.ts
 *     CTAData, HeroBlockData, ProofItem, ProofBlockData, CTABlockData
 *     PageSectionBase, PageSectionData, PageData
 *     CmsContextSlotConfig, CmsPageContextConfig
 *
 *   providers/cms-provider.ts
 *     CMSProvider (interface)
 *
 *   providers/mock-provider.ts
 *     MockCMSProvider (in-memory MVP implementation)
 *
 *   providers/sanity-provider.ts
 *     SanityProvider (production Sanity implementation)
 *
 *   providers/create-cms-provider.ts
 *     createCMSProvider() (environment-driven factory)
 *
 *   mappers/content-mappers.ts
 *     mapHeroBlockData, mapProofBlockData, mapCTABlockData
 *
 *   mappers/page-config-mapper.ts
 *     mapSectionsToContentBlocks, mapContextConfigToResolvedSlots,
 *     mapPageDataToPageConfig
 *
 *   mappers/sanity/
 *     mapSanityHero, mapSanityProof, mapSanityCTA
 *
 *   queries/sanity/
 *     HERO_BY_KEY_QUERY, PROOF_BY_KEY_QUERY, CTA_BY_KEY_QUERY
 */

// Content types — context block data shapes
export type {
  CTAData,
  HeroCTAItem,
  HeroBannerImage,
  HeroBannerVideoUpload,
  HeroBannerVideoYouTube,
  HeroBannerVideoVimeo,
  HeroBannerVideoSource,
  HeroBannerVideo,
  HeroBannerMedia,
  HeroBlockData,
  ProofItem,
  ProofBlockData,
  CTABlockData,
  AnyBlockData,
} from "./types";

// Content types — page model shapes
export type {
  PageSectionBase,
  PageSectionData,
  TextSectionData,
  FeatureGridData,
  TestimonialSectionData,
  FaqSectionData,
  CtaSectionData,
  FormSectionData,
  PageData,
  CmsContextSlotConfig,
  CmsPageContextConfig,
} from "./types";

// Content types — entity document shapes (Company, NewsArticle, Vacancy)
export type {
  CmsImageData,
  CompanyRef,
  BranchData,
  StatData,
  CompanyData,
  NewsArticleData,
  ProcessStepData,
  RecruiterData,
  VacancyData,
} from "./types";

// Provider interface + shared result types
export type { CMSProvider, ProvisionResult, TestConnectionResult } from "./providers/cms-provider";
export { MockCMSProvider } from "./providers/mock-provider";
export { SanityProvider } from "./providers/sanity-provider";
export { createCMSProvider, createPreviewCMSProvider, createDraftStatamicProvider } from "./providers/create-cms-provider";

// Mappers (content-layer)
export {
  mapHeroBlockData,
  mapProofBlockData,
  mapCTABlockData,
} from "./mappers/content-mappers";

// Mappers (page-config layer)
export {
  mapSectionsToContentBlocks,
  mapContextConfigToResolvedSlots,
  mapPageDataToPageConfig,
} from "./mappers/page-config-mapper";

// Mappers (entity document → PageData assemblers)
export {
  mapNewsArticleToPageData,
  mapVacancyToPageData,
  mapCompanyToPageData,
} from "./mappers/entity-page-assemblers";

// Mappers (Sanity-specific)
export { mapSanityHero, mapSanityProof, mapSanityCTA } from "./mappers/sanity";
