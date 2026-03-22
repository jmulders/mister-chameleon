/**
 * Mister Chameleon — Product Catalog
 *
 * The authoritative catalog of platform layers, product modules, and service
 * offerings that make up the Mister Chameleon platform.
 *
 * ─── How to read this file ────────────────────────────────────────────────────
 *
 *   PLATFORM_LAYERS    Core technical capabilities, ordered from foundational
 *                      to higher-order.
 *
 *   PRODUCT_MODULES    Customer-facing features, ordered by commercial
 *                      importance (flagship first).
 *
 *   SERVICE_OFFERINGS  Engagement types, ordered from entry-point to advanced.
 *
 *   MC_CATALOG         Assembled ProductCatalog — single point of import for
 *                      callers that need the full picture.
 *
 *   Lookup indexes     O(1) access maps: LAYER_INDEX, MODULE_INDEX, SERVICE_INDEX.
 *
 * ─── Extending the catalog ───────────────────────────────────────────────────
 *
 *   To add a layer:    Add its ID to ProductLayerId in types.ts, then add the
 *                      object here and include it in PLATFORM_LAYERS.
 *
 *   To add a module:   Add its ID to ProductModuleId in types.ts, add the
 *                      object here with its layer dependencies, and include
 *                      it in PRODUCT_MODULES.
 *
 *   To add a service:  Add its ID to ServiceOfferingId in types.ts, add the
 *                      object here, and include it in SERVICE_OFFERINGS.
 *
 * ─── What this file does NOT do ──────────────────────────────────────────────
 *
 *   • It does not import from Next.js, react, or any UI layer.
 *   • It does not read environment variables.
 *   • It does not connect to the database.
 *   It is pure data — safe to import from any context.
 */

