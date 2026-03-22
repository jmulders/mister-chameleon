/**
 * Feature Capability Model
 *
 * Defines the named, typed capabilities the platform can deliver to a client.
 * Capabilities are the atom of the product packaging system — the unit that
 * pricing packages, module registries, and capability matrices are built from.
 *
 * ─── Vocabulary clarification ─────────────────────────────────────────────────
 *
 *   TenantFeatureFlags (tenant/types.ts)
 *     Runtime boolean gates per tenant. "Is the contact form enabled for
 *     this tenant right now?" These are deployment knobs, not product concepts.
 *
 *   ProductLayer.capabilities[] (catalog.ts)
 *     Plain string descriptions of what a technical layer can do.
 *     Engineering-facing, not typed by ID. Good for docs, not queries.
 *
 *   Capability (THIS FILE)
 *     Named, typed product capabilities — the things that appear in a
 *     "what's included" table on a pricing page. Stable IDs, queryable,
 *     linked to the modules and layers that provide them.
 *
 * ─── Scope model ─────────────────────────────────────────────────────────────
 *
 *   Every capability has a scope that describes where in the platform it
 *   originates:
 *
 *   "module"     Delivered by a specific ProductModule. The module must be
 *                active (and its tenant feature flag true, if set) for this
 *                capability to be available.
 *
 *   "layer"      A capability of a platform layer that is available to any
 *                module that depends on that layer. Examples: AI decisioning
 *                and experiment support are layer capabilities of "decisioning".
 *                They enhance adaptive surfaces but are not a module themselves.
 *
 *   "platform"   Cross-cutting infrastructure capability available to all
 *                tenants. Multi-CMS support and tenant theming are platform
 *                capabilities — they don't belong to any one module.
 *
 * ─── How capabilities connect to packaging ───────────────────────────────────
 *
 *   Capabilities ─── provided to ──► Modules  (sourceModule field)
 *   Capabilities ─── grouped into ──► Packages (module-registry.ts)
 *   Packages     ─── support ──────► Use cases (via tier alignment)
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   product/types.ts          → ProductModuleId, ProductLayerId, ModuleStatus
 *   product/catalog.ts        → Module, layer, service objects + indexes
 *   product/use-cases.ts      → Use case definitions
 *   product/features.ts       ← YOU ARE HERE — Capability types and definitions
 *   product/module-registry.ts → ModuleRegistry, PackageDefinition, PackageRegistry
 *   product/index.ts          → barrel re-export
 */

import type { ProductModuleId, ProductLayerId, ModuleStatus } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for every named platform capability.
 *
 * ── Surfaces ──
 * adaptive-homepage       Adaptive rendering on the homepage.
 * adaptive-product-page   Adaptive rendering on product/service detail pages.
 * adaptive-landing-page   Adaptive rendering on campaign landing pages.
 *
 * ── Decisioning ──
 * rules-decisioning       Source- and history-aware rule evaluation.
 * ai-decisioning          AI-augmented decision provider (confidence-gated).
 * experiment-support      A/B experiment decorator for controlled variant tests.
 *
 * ── Data ──
 * visitor-history         First-party visitor history persisted across sessions.
 * contact-enrichment      Contact submissions enriched with session + variant data.
 * dashboard-analytics     Variant analytics dashboard (planned).
 *
 * ── Integration ──
 * journey-orchestration   n8n dispatch with enriched four-layer payload.
 * multi-cms-support       Provider-agnostic CMS abstraction (Sanity, Storyblok, etc.).
 *
 * ── Platform ──
 * tenant-theming          Per-tenant CSS variable injection from TenantTheme config.
 */
export type CapabilityId =
  // Surfaces
  | "adaptive-homepage"
  | "adaptive-product-page"
  | "adaptive-landing-page"
  // Decisioning
  | "rules-decisioning"
  | "ai-decisioning"
  | "experiment-support"
  // Data
  | "visitor-history"
  | "contact-enrichment"
  | "dashboard-analytics"
  // Integration
  | "journey-orchestration"
  | "multi-cms-support"
  // Platform
  | "tenant-theming";

