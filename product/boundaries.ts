/**
 * Product Boundary Definitions
 *
 * The authoritative, machine-readable record of what the Mister Chameleon
 * platform supports, what is planned, and what it will never do.
 *
 * ─── Why this file exists ─────────────────────────────────────────────────────
 *
 *   Every product that enables customisation accumulates scope debt: clients
 *   ask for one more thing, delivery teams find a workaround, and over time
 *   the platform becomes unmaintainable custom software dressed as a product.
 *
 *   This file is the countermeasure. It states boundaries explicitly — not
 *   in a wiki that nobody reads, but in code that can be imported, tested,
 *   and surfaced in tooling. When a new requirement arrives during sales or
 *   delivery, the answer to "does the platform support this?" is queryable.
 *
 * ─── Who uses this ────────────────────────────────────────────────────────────
 *
 *   Sales (AMs)     Run checkBoundary() / checkRequirements() during discovery
 *                   to surface blockers before a contract is signed. If a client
 *                   names a requirement that maps to "unsupported", that is a
 *                   qualification blocker — not a "we'll figure it out" item.
 *
 *   Delivery        Use this during scoping to agree what is and isn't in scope
 *                   for a given engagement. If a client raises a mid-delivery
 *                   request that maps to "conditional" or "planned", pause and
 *                   get explicit alignment before building anything.
 *
 *   Product         Track which items move from "planned" to "supported" as the
 *                   platform evolves. Items clients consistently request in the
 *                   "conditional" or "unsupported" lists are roadmap candidates.
 *
 * ─── Boundary model ──────────────────────────────────────────────────────────
 *
 *   supported       Works today. Deliver without extra negotiation.
 *   planned         On the roadmap. Architecture exists or is designed.
 *                   Do not promise to clients without a committed date.
 *   conditional     Works under defined conditions (specific tier, specific
 *                   configuration). Outside those conditions, it does not work.
 *   unsupported     Hard no. Not "not yet" — will not be built. If a client's
 *                   requirements depend on this, resolve before signing.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   product/types.ts               → ProductModuleId, ProductLayerId
 *   product/features.ts            → CapabilityId
 *   product/scope-classification.ts → ScopeCategory (finer delivery grain)
 *   product/boundaries.ts          ← YOU ARE HERE — hard platform boundaries
 *   product/index.ts               → barrel re-export
 *
 * ─── Relationship to scope-classification.ts ─────────────────────────────────
 *
 *   scope-classification.ts operates at the delivery grain: which work items
 *   are in-product vs. custom work vs. unsupported for a given engagement.
 *
 *   boundaries.ts operates at the platform grain: what dimensions of the
 *   platform have hard-coded limits (which CMS providers, which page types,
 *   etc.) and what architectural patterns are categorically excluded.
 *
 *   The two files are complementary. Use scope-classification for engagement
 *   scoping; use boundaries for platform qualification.
 */

import type { CommercialTierId } from "@/pricing/packages";
import type { CapabilityId } from "./features";
import type { ProductModuleId } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four boundary states.
 *
 * supported    Works today. No extra conditions.
 * planned      On the roadmap. Architecture exists; not yet delivered.
 * conditional  Works only under defined conditions (tier, config, etc.).
 * unsupported  Will not be built. Hard boundary.
 */
export type BoundaryStatus = "supported" | "planned" | "conditional" | "unsupported";

/**
 * How well a CMS provider's schema aligns with the platform's block model.
 *
 * native   The provider's schema matches HeroBlockData / ProofBlockData /
 *          CTABlockData with no custom mapping required.
 * mapped   A mapper layer bridges the provider's schema to platform block types.
 *          Supported, but the mapper must be implemented during onboarding.
 * partial  Only a subset of block types is achievable with this provider's schema.
 *          Not all content models translate cleanly.
 */
export type CMSSchemaAlignment = "native" | "mapped" | "partial";

/**
 * How a block's content can be changed after onboarding.
 *
 * client-cms    The client can edit content independently via their CMS.
 * mc-impl       Content can only be changed via an MC implementation engagement.
 * custom-quote  Changes require a custom SOW — non-standard scope.
 */
export type ContentEditability = "client-cms" | "mc-impl" | "custom-quote";

/**
 * What level of visual customisation is available for a block.
 *
 * content-only       Only copy (headline, subheadline, CTA label) can change.
 *                    Layout, spacing, and component structure are fixed.
 * content-and-brand  Copy plus the tenant brand theme (colours, radius, font).
 *                    No structural layout changes.
 * layout-variants    The block supports predefined layout options (e.g. left /
 *                    right / centred) — not arbitrary CSS, but structured choice.
 * full-custom        Arbitrary CSS / component redesign. Custom work scope only.
 */
export type BlockCustomisationLevel =
  | "content-only"
  | "content-and-brand"
  | "layout-variants"
  | "full-custom";

// ─────────────────────────────────────────────────────────────────────────────
// ID TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for each CMS provider boundary entry.
 * "mock" is excluded — it is an internal development tool, not a client-facing
 * CMS provider.
 */
export type CMSProviderBoundaryId = "sanity" | "storyblok" | "statamic";

/**
 * Stable identifiers for each page type the platform may adapt.
 * Superset of the currently supported set — covers planned and unsupported
 * page types so qualification conversations have a full vocabulary.
 */
export type PageTypeBoundaryId =
  | "homepage"
  | "campaign-landing-page"
  | "product-page"
  | "pricing-page"
  | "blog-post"
  | "case-study"
  | "about-page";

/**
 * Stable identifiers for each decision provider boundary entry.
 */
export type DecisionProviderBoundaryId = "rules" | "ai";

/**
 * Stable identifiers for each adaptive page block the platform renders.
 */
export type BlockTypeBoundaryId = "hero" | "proof" | "cta";

/**
 * Stable identifiers for each unsupported architectural extension.
 *
 * These are architectural patterns the platform will never adopt, regardless
 * of commercial pressure, client requests, or framing as "just a workaround".
 * Adding a new entry here requires explicit product team agreement.
 */
export type UnsupportedExtensionId =
  | "client-side-personalisation"
  | "cross-site-tracking"
  | "pii-storage"
  | "third-party-cookie-dependency"
  | "external-ml-model-integration"
  | "realtime-bidirectional-crm-sync"
  | "full-frontend-rewrite"
  | "on-premise-deployment"
  | "multi-tenant-data-comingling"
  | "third-party-pixel-injection"
  | "hardcoded-html-cms";

