/**
 * Module Registry and Package Capability Matrix
 *
 * Two related structures that power the product packaging layer:
 *
 *   ModuleRegistry       An enriched view of every ProductModule that adds its
 *                        capability inventory — the named features each module
 *                        provides. This is the bridge between modules (what we
 *                        sell) and capabilities (what those modules can do).
 *
 *   PackageDefinition    A logical bundle of capabilities and modules that forms
 *                        a purchasable tier. Not a pricing record — a product
 *                        architecture concept that pricing logic can build on.
 *
 *   PackageRegistry      The record of all defined packages, indexed by PackageId.
 *                        This is the PackageCapabilityMatrix foundation the
 *                        platform can later query to generate proposals, pricing
 *                        pages, and tenant feature flag sets.
 *
 * ─── Three-package model ─────────────────────────────────────────────────────
 *
 *   essential    The core adaptive platform. One adaptive surface (homepage),
 *                rules-based decisioning, visitor history, contact enrichment,
 *                and journey orchestration. Covers entry and growth use cases.
 *
 *   growth       Extends essential with campaign surfaces and testing. Adds
 *                adaptive landing pages (when available), A/B experiment
 *                support, and the analytics dashboard (when available).
 *
 *   scale        Extends growth with AI decisioning and adaptive product pages.
 *                The full platform footprint — covers all use case tiers
 *                including account-based marketing and known-user experiences.
 *
 * ─── Relationship to use case tiers ──────────────────────────────────────────
 *
 *   Package tier  →  Use case tier alignment
 *   essential     →  "entry" and "growth" use cases
 *   growth        →  "growth" and "full-journey" use cases (without AI)
 *   scale         →  all use cases including "full-journey" with AI
 *
 * ─── How capability gating works ─────────────────────────────────────────────
 *
 *   Some capabilities in a package are always-on; others require a
 *   TenantFeatureFlag to be set. The package defines the MAXIMUM capability
 *   set available — individual tenant configs gate the runtime subset.
 *
 *   To get the active capabilities for a specific tenant:
 *     1. getCapabilitiesForPackage(packageId)         → all capabilities in tier
 *     2. Filter by capability.tenantFeatureFlag       → identify gated caps
 *     3. Cross-reference with tenant.features         → resolve active set
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   product/types.ts          → ProductModuleId, ProductLayerId, ModuleStatus
 *   product/catalog.ts        → ProductModule objects + MODULE_INDEX
 *   product/use-cases.ts      → UseCaseId, UseCaseTier, UseCaseDefinition
 *   product/features.ts       → CapabilityId, Capability, CAPABILITY_INDEX
 *   product/module-registry.ts ← YOU ARE HERE
 *   product/index.ts          → barrel re-export
 */

import type { ProductModuleId } from "./types";
import type { UseCaseTier } from "./use-cases";
import type { CapabilityId, Capability } from "./features";

import { MODULE_INDEX } from "./catalog";
import { CAPABILITY_INDEX, CAPABILITIES, getCapabilitiesForModule } from "./features";
import type { ProductModule } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// MODULE REGISTRY TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An enriched module entry that augments the base ProductModule with
 * its capability inventory.
 *
 * The capability inventory is the authoritative list of named Capabilities
 * this module provides to a client. It is defined here (not in catalog.ts)
 * to keep the catalog focused on what modules ARE rather than what they DO
 * from a packaging perspective.
 */
export interface ModuleRegistryEntry {
  /** The ProductModule from the catalog. */
  module: ProductModule;

  /**
   * The CapabilityIds this module provides.
   *
   * Includes only module-scoped capabilities (scope: "module"). Layer and
   * platform capabilities are not listed here — use getCapabilitiesForLayer()
   * and getCapabilitiesByScope("platform") from features.ts for those.
   *
   * Ordered to match the natural "what does this module do?" narrative.
   */
  capabilities: readonly CapabilityId[];
}

/** The full module registry, indexed by ProductModuleId for O(1) access. */
export type ModuleRegistry = Readonly<Record<ProductModuleId, ModuleRegistryEntry>>;

// ─────────────────────────────────────────────────────────────────────────────
// PACKAGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for the three commercial packages.
 *
 * essential    Core adaptive platform — one surface, rules decisioning, enrichment.
 * growth       Adds campaign surfaces, experiment support, analytics dashboard.
 * scale        Adds AI decisioning, product/service page adaptation.
 */
export type PackageId = "essential" | "growth" | "scale";

/**
 * A commercial package — a named, logical bundle of capabilities and modules
 * that forms a pricing tier.
 *
 * PackageDefinition is an architecture concept, not a pricing record.
 * It does not carry price, currency, billing interval, or SKU data.
 * Those concerns belong in a separate pricing module that can read
 * PackageDefinition as input.
 */