/**
 * Taxonomy for grouping capabilities in UI display (e.g. a pricing table).
 *
 * surface      User-facing adaptive pages and rendering.
 * decisioning  How experiences are selected, tested, and refined.
 * data         Signals collected, stored, and surfaced.
 * integration  Connections to external systems and content backends.
 * platform     Infrastructure: multi-tenant support, theming, configuration.
 */
export type CapabilityCategory =
  | "surface"
  | "decisioning"
  | "data"
  | "integration"
  | "platform";

/**
 * Where in the platform stack this capability originates.
 *
 * module    Delivered by a specific ProductModule. The module must be active.
 * layer     Originates in a platform layer; enhances any module that depends on it.
 * platform  Cross-cutting infrastructure; available to all tenants by default.
 */
export type CapabilityScope = "module" | "layer" | "platform";

/**
 * A named, typed platform capability — the atom of the product packaging system.
 *
 * Capabilities are customer-facing in intent (they appear in "what's included"
 * tables) and implementation-friendly in structure (they carry IDs, scopes,
 * and layer/module references that the registry and packaging logic can query).
 */
export interface Capability {
  /** Stable, URL-safe identifier. */
  id: CapabilityId;

  /** Customer-facing display name. */
  label: string;

  /**
   * One-sentence customer-facing description.
   * Written to be readable in a proposal or pricing comparison table.
   * Avoid internal jargon (no "DecisionInput", "VisitorHistory", etc.).
   */
  description: string;

  /**
   * Which display group this capability belongs to.
   * Used to section a pricing table or capability matrix.
   */
  category: CapabilityCategory;

  /**
   * Where in the platform this capability originates.
   * Determines which of sourceModule / sourceLayer is relevant.
   */
  scope: CapabilityScope;

  /**
   * The ProductModule that delivers this capability.
   * Set when scope is "module". Absent for "layer" and "platform" capabilities.
   */
  sourceModule?: ProductModuleId;

  /**
   * The platform layer that implements this capability.
   * Set when scope is "layer". Absent for "module" and "platform" capabilities.
   */
  sourceLayer?: ProductLayerId;

  /**
   * Current availability state — mirrors ModuleStatus.
   *
   * available   Live and deliverable today.
   * beta        Functional but not publicly marketed.
   * planned     On the roadmap; types exist, implementation does not.
   */
  status: ModuleStatus;

  /**
   * The TenantFeatureFlags key that gates this capability at runtime.
   *
   * When set, the capability is only active if the corresponding flag is true
   * in the tenant's feature config. Must match a key in TenantFeatureFlags
   * (tenant/types.ts). Absent for capabilities that are always active.
   *
   * Examples:
   *   "contactForm"          → gates contact-enrichment and journey-orchestration
   *   "aiDecisionProvider"   → gates ai-decisioning
   *   "abTesting"            → gates experiment-support
   */
  tenantFeatureFlag?: string;