// ─────────────────────────────────────────────────────────────────────────────
// BOUNDARY INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Boundary definition for a single CMS provider.
 *
 * Describes which providers are production-ready, which are mapped,
 * and what the known limitations of each provider are.
 */
export interface CMSProviderBoundary {
  /** Stable identifier. Must match the CMSProviderName used in TenantConfig. */
  id: CMSProviderBoundaryId;

  /** Customer-facing display name. */
  label: string;

  /** URL to the provider's documentation or website. */
  website: string;

  /** Whether this provider is usable today. */
  status: BoundaryStatus;

  /**
   * How closely the provider's schema aligns with the platform block model.
   * "native" requires no custom mapping; "mapped" requires a mapper written
   * during onboarding; "partial" means not all blocks can be served.
   */
  schemaAlignment: CMSSchemaAlignment;

  /**
   * Environment variables that must be set for this provider to initialise.
   * These are listed so onboarding can gate on their presence early.
   */
  requiredEnvVars: readonly string[];

  /**
   * One-sentence description of the provider's positioning in the platform.
   */
  description: string;

  /**
   * Known limitations specific to this provider's integration.
   * Each entry is a single clear constraint statement.
   */
  limitations: readonly string[];

  /**
   * Implementation notes for the MC delivery team during onboarding.
   * Not shown to clients.
   */
  deliveryNotes?: string;
}

/**
 * Boundary definition for a page type the platform may adapt.
 *
 * Captures which page types are supported today, which are planned, and which
 * the platform will never adapt — and why.
 */
export interface PageTypeBoundary {
  /** Stable identifier. */
  id: PageTypeBoundaryId;

  /** Customer-facing label. */
  label: string;

  /** Whether this page type is adaptable today. */
  status: BoundaryStatus;

  /**
   * The minimum commercial tier required to enable this page type.
   * Not applicable for "unsupported" pages.
   */
  minimumTier?: CommercialTierId;

  /**
   * The platform capability that delivers adaptive rendering for this page type.
   * References CapabilityId from product/features.ts.
   */
  capability?: CapabilityId;

  /**
   * The product module that this page type belongs to.
   */
  module?: ProductModuleId;

  /**
   * Which content blocks are active (and adaptive) on this page type.
   * For unsupported pages, this is empty.
   */
  adaptiveBlocks: readonly BlockTypeBoundaryId[];

  /**
   * For "conditional" pages: the conditions that must be met.
   * For "planned" pages: the expected blocker or dependency.
   * For "unsupported" pages: the reason it will not be built.
   */
  statusReason: string;
}

/**
 * Boundary definition for a decision provider.
 *
 * Captures which signals each provider can act on, which it cannot,
 * and which tier or configuration is required to activate it.
 */
export interface DecisionProviderBoundary {
  /** Stable identifier. Must match the DecisionProviderName in TenantConfig. */
  id: DecisionProviderBoundaryId;

  /** Display name. */
  label: string;

  /** Whether this provider is usable today. */
  status: BoundaryStatus;

  /**
   * The minimum commercial tier required to activate this provider.
   */
  minimumTier: CommercialTierId;

  /**
   * The tenant feature flag key that gates this provider at runtime.
   * Corresponds to a key in TenantFeatureFlags (tenant/types.ts).
   */
  tenantFeatureFlag?: string;

  /**
   * Signals (VisitorContext fields) this provider can act on.
   * Listed as field names or readable descriptions.
   */
  supportedSignals: readonly string[];

  /**
   * Input types this provider cannot act on.
   * Important for qualification — if a client needs a signal type here,
   * a custom decision provider would be required (custom work).
   */
  unsupportedInputs: readonly string[];

  /**
   * Description of the provider's decision strategy.
   */
  description: string;

  /**
   * For "conditional" providers: the conditions under which it applies.
   */
  conditions?: string;
}

/**
 * Boundary definition for a single adaptive content block type.
 *
 * Captures what is and isn't variable within a block, and what kinds
 * of extension are out of scope.
 */
export interface BlockTypeBoundary {
  /** Stable identifier. Matches the TenantBlockConfig key. */
  id: BlockTypeBoundaryId;

  /** Display name. */
  label: string;

  /** Whether this block type is rendered and adaptive today. */
  status: BoundaryStatus;

  /**
   * The number of distinct content variants supported for this block in a
   * standard product engagement. Clients may define fewer, but no more without
   * a custom engagement.
   */
  standardVariantCount: number;

  /**
   * Who can change content in this block type after onboarding.
   */
  contentEditability: ContentEditability;

  /**
   * What level of visual customisation is available within the platform.
   */
  customisationLevel: BlockCustomisationLevel;

  /**
   * What the block renders — the fields editable via CMS content.
   */
  adaptiveFields: readonly string[];

  /**
   * What is NOT variable within this block — structural or layout elements
   * that cannot change between variants.
   */
  fixedElements: readonly string[];

  /**
   * Extension requests that are outside the block's scope entirely.
   * Any client request that matches these entries should be treated as
   * custom_work or unsupported per scope-classification.ts.
   */
  unsupportedExtensions: readonly string[];
}

/**
 * Boundary definition for the platform's theming system.
 *
 * Documents what "brand theming" includes and excludes so that
 * "we'll customise the design to match our brand" is clearly scoped
 * before a client signs.
 */
export interface ThemingBoundary {
  /**
   * The properties a TenantTheme config can control.
   * Each entry corresponds to a field in the TenantTheme / CSS custom property.
   */
  supportedProperties: readonly ThemingProperty[];

  /**
   * The granularity at which theming applies.
   *
   * tenant     One theme config governs the entire deployment. All pages and
   *            components inherit the same CSS custom property set.
   */
  granularity: "tenant";

  /**
   * Whether per-tenant dark mode palettes are supported.
   * False = the platform has a single media-query dark mode defined in theme.css,
   * but tenants cannot provide a custom dark palette.
   */
  perTenantDarkMode: boolean;

  /**
   * Whether individual components can override the tenant theme locally.
   * False = all components derive from the global CSS custom property cascade.
   * Component-level style overrides require custom work.
   */
  perComponentOverrides: boolean;

  /**
   * Whether clients can supply arbitrary CSS for any page.
   * False = CSS is generated entirely from the TenantTheme config.
   * Custom CSS injection is unsupported.
   */
  arbitraryCSSInjection: boolean;

