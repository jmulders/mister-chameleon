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

// ── Collection source (CMS-agnostic content source model) ─────────────────────

export type {
  CollectionKey,
  CollectionSourceMode,
  CollectionSortDir,
  ManualContentSource,
  CollectionContentSource,
  ContentSource,
  CollectionItem,
} from "./collection-source";

export {
  COLLECTION_KEY_LABELS,
  isCollectionSource,
  isManualSource,
  isCollectionKey,
  sortBySelectedIds,
} from "./collection-source";

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
  BreadcrumbItem,
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

  // ── Conversion / pricing block data types ────────────────────────────────────
  PriceTier,
  PricingSectionBlockData,

  // ── Content / editorial block data types ─────────────────────────────────────
  BlockCTA,
  ContentSectionBlockData,
  TeamMemberItem,
  TeamSectionBlockData,

  // ── New core block data types ─────────────────────────────────────────────────
  TimelineItem,
  TimelineBlockData,
  QuickLinkItem,
  QuickLinksBlockData,
  TextMediaBlockData,
  ContactSectionBlockData,

  // ── Map block data type ──────────────────────────────────────────────────────
  MapBlockData,

  // ── Commerce block data types ────────────────────────────────────────────────
  CartSummaryBlockData,
  CheckoutBlockData,

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
  // conversion / pricing
  PricingSectionBlock,
  // content / editorial
  ContentSectionBlock,
  TeamSectionBlock,
  // new core blocks
  TimelineBlock,
  QuickLinksBlock,
  TextMediaBlock,
  ContactSectionBlock,
  // map
  MapBlock,
  // commerce
  CartSummaryBlock,
  CheckoutBlock,
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

// ── Block variant register ────────────────────────────────────────────────────

export type {
  VariantDefinition,
  VariantRegisterEntry,
} from "./block-variant-register";

export {
  BLOCK_VARIANT_REGISTER,
  VARIANT_REGISTER_MAP,
  getVariantRegisterEntry,
  getDefaultVariant,
  isRegisteredVariant,
  getVariantOptions,
} from "./block-variant-register";

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
  // conversion / pricing
  PricingSectionVariant,
  // content / editorial
  ContentSectionVariant,
  TeamSectionVariant,
  AboutVariant,
  // new core blocks
  TimelineVariant,
  QuickLinksVariant,
  TextMediaVariant,
  ContactSectionVariant,
  // extended variants
  NewsListVariant,
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

// ── Page presets ──────────────────────────────────────────────────────────────

export type { PagePreset } from "./page-presets";

export {
  PAGE_PRESETS,
  PAGE_PRESET_MAP,
  getPreset,
  getAllPresets,
} from "./page-presets";

// ── Site presets ───────────────────────────────────────────────────────────────

export type { SiteType, SitePreset, SitePageEntry } from "./site-presets";

export {
  SITE_PRESETS,
  SITE_PRESET_MAP,
  getSitePreset,
  getAllSitePresets,
  isSiteType,
} from "./site-presets";

// ── Site starters ─────────────────────────────────────────────────────────────
//
// Use-case-driven starter bundles.  Each combines siteTypeKey + themeKey +
// blueprintKey into a single meaningful setup choice for the operator.

export type { SiteStarter } from "./starters";

export {
  SITE_STARTERS,
  getAllStarters,
  findStarterByKey,
  getStartersBySiteType,
} from "./starters";

// ── Template catalog ──────────────────────────────────────────────────────────

export type {
  TemplateCatalogCategory,
  TemplateCatalogEntry,
  TemplatePreviewType,
} from "./template-catalog";

export {
  TEMPLATE_CATALOG,
  TEMPLATE_CATALOG_MAP,
  TEMPLATE_CATALOG_CATEGORY_LABELS,
  getTemplateCatalogEntry,
  getAllTemplateCatalogEntries,
  getTemplateCatalogByCategory,
  resolvePresetKey,
  templateKeysToPageEntries,
} from "./template-catalog";

// ── Template registry ─────────────────────────────────────────────────────────

export type {
  SlotContractKey,
  SlotContractStatus,
  SlotContract,
  TemplateRegistryKey,
  TemplateRegistryCategory,
  TemplateRegistryEntry,
} from "./template-registry";

export {
  SLOT_CONTRACT_REGISTRY,
  CORE_TEMPLATE_REGISTRY,
  EXTENDED_TEMPLATE_REGISTRY,
  FULL_TEMPLATE_REGISTRY,
  TEMPLATE_REGISTRY_MAP,
  getTemplateRegistryEntry,
  getRegistryByCategory,
  getRegistryEntryByCatalogKey,
  getDefaultSelectedTemplates,
  getSlotContract,
  getActiveSlotContracts,
} from "./template-registry";