  /**
   * Optional internal notes for engineering and product team context.
   * Not shown in customer-facing UI. Useful for "why is this planned?" context.
   */
  internalNotes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── Surfaces ──────────────────────────────────────────────────────────────────

const ADAPTIVE_HOMEPAGE: Capability = {
  id: "adaptive-homepage",
  label: "Adaptive Homepage",
  description:
    "The homepage detects each visitor's traffic source and history, then " +
    "renders the hero, proof, and CTA blocks most likely to convert them — " +
    "server-side, with no client-side flicker.",
  category: "surface",
  scope: "module",
  sourceModule: "adaptive-website",
  status: "available",
};

const ADAPTIVE_PRODUCT_PAGE: Capability = {
  id: "adaptive-product-page",
  label: "Adaptive Product/Service Page",
  description:
    "Product and service detail pages that adapt their emphasis to the " +
    "audience that arrived — showing ROI framing to Google visitors, " +
    "vision framing to LinkedIn visitors, and platform depth to returning evaluators.",
  category: "surface",
  scope: "module",
  sourceModule: "adaptive-website",
  status: "planned",
  internalNotes:
    "The rendering pipeline can handle this today. What's missing is the " +
    "product/service-page variant key type in decision/types.ts and a new " +
    "page route. Add PageTypeId 'product-detail-page' and wire a new page " +
    "when a client requests it.",
};

const ADAPTIVE_LANDING_PAGE: Capability = {
  id: "adaptive-landing-page",
  label: "Adaptive Landing Pages",
  description:
    "Campaign landing pages that read UTM parameters and visitor context on " +
    "arrival and render the variant that best matches the audience each paid " +
    "campaign was targeting — one URL, many first impressions.",
  category: "surface",
  scope: "module",
  sourceModule: "adaptive-landing-pages",
  status: "planned",
  internalNotes:
    "Blocked on the adaptive-landing-pages module (currently 'planned' in " +
    "catalog.ts). The decisioning and rendering infrastructure is already in " +
    "place; this needs a new page route and campaign-specific variant key types.",
};

// ── Decisioning ───────────────────────────────────────────────────────────────

const RULES_DECISIONING: Capability = {
  id: "rules-decisioning",
  label: "Rules-Based Decisioning",
  description:
    "An ordered rule set evaluates each visitor's traffic source and " +
    "behavioural history to select the optimal experience plan — zero AI " +
    "cost, zero latency overhead, live from day one.",
  category: "decisioning",
  scope: "layer",
  sourceLayer: "decisioning",
  status: "available",
};

const AI_DECISIONING: Capability = {
  id: "ai-decisioning",
  label: "AI-Augmented Decisioning",
  description:
    "An LLM evaluates visitor signals to select the experience plan when " +
    "the rules engine confidence is below the configured threshold. Falls " +
    "back to rule evaluation gracefully when AI is unavailable.",
  category: "decisioning",
  scope: "layer",
  sourceLayer: "decisioning",
  status: "available",
  tenantFeatureFlag: "aiDecisionProvider",
  internalNotes:
    "AiDecisionProvider base class and confidence policy are implemented. " +
    "Requires a subclass wired into the page and aiDecisionProvider flag set " +
    "to true in the tenant config. Gated by flag, not by status.",
};

const EXPERIMENT_SUPPORT: Capability = {
  id: "experiment-support",
  label: "A/B Experiment Support",
  description:
    "Run controlled variant experiments on any adaptive page. The experiment " +
    "decorator intercepts the decision engine, applies bucket assignments, " +
    "and records exposure events for statistical readout.",
  category: "decisioning",
  scope: "layer",
  sourceLayer: "decisioning",
  status: "available",
  tenantFeatureFlag: "abTesting",
  internalNotes:
    "ExperimentDecisionProvider is implemented. Gated by the abTesting feature " +
    "flag to avoid the DB round-trip on tenants without active experiments.",
};

// ── Data ──────────────────────────────────────────────────────────────────────

const VISITOR_HISTORY: Capability = {
  id: "visitor-history",
  label: "First-Party Visitor History",
  description:
    "The platform tracks page views, CTA clicks, and session patterns across " +
    "visits to build a persistent profile — no third-party cookies, no consent " +
    "dependency, no PII. History feeds back into decisioning on every return visit.",
  category: "data",
  scope: "module",
  sourceModule: "context-intelligence",
  status: "available",
};

const CONTACT_ENRICHMENT: Capability = {
  id: "contact-enrichment",
  label: "Enriched Contact Submissions",
  description:
    "Every form submission is automatically enriched server-side with traffic " +
    "source, UTMs, session depth, CTA engagement history, and the variant " +
    "the visitor converted on — no client-side data passing required.",
  category: "data",
  scope: "module",
  sourceModule: "adaptive-follow-up",
  status: "available",
  tenantFeatureFlag: "contactForm",
};

const DASHBOARD_ANALYTICS: Capability = {
  id: "dashboard-analytics",
  label: "Variant Analytics Dashboard",
  description:
    "An internal dashboard surfacing variant selection frequency, CTA click " +
    "rates per variant, conversion by traffic source, and session engagement " +
    "depth trends — drawn from the platform's own first-party event data.",
  category: "data",
  scope: "platform",
  status: "planned",
  internalNotes:
    "The data layer (events, sessions, served_variants tables) is already " +
    "collecting everything needed. This is a UI + query layer problem. " +
    "Likely its own ProductModule ('analytics-dashboard') when built.",
};

// ── Integration ───────────────────────────────────────────────────────────────

const JOURNEY_ORCHESTRATION: Capability = {
  id: "journey-orchestration",
  label: "Journey Orchestration",
  description:
    "Contact submissions dispatch an enriched four-layer payload to n8n for " +
    "routing to CRM, email sequences, Slack, or any connected workflow tool. " +
    "Per-tenant webhook URL override supported.",
  category: "integration",
  scope: "module",
  sourceModule: "adaptive-follow-up",
  status: "available",
  tenantFeatureFlag: "contactForm",
};

const MULTI_CMS_SUPPORT: Capability = {
  id: "multi-cms-support",
  label: "Multi-CMS Support",
  description:
    "Connect the platform to any supported CMS — Sanity, Storyblok, Statamic, " +
    "or the built-in mock. Each tenant chooses their own provider; the adaptive " +
    "rendering pipeline is provider-agnostic.",
  category: "integration",
  scope: "platform",
  status: "available",
};

// ── Platform ──────────────────────────────────────────────────────────────────

const TENANT_THEMING: Capability = {
  id: "tenant-theming",
  label: "Per-Tenant Brand Theming",
  description:
    "Each deployment gets its own brand theme — primary colours, radius " +
    "personality, and brand metadata — injected as CSS custom properties " +
    "at request time. Components inherit via cascade; no code changes needed.",
  category: "platform",
  scope: "platform",
  status: "available",
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLED COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All platform capabilities, ordered by category and commercial entry point.
 *
 * Surface → Decisioning → Data → Integration → Platform
 */
export const CAPABILITIES: readonly Capability[] = [
  // Surfaces
  ADAPTIVE_HOMEPAGE,
  ADAPTIVE_PRODUCT_PAGE,
  ADAPTIVE_LANDING_PAGE,
  // Decisioning
  RULES_DECISIONING,
  AI_DECISIONING,
  EXPERIMENT_SUPPORT,
  // Data
  VISITOR_HISTORY,
  CONTACT_ENRICHMENT,
  DASHBOARD_ANALYTICS,
  // Integration
  JOURNEY_ORCHESTRATION,
  MULTI_CMS_SUPPORT,
  // Platform
  TENANT_THEMING,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP INDEX
// ─────────────────────────────────────────────────────────────────────────────

/** Mapped type for O(1) capability lookup by ID. */
export type CapabilityIndex = Readonly<Record<CapabilityId, Capability>>;

/**
 * Index of all capabilities by ID.
 *
 * @example
 *   const cap = CAPABILITY_INDEX["ai-decisioning"];
 *   console.log(cap.status, cap.tenantFeatureFlag);
 */
export const CAPABILITY_INDEX: CapabilityIndex = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c]),
) as CapabilityIndex;

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all capabilities in the given category.
 *
 * @example
 *   const surfaces = getCapabilitiesByCategory("surface");
 */
