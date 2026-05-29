/**
 * Block Content Contracts — Public API
 *
 * Single import point for the block contract system.
 *
 * ─── What this module provides ───────────────────────────────────────────────
 *
 *   Types          BlockContentContract, BlockContractField, BlockValidationRule
 *                  BlockValidationResult, BlockValidationError
 *                  PageValidationResult, BlockContentSeed
 *
 *   Contracts      ALL_BLOCK_CONTRACTS, BLOCK_CONTRACT_REGISTRY, getBlockContract()
 *                  Individual: HERO_CONTRACT, FEATURE_GRID_CONTRACT, etc.
 *
 *   Page defaults  PAGE_TYPE_BLOCK_DEFAULTS, getPageTypeDefaults()
 *                  getDefaultBlocksForPageType(), getPageTypesForBlock()
 *
 *   Model compat   MODEL_COMPATIBILITY, getModelCompatibility()
 *                  getModelBlocks(), getModelsForBlock(), UNIVERSAL_BLOCKS
 *
 *   Validation     validateBlock(), validatePage(), validateBlueprintSeed()
 *                  isBlockSafeToRender(), formatValidationReport()
 *                  getCmsValidationHints()
 *
 * ─── Quick examples ───────────────────────────────────────────────────────────
 *
 *   // 1. Validate a block before rendering
 *   import { validateBlock } from "@/blueprints/block-contracts";
 *   const { valid, errors } = validateBlock("formSection", blockData);
 *
 *   // 2. Get default block order for a page type
 *   import { getDefaultBlocksForPageType } from "@/blueprints/block-contracts";
 *   const blocks = getDefaultBlocksForPageType("overview", "required");
 *
 *   // 3. Check model compatibility
 *   import { getModelBlocks } from "@/blueprints/block-contracts";
 *   const coreBlocks = getModelBlocks("careers", "core");
 *
 *   // 4. Get CMS schema validation hints
 *   import { getCmsValidationHints } from "@/blueprints/block-contracts";
 *   const hints = getCmsValidationHints("pricingSection");
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  BlockContractFieldType,
  BlockContractField,
  BlockValidationRule,
  BlockContentContract,
  BlockValidationError,
  BlockValidationResult,
  PageValidationResult,
  BlockContentSeed,
} from "./types";

// ── Contracts ─────────────────────────────────────────────────────────────────
export {
  // Context slots
  HERO_CONTRACT,
  // Text
  TEXT_SECTION_CONTRACT,
  RICH_TEXT_CONTRACT,
  CONTENT_SECTION_CONTRACT,
  // Features / proof
  FEATURE_GRID_CONTRACT,
  TESTIMONIAL_SECTION_CONTRACT,
  LOGO_STRIP_CONTRACT,
  STATS_CONTRACT,
  // Content
  FAQ_SECTION_CONTRACT,
  CTA_SECTION_CONTRACT,
  // Media
  SLIDER_CONTRACT,
  // Forms
  FORM_SECTION_CONTRACT,
  CONTACT_SECTION_CONTRACT,
  // Process
  PROCESS_STEPS_CONTRACT,
  // Listing
  LISTING_CONTRACT,
  RELATED_CONTENT_CONTRACT,
  FILTER_BAR_CONTRACT,
  // Pricing
  PRICING_SECTION_CONTRACT,
  // Team
  TEAM_SECTION_CONTRACT,
  // Commerce
  CART_SUMMARY_CONTRACT,
  PRODUCT_OVERVIEW_CONTRACT,
  PRODUCT_DETAIL_CONTRACT,
  // Careers
  VACANCY_META_CONTRACT,
  APPLY_PANEL_CONTRACT,
  RECRUITER_PANEL_CONTRACT,
  // Registry
  ALL_BLOCK_CONTRACTS,
  BLOCK_CONTRACT_REGISTRY,
  getBlockContract,
} from "./contracts";

// ── Page type defaults ────────────────────────────────────────────────────────
export type {
  PageBlockRole,
  PageBlockDefault,
  PageTypeBlockDefaults,
} from "./page-type-defaults";
export {
  HOMEPAGE_DEFAULTS,
  OVERVIEW_DEFAULTS,
  DETAIL_DEFAULTS,
  FORM_DEFAULTS,
  PROCESS_DEFAULTS,
  PAGE_TYPE_BLOCK_DEFAULTS,
  getPageTypeDefaults,
  getDefaultBlocksForPageType,
  getPageTypesForBlock,
} from "./page-type-defaults";

// ── Model compatibility ───────────────────────────────────────────────────────
export type {
  ModelBlockPresence,
  ModelBlockEntry,
  ModelCompatibilityEntry,
} from "./model-compatibility";
export {
  SERVICE_MODEL_BLOCKS,
  PRODUCT_SAAS_MODEL_BLOCKS,
  CAREERS_MODEL_BLOCKS,
  CATALOG_MODEL_BLOCKS,
  COMMERCE_MODEL_BLOCKS,
  MODEL_COMPATIBILITY,
  getModelCompatibility,
  getModelBlocks,
  getModelsForBlock,
  UNIVERSAL_BLOCKS,
} from "./model-compatibility";

// ── Validation ────────────────────────────────────────────────────────────────
export type { PageBlockInput } from "./validate";
export {
  validateBlock,
  validatePage,
  validateBlueprintSeed,
  isBlockSafeToRender,
  formatValidationReport,
  getCmsValidationHints,
} from "./validate";
