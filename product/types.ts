/**
 * Product Model Types
 *
 * Represents the Mister Chameleon platform as a structured, layered product.
 * This is an internal architecture layer — no UI consumes it yet.
 *
 * ─── Three-tier model ────────────────────────────────────────────────────────
 *
 *   Platform Layers    Core technical capabilities the platform is built on.
 *                      Not customer-facing; underpin every module.
 *                      Examples: context engine, decisioning, tracking.
 *
 *   Product Modules    Customer-facing product features built on the layers.
 *                      These are what clients buy and what we demo.
 *                      Examples: adaptive website, adaptive follow-up.
 *
 *   Service Offerings  Implementation and advisory work Mister Chameleon
 *                      delivers. Time-bound engagements that activate modules.
 *                      Examples: onboarding, content modelling, strategy.
 *
 * ─── How this connects to the runtime platform ───────────────────────────────
 *
 *   ProductModule.tenantFeatureFlag links a module to TenantFeatureFlags,
 *   making the product model queryable at runtime:
 *     "which modules is this tenant licensed for?" ← check feature flags
 *     "which layers does this module depend on?"   ← read module.layers
 *
 *   ProductModule.layers links to actual source directories, so internal
 *   tooling can cross-reference the product model with the implementation.
 *
 * ─── File map ────────────────────────────────────────────────────────────────
 *
 *   product/types.ts    ← YOU ARE HERE — all type definitions
 *   product/catalog.ts  ← concrete catalog data (layers, modules, services)
 *   product/index.ts    ← barrel re-export
 */

// ── Stable identifier types ───────────────────────────────────────────────────
//
// Defined as string literal unions so TypeScript enforces valid IDs at every
// reference site. Adding a new entry here requires populating the catalog.

/**
 * Stable identifiers for core platform capability layers.
 *
 * context-engine     Detects and normalises visitor context from HTTP requests.
 * adaptive-rendering Selects and assembles page content from variant + CMS pairs.
 * decisioning        Evaluates rules or AI models to choose the experience plan.
 * tracking           Records first-party behavioural events to the data layer.
 * orchestration      Connects on-site signals to downstream systems (n8n, CRM).
 */
export type ProductLayerId =
  | "context-engine"
  | "adaptive-rendering"
  | "decisioning"
  | "tracking"
  | "orchestration";

/**
 * Stable identifiers for customer-facing product modules.
 *
 * adaptive-website        The main adaptive homepage / site experience.
 * adaptive-landing-pages  Variant-keyed landing pages per campaign or segment.
 * adaptive-follow-up      Contact enrichment and journey dispatch via n8n.
 * context-intelligence    Visitor history, session signals, and diagnostics.
 */
export type ProductModuleId =
  | "adaptive-website"
  | "adaptive-landing-pages"
  | "adaptive-follow-up"
  | "context-intelligence";

/**
 * Stable identifiers for service engagements.
 *
 * onboarding         Scoped launch project: configure, launch, validate.
 * content-modeling   Define variant strategy and populate CMS entries.
 * optimisation       Ongoing iteration on variant performance.
 * strategy           Advisory: positioning, ICP, channel-to-variant mapping.
 */
export type ServiceOfferingId =
  | "onboarding"
  | "content-modeling"
  | "optimisation"
  | "strategy";

// ── Enumeration types ─────────────────────────────────────────────────────────

/**
 * How a service engagement is structured and billed.
 *
 * implementation   One-time delivery: setup, configuration, launch.
 * advisory         Workshops or strategic sessions — knowledge transfer.
 * ongoing          Continuous: monitoring, A/B iteration, performance reviews.
 */
export type ServiceType =
  | "implementation"
  | "advisory"
  | "ongoing";

/**
 * Availability state for a product module.
 *
 * available   Live in production and actively offered to clients.
 * beta        Functional but not publicly marketed yet — internal or pilot use.
 * planned     On the roadmap; types and catalog entries exist, code does not.
 */
export type ModuleStatus =
  | "available"
  | "beta"
  | "planned";

/**
 * The business problems a module or service addresses.
 *
 * Used in sales qualification ("does this module solve their stated problem?")
 * and product positioning. Multiple modules can share use cases — it is not
 * a one-to-one mapping.
 *
 * traffic-to-conversion      Turn inbound search or social traffic into pipeline.
 * visitor-personalisation    Serve the most relevant message to each visitor.
 * campaign-attribution       Attribute contacts and conversions back to source.
 * content-optimisation       Improve variant performance through evidence.
 * lead-qualification         Signal intent and context before a sales call.
 * journey-orchestration      Bridge on-site behaviour to CRM, email, and follow-up.
 * platform-observability     Understand what the platform decided and why.
 */
export type UseCaseType =
  | "traffic-to-conversion"
  | "visitor-personalisation"
  | "campaign-attribution"
  | "content-optimisation"
  | "lead-qualification"
  | "journey-orchestration"
  | "platform-observability";