export interface PackageDefinition {
  /** Stable slug. */
  id: PackageId;

  /** Customer-facing display name. */
  label: string;

  /** Single-sentence value proposition for a pricing page headline. */
  tagline: string;

  /**
   * Two-to-three sentence description for a pricing page card or proposal.
   * Written to be readable by a non-technical buyer.
   */
  description: string;

  /**
   * Use case tier this package is designed to deliver.
   * Packages and use cases share the same three-tier vocabulary so
   * getUseCasesByTier(package.tier) returns the use cases this package enables.
   */
  tier: UseCaseTier;

  /**
   * All capability IDs included in this package.
   *
   * This is the definitive "what's included" list. It includes:
   *   • Module capabilities (from modules listed in this.modules)
   *   • Layer capabilities (rules-decisioning, ai-decisioning, etc.)
   *   • Platform capabilities (tenant-theming, multi-cms-support)
   *
   * Capabilities may be runtime-gated (see Capability.tenantFeatureFlag).
   * The package grants the RIGHT to use them; the flag enables them per tenant.
   */
  capabilities: readonly CapabilityId[];

  /**
   * The ProductModules that must be active to deliver this package.
   * Used to generate the feature flag set for a new tenant at onboarding.
   */
  modules: readonly ProductModuleId[];

  /**
   * Subset of capabilities to visually highlight in a comparison table.
   * Typically the differentiating capabilities vs the tier below.
   * When absent, no capabilities are highlighted.
   */
  highlightCapabilities?: readonly CapabilityId[];

  /**
   * Capabilities from the tier below that are also included.
   * Enables "everything in [lower tier], plus:" copy in pricing tables.
   * When this is the lowest tier, this is empty.
   */
  includesFromTier?: PackageId;
}

/** The full package registry, indexed by PackageId for O(1) access. */
export type PackageRegistry = Readonly<Record<PackageId, PackageDefinition>>;

// ─────────────────────────────────────────────────────────────────────────────
// MODULE REGISTRY DATA
// ─────────────────────────────────────────────────────────────────────────────
//
// Maps every ProductModule to its capability inventory.
// Layer and platform capabilities are declared in the package definitions
// below, not here — they are not owned by any single module.

/**
 * The module registry — each module entry augmented with its capability inventory.
 *
 * @example
 *   const entry = MODULE_REGISTRY["adaptive-website"];
 *   console.log(entry.capabilities);       // ["adaptive-homepage", ...]
 *   console.log(entry.module.status);      // "available"
 */
