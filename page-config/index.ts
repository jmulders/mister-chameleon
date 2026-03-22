/**
 * page-config — barrel export
 *
 * Public API for the platform page model.
 *
 * Import from "@/page-config" to access:
 *   - PageConfig and all related types
 *   - Named template constants and the template registry
 *   - The content block type registry and helpers
 *
 * ─── Module structure ─────────────────────────────────────────────────────────
 *
 *   types.ts     — PageConfig, ContentBlock, ContextSlot, TemplateDefinition,
 *                  BlockDefinition, BlockCategory, and all *BlockData types
 *   templates.ts — MARKETING_PAGE_TEMPLATE, LANDING_PAGE_TEMPLATE, ARTICLE_PAGE_TEMPLATE,
 *                  TEMPLATE_REGISTRY, getTemplateDefinition(), getAllTemplateDefinitions(),
 *                  getTemplate() (deprecated), isTemplateKey()
 *   registry.ts  — BLOCK_REGISTRY, REGISTERED_CONTENT_BLOCK_TYPES,
 *                  CONTENT_BLOCK_DISPLAY_NAMES, isRegisteredBlockType(),
 *                  getBlockDisplayName(), getBlockDefinition(),
 *                  getAllBlockDefinitions(), getBlocksByCategory()
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 * @example
 * import type { PageConfig, ContentBlock } from "@/page-config";
 * import { MARKETING_PAGE_TEMPLATE, isRegisteredBlockType } from "@/page-config";
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  // Template layer
  TemplateKey,
  ContextSlotId,
  ContextSlotPosition,
  ContextSlotSpec,
  TemplateDefinition,

  // Block taxonomy
  BlockCategory,
  BlockDefinition,

  // Content block type alias
  ContentBlockType,

  // ── Existing live block data types ──────────────────────────────────────────
  TextSectionBlockData,
  FeatureItem,
  FeatureGridBlockData,
  TestimonialItem,
  TestimonialSectionBlockData,
  FaqItem,
  FaqSectionBlockData,
  CtaSectionBlockData,
  FormBlockData,

  // ── New block data types ─────────────────────────────────────────────────────
  RichTextBlockData,
  ImageBlockData,
  VideoBlockData,
  QuoteBlockData,
  LogoItem,
  LogoStripBlockData,
  StatItem,
  StatsBlockData,
  SlideItem,
  SliderBlockData,
  TeamMember,
  AboutBlockData,
  NewsItem,
  NewsListBlockData,
  CaseMetric,
  CaseHighlightBlockData,

  // ── Listing / detail block data types ────────────────────────────────────────
  ListingItem,
  ListingBlockData,
  ArticleBodyBlockData,
  ArticleAuthor,
  ArticleMetaBlockData,
  RelatedItem,
  RelatedContentBlockData,
  VacancyMetaBlockData,
  ApplyPanelBlockData,
  FilterOption,
  FilterBarBlockData,
  SearchResultsBlockData,
  SearchBlockData,

  // ── Careers / W6 block data types ────────────────────────────────────────────
  ProcessStep,
  ProcessStepsBlockData,
  RecruiterPanelBlockData,

  // ── Content block union (all blocks) ────────────────────────────────────────
  TextSectionBlock,
  FeatureGridBlock,
  TestimonialSectionBlock,
  FaqSectionBlock,
  CtaSectionBlock,
  FormSectionBlock,
  RichTextBlock,
  ImageBlock,
  VideoBlock,
  QuoteBlock,
  LogoStripBlock,
  StatsBlock,
  SliderBlock,
  AboutBlock,
  NewsListBlock,
  CaseHighlightBlock,
  ListingBlock,
  ArticleBodyBlock,
  ArticleMetaBlock,
  RelatedContentBlock,
  VacancyMetaBlock,
  ApplyPanelBlock,
  FilterBarBlock,
  SearchResultsBlock,
  SearchBlock,
  // careers / W6
  ProcessStepsBlock,
  RecruiterPanelBlock,
  ContentBlock,

  // Context slot
  ResolvedContextSlot,

  // Page
  PageSeoConfig,
  PageConfig,

  // Context slot data (incremental-migration bridge — see ContextSlotData JSDoc)
  ContextSlotData,
} from "./types";

// ── Templates ─────────────────────────────────────────────────────────────────

export {
  MARKETING_PAGE_TEMPLATE,
  LANDING_PAGE_TEMPLATE,
  ARTICLE_PAGE_TEMPLATE,
  LISTING_PAGE_TEMPLATE,
  DETAIL_PAGE_TEMPLATE,
  TEMPLATE_REGISTRY,
  getTemplateDefinition,
  getAllTemplateDefinitions,
  getTemplate,
  isTemplateKey,
} from "./templates";

// ── Block variants ────────────────────────────────────────────────────────────

export type {
  TextSectionVariant,
  FeatureGridVariant,
  TestimonialVariant,
  FaqSectionVariant,
  CtaSectionVariant,
  StatsVariant,
  LogoStripVariant,
  FormSectionVariant,
  ListingVariant,
  ArticleBodyVariant,
  ArticleMetaVariant,
  RelatedContentVariant,
  VacancyMetaVariant,
  ApplyPanelVariant,
  FilterBarVariant,
  SearchResultsVariant,
  // careers / W6
  ProcessStepsVariant,
  RecruiterPanelVariant,
} from "./block-variants";

export {
  resolveBlockVariant,
  getBlockValidVariants,
} from "./block-variants";

// ── Registry ──────────────────────────────────────────────────────────────────

export {
  BLOCK_REGISTRY,
  REGISTERED_CONTENT_BLOCK_TYPES,
  CONTENT_BLOCK_DISPLAY_NAMES,
  isRegisteredBlockType,
  getBlockDisplayName,
  getBlockDefinition,
  getAllBlockDefinitions,
  getBlocksByCategory,
} from "./registry";
