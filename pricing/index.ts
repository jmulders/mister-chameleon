/**
 * Pricing Module — Barrel Export
 *
 * Re-exports all public types and runtime values from the pricing layer.
 *
 * ─── Consumers ────────────────────────────────────────────────────────────────
 *
 *   import type { PricingConfig, AnyPricingFee }  from "@/pricing";
 *   import { STANDARD_PRICING_MODEL, getFee }     from "@/pricing";
 *   import { resolveProposal, formatPrice }       from "@/pricing";
 *   import { PRICING_PACKAGES, buildConfigFromTier } from "@/pricing";
 *
 * ─── Module map ───────────────────────────────────────────────────────────────
 *
 *   pricing/types.ts      — all fee primitive type definitions
 *   pricing/model.ts      — fee catalog + standard model + proposal helpers
 *   pricing/packages.ts   — commercial tier definitions (Start / Growth / Scale)
 *   pricing/index.ts      ← YOU ARE HERE — barrel re-export
 */

// ── Type exports ───────────────────────────────────────────────────────────────

export type {
  // Identifier types
  SetupFeeId,
  PlatformFeeId,
  ModuleFeeId,
  ServiceFeeId,
  OptimizationFeeId,
  PricingFeeId,
  PricingModelId,

  // Monetary types
  PricingCurrency,
  BillingCadence,
  PricingBasis,
  MonetaryAmount,
  PricingBand,

  // Fee category discriminant
  FeeCategory,

  // Fee interfaces
  PricingFeeBase,
  SetupFee,
  PlatformFee,
  ModuleFee,
  ServiceFee,
  OptimizationFee,
  AnyPricingFee,

  // Model
  PricingModel,

  // Config
  PricingConfig,

  // Proposal output types
  ProposalLineItem,
  ResolvedProposal,

  // Index types
  ModuleFeeIndex,
  ServiceFeeIndex,
} from "./types";

// ── Runtime exports ────────────────────────────────────────────────────────────

export {
  // ── Fee instances — setup ────────────────────────────────────────────────────
  SETUP_STANDARD,
  SETUP_ACCELERATED,
  SETUP_LIGHT,

  // ── Fee instances — platform ─────────────────────────────────────────────────
  PLATFORM_BASE,

  // ── Fee instances — modules ──────────────────────────────────────────────────
  MODULE_ADAPTIVE_WEBSITE,
  MODULE_ADAPTIVE_LANDING_PAGES,
  MODULE_ADAPTIVE_FOLLOW_UP,
  MODULE_CONTEXT_INTELLIGENCE,

  // ── Fee instances — services ─────────────────────────────────────────────────
  SERVICE_ONBOARDING,
  SERVICE_CONTENT_MODELING,
  SERVICE_OPTIMISATION_RETAINER,
  SERVICE_STRATEGY_ADVISORY,

  // ── Fee instances — optimization ─────────────────────────────────────────────
  OPTIMIZATION_MONTHLY,
  OPTIMIZATION_QUARTERLY,

  // ── Pricing model ─────────────────────────────────────────────────────────────
  /** The complete fee catalog. Select from this to build PricingConfig instances. */
  STANDARD_PRICING_MODEL,

  // ── Example config ────────────────────────────────────────────────────────────
  /** Reference configuration for a typical B2B growth engagement. */
  EXAMPLE_PRICING_CONFIG,

  // ── Lookup helpers ────────────────────────────────────────────────────────────
  /** Get any fee by ID. */
  getFee,
  /** Get a module fee by its ModuleFeeId. */
  getModuleFee,
  /** Get all module fees for a given ProductModuleId. */
  getModuleFeesByModule,
  /** Get a service fee by its ServiceFeeId. */
  getServiceFee,
  /** Get all service fees for a given ServiceOfferingId. */
  getServiceFeesByOffering,

  // ── Proposal generation ───────────────────────────────────────────────────────
  /** Build ordered ProposalLineItem array from a PricingConfig. */
  buildProposalLineItems,
  /** Fully resolve a PricingConfig into a ResolvedProposal with totals. */
  resolveProposal,
  /** Format a MonetaryAmount as a display string (e.g. £2,500.00). */
  formatPrice,
} from "./model";

// ── Package tier type exports ──────────────────────────────────────────────────

export type {
  // Tier identifier
  CommercialTierId,

  // Support level discriminants
  CmsSupportLevel,
  AiSupportLevel,
  DashboardLevel,
  ReportingLevel,
  SupportedPageType,
  OnboardingScope,

  // Package structure
  PackageOnboarding,
  PackagePricingRef,
  PricingPackage,
  PricingPackageRegistry,

  // Feature matrix
  FeatureMatrixRow,
} from "./packages";

