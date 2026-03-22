/**
 * Product Module — Public API
 *
 * The internal product model for the Mister Chameleon platform.
 * Import from "@/product" rather than from individual files.
 *
 * ─── What this module provides ───────────────────────────────────────────────
 *
 *   Types
 *     ProductLayerId        — stable IDs for platform capability layers
 *     ProductModuleId       — stable IDs for customer-facing product modules
 *     ServiceOfferingId     — stable IDs for service engagements
 *     UseCaseType           — enumeration of addressable business problems
 *     ModuleStatus          — "available" | "beta" | "planned"
 *     ServiceType           — "implementation" | "advisory" | "ongoing"
 *     ProductLayer          — core technical capability definition
 *     ProductModule         — customer-facing product feature definition
 *     ServiceOffering       — implementation/advisory service definition
 *     ProductCatalog        — aggregated catalog shape
 *     ProductLayerIndex     — mapped type for O(1) layer lookup
 *     ProductModuleIndex    — mapped type for O(1) module lookup
 *     ServiceOfferingIndex  — mapped type for O(1) service lookup
 *     CapabilityId          — stable IDs for named product capabilities
 *     CapabilityCategory    — "surface" | "decisioning" | "data" | "integration" | "platform"
 *     CapabilityScope       — "module" | "layer" | "platform"
 *     Capability            — named product capability definition
 *     CapabilityIndex       — mapped type for O(1) capability lookup
 *     PackageId             — "essential" | "growth" | "scale"
 *     PackageDefinition     — package with capability + module inventory
 *     PackageRegistry       — mapped type for O(1) package lookup
 *     ModuleRegistryEntry   — ProductModule augmented with capability inventory
 *     ModuleRegistry        — mapped type for O(1) module+capability lookup
 *
 *   Catalog data
 *     PLATFORM_LAYERS       — all platform layers as a readonly array
 *     PRODUCT_MODULES       — all product modules as a readonly array
 *     SERVICE_OFFERINGS     — all service offerings as a readonly array
 *     MC_CATALOG            — assembled ProductCatalog (layers + modules + services)
 *     CAPABILITIES          — all named capabilities as a readonly array
 *     MODULE_REGISTRY       — modules augmented with capability inventories
 *     PACKAGE_REGISTRY      — package capability matrix (essential/growth/scale)
 *
 *   Lookup indexes
 *     LAYER_INDEX           — Record<ProductLayerId, ProductLayer>
 *     MODULE_INDEX          — Record<ProductModuleId, ProductModule>
 *     SERVICE_INDEX         — Record<ServiceOfferingId, ServiceOffering>
 *     CAPABILITY_INDEX      — Record<CapabilityId, Capability>
 *
 *   Query helpers
 *     getModulesByStatus()              — filter modules by availability state
 *     getModulesForUseCase()            — find modules that address a given use case
 *     getServicesForModule()            — find services that support a given module
 *     getLayersForModule()              — resolve a module's layer dependencies
 *     getCapabilitiesByCategory()       — filter capabilities by category
 *     getCapabilitiesByStatus()         — filter capabilities by status
 *     getCapabilitiesForModule()        — capabilities a module provides
 *     getCapabilitiesForLayer()         — capabilities a layer provides
 *     getGatedCapabilities()            — capabilities behind a feature flag
 *     getCapabilitiesForPackage()       — full capability objects for a package
 *     getPackagesWithCapability()       — which packages include a capability
 *     getMinimumPackageForCapability()  — lowest tier that includes a capability
 *     isCapabilityInPackage()           — boolean check for matrix rendering
 *     getPackageDiff()                  — capability additions between two packages
 *     getFeatureFlagsForPackage()       — generate TenantFeatureFlags for a package
 *     buildCapabilityMatrix()           — full package × capability matrix rows
 *     getModuleRegistryEntry()          — module + resolved capability objects
 *     getAllCapabilitiesForModule()      — all capabilities a module provides
 *
 *   Scope classification
 *     ScopeCategory         — "in_product" | "in_implementation" | "custom_work" | "unsupported"
 *     ScopeDomain           — "cms" | "frontend" | "decisioning" | "integration" | …
 *     CustomWorkRisk        — "low" | "medium" | "high"
 *     ScopeItemId           — union of 37 stable scope item IDs
 *     ScopeItem             — full scope item with sales/delivery guidance
 *     ScopeQualificationQuestion — discovery question paired to surfaced scope items
 *
 *   Scope catalog
 *     SCOPE_CATALOG               — 37 scope items ordered by domain
 *     QUALIFICATION_QUESTIONS     — 10 AM discovery questions
 *
 *   Scope helpers
 *     getScopeByCategory()        — filter items by in_product / custom_work / etc.
 *     getScopeByDomain()          — filter items by domain (cms, frontend, …)
 *     getScopeItem()              — look up a single scope item by ID
 *     getScopeForCapability()     — scope items related to a CapabilityId
 *     getScopeForModule()         — scope items related to a ProductModuleId
 *     getCustomWorkRequiringQuote() — all custom_work items with requiresSeparateQuote
 *     getCustomWorkByRisk()       — custom_work items filtered by risk level
 *     assessScopeRisk()           — partition flagged IDs into risk buckets
 *
 *   Product boundaries
 *     BoundaryStatus              — "supported" | "planned" | "conditional" | "unsupported"
 *     CMSProviderBoundaryId       — "sanity" | "storyblok" | "statamic"
 *     PageTypeBoundaryId          — "homepage" | "campaign-landing-page" | …
 *     DecisionProviderBoundaryId  — "rules" | "ai"
 *     BlockTypeBoundaryId         — "hero" | "proof" | "cta"
 *     UnsupportedExtensionId      — union of 11 hard-no architectural extension IDs
 *     CMSProviderBoundary         — per-provider limitations, env vars, schema alignment
 *     PageTypeBoundary            — page type status, minimum tier, adaptive blocks
 *     DecisionProviderBoundary    — signals supported, tier requirement, conditions
 *     BlockTypeBoundary           — adaptive fields, fixed elements, unsupported extensions
 *     ThemingBoundary             — what CSS custom properties are included / excluded
 *     UnsupportedExtension        — hard architectural exclusion with reason + alternative
 *     ProductBoundaries           — assembled root boundary document
 *
 *   Boundary catalog
 *     CMS_PROVIDER_BOUNDARIES     — 3 provider entries (sanity, storyblok, statamic)
 *     PAGE_TYPE_BOUNDARIES        — 7 page type entries (homepage + 6 others)
 *     DECISION_PROVIDER_BOUNDARIES — rules + ai provider entries
 *     BLOCK_TYPE_BOUNDARIES       — hero, proof, cta block entries
 *     THEMING_BOUNDARY            — what brand theming covers and excludes
 *     UNSUPPORTED_EXTENSIONS      — 11 hard-no architectural extension entries
 *     PRODUCT_BOUNDARIES          — assembled root boundary document
 *
 *   Boundary helpers
 *     getCMSProviderBoundary()       — look up a single CMS provider boundary
 *     getCMSProvidersByStatus()      — filter CMS providers by status
 *     getPageTypeBoundary()          — look up a single page type boundary
 *     getPageTypesByTier()           — page types available from a given commercial tier
 *     getPageTypesByStatus()         — filter page types by status
 *     getDecisionProviderBoundary()  — look up a single decision provider boundary
 *     getBlockTypeBoundary()         — look up a single block type boundary
 *     getUnsupportedExtension()      — look up a single unsupported extension
 *     getUnsupportedExtensionsByDomain() — filter unsupported extensions by domain
 *     checkRequirements()            — assess a list of requirement IDs against all boundaries
 *
 * ─── Usage examples ──────────────────────────────────────────────────────────
 *
 *   import { MC_CATALOG } from "@/product";
 *   const liveModules = MC_CATALOG.modules.filter(m => m.status === "available");
 *
 *   import { MODULE_INDEX, getServicesForModule } from "@/product";
 *   const mod = MODULE_INDEX["adaptive-website"];
 *   const services = getServicesForModule("adaptive-website");
 *
 *   import type { ProductModule } from "@/product";
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  ProductLayerId,
  ProductModuleId,
  ServiceOfferingId,
  UseCaseType,
  ModuleStatus,
  ServiceType,
  ProductLayer,
  ProductModule,
  ServiceOffering,
  ProductCatalog,
  ProductLayerIndex,
  ProductModuleIndex,
  ServiceOfferingIndex,
} from "./types";

// ── Catalog data ──────────────────────────────────────────────────────────────
export {
  PLATFORM_LAYERS,
  PRODUCT_MODULES,
  SERVICE_OFFERINGS,
  MC_CATALOG,
} from "./catalog";

// ── Lookup indexes ────────────────────────────────────────────────────────────
export {
  LAYER_INDEX,
  MODULE_INDEX,
  SERVICE_INDEX,
} from "./catalog";

// ── Query helpers ─────────────────────────────────────────────────────────────
export {
  getModulesByStatus,
  getModulesForUseCase,
  getServicesForModule,
  getLayersForModule,
} from "./catalog";

// ── Use cases ─────────────────────────────────────────────────────────────────
// Customer scenario definitions — each maps required modules + services to a
// named deployment pattern with target outcomes, recommended pages, and KPIs.
export type {
  UseCaseId,
  PageTypeId,
  UseCaseTier,
  UseCaseKPI,
  RecommendedPage,
  UseCaseDefinition,
  UseCaseIndex,
} from "./use-cases";

export {
  USE_CASES,
  USE_CASE_INDEX,
} from "./use-cases";

export {
  getUseCasesByTier,
  getUseCasesForModule,
  getUseCasesForPage,
  getRelatedUseCases,
  getRequiredModulesForUseCase,
  getRecommendedServicesForUseCase,
  getAdaptivePagesForUseCase,
} from "./use-cases";

// ── Capabilities ──────────────────────────────────────────────────────────────
// Named, typed product capabilities — the atom of the packaging system.
export type {
  CapabilityId,
  CapabilityCategory,
  CapabilityScope,
  Capability,
  CapabilityIndex,
} from "./features";

export {
  CAPABILITIES,
  CAPABILITY_INDEX,
} from "./features";

export {
  getCapabilitiesByCategory,
  getCapabilitiesByStatus,
  getCapabilitiesForModule,
  getCapabilitiesForLayer,
  getGatedCapabilities,
} from "./features";

// ── Module registry and package matrix ───────────────────────────────────────
// The capability inventory per module and the three-tier package definitions.
export type {
  ModuleRegistryEntry,
  ModuleRegistry,
  PackageId,
  PackageDefinition,
  PackageRegistry,
} from "./module-registry";

export {
  MODULE_REGISTRY,
  PACKAGE_REGISTRY,
} from "./module-registry";

export {
  getCapabilitiesForPackage,
  getPackagesWithCapability,
  getMinimumPackageForCapability,
  isCapabilityInPackage,
  getPackageDiff,
  getFeatureFlagsForPackage,
  buildCapabilityMatrix,
  getModuleRegistryEntry,
  getAllCapabilitiesForModule,
} from "./module-registry";

// ── Scope classification ───────────────────────────────────────────────────
// Business-critical boundary definitions: what is in-product, in-implementation,
// custom work, or unsupported. Used for pre-sale qualification and delivery scope
// management.
export type {
  ScopeCategory,
  ScopeDomain,
  CustomWorkRisk,
  ScopeItemId,
  ScopeItem,
  ScopeQualificationQuestion,
} from "./scope-classification";

export {
  SCOPE_CATALOG,
  QUALIFICATION_QUESTIONS,
  getScopeByCategory,
  getScopeByDomain,
  getScopeItem,
  getScopeForCapability,
  getScopeForModule,
  getCustomWorkRequiringQuote,
  getCustomWorkByRisk,
  assessScopeRisk,
} from "./scope-classification";

// ── Product boundaries ─────────────────────────────────────────────────────
// Hard platform rules: supported CMS providers, page types, decision providers,
// block types, theming scope, and unsupported architectural extensions.
// Queryable at runtime for proposal generation, AM discovery tooling, and
// delivery scoping.
export type {
  BoundaryStatus,
  CMSSchemaAlignment,
  ContentEditability,
  BlockCustomisationLevel,
  CMSProviderBoundaryId,
  PageTypeBoundaryId,
  DecisionProviderBoundaryId,
  BlockTypeBoundaryId,
  UnsupportedExtensionId,
  CMSProviderBoundary,
  PageTypeBoundary,
  DecisionProviderBoundary,
  BlockTypeBoundary,
  ThemingBoundary,
  ThemingProperty,
  UnsupportedExtension,
  ProductBoundaries,
} from "./boundaries";

export {
  CMS_PROVIDER_BOUNDARIES,
  PAGE_TYPE_BOUNDARIES,
  DECISION_PROVIDER_BOUNDARIES,
  BLOCK_TYPE_BOUNDARIES,
  THEMING_BOUNDARY,
  UNSUPPORTED_EXTENSIONS,
  PRODUCT_BOUNDARIES,
  getCMSProviderBoundary,
  getCMSProvidersByStatus,
  getPageTypeBoundary,
  getPageTypesByTier,
  getPageTypesByStatus,
  getDecisionProviderBoundary,
  getBlockTypeBoundary,
  getUnsupportedExtension,
  getUnsupportedExtensionsByDomain,
  checkRequirements,
} from "./boundaries";