// ── Core model interfaces ─────────────────────────────────────────────────────

/**
 * A core technical capability that underpins one or more product modules.
 *
 * Platform layers are internal — they are not sold or presented directly to
 * clients. They exist to document the technical architecture and to make the
 * dependency graph between modules and code explicit.
 */
export interface ProductLayer {
  /** Stable, URL-safe slug — must match ProductLayerId. */
  id: ProductLayerId;

  /** Short display label used in internal tooling and architecture docs. */
  label: string;

  /** One-paragraph description of what this layer does and why it exists. */
  description: string;

  /**
   * Specific technical capabilities this layer provides.
   * Written as capability statements (what it can do), not implementation notes.
   */
  capabilities: readonly string[];

  /**
   * Source directories or files that implement this layer.
   * Relative to the project root, matching the tsconfig paths.
   * Optional — omit if the layer spans too many locations to be useful to list.
   */
  sourceModules?: readonly string[];
}

/**
 * A customer-facing product feature built on one or more platform layers.
 *
 * Modules are the unit of product packaging — they map directly to what clients
 * license and what we demo. Each module should be independently demonstrable
 * and independently deliverable.
 */
export interface ProductModule {
  /** Stable slug — used in tenant config, analytics, and sales tooling. */
  id: ProductModuleId;

  /** Customer-facing display name. */
  label: string;

  /** Single-sentence value proposition for sales and website copy. */
  tagline: string;

  /**
   * Detailed description for internal documentation, pitch decks, and
   * the future product/pricing page. Two to four sentences.
   */
  description: string;

  /** Platform layers this module depends on, in dependency order. */
  layers: readonly ProductLayerId[];

  /**
   * Use cases this module addresses.
   * Used for sales qualification and cross-sell logic.
   */
  useCases: readonly UseCaseType[];

  /** Current availability state. */
  status: ModuleStatus;

  /**
   * The key in TenantFeatureFlags that gates this module per-tenant.
   *
   * When set, the module is active only if the flag is true in the tenant's
   * feature flags. When absent, the module is unconditionally active for all
   * tenants (i.e., it has no runtime gate beyond deployment).
   *
   * Must match a key defined in TenantFeatureFlags (tenant/types.ts).
   */
  tenantFeatureFlag?: string;
}

/**
 * A scoped implementation or advisory engagement Mister Chameleon delivers
 * to activate or improve one or more product modules for a client.
 *
 * Services bridge the product (what we build) and the client outcome (what
 * they experience). The catalog records what we offer; scoping documents
 * capture per-client customisation.
 */
export interface ServiceOffering {
  /** Stable slug. */
  id: ServiceOfferingId;

  /** Display name shown in proposals and scope documents. */
  label: string;

  /** Whether this is a one-time project, an advisory session, or ongoing. */
  type: ServiceType;

  /**
   * What the engagement covers and how it is delivered.
   * Written for an internal audience — honest about scope and assumptions.
   */
  description: string;

  /**
   * Concrete, tangible outputs the client receives at the end of this
   * engagement. Each entry should be a specific artefact or outcome.
   */
  deliverables: readonly string[];

  /**
   * Indicative duration — for planning purposes only, not contractual.
   * Examples: "1 week", "2–3 weeks", "ongoing monthly retainer".
   */
  typicalDuration?: string;

  /**
   * Modules that this service is primarily designed to activate or improve.
   * Used to cross-reference services with the product modules they support.
   */
  relatedModules: readonly ProductModuleId[];
}

// ── Catalog aggregation ───────────────────────────────────────────────────────

/**
 * The full product catalog — a single source of truth for all platform layers,
 * product modules, and service offerings.
 *
 * Consumed by internal tooling, future pricing pages, and sales enablement.
 * Defined in product/catalog.ts and re-exported from product/index.ts.
 */
export interface ProductCatalog {
  /**
   * All platform layers, ordered from foundational (context, tracking)
   * to higher-order (orchestration, rendering).
   */
  layers: readonly ProductLayer[];

  /**
   * All product modules, ordered from flagship to supporting.
   */
  modules: readonly ProductModule[];

  /**
   * All service offerings, ordered from entry-point (onboarding) to
   * advanced (strategy, optimisation).
   */
  services: readonly ServiceOffering[];
}

// ── Lookup helpers (types only) ───────────────────────────────────────────────
//
// These mapped types power indexed lookups without runtime cost.
// The catalog.ts file ships the runtime lookup functions.

/** Index type for fast layer lookup by ID. */
export type ProductLayerIndex = Readonly<Record<ProductLayerId, ProductLayer>>;

/** Index type for fast module lookup by ID. */
export type ProductModuleIndex = Readonly<Record<ProductModuleId, ProductModule>>;

/** Index type for fast service lookup by ID. */
export type ServiceOfferingIndex = Readonly<Record<ServiceOfferingId, ServiceOffering>>;