// ── Package tier runtime exports ───────────────────────────────────────────────

export {
  // ── Package definitions ───────────────────────────────────────────────────
  /** Start tier — adaptive homepage, rules decisioning, contact enrichment. */
  START_PACKAGE,
  /** Growth tier — adds campaign landing pages, A/B experiments, analytics. */
  GROWTH_PACKAGE,
  /** Scale tier — AI decisioning, product pages, quarterly strategy programme. */
  SCALE_PACKAGE,

  /** All three commercial tiers indexed by CommercialTierId. */
  PRICING_PACKAGES,

  // ── Package lookup helpers ────────────────────────────────────────────────
  /** Get a package by CommercialTierId. */
  getPackage,
  /** All tiers ordered from lowest to highest. */
  getOrderedTiers,
  /** All tiers that include a given page type. */
  getTiersForPageType,
  /** The lowest tier that supports a given AI level. */
  getMinimumTierForAiLevel,
  /** All tiers above the given tier in the upgrade path. */
  getUpgradePath,

  // ── Config generation ─────────────────────────────────────────────────────
  /** Generate a PricingConfig template from a commercial tier. */
  buildConfigFromTier,

  // ── Feature matrix ────────────────────────────────────────────────────────
  /** Build the commercial "compare plans" feature matrix. */
  buildPackageFeatureMatrix,
} from "./packages";

// ── Capability feature matrix ──────────────────────────────────────────────
//
// The structured capability × tier × support-level matrix.
// Answers: which tier includes a capability, at what level, under what conditions.
// Distinct from the boolean capability matrix (product/module-registry.ts) and
// the display-string commercial matrix (buildPackageFeatureMatrix above).

export type {
  MatrixSupportLevel,
  TierCapabilityEntry,
  CapabilityMatrixRow,
  CapabilityFeatureMatrix,
  TierCapabilitySummary,
} from "./feature-matrix";

export {
  // ── The matrix ────────────────────────────────────────────────────────────
  /** All 12 capability rows × 3 tiers with structured support levels. */
  CAPABILITY_FEATURE_MATRIX,

  // ── Cell and row access ───────────────────────────────────────────────────
  /** Get a single capability × tier cell entry. */
  getTierEntry,
  /** Get the full matrix row for a capability. */
  getMatrixRow,
  /** Get all matrix rows in a capability category. */
  getMatrixRowsByCategory,
  /** Resolve the full Capability object from a matrix row. */
  resolveCapability,
  /** Return the full matrix (alias for CAPABILITY_FEATURE_MATRIX). */
  getFullMatrix,
  /** Build a flat display-ready table (label + displayLabel per tier). */
  buildDisplayMatrix,

  // ── Tier capability queries ───────────────────────────────────────────────
  /** Capabilities fully included (no conditions) in the given tier. */
  getIncludedCapabilities,
  /** Capabilities included but requiring config/flag in the given tier. */
  getConditionalCapabilities,
  /** Capabilities committed but not yet shipped in the given tier. */
  getPlannedCapabilities,
  /** Capabilities activatable as add-ons in the given tier. */
  getAddonEligibleCapabilities,
  /** Capabilities not available at this tier (must upgrade). */
  getMissingCapabilities,
  /** Full capability summary bucketed by support level for the given tier. */
  getTierCapabilitySummary,

  // ── Capability × tier queries ─────────────────────────────────────────────
  /** Minimum tier where capability is fully included (no conditions). */
  getMinimumTierForCapability,
  /** Minimum tier where capability is accessible (incl. conditional/planned). */
  getMinimumTierWithAccess,
  /** All tiers where the capability is accessible. */
  getTiersWithCapability,
  /** Whether capability is available (incl. conditional) in the given tier. */
  isCapabilityInTier,
  /** Whether capability is accessible (incl. planned) in the given tier. */
  isCapabilityAccessible,

  // ── Upgrade path helpers ──────────────────────────────────────────────────
  /** Tier to upgrade to for a capability the current tier lacks. */
  getUpgradeTierForCapability,
  /** Human-readable "upgrade to unlock" message. */
  getUpgradeMessage,

  // ── Qualification helpers ─────────────────────────────────────────────────
  /** Check whether a tier fully covers a set of required capabilities. */
  checkTierCoverage,
} from "./feature-matrix";