export function getCapabilitiesByCategory(
  category: CapabilityCategory,
): Capability[] {
  return CAPABILITIES.filter((c) => c.category === category);
}

/**
 * Returns all capabilities whose status matches the given value.
 *
 * @example
 *   const live = getCapabilitiesByStatus("available");
 *   const coming = getCapabilitiesByStatus("planned");
 */
export function getCapabilitiesByStatus(
  status: ModuleStatus,
): Capability[] {
  return CAPABILITIES.filter((c) => c.status === status);
}

/**
 * Returns all capabilities provided by the given module.
 *
 * @example
 *   const caps = getCapabilitiesForModule("adaptive-website");
 */
export function getCapabilitiesForModule(
  moduleId: ProductModuleId,
): Capability[] {
  return CAPABILITIES.filter(
    (c) => c.scope === "module" && c.sourceModule === moduleId,
  );
}

/**
 * Returns all capabilities originating from the given platform layer.
 *
 * @example
 *   const caps = getCapabilitiesForLayer("decisioning");
 */
export function getCapabilitiesForLayer(
  layerId: ProductLayerId,
): Capability[] {
  return CAPABILITIES.filter(
    (c) => c.scope === "layer" && c.sourceLayer === layerId,
  );
}

/**
 * Returns all capabilities that are runtime-gated by a tenant feature flag.
 *
 * @example
 *   const gated = getGatedCapabilities();
 *   // → [contact-enrichment, journey-orchestration, ai-decisioning, experiment-support]
 */
export function getGatedCapabilities(): Capability[] {
  return CAPABILITIES.filter((c) => c.tenantFeatureFlag !== undefined);
}