export const MODULE_REGISTRY: ModuleRegistry = {
  "adaptive-website": {
    module: MODULE_INDEX["adaptive-website"],
    capabilities: [
      "adaptive-homepage",
      "adaptive-product-page",  // planned — the module's pipeline can support it
    ],
  },

  "adaptive-landing-pages": {
    module: MODULE_INDEX["adaptive-landing-pages"],
    capabilities: [
      "adaptive-landing-page",
    ],
  },

  "adaptive-follow-up": {
    module: MODULE_INDEX["adaptive-follow-up"],
    capabilities: [
      "contact-enrichment",
      "journey-orchestration",
    ],
  },

  "context-intelligence": {
    module: MODULE_INDEX["context-intelligence"],
    capabilities: [
      "visitor-history",
    ],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PACKAGE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const ESSENTIAL_PACKAGE: PackageDefinition = {
  id: "essential",
  label: "Essential",
  tagline: "An adaptive homepage and enriched contact pipeline, live in days.",
  description:
    "The core Mister Chameleon platform. Your homepage adapts to every visitor's " +
    "source and history. Every contact submission arrives enriched with attribution " +
    "context. Multi-CMS support and per-tenant branding included from day one.",
  tier: "entry",

  // All module capabilities from: adaptive-website, context-intelligence,
  // adaptive-follow-up. Plus layer capabilities (rules-decisioning) and
  // platform capabilities (multi-cms-support, tenant-theming).
  capabilities: [
    // Surface
    "adaptive-homepage",
    // Decisioning
    "rules-decisioning",
    // Data
    "visitor-history",
    "contact-enrichment",
    // Integration
    "journey-orchestration",
    "multi-cms-support",
    // Platform
    "tenant-theming",
  ],

  modules: [
    "adaptive-website",
    "context-intelligence",
    "adaptive-follow-up",
  ],

  // No includesFromTier — this is the base package
  highlightCapabilities: [
    "adaptive-homepage",
    "contact-enrichment",
    "visitor-history",
  ],
};

const GROWTH_PACKAGE: PackageDefinition = {
  id: "growth",
  label: "Growth",
  tagline: "Everything in Essential, plus campaign surfaces and variant testing.",
  description:
    "Extends the core platform with campaign landing pages that adapt per " +
    "audience, A/B experiment support for data-driven variant iteration, and " +
    "the analytics dashboard to track variant performance over time.",
  tier: "growth",

  capabilities: [
    // Everything in essential
    "adaptive-homepage",
    "rules-decisioning",
    "visitor-history",
    "contact-enrichment",
    "journey-orchestration",
    "multi-cms-support",
    "tenant-theming",
    // Growth additions
    "adaptive-landing-page",    // planned — unlocked when module ships
    "experiment-support",
    "dashboard-analytics",      // planned — unlocked when feature ships
  ],

  modules: [
    "adaptive-website",
    "context-intelligence",
    "adaptive-follow-up",
    "adaptive-landing-pages",   // planned — added when available
  ],

  includesFromTier: "essential",
  highlightCapabilities: [
    "adaptive-landing-page",
    "experiment-support",
    "dashboard-analytics",
  ],
};

const SCALE_PACKAGE: PackageDefinition = {
  id: "scale",
  label: "Scale",
  tagline: "The full platform — AI decisioning, product pages, and the complete capability set.",
  description:
    "The maximum platform footprint. AI-augmented decisioning upgrades the " +
    "experience selection beyond the rule set. Adaptive product and service " +
    "pages extend personalisation across the full site. All current and " +
    "upcoming capabilities included.",
  tier: "full-journey",

  capabilities: [
    // Everything in growth
    "adaptive-homepage",
    "rules-decisioning",
    "visitor-history",
    "contact-enrichment",
    "journey-orchestration",
    "multi-cms-support",
    "tenant-theming",
    "adaptive-landing-page",
    "experiment-support",
    "dashboard-analytics",
    // Scale additions
    "adaptive-product-page",   // planned — unlocked when pipeline extended
    "ai-decisioning",
  ],

  modules: [
    "adaptive-website",
    "context-intelligence",
    "adaptive-follow-up",
    "adaptive-landing-pages",
  ],

  includesFromTier: "growth",
  highlightCapabilities: [
    "ai-decisioning",
    "adaptive-product-page",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PACKAGE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The package capability matrix — all defined packages indexed by ID.
 *
 * This is the PackageCapabilityMatrix foundation. Future pricing logic queries
 * this to generate package suggestions, capability comparisons, and tenant
 * feature flag sets.
 *
 * @example
 *   const pkg = PACKAGE_REGISTRY["growth"];
 *   console.log(pkg.capabilities);  // full capability list
 *   console.log(pkg.modules);       // which modules to activate
 *
 *   // Generate a "what's included" comparison table:
 *   Object.values(PACKAGE_REGISTRY).map(p => ({
 *     label: p.label,
 *     caps: p.capabilities.map(id => CAPABILITY_INDEX[id].label),
 *   }));
 */
export const PACKAGE_REGISTRY: PackageRegistry = {
  essential: ESSENTIAL_PACKAGE,
  growth:    GROWTH_PACKAGE,
  scale:     SCALE_PACKAGE,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the full Capability objects included in the given package.
 *
 * @example
 *   const caps = getCapabilitiesForPackage("growth");
 *   caps.forEach(c => console.log(c.label, c.status));
 */
export function getCapabilitiesForPackage(packageId: PackageId): Capability[] {
  return PACKAGE_REGISTRY[packageId].capabilities.map(
    (id) => CAPABILITY_INDEX[id],
  );
}

/**
 * Returns every package that includes the given capability.
 *
 * @example
 *   const pkgs = getPackagesWithCapability("ai-decisioning");
 *   // → ["scale"]
 */
export function getPackagesWithCapability(capId: CapabilityId): PackageId[] {
  return (Object.values(PACKAGE_REGISTRY) as PackageDefinition[])
    .filter((pkg) => (pkg.capabilities as readonly string[]).includes(capId))
    .map((pkg) => pkg.id);
}

/**
 * Returns the lowest-tier package that includes the given capability.
 * Useful for "upgrade to unlock" messaging in pricing UI.
 *
 * Returns null if no package includes the capability (should not happen
 * for any capability in CAPABILITIES, but defensive for future additions).
 *
 * @example
 *   const min = getMinimumPackageForCapability("ai-decisioning");
 *   // → "scale"
 *
 *   const min = getMinimumPackageForCapability("adaptive-homepage");
 *   // → "essential"
 */
export function getMinimumPackageForCapability(
  capId: CapabilityId,
): PackageId | null {
  const tierOrder: PackageId[] = ["essential", "growth", "scale"];
  return (
    tierOrder.find((id) =>
      (PACKAGE_REGISTRY[id].capabilities as readonly string[]).includes(capId),
    ) ?? null
  );
}

/**
 * Returns true if the given capability is included in the given package.
 * The core predicate for rendering a capability comparison matrix.
 *
 * @example
 *   isCapabilityInPackage("ai-decisioning", "essential") // → false
 *   isCapabilityInPackage("ai-decisioning", "scale")     // → true
 */
export function isCapabilityInPackage(
  capId: CapabilityId,
  packageId: PackageId,
): boolean {
  return (
    PACKAGE_REGISTRY[packageId].capabilities as readonly string[]
  ).includes(capId);
}

/**
 * Returns the capability diff between two packages — the capabilities in
 * `higher` that are not in `lower`. Useful for "what do you get by upgrading?"
 * copy in pricing tables.
 *
 * @example
 *   const diff = getPackageDiff("essential", "growth");
 *   // → [adaptive-landing-page, experiment-support, dashboard-analytics]
 */
export function getPackageDiff(
  lower: PackageId,
  higher: PackageId,
): Capability[] {
  const lowerCaps = new Set(PACKAGE_REGISTRY[lower].capabilities);
  return PACKAGE_REGISTRY[higher].capabilities
    .filter((id) => !lowerCaps.has(id))
    .map((id) => CAPABILITY_INDEX[id]);
}

/**
 * Returns the full ModuleRegistryEntry for the given module, including
 * the resolved Capability objects (not just IDs).
 *
 * @example
 *   const entry = getModuleRegistryEntry("adaptive-follow-up");
 *   entry.capabilities.forEach(c => console.log(c.label));
 */
export function getModuleRegistryEntry(moduleId: ProductModuleId): {
  module: ProductModule;
  capabilities: Capability[];
} {
  const entry = MODULE_REGISTRY[moduleId];
  return {
    module: entry.module,
    capabilities: entry.capabilities.map((id) => CAPABILITY_INDEX[id]),
  };
}

/**
 * Returns all capabilities in the registry for the given module, drawn from
 * features.ts. This includes both module-scoped capabilities (listed in
 * MODULE_REGISTRY) and any layer capabilities the module's layers provide.
 *
 * @example
 *   const all = getAllCapabilitiesForModule("adaptive-website");
 *   // → [adaptive-homepage, adaptive-product-page]
 *   //   (layer caps like rules-decisioning are on the layer, not the module)
 */
export function getAllCapabilitiesForModule(moduleId: ProductModuleId): Capability[] {
  return getCapabilitiesForModule(moduleId);
}

/**
 * Generates the recommended TenantFeatureFlags shape for a given package.
 *
 * Returns a plain object of flag keys → true for every capability in the
 * package that has a tenantFeatureFlag set. Callers can spread this into
 * a createTenantConfig() call to activate all capabilities in the package.
 *
 * Only flags for AVAILABLE capabilities are included — planned capabilities
 * whose flags aren't runtime-meaningful yet are omitted.
 *
 * @example
 *   const flags = getFeatureFlagsForPackage("essential");
 *   // → { contactForm: true }
 *
 *   const flags = getFeatureFlagsForPackage("scale");
 *   // → { contactForm: true, aiDecisionProvider: true }
 */
export function getFeatureFlagsForPackage(
  packageId: PackageId,
): Record<string, true> {
  const flags: Record<string, true> = {};
  for (const capId of PACKAGE_REGISTRY[packageId].capabilities) {
    const cap = CAPABILITY_INDEX[capId];
    if (cap.tenantFeatureFlag && cap.status === "available") {
      flags[cap.tenantFeatureFlag] = true;
    }
  }
  return flags;
}

/**
 * Returns a matrix-ready snapshot of all packages × all capabilities.
 *
 * Each row is a capability; each column is a package. The cell value is
 * true when the capability is included in that package.
 *
 * Suitable for direct rendering in a pricing comparison table component.
 *
 * @example
 *   const matrix = buildCapabilityMatrix();
 *   // → [
 *   //     { capability: Capability, essential: true, growth: true, scale: true },
 *   //     { capability: Capability, essential: false, growth: true, scale: true },
 *   //     ...
 *   //   ]
 */
export function buildCapabilityMatrix(): Array<{
  capability: Capability;
  essential: boolean;
  growth: boolean;
  scale: boolean;
}> {
  return CAPABILITIES.map((cap) => ({
    capability: cap,
    essential: isCapabilityInPackage(cap.id, "essential"),
    growth:    isCapabilityInPackage(cap.id, "growth"),
    scale:     isCapabilityInPackage(cap.id, "scale"),
  }));
}