  /**
   * What theming does NOT cover — explicit exclusions to state in proposals.
   */
  exclusions: readonly string[];
}

/**
 * A single themeable property, describing what it controls and how it maps
 * to the CSS custom property layer.
 */
export interface ThemingProperty {
  /** Readable name. */
  label: string;
  /** CSS custom property name. */
  cssVariable: string;
  /** Brief description of what changing this property affects. */
  affects: string;
}

/**
 * An architectural extension that the platform will never support.
 *
 * These are not roadmap items. They represent patterns that would fundamentally
 * conflict with the platform's technical model, privacy posture, or delivery
 * repeatability. Any client requirement that maps to an entry here is a
 * qualification blocker.
 */
export interface UnsupportedExtension {
  /** Stable identifier. */
  id: UnsupportedExtensionId;

  /** Customer-readable label for the pattern. */
  label: string;

  /** The technical or product domain this falls under. */
  domain:
    | "rendering"
    | "privacy"
    | "cms"
    | "decisioning"
    | "integration"
    | "deployment"
    | "frontend";

  /**
   * Plain-language explanation of why this is unsupported.
   * Must be honest and non-defensive. Designed to be read aloud in a client
   * call if needed.
   */
  reason: string;

  /**
   * What the client can do instead, within the platform's supported model.
   * Always provide one if possible — "unsupported" without an alternative
   * often feels like a dead end and erodes trust.
   */
  alternativePath?: string;
}

/**
 * The assembled product boundary document.
 *
 * Collects all boundary definitions into a single queryable object.
 * Import from "@/product" and call helpers to query specific dimensions.
 */
export interface ProductBoundaries {
  /**
   * Semantic version of this boundary document.
   * Increment the minor version when adding new entries.
   * Increment the major version when an existing boundary changes status.
   */
  version: string;

  /** ISO date string. When these boundaries were last reviewed and confirmed. */
  lastReviewedAt: string;

  /** Supported, planned, and unsupported CMS providers. */
  cmsProviders: readonly CMSProviderBoundary[];

  /** Supported, planned, and unsupported page types. */
  pageTypes: readonly PageTypeBoundary[];

  /** Supported and conditional decision providers. */
  decisionProviders: readonly DecisionProviderBoundary[];

  /** Supported adaptive content blocks. */
  blockTypes: readonly BlockTypeBoundary[];

  /** The platform theming model — what brand customisation covers. */
  theming: ThemingBoundary;