import type {
  ProductLayer,
  ProductModule,
  ServiceOffering,
  ProductCatalog,
  ProductLayerIndex,
  ProductModuleIndex,
  ServiceOfferingIndex,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM LAYERS
// ─────────────────────────────────────────────────────────────────────────────
//
// These are the technical building blocks of the platform. They are internal
// — never presented to clients directly — but they underpin every module.

const CONTEXT_ENGINE_LAYER: ProductLayer = {
  id: "context-engine",
  label: "Context Engine",
  description:
    "Detects and normalises every signal available from an inbound request: " +
    "traffic source, UTM parameters, referrer domain, device class, and the " +
    "visitor's first-party history from previous sessions. Produces the " +
    "DecisionInput that all other layers consume.",
  capabilities: [
    "Traffic source detection (Google, LinkedIn, direct, other)",
    "UTM parameter extraction and normalisation",
    "Device and viewport classification (mobile / desktop)",
    "Persistent session creation and cookie management",
    "First-party visitor history retrieval (page views, CTA clicks, engagement depth)",
    "History-aware DecisionInput assembly via buildDecisionInput()",
  ],
  sourceModules: [
    "context/detect-context.ts",
    "context/visitor-history.ts",
    "context/fetch-visitor-history.ts",
    "data/repositories/sessions-repository.ts",
  ],
};

const ADAPTIVE_RENDERING_LAYER: ProductLayer = {
  id: "adaptive-rendering",
  label: "Adaptive Rendering",
  description:
    "Selects the right content variant for each visitor and composes a " +
    "complete page experience by fetching matching CMS entries for the " +
    "chosen variant keys. Decouples the decision (which keys?) from the " +
    "content (what does each key say?) so both can change independently.",
  capabilities: [
    "Variant-keyed page composition (hero × proof × cta plan)",
    "CMS content fetch per variant key, provider-agnostic",
    "Served variant persistence for attribution and history signals",
    "Graceful fallback to default experience when CMS content is missing",
    "Server-side rendering — no client-side personalisation flicker",
  ],
  sourceModules: [
    "experience/compose-experience.ts",
    "experience/log-served-variants.ts",
    "data/repositories/variants-repository.ts",
  ],
};

const DECISIONING_LAYER: ProductLayer = {
  id: "decisioning",
  label: "Decisioning",
  description:
    "Evaluates visitor context and history against an ordered rule set (or " +
    "an AI model) to select the ExperiencePlan — the combination of hero, " +
    "proof, and CTA variant keys that best matches the visitor's inferred " +
    "intent. Ships two providers: rules-based (zero latency) and AI-augmented " +
    "(optional, confidence-gated).",
  capabilities: [
    "Ordered rule evaluation with priority-based short-circuit",
    "Source-aware rules (Google, LinkedIn, direct traffic)",
    "History-aware rules (returning visitor, CTA engagement, page view depth)",
    "AI decision provider with configurable confidence policy and rules fallback",
    "A/B experiment decorator for controlled variant testing",
    "Decision logging for observability and audit",
  ],
  sourceModules: [
    "decision/rules/homepage-rules.ts",
    "decision/providers/rules-decision-provider.ts",
    "decision/providers/ai-decision-provider.ts",
    "decision/providers/experiment-decision-provider.ts",
    "decision/ai-confidence-policy.ts",
  ],
};

const TRACKING_LAYER: ProductLayer = {
  id: "tracking",
  label: "Tracking",
  description:
    "Records first-party behavioural events — page views, CTA clicks, " +
    "form submissions — into the platform's own data layer. Events are " +
    "validated against a typed schema before persistence, ensuring clean " +
    "signal quality for history queries and future analytics.",
  capabilities: [
    "Typed event schema with EventPayloadMap per event type",
    "Server-side event validation (no raw client payloads persisted)",
    "POST /api/track route for client-emitted events",
    "CTA click tracking via TrackedCTAButton component",
    "Page view recording on every session creation",
    "contact_form_submit event for contact attribution",
  ],
  sourceModules: [
    "tracking/event-types.ts",
    "tracking/validate-event.ts",
    "tracking/track-event.ts",
    "data/repositories/events-repository.ts",
    "app/api/track/route.ts",
  ],
};

const ORCHESTRATION_LAYER: ProductLayer = {
  id: "orchestration",
  label: "Orchestration",
  description:
    "Connects on-site signals to downstream systems — currently n8n for " +
    "contact form enrichment and CRM handoff. Assembles a four-layer payload " +
    "(campaign source, session context, served variants, visitor history) at " +
    "form submission time so downstream workflows have full attribution context " +
    "without any client-side data passing.",
  capabilities: [
    "Campaign context assembly at contact form submission (UTM, source, referrer)",
    "Session context enrichment (device, visit type, engagement history)",
    "Last served experience inclusion (which variant the contact saw)",
    "n8n webhook dispatch with configurable per-tenant URL override",
    "10-second timeout with graceful no-op when webhook is unconfigured",
    "fire-and-forget contact_form_submit event for attribution tracking",
  ],
  sourceModules: [
    "contact/build-contact-context-payload.ts",
    "contact/types.ts",
    "app/api/contact/route.ts",
  ],
};

/**
 * All platform layers, ordered from foundational to higher-order.
 *
 * context-engine → tracking → decisioning → adaptive-rendering → orchestration
 */
export const PLATFORM_LAYERS: readonly ProductLayer[] = [
  CONTEXT_ENGINE_LAYER,
  TRACKING_LAYER,
  DECISIONING_LAYER,
  ADAPTIVE_RENDERING_LAYER,
  ORCHESTRATION_LAYER,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT MODULES
// ─────────────────────────────────────────────────────────────────────────────
//
// Customer-facing product features, ordered by commercial importance.

const ADAPTIVE_WEBSITE_MODULE: ProductModule = {
  id: "adaptive-website",
  label: "Adaptive Website",
  tagline: "Your homepage, personalised to every visitor — no code changes.",
  description:
    "The flagship module. Detects each visitor's traffic source and behavioural " +
    "history, then selects and renders the version of the homepage most likely " +
    "to convert them. Hero, proof, and CTA blocks are independently variant-keyed, " +
    "so content teams control the copy while the engine controls the selection.",
  layers: [
    "context-engine",
    "decisioning",
    "adaptive-rendering",
    "tracking",
  ],
  useCases: [
    "traffic-to-conversion",
    "visitor-personalisation",
    "content-optimisation",
    "platform-observability",
  ],
  status: "available",
  // No tenantFeatureFlag — always active when the platform is deployed.
};

const ADAPTIVE_LANDING_PAGES_MODULE: ProductModule = {
  id: "adaptive-landing-pages",
  label: "Adaptive Landing Pages",
  tagline: "Campaign landing pages that adapt to the audience they serve.",
  description:
    "Extends the adaptive engine beyond the homepage to campaign-specific " +
    "URLs. Each landing page reads the same DecisionInput — UTM parameters, " +
    "source, history — and selects the variant most relevant to the campaign " +
    "or segment that drove the click. One URL, multiple first impressions.",
  layers: [
    "context-engine",
    "decisioning",
    "adaptive-rendering",
    "tracking",
  ],
  useCases: [
    "traffic-to-conversion",
    "visitor-personalisation",
    "campaign-attribution",
    "content-optimisation",
  ],
  status: "planned",
};

const ADAPTIVE_FOLLOW_UP_MODULE: ProductModule = {
  id: "adaptive-follow-up",
  label: "Adaptive Follow-Up",
  tagline: "Every contact form submission enriched with full session context.",
  description:
    "When a visitor submits the contact form, the platform assembles a " +
    "four-layer payload — campaign attribution, session context, served variant " +
    "history, and visitor engagement signals — and dispatches it to n8n for " +
    "routing to CRM, email sequences, or Slack. Sales teams see not just who " +
    "enquired, but where they came from and what message converted them.",
  layers: [
    "context-engine",
    "tracking",
    "orchestration",
  ],
  useCases: [
    "lead-qualification",
    "campaign-attribution",
    "journey-orchestration",
  ],
  status: "available",
  tenantFeatureFlag: "contactForm",
};

const CONTEXT_INTELLIGENCE_MODULE: ProductModule = {
  id: "context-intelligence",
  label: "Context Intelligence",
  tagline: "First-party visitor data that improves every decision over time.",
  description:
    "Surfaces the platform's first-party data layer as a product in its own " +
    "right. Tracks page views, CTA engagement, and session patterns across " +
    "visits to build a persistent VisitorHistory profile. History signals feed " +
    "back into the decisioning layer — returning visitors who clicked a CTA get " +
    "a different experience than first-time visitors — closing the loop between " +
    "data collection and experience personalisation.",
  layers: [
    "context-engine",
    "tracking",
    "decisioning",
  ],
  useCases: [
    "visitor-personalisation",
    "lead-qualification",
    "content-optimisation",
    "platform-observability",
  ],
  status: "available",
};

/**
 * All product modules, flagship first.
 */
export const PRODUCT_MODULES: readonly ProductModule[] = [
  ADAPTIVE_WEBSITE_MODULE,
  ADAPTIVE_FOLLOW_UP_MODULE,
  CONTEXT_INTELLIGENCE_MODULE,
  ADAPTIVE_LANDING_PAGES_MODULE,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE OFFERINGS
// ─────────────────────────────────────────────────────────────────────────────
//
// Implementation and advisory work, ordered from entry-point to advanced.

const ONBOARDING_SERVICE: ServiceOffering = {
  id: "onboarding",
  label: "Platform Onboarding",
  type: "implementation",
  description:
    "A scoped launch engagement that takes a new client from signed contract " +
    "to live adaptive website. Covers tenant configuration, CMS connection, " +
    "variant strategy definition, and launch validation. Designed to complete " +
    "within two weeks assuming the client's CMS is already provisioned.",
  deliverables: [
    "Completed tenant config file (tenantId, theme, CMS provider, feature flags)",
    "Variant set defined and agreed (hero × proof × cta keys)",
    "CMS entries populated and connected to all agreed variant keys",
    "n8n workflow connected and contact form tested end-to-end",
    "Decision rules reviewed and aligned to client's traffic sources",
    "Diagnostics bar sign-off confirming live variant selection is correct",
    "Handover document: what was set up, how to add variants, how to read signals",
  ],
  typicalDuration: "1–2 weeks",
  relatedModules: [
    "adaptive-website",
    "adaptive-follow-up",
  ],
};

const CONTENT_MODELING_SERVICE: ServiceOffering = {
  id: "content-modeling",
  label: "Content Modelling",
  type: "advisory",
  description:
    "A workshop-based engagement that defines the variant strategy for a " +
    "client's adaptive pages. Maps their traffic sources to messaging angles, " +
    "identifies the highest-leverage variant dimensions (hero intent, proof " +
    "type, CTA escalation level), and produces a content brief for the client's " +
    "copywriters or CMS team to execute against.",
  deliverables: [
    "Traffic source audit: which channels drive the most qualified visitors",
    "Variant matrix: hero × proof × cta combinations mapped to audience intent",
    "Copy brief per variant key: headline direction, proof angle, CTA framing",
    "CMS schema recommendation for the chosen provider",
    "Decision rule recommendations: which rules to activate and in what priority",
  ],
  typicalDuration: "3–5 days",
  relatedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
  ],
};

const OPTIMISATION_SERVICE: ServiceOffering = {
  id: "optimisation",
  label: "Ongoing Optimisation",
  type: "ongoing",
  description:
    "A monthly retainer covering performance review, variant iteration, and " +
    "decision rule tuning. Combines platform signal data (variant selection " +
    "frequency, CTA click rates, form conversion by variant) with client " +
    "pipeline data to identify which variant-to-segment combinations are " +
    "producing the best outcomes and what to test next.",
  deliverables: [
    "Monthly performance report: variant selection breakdown, conversion by variant",
    "Rule tuning recommendations based on observed signal patterns",
    "Up to two new variant copy iterations per month",
    "A/B experiment design and readout (when abTesting flag is active)",
    "Contact intelligence review: session engagement trends across the cohort",
  ],
  typicalDuration: "Ongoing monthly",
  relatedModules: [
    "adaptive-website",
    "context-intelligence",
    "adaptive-follow-up",
    "adaptive-landing-pages",
  ],
};

const STRATEGY_SERVICE: ServiceOffering = {
  id: "strategy",
  label: "Adaptive Strategy",
  type: "advisory",
  description:
    "A senior advisory engagement for clients who want to move beyond variant " +
    "copy and use the platform as a strategic channel intelligence layer. " +
    "Covers ICP refinement, channel-to-message fit, adaptive page architecture " +
    "for multi-product or multi-segment GTM motions, and roadmap planning for " +
    "expanding the platform footprint (additional page types, AI decisioning, " +
    "deeper CRM integration).",
  deliverables: [
    "ICP and channel-fit workshop output: segments, sources, and priority order",
    "Adaptive architecture blueprint: which pages to adapt, in which order",
    "Channel-to-variant mapping: recommended message frames per traffic source",
    "Platform expansion roadmap: phased rollout of additional modules",
    "AI decisioning readiness assessment (when relevant)",
  ],
  typicalDuration: "2–4 weeks",
  relatedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
    "context-intelligence",
    "adaptive-follow-up",
  ],
};

/**
 * All service offerings, ordered from entry-point to advanced.
 */
export const SERVICE_OFFERINGS: readonly ServiceOffering[] = [
  ONBOARDING_SERVICE,
  CONTENT_MODELING_SERVICE,
  OPTIMISATION_SERVICE,
  STRATEGY_SERVICE,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLED CATALOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete Mister Chameleon product catalog.
 *
 * Single point of import for tooling that needs the full picture:
 *   import { MC_CATALOG } from "@/product";
 *   MC_CATALOG.modules.filter(m => m.status === "available")
 */
export const MC_CATALOG: ProductCatalog = {
  layers:   PLATFORM_LAYERS,
  modules:  PRODUCT_MODULES,
  services: SERVICE_OFFERINGS,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP INDEXES
// ─────────────────────────────────────────────────────────────────────────────
//
// Pre-built O(1) access maps. Use these instead of Array.find() when
// the caller knows the ID it is looking for.

/**
 * Index of all platform layers by ID.
 *
 * @example
 *   const layer = LAYER_INDEX["context-engine"];
 *   console.log(layer.capabilities);
 */
export const LAYER_INDEX: ProductLayerIndex = Object.fromEntries(
  PLATFORM_LAYERS.map((l) => [l.id, l]),
) as ProductLayerIndex;

/**
 * Index of all product modules by ID.
 *
 * @example
 *   const mod = MODULE_INDEX["adaptive-website"];
 *   console.log(mod.useCases);
 */
export const MODULE_INDEX: ProductModuleIndex = Object.fromEntries(
  PRODUCT_MODULES.map((m) => [m.id, m]),
) as ProductModuleIndex;

/**
 * Index of all service offerings by ID.
 *
 * @example
 *   const svc = SERVICE_INDEX["onboarding"];
 *   console.log(svc.deliverables);
 */
export const SERVICE_INDEX: ServiceOfferingIndex = Object.fromEntries(
  SERVICE_OFFERINGS.map((s) => [s.id, s]),
) as ServiceOfferingIndex;

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
//
// Small, pure functions for common catalog queries.
// All return new arrays — callers can filter/map further without mutating.

/**
 * Returns all modules whose status matches the given value.
 *
 * @example
 *   const live = getModulesByStatus("available");
 */
export function getModulesByStatus(
  status: ProductModule["status"],
): ProductModule[] {
  return PRODUCT_MODULES.filter((m) => m.status === status);
}

/**
 * Returns all modules that address the given use case.
 *
 * @example
 *   const modules = getModulesForUseCase("campaign-attribution");
 */
export function getModulesForUseCase(
  useCase: ProductModule["useCases"][number],
): ProductModule[] {
  return PRODUCT_MODULES.filter((m) =>
    (m.useCases as readonly string[]).includes(useCase),
  );
}

/**
 * Returns all service offerings that support the given module.
 *
 * @example
 *   const services = getServicesForModule("adaptive-website");
 */
export function getServicesForModule(moduleId: ProductModule["id"]): ServiceOffering[] {
  return SERVICE_OFFERINGS.filter((s) =>
    (s.relatedModules as readonly string[]).includes(moduleId),
  );
}

/**
 * Returns all platform layers that the given module depends on,
 * resolved to full ProductLayer objects.
 *
 * @example
 *   const layers = getLayersForModule("adaptive-follow-up");
 */
export function getLayersForModule(moduleId: ProductModule["id"]): ProductLayer[] {
  const mod = MODULE_INDEX[moduleId];
  return mod.layers.map((layerId) => LAYER_INDEX[layerId]);
}