  /** Architectural patterns the platform will never support. */
  unsupportedExtensions: readonly UnsupportedExtension[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CMS PROVIDER BOUNDARIES
// ─────────────────────────────────────────────────────────────────────────────

const SANITY_BOUNDARY: CMSProviderBoundary = {
  id: "sanity",
  label: "Sanity",
  website: "https://sanity.io",
  status: "supported",
  schemaAlignment: "native",
  requiredEnvVars: [
    "SANITY_PROJECT_ID",
    "SANITY_DATASET",
    "SANITY_API_VERSION",
  ],
  description:
    "Sanity is the reference CMS for the platform. Block schemas are designed " +
    "to align with Sanity document types, making it the lowest-friction " +
    "provider to connect during onboarding.",
  limitations: [
    "Live preview requires Sanity's Presentation tool; not included in standard onboarding.",
    "Draft content is not served to adaptive pages — only published documents.",
    "Image CDN URLs from Sanity require the @sanity/image-url package at build time.",
    "Multi-dataset setups (e.g. separate datasets per locale) are not supported in a single tenant config.",
  ],
  deliveryNotes:
    "Define block document types (hero_block, proof_block, cta_block) with " +
    "string variant_key fields. The mock provider's schema matches this pattern " +
    "exactly — use it as the schema specification for the Sanity studio setup.",
};

const STORYBLOK_BOUNDARY: CMSProviderBoundary = {
  id: "storyblok",
  label: "Storyblok",
  website: "https://storyblok.com",
  status: "supported",
  schemaAlignment: "mapped",
  requiredEnvVars: [
    "STORYBLOK_ACCESS_TOKEN",
  ],
  description:
    "Storyblok is supported via a mapper layer that bridges Storyblok component " +
    "fields to the platform's block types. Clients who already use Storyblok " +
    "can connect their existing stories to the platform after a field-mapping " +
    "session during onboarding.",
  limitations: [
    "Storyblok's visual editor / live preview is not connected to the adaptive pipeline.",
    "The mapper layer must be configured during onboarding — it is not zero-configuration.",
    "Storyblok's draft / version management is bypassed; only published content is served.",
    "Nested Storyblok components beyond one level deep are not supported in adaptive blocks.",
  ],
  deliveryNotes:
    "The mapper in cms/mappers/ must translate Storyblok story fields to " +
    "HeroBlockData, ProofBlockData, and CTABlockData. Allow one day of " +
    "onboarding time for field mapping and smoke testing.",
};

const STATAMIC_BOUNDARY: CMSProviderBoundary = {
  id: "statamic",
  label: "Statamic",
  website: "https://statamic.com",
  status: "supported",
  schemaAlignment: "mapped",
  requiredEnvVars: [
    "STATAMIC_API_URL",
    "STATAMIC_API_KEY",
  ],
  description:
    "Statamic is supported via the REST API, with a mapper layer translating " +
    "Statamic entry fields to platform block types. Suitable for clients on " +
    "the Laravel / PHP stack who have existing Statamic installations.",
  limitations: [
    "Statamic GraphQL API is not used — REST API only.",
    "Statamic Live Preview is not connected to the adaptive pipeline.",
    "The mapper layer requires configuration during onboarding.",
    "Statamic's Bard / Replicator field types are not supported in adaptive blocks — plain text fields only.",
    "Multi-site Statamic setups require a separate tenant config per site.",
  ],
  deliveryNotes:
    "Ensure the Statamic API is enabled and the API key has read access to " +
    "the entries that will serve adaptive block content. Map flat field " +
    "structures — avoid Bard or complex nested field types in adaptive content.",
};

/**
 * All supported, planned, and unsupported CMS provider boundaries.
 *
 * "mock" is intentionally excluded — it is an internal development provider
 * and must never be configured on a client production deployment.
 */
export const CMS_PROVIDER_BOUNDARIES: readonly CMSProviderBoundary[] = [
  SANITY_BOUNDARY,
  STORYBLOK_BOUNDARY,
  STATAMIC_BOUNDARY,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE TYPE BOUNDARIES
// ─────────────────────────────────────────────────────────────────────────────

const HOMEPAGE_BOUNDARY: PageTypeBoundary = {
  id: "homepage",
  label: "Homepage",
  status: "supported",
  minimumTier: "start",
  capability: "adaptive-homepage",
  module: "adaptive-website",
  adaptiveBlocks: ["hero", "proof", "cta"],
  statusReason:
    "Fully supported. The homepage adaptive pipeline is the flagship delivery " +
    "in every package tier. All three adaptive blocks (hero, proof, cta) are " +
    "active by default. Enabled via the TenantPageConfig.homepage flag.",
};

const CAMPAIGN_LANDING_PAGE_BOUNDARY: PageTypeBoundary = {
  id: "campaign-landing-page",
  label: "Campaign Landing Pages",
  status: "planned",
  minimumTier: "growth",
  capability: "adaptive-landing-page",
  module: "adaptive-landing-pages",
  adaptiveBlocks: ["hero", "proof", "cta"],
  statusReason:
    "On the roadmap. The decisioning and rendering infrastructure is fully " +
    "capable of serving adaptive landing pages today. What is missing is the " +
    "campaign landing page route, a campaign-specific variant key type in " +
    "decision/types.ts, and CMS content for those keys. Do not promise this " +
    "to clients without a confirmed delivery date.",
};

const PRODUCT_PAGE_BOUNDARY: PageTypeBoundary = {
  id: "product-page",
  label: "Product / Service Pages",
  status: "planned",
  minimumTier: "growth",
  capability: "adaptive-product-page",
  module: "adaptive-website",
  adaptiveBlocks: ["hero", "proof", "cta"],
  statusReason:
    "On the roadmap. The rendering pipeline can serve an adaptive product page " +
    "today. What is missing is the product/service page route, a " +
    "product-page variant key type in decision/types.ts, and CMS schemas for " +
    "those keys. Treat as planned until a specific client engagement triggers " +
    "the build.",
};

const PRICING_PAGE_BOUNDARY: PageTypeBoundary = {
  id: "pricing-page",
  label: "Pricing Page",
  status: "unsupported",
  adaptiveBlocks: [],
  statusReason:
    "Pricing pages are not in scope for adaptive rendering. Personalising " +
    "pricing creates legal and regulatory risk, inconsistent pricing surface, " +
    "and trust erosion if visitors compare notes. There is no architectural " +
    "blocker, but this is a deliberate product boundary.",
};

const BLOG_POST_BOUNDARY: PageTypeBoundary = {
  id: "blog-post",
  label: "Blog Posts / Articles",
  status: "unsupported",
  adaptiveBlocks: [],
  statusReason:
    "Blog post adaptive rendering is not a supported use case. The variant " +
    "model (hero × proof × cta blocks) does not apply to editorial content. " +
    "Blog content should be managed directly in the CMS without the adaptive " +
    "layer. A future 'editorial personalisation' product may address this, " +
    "but it would be a distinct product from the current platform.",
};

const CASE_STUDY_BOUNDARY: PageTypeBoundary = {
  id: "case-study",
  label: "Case Study Pages",
  status: "unsupported",
  adaptiveBlocks: [],
  statusReason:
    "Case study pages contain fixed editorial content and are not suitable " +
    "for the current variant model. The platform does not support adaptive " +
    "long-form editorial pages. A prospect should view the correct case study " +
    "via a CTA variant that links to it — the case study itself is not adapted.",
};

const ABOUT_PAGE_BOUNDARY: PageTypeBoundary = {
  id: "about-page",
  label: "About / Team Pages",
  status: "unsupported",
  adaptiveBlocks: [],
  statusReason:
    "About and team pages are not in scope for adaptive rendering. These pages " +
    "carry static brand and trust content where personalisation provides little " +
    "conversion value and risks undermining authenticity. Excluded deliberately.",
};

/**
 * All page type boundaries — supported, planned, and unsupported.
 */
export const PAGE_TYPE_BOUNDARIES: readonly PageTypeBoundary[] = [
  HOMEPAGE_BOUNDARY,
  CAMPAIGN_LANDING_PAGE_BOUNDARY,
  PRODUCT_PAGE_BOUNDARY,
  PRICING_PAGE_BOUNDARY,
  BLOG_POST_BOUNDARY,
  CASE_STUDY_BOUNDARY,
  ABOUT_PAGE_BOUNDARY,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// DECISION PROVIDER BOUNDARIES
// ─────────────────────────────────────────────────────────────────────────────

const RULES_PROVIDER_BOUNDARY: DecisionProviderBoundary = {
  id: "rules",
  label: "Rules-Based Decision Provider",
  status: "supported",
  minimumTier: "start",
  description:
    "An ordered rule set evaluates each request against a priority-ordered list " +
    "of predicates. Source-aware rules (Google, LinkedIn, direct) and " +
    "history-aware rules (returning visitors, CTA engagers, page depth) are " +
    "built-in. Zero AI cost. Zero added latency. Active on all tiers from day one.",
  supportedSignals: [
    "source (TrafficSource: linkedin | google | direct | unknown)",
    "device (DeviceType: mobile | desktop)",
    "visitType (VisitType: new | returning)",
    "utmSource / utmMedium / utmCampaign",
    "referrerDomain",
    "history.totalPageViews",
    "history.ctaClickCount",
    "history.lastVariantSeen",
    "history.hasConverted",
    "history.sessionCount",
  ],
  unsupportedInputs: [
    "Real-time firmographic data (company name, industry, size) — no third-party enrichment API.",
    "IP-to-company lookup — deliberate privacy boundary; no reverse IP lookup.",
    "LinkedIn profile data — no LinkedIn API integration.",
    "CRM contact status (e.g. 'is this person already a customer?') — no real-time CRM query.",
    "Predictive lead score from external ML model.",
    "Geo-targeting beyond what is derivable from UTM/source signals.",
  ],
};

const AI_PROVIDER_BOUNDARY: DecisionProviderBoundary = {
  id: "ai",
  label: "AI-Augmented Decision Provider",
  status: "conditional",
  minimumTier: "growth",
  tenantFeatureFlag: "aiDecisionProvider",
  description:
    "An LLM evaluates the full DecisionInput when the rules engine confidence " +
    "is below the configured threshold. Falls back to rules when AI is " +
    "unavailable or when latency exceeds the policy limit. Requires Growth or " +
    "Scale tier and the aiDecisionProvider feature flag to be set in the " +
    "tenant config.",
  supportedSignals: [
    "Full VisitorContext — all fields the rules provider can act on.",
    "VisitorHistory — same history signals available to rules.",
    "Natural language signal interpretation for ambiguous UTM combinations.",
    "History pattern inference where rule predicates are underspecified.",
  ],
  unsupportedInputs: [
    "Real-time external data lookups during AI evaluation — no mid-request API calls.",
    "Training on client-specific data — the model is not fine-tuned per tenant.",
    "Deterministic output — AI decisions are probabilistic; exact reproducibility is not guaranteed.",
    "Token-for-token audit logs of LLM prompts/responses — reasoning traces only.",
  ],
  conditions:
    "Requires: (1) Growth or Scale commercial tier. (2) aiDecisionProvider " +
    "feature flag set to true in TenantConfig. (3) An AiDecisionProvider " +
    "subclass wired into the page route. (4) Confidence policy configured " +
    "(see decision/ai-confidence-policy.ts). Rules provider must be present " +
    "as the fallback — AI cannot be deployed without it.",
};

/**
 * All decision provider boundaries.
 */
export const DECISION_PROVIDER_BOUNDARIES: readonly DecisionProviderBoundary[] = [
  RULES_PROVIDER_BOUNDARY,
  AI_PROVIDER_BOUNDARY,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK TYPE BOUNDARIES
// ─────────────────────────────────────────────────────────────────────────────

const HERO_BLOCK_BOUNDARY: BlockTypeBoundary = {
  id: "hero",
  label: "Hero Block",
  status: "supported",
  standardVariantCount: 3,
  contentEditability: "client-cms",
  customisationLevel: "content-and-brand",
  adaptiveFields: [
    "title      — Primary headline text",
    "subtitle   — Supporting paragraph beneath the headline",
    "cta.label  — Primary CTA button label",
    "cta.href   — Primary CTA destination URL",
    "tag        — Optional eyebrow label / badge above the headline",
  ],
  fixedElements: [
    "Block layout and section structure — single-column above-the-fold layout",
    "Number of CTAs — one primary CTA per variant (no secondary CTA in standard product)",
    "Media area — no hero image, video, or illustration in the standard block",
    "Animation — no scroll-triggered or entrance animations in standard product",
    "Typography scale — governed by the design system, not per-variant",
  ],
  unsupportedExtensions: [
    "Hero image or video background — custom work; requires design system extension",
    "Secondary CTA button — custom work; CTA variant model supports one primary action",
    "Animated copy or typewriter effects — unsupported; no animation layer in standard product",
    "Multi-column hero layout — custom work; standard block is single-column",
    "Countdown timer or urgency widget — unsupported; not a platform pattern",
    "Embedded form in hero — unsupported; contact form is a separate page section",
  ],
};

const PROOF_BLOCK_BOUNDARY: BlockTypeBoundary = {
  id: "proof",
  label: "Proof Block",
  status: "supported",
  standardVariantCount: 3,
  contentEditability: "client-cms",
  customisationLevel: "content-and-brand",
  adaptiveFields: [
    "title        — Section heading / eyebrow label above the proof items",
    "items[].title — Short bold label per proof point (stat, quote attribution, badge)",
    "items[].text  — One-to-two sentence supporting copy per proof point",
  ],
  fixedElements: [
    "Number of proof items per variant — standardised at 3 items",
    "Proof item layout — horizontal card row (not configurable per variant)",
    "Logo grid — no client logo strip in standard product; a separate block type would be required",
    "Star rating or review widget — not a standard proof block element",
    "Testimonial photo — no avatar or headshot in standard proof items",
  ],
  unsupportedExtensions: [
    "Client logo grid / logo strip — custom work; requires a separate block type",
    "Star ratings or G2 / Trustpilot widget embeds — unsupported; no third-party review widget",
    "Testimonial carousel or slider — unsupported; no interactive carousel in standard product",
    "Video testimonials — unsupported; media embeds require custom frontend work",
    "Live stat counters (animated numbers) — unsupported; no animation layer",
    "Per-item CTA links within the proof block — unsupported; proof items are informational only",
  ],
};

const CTA_BLOCK_BOUNDARY: BlockTypeBoundary = {
  id: "cta",
  label: "CTA Block",
  status: "supported",
  standardVariantCount: 3,
  contentEditability: "client-cms",
  customisationLevel: "content-and-brand",
  adaptiveFields: [
    "title      — Large display headline",
    "text       — Supporting paragraph beneath the headline",
    "cta.label  — Primary CTA button label",
    "cta.href   — Primary CTA destination URL",
  ],
  fixedElements: [
    "Block layout — full-width section with centred content",
    "Number of CTAs — one primary CTA per variant",
    "Background — uses bgInverse (dark) from the tenant theme; not per-variant configurable",
    "Secondary actions — no sub-links or secondary CTAs in standard product",
  ],
  unsupportedExtensions: [
    "Inline contact form as a CTA — unsupported; the contact form is a separate page section",
    "Calendly or booking widget embed — unsupported; link to an external booking URL instead",
    "Secondary CTA with different visual weight — custom work",
    "Countdown timer or urgency messaging — unsupported",
    "Background image or gradient per variant — custom work; background is theme-governed",
    "Multi-step or conditional CTA (e.g. 'if returning visitor, show X, else Y') — handled by the decision engine, not block-level logic",
  ],
};

/**
 * All adaptive block type boundaries.
 */
export const BLOCK_TYPE_BOUNDARIES: readonly BlockTypeBoundary[] = [
  HERO_BLOCK_BOUNDARY,
  PROOF_BLOCK_BOUNDARY,
  CTA_BLOCK_BOUNDARY,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// THEMING BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The platform theming boundary — a single, explicit statement of what
 * "brand theming" covers and does not cover.
 *
 * When a client says "we'll need to customise the design to match our brand",
 * this is the boundary that defines what that means in practice.
 */
export const THEMING_BOUNDARY: ThemingBoundary = {
  supportedProperties: [
    {
      label: "Primary Brand Colour",
      cssVariable: "--color-brand-primary",
      affects: "Buttons, links, interactive states, and focus rings across all components.",
    },
    {
      label: "Brand Hover Colour",
      cssVariable: "--color-brand-primary-hover",
      affects: "Button and link hover states.",
    },
    {
      label: "Brand Active Colour",
      cssVariable: "--color-brand-primary-active",
      affects: "Button pressed / active states.",
    },
    {
      label: "Subtle Brand Tint",
      cssVariable: "--color-brand-primary-subtle",
      affects: "Lightly tinted background areas (badges, highlights).",
    },
    {
      label: "Brand Text Colour",
      cssVariable: "--color-brand-text-brand",
      affects: "Inline brand-coloured text links and labels.",
    },
    {
      label: "Primary Text Colour",
      cssVariable: "--color-text-text",
      affects: "Main body copy and headings.",
    },
    {
      label: "Muted Text Colour",
      cssVariable: "--color-text-text-muted",
      affects: "Secondary labels, captions, and supporting copy.",
    },
    {
      label: "Page Background",
      cssVariable: "--color-background-bg",
      affects: "The main page background colour.",
    },
    {
      label: "Subtle Background",
      cssVariable: "--color-background-bg-subtle",
      affects: "Recessed panels, table rows, and inset areas.",
    },
    {
      label: "Inverse Background",
      cssVariable: "--color-background-bg-inverse",
      affects: "Dark sections — primarily the CTA block background.",
    },
    {
      label: "Border Colour",
      cssVariable: "--color-border-border",
      affects: "Component borders, dividers, and input outlines.",
    },
    {
      label: "Strong Border Colour",
      cssVariable: "--color-border-border-strong",
      affects: "Emphasised borders, focus outlines.",
    },
    {
      label: "Corner Radius Personality",
      cssVariable: "--radius-*",
      affects:
        "All component corner radii. Three personalities: 'sharp' (0px), " +
        "'balanced' (8px / 16px), 'rounded' (12px / 24px).",
    },
  ],
  granularity: "tenant",
  perTenantDarkMode: false,
  perComponentOverrides: false,
  arbitraryCSSInjection: false,
  exclusions: [
    "Custom typography / web fonts — no font loading in the standard theme; system font stack only.",
    "Per-page or per-section colour overrides — one theme governs all pages and all sections.",
    "Per-variant visual styling — all variants of a block share the same visual theme.",
    "Dark mode custom palette per tenant — a single system media-query dark mode exists globally.",
    "Custom icon sets or icon library swaps — Lucide React is the platform icon system.",
    "Custom illustration or image assets injected via theme config — images are managed in the CMS.",
    "Component-level CSS overrides — components derive entirely from the CSS custom property cascade.",
    "Animation or motion preferences per tenant — no motion theming in standard product.",
    "Full design system replacement — the platform ships one design system; a full rewrite is unsupported.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// UNSUPPORTED ARCHITECTURAL EXTENSIONS
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_SIDE_PERSONALISATION: UnsupportedExtension = {
  id: "client-side-personalisation",
  domain: "rendering",
  label: "Client-Side Personalisation",
  reason:
    "The platform's adaptive rendering is server-side by design. All variant " +
    "selection occurs before the HTML is sent to the browser. Client-side " +
    "personalisation (reading cookies or localStorage in the browser, then " +
    "swapping content) produces layout shift, is blocked by ad blockers, and " +
    "defeats the purpose of the server-side architecture. This pattern will " +
    "not be added to the platform.",
  alternativePath:
    "All personalisation is server-side via the decision engine. If a client " +
    "needs browser-side state (e.g. preference toggles), those should be " +
    "handled by the client application layer outside the adaptive pipeline.",
};

const CROSS_SITE_TRACKING: UnsupportedExtension = {
  id: "cross-site-tracking",
  domain: "privacy",
  label: "Cross-Site or Cross-Session Identity Stitching",
  reason:
    "The platform uses a first-party session cookie (mc_session_id) for " +
    "within-session and cross-session history within the same site. It does " +
    "not stitch identities across domains, does not fingerprint devices, and " +
    "does not use third-party identity graphs. Adding cross-site tracking " +
    "would undermine the platform's privacy positioning and GDPR alignment.",
  alternativePath:
    "History signals are available within a single tenant's session scope. " +
    "If cross-domain identity resolution is needed, the client should use a " +
    "purpose-built CDP — the platform can receive a resolved identity token " +
    "if the client implements this themselves.",
};

const PII_STORAGE: UnsupportedExtension = {
  id: "pii-storage",
  domain: "privacy",
  label: "PII Storage in the Platform Database",
  reason:
    "The platform database (events, sessions, served_variants, experiments) " +
    "stores no personally identifiable information. Session IDs are opaque " +
    "random identifiers. There are no name, email, or device fingerprint " +
    "columns. Storing PII in the platform database would require a full GDPR " +
    "compliance review, data processing agreements, and retention policies " +
    "that are outside the platform's scope.",
  alternativePath:
    "Contact form submissions include enriched context (UTM, session, variant " +
    "data) but the PII (name, email) flows through n8n to the client's CRM. " +
    "The CRM holds PII; the platform holds anonymous behavioural signals.",
};

const THIRD_PARTY_COOKIE_DEPENDENCY: UnsupportedExtension = {
  id: "third-party-cookie-dependency",
  domain: "privacy",
  label: "Third-Party Cookie Dependency",
  reason:
    "The platform uses no third-party cookies and relies on no third-party " +
    "cookie-based signals for its decision engine. Third-party cookies are " +
    "deprecated in Chrome and blocked by default in Firefox and Safari. " +
    "Building a dependency on them would make the platform non-functional for " +
    "a large portion of the client's visitor base.",
  alternativePath:
    "All signals are first-party: referrer header, UTM parameters, first-party " +
    "session cookie, and first-party event history. These work without " +
    "third-party cookies.",
};

const EXTERNAL_ML_MODEL: UnsupportedExtension = {
  id: "external-ml-model-integration",
  domain: "decisioning",
  label: "External ML Model Integration for Decision Selection",
  reason:
    "The decision engine interfaces with LLMs via the AiDecisionProvider " +
    "abstract class. Custom ML models (TensorFlow, custom scoring APIs, client " +
    "data science pipelines) are not supported decision providers. Integrating " +
    "an arbitrary external ML model would introduce unpredictable latency, " +
    "require custom error handling, and break the confidence policy / fallback " +
    "model.",
  alternativePath:
    "If a client has a lead scoring model, they can use n8n to post-process " +
    "enriched contact submissions and append a score to their CRM record. The " +
    "platform does not consume external scores as decision inputs.",
};

const REALTIME_CRM_SYNC: UnsupportedExtension = {
  id: "realtime-bidirectional-crm-sync",
  domain: "integration",
  label: "Real-Time Bidirectional CRM Sync",
  reason:
    "The platform's CRM integration is one-way and event-driven: contact " +
    "submissions dispatch an enriched payload to n8n, which the client's n8n " +
    "workflow routes to their CRM. Two-way sync (reading CRM status to inform " +
    "personalisation, writing back analytics events to CRM records in real " +
    "time) is outside the integration model.",
  alternativePath:
    "One-way enriched dispatch via n8n is in-product. If a client needs " +
    "real-time CRM data to drive personalisation, this can be explored as " +
    "custom work under a separate SOW — but it carries significant complexity " +
    "and latency risk.",
};

const FULL_FRONTEND_REWRITE: UnsupportedExtension = {
  id: "full-frontend-rewrite",
  domain: "frontend",
  label: "Full Frontend Redesign / Custom Design System",
  reason:
    "The platform ships one design system. Brand theming via CSS custom " +
    "properties covers colours, radius, and metadata. A full redesign of " +
    "the component library, introducing a custom design system or replacing " +
    "the existing components with client-provided React components, converts " +
    "the platform from a product into a custom build and is not supported.",
  alternativePath:
    "The theming system covers brand-level visual identity (colours, radius, " +
    "meta). If a client has specific design requirements beyond this, the " +
    "MC team can scope a custom frontend engagement as a separate SOW — but " +
    "this is custom work, not product.",
};

const ON_PREMISE_DEPLOYMENT: UnsupportedExtension = {
  id: "on-premise-deployment",
  domain: "deployment",
  label: "On-Premise or Self-Hosted Deployment",
  reason:
    "The platform is a cloud-native Next.js application designed for edge " +
    "deployment (Vercel, Cloudflare). On-premise or self-hosted deployment " +
    "in a client's data centre or private cloud is not supported. The platform " +
    "depends on edge runtime APIs and CDN-level caching that are not available " +
    "in a typical on-premise environment.",
  alternativePath:
    "Deployment is to Vercel (recommended) or compatible edge platforms. " +
    "If a client has strict data residency requirements, discuss Vercel's " +
    "EU/regional deployment options before escalating to 'cannot deploy'.",
};

const MULTI_TENANT_DATA_COMINGLING: UnsupportedExtension = {
  id: "multi-tenant-data-comingling",
  domain: "deployment",
  label: "Shared Database Across Client Tenants",
  reason:
    "Each client deployment has its own isolated database. Tenant data " +
    "(sessions, events, variants) is never stored in a shared multi-tenant " +
    "database alongside other clients' data. This is a deliberate privacy and " +
    "data isolation boundary. A shared database schema is not supported.",
  alternativePath:
    "Each client gets their own Supabase project (or equivalent). The tenant " +
    "config points to that client's database. There is no shared data layer.",
};

const THIRD_PARTY_PIXEL_INJECTION: UnsupportedExtension = {
  id: "third-party-pixel-injection",
  domain: "privacy",
  label: "Third-Party Marketing Pixel Injection",
  reason:
    "The platform does not support injecting third-party marketing pixels " +
    "(Facebook Pixel, LinkedIn Insight Tag, TikTok Pixel, etc.) via theme " +
    "config or CMS. Third-party pixels introduce uncontrolled third-party " +
    "requests, conflict with the platform's first-party data posture, and " +
    "require a consent management layer that is outside the platform's scope.",
  alternativePath:
    "Clients who need third-party tracking pixels should add them via their " +
    "own Google Tag Manager container or by editing the base layout outside " +
    "the platform's configuration layer. This is outside MC's delivery scope.",
};

const HARDCODED_HTML_CMS: UnsupportedExtension = {
  id: "hardcoded-html-cms",
  domain: "cms",
  label: "Hardcoded HTML as CMS Content",
  reason:
    "The platform CMS layer expects structured data (HeroBlockData, " +
    "ProofBlockData, CTABlockData) with typed fields. CMS providers that " +
    "output raw HTML blobs rather than structured field values are not " +
    "compatible with the mapper pattern and cannot be adapted without " +
    "introducing an HTML parser into the rendering pipeline.",
  alternativePath:
    "If a client's existing CMS stores content as HTML, they have two options: " +
    "migrate the relevant content to a supported structured CMS (Sanity / " +
    "Storyblok / Statamic), or use the mock provider during an extended " +
    "onboarding while migration is planned.",
};

/**
 * All unsupported architectural extensions.
 *
 * These are hard boundaries — not roadmap items. A client requirement that
 * maps to any of these entries is a qualification blocker.
 */
export const UNSUPPORTED_EXTENSIONS: readonly UnsupportedExtension[] = [
  CLIENT_SIDE_PERSONALISATION,
  CROSS_SITE_TRACKING,
  PII_STORAGE,
  THIRD_PARTY_COOKIE_DEPENDENCY,
  EXTERNAL_ML_MODEL,
  REALTIME_CRM_SYNC,
  FULL_FRONTEND_REWRITE,
  ON_PREMISE_DEPLOYMENT,
  MULTI_TENANT_DATA_COMINGLING,
  THIRD_PARTY_PIXEL_INJECTION,
  HARDCODED_HTML_CMS,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLED BOUNDARY DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete product boundary document.
 *
 * Single point of import for tools and workflows that need to query
 * any dimension of what the platform supports.
 *
 * @example
 *   import { PRODUCT_BOUNDARIES } from "@/product";
 *   const supported = PRODUCT_BOUNDARIES.cmsProviders.filter(p => p.status === "supported");
 */
export const PRODUCT_BOUNDARIES: ProductBoundaries = {
  version: "1.0.0",
  lastReviewedAt: "2026-03-15",
  cmsProviders:           CMS_PROVIDER_BOUNDARIES,
  pageTypes:              PAGE_TYPE_BOUNDARIES,
  decisionProviders:      DECISION_PROVIDER_BOUNDARIES,
  blockTypes:             BLOCK_TYPE_BOUNDARIES,
  theming:                THEMING_BOUNDARY,
  unsupportedExtensions:  UNSUPPORTED_EXTENSIONS,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the boundary definition for a specific CMS provider.
 *
 * @example
 *   const sanity = getCMSProviderBoundary("sanity");
 *   console.log(sanity.limitations);
 */
export function getCMSProviderBoundary(
  id: CMSProviderBoundaryId,
): CMSProviderBoundary | undefined {
  return CMS_PROVIDER_BOUNDARIES.find((p) => p.id === id);
}

/**
 * Returns all CMS provider boundaries with the given status.
 *
 * @example
 *   const ready = getCMSProvidersByStatus("supported");
 */
export function getCMSProvidersByStatus(
  status: BoundaryStatus,
): readonly CMSProviderBoundary[] {
  return CMS_PROVIDER_BOUNDARIES.filter((p) => p.status === status);
}

/**
 * Returns the boundary definition for a specific page type.
 *
 * @example
 *   const homepage = getPageTypeBoundary("homepage");
 *   console.log(homepage.adaptiveBlocks);
 */
export function getPageTypeBoundary(
  id: PageTypeBoundaryId,
): PageTypeBoundary | undefined {
  return PAGE_TYPE_BOUNDARIES.find((p) => p.id === id);
}

/**
 * Returns all page type boundaries available from a given commercial tier.
 * A page type is "available" from a tier if its minimumTier is at or below
 * the specified tier in the commercial ordering (start → growth → scale).
 *
 * @example
 *   const startPages = getPageTypesByTier("start");
 *   // → [homepage]
 *   const growthPages = getPageTypesByTier("growth");
 *   // → [homepage, campaign-landing-page, product-page]
 */
export function getPageTypesByTier(
  tierId: CommercialTierId,
): readonly PageTypeBoundary[] {
  const tierOrder: CommercialTierId[] = ["start", "growth", "scale"];
  const tierIndex = tierOrder.indexOf(tierId);
  return PAGE_TYPE_BOUNDARIES.filter((p) => {
    if (!p.minimumTier) return false;
    return tierOrder.indexOf(p.minimumTier) <= tierIndex;
  });
}

/**
 * Returns all page type boundaries with the given status.
 *
 * @example
 *   const planned = getPageTypesByStatus("planned");
 */
export function getPageTypesByStatus(
  status: BoundaryStatus,
): readonly PageTypeBoundary[] {
  return PAGE_TYPE_BOUNDARIES.filter((p) => p.status === status);
}

/**
 * Returns the decision provider boundary for the given provider ID.
 *
 * @example
 *   const ai = getDecisionProviderBoundary("ai");
 *   console.log(ai.conditions);
 */
export function getDecisionProviderBoundary(
  id: DecisionProviderBoundaryId,
): DecisionProviderBoundary | undefined {
  return DECISION_PROVIDER_BOUNDARIES.find((p) => p.id === id);
}

/**
 * Returns the block type boundary for the given block ID.
 *
 * @example
 *   const hero = getBlockTypeBoundary("hero");
 *   console.log(hero.unsupportedExtensions);
 */
export function getBlockTypeBoundary(
  id: BlockTypeBoundaryId,
): BlockTypeBoundary | undefined {
  return BLOCK_TYPE_BOUNDARIES.find((b) => b.id === id);
}

/**
 * Returns the unsupported extension definition for the given ID.
 *
 * @example
 *   const ext = getUnsupportedExtension("pii-storage");
 *   console.log(ext.alternativePath);
 */
export function getUnsupportedExtension(
  id: UnsupportedExtensionId,
): UnsupportedExtension | undefined {
  return UNSUPPORTED_EXTENSIONS.find((e) => e.id === id);
}

/**
 * Returns all unsupported extensions in the given domain.
 *
 * @example
 *   const privacyBlocks = getUnsupportedExtensionsByDomain("privacy");
 */
export function getUnsupportedExtensionsByDomain(
  domain: UnsupportedExtension["domain"],
): readonly UnsupportedExtension[] {
  return UNSUPPORTED_EXTENSIONS.filter((e) => e.domain === domain);
}

/**
 * Checks a set of named requirements against the product boundaries and
 * returns a structured assessment.
 *
 * Useful in sales tooling to quickly identify blockers during discovery.
 * Pass in requirement identifiers from CMS provider IDs, page type IDs,
 * decision provider IDs, or unsupported extension IDs.
 *
 * Returns:
 *   blockers         — requirements that map to "unsupported" entries
 *   conditional      — requirements that are supported only under conditions
 *   planned          — requirements that are on the roadmap but not yet delivered
 *   supported        — requirements that are fully supported today
 *   unrecognised     — requirement IDs that do not match any boundary entry
 *
 * @example
 *   const result = checkRequirements(["sanity", "homepage", "ai", "pii-storage"]);
 *   // result.blockers → ["pii-storage"]
 *   // result.conditional → ["ai"]
 *   // result.supported → ["sanity", "homepage"]
 */
export function checkRequirements(
  requirementIds: readonly string[],
): {
  blockers:      readonly string[];
  conditional:   readonly string[];
  planned:       readonly string[];
  supported:     readonly string[];
  unrecognised:  readonly string[];
} {
  const blockers:     string[] = [];
  const conditional:  string[] = [];
  const planned:      string[] = [];
  const supported:    string[] = [];
  const unrecognised: string[] = [];

  for (const id of requirementIds) {
    const cmsMatch    = CMS_PROVIDER_BOUNDARIES.find((p) => p.id === id);
    const pageMatch   = PAGE_TYPE_BOUNDARIES.find((p) => p.id === id);
    const decMatch    = DECISION_PROVIDER_BOUNDARIES.find((p) => p.id === id);
    const extMatch    = UNSUPPORTED_EXTENSIONS.find((e) => e.id === id);

    if (extMatch) {
      // All entries in UNSUPPORTED_EXTENSIONS are hard nos
      blockers.push(id);
    } else if (cmsMatch || pageMatch || decMatch) {
      const status = (cmsMatch ?? pageMatch ?? decMatch)!.status;
      if (status === "supported") supported.push(id);
      else if (status === "conditional") conditional.push(id);
      else if (status === "planned") planned.push(id);
      else if (status === "unsupported") blockers.push(id);
    } else {
      unrecognised.push(id);
    }
  }

  return { blockers, conditional, planned, supported, unrecognised };
}
