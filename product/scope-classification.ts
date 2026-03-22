/**
 * Scope Classification Model
 *
 * Defines the boundary between what Mister Chameleon delivers as standard
 * product, what requires a service engagement to implement, what is possible
 * as custom work, and what is outside the platform entirely.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   The most common source of delivery failure and client disappointment at
 *   MC is misaligned scope expectations set during the sales process. A client
 *   hears "supports any CMS" and expects their proprietary content tool to work
 *   out of the box. A developer hears "customisable" and expects full source
 *   access. This file is the authoritative answer to "does MC support X?"
 *
 *   It serves three distinct audiences:
 *
 *   Sales            Use it to qualify requirements before signing. If a client's
 *                    requirement appears in the unsupported list, that is a
 *                    blocker — not a nice-to-have to figure out after go-live.
 *
 *   Delivery         Use it during scoping and onboarding to document what is
 *                    and isn't included in a given engagement. If a client raises
 *                    a request mid-delivery that appears as custom_work, pause
 *                    and get a change order, not a workaround.
 *
 *   Product          Use it to decide where to invest. Items appearing frequently
 *                    in custom_work are roadmap candidates. Items in unsupported
 *                    that clients consistently request suggest a product gap.
 *
 * ─── Four categories ──────────────────────────────────────────────────────────
 *
 *   in_product          Ships in the platform. No extra MC effort once configured.
 *                       Client licenses a package and this works on day one.
 *                       Zero negotiation required.
 *
 *   in_implementation   Delivered by MC during onboarding or a service engagement.
 *                       Extra time and cost, but within the supported delivery
 *                       model. Scoped in the engagement, not in the product.
 *
 *   custom_work         Possible but not standard. Requires a separate statement
 *                       of work, scoped and priced independently. Higher risk and
 *                       longer timeline. The client must accept both. Never agree
 *                       to custom work inside a standard engagement scope.
 *
 *   unsupported         MC will not build or support this in any configuration.
 *                       Hard boundary — not a "not yet" or a "for the right price".
 *                       If a client's requirements depend on unsupported items,
 *                       this must be resolved before the engagement begins.
 *
 * ─── How categories relate to deliverability ─────────────────────────────────
 *
 *   in_product          → Deliver today. No extra scope needed.
 *   in_implementation   → Deliver with planned service engagement time.
 *   custom_work         → Deliver with separate quote and statement of work.
 *   unsupported         → Do not deliver. Clarify alternative or exit.
 *
 * ─── How to use this in a sales conversation ─────────────────────────────────
 *
 *   1. Identify the client's requirements during discovery.
 *   2. Map each requirement to a ScopeItem using getScopeByDomain() or
 *      getScopeForCapability().
 *   3. If any item is unsupported: surface it immediately. Do not proceed to
 *      proposal without a resolution plan.
 *   4. If any item is custom_work: scope it separately. Do not bundle it into
 *      the standard package price. Use the salesGuidance text on the item.
 *   5. All in_product and in_implementation items: proceed to proposal as normal.
 *
 * ─── How to use this in a delivery conversation ──────────────────────────────
 *
 *   When a client raises a request mid-engagement:
 *   1. Classify the request: find the relevant ScopeItem.
 *   2. If in_product: confirm it is activated in the client's package tier.
 *   3. If in_implementation: confirm it was scoped in the engagement.
 *      If not, raise a scope extension.
 *   4. If custom_work: stop. Do not begin work. Get a change order first.
 *      Use the deliveryGuidance text on the item for the client conversation.
 *   5. If unsupported: stop. Explain the boundary. Use alternativePath if
 *      available to offer a constructive path forward.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   product/types.ts              → ProductModuleId, ServiceOfferingId
 *   product/features.ts           → CapabilityId
 *   product/module-registry.ts    → PackageId
 *   pricing/packages.ts           → CommercialTierId
 *   product/scope-classification.ts ← YOU ARE HERE
 *   product/index.ts              → barrel re-export
 */

import type { ProductModuleId }  from "./types";
import type { CapabilityId }     from "./features";
import type { PackageId }        from "./module-registry";

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four scope categories.
 *
 * These are used as discriminants throughout the model — every ScopeItem
 * has exactly one category, and every decision about scope maps to one of these.
 */
export type ScopeCategory =
  | "in_product"
  | "in_implementation"
  | "custom_work"
  | "unsupported";

/**
 * The domain areas the platform touches.
 *
 * cms            Content management system selection and integration.
 * frontend       Visual rendering, component structure, design system.
 * decisioning    How the platform selects and serves experience variants.
 * integration    Connections to external systems (CRM, email, analytics).
 * reporting      Data surfacing, dashboards, and client-facing reports.
 * analytics      Event tracking, attribution, and data collection.
 * content        Variant copy production, content strategy, briefing.
 * infrastructure Hosting, deployment model, performance, and SLA.
 */
export type ScopeDomain =
  | "cms"
  | "frontend"
  | "decisioning"
  | "integration"
  | "reporting"
  | "analytics"
  | "content"
  | "infrastructure";

/**
 * Risk level for custom_work items.
 *
 * low      Well-understood problem; clear solution path; manageable timeline.
 * medium   Some unknowns in scope or technical complexity; estimate with buffer.
 * high     Significant unknowns; dependencies on client systems; scope creep risk.
 *          Never agree to high-risk custom work without a fixed-scope SOW and
 *          explicit client sign-off on the risk profile.
 */
export type CustomWorkRisk = "low" | "medium" | "high";

/**
 * Stable identifiers for all defined scope items.
 *
 * Format: {domain}-{slug}
 * Convention: lowercase-hyphenated, unique across all domains.
 */
export type ScopeItemId =
  // ── CMS ──
  | "cms-supported-providers"
  | "cms-initial-configuration"
  | "cms-variant-key-structure"
  | "cms-unsupported-provider"
  | "cms-proprietary-headless"
  | "cms-hardcoded-html"
  // ── Frontend ──
  | "frontend-brand-theming"
  | "frontend-tenant-theme-setup"
  | "frontend-custom-design-system"
  | "frontend-component-library-integration"
  | "frontend-full-rewrite"
  // ── Decisioning ──
  | "decisioning-rules-engine"
  | "decisioning-ai-fallback"
  | "decisioning-ab-experiments"
  | "decisioning-custom-rule-design"
  | "decisioning-non-standard-logic"
  | "decisioning-external-ml-model"
  | "decisioning-cdp-integration"
  // ── Integration ──
  | "integration-n8n-dispatch"
  | "integration-n8n-workflow-design"
  | "integration-crm-field-mapping"
  | "integration-custom-crm-api"
  | "integration-bi-tool-export"
  | "integration-realtime-bidirectional-sync"
  | "integration-third-party-tag-manager"
  // ── Reporting ──
  | "reporting-platform-dashboard"
  | "reporting-monthly-report"
  | "reporting-custom-dashboard"
  | "reporting-bi-platform-integration"
  | "reporting-pii-user-level"
  // ── Analytics ──
  | "analytics-first-party-tracking"
  | "analytics-event-schema-extension"
  | "analytics-ga4-passthrough"
  | "analytics-third-party-pixels"
  // ── Content ──
  | "content-variant-content-brief"
  | "content-review-and-upload"
  | "content-full-copywriting"
  | "content-brand-identity-design"
  // ── Infrastructure ──
  | "infrastructure-standard-sla"
  | "infrastructure-sla-upgrade"
  | "infrastructure-on-premise"
  | "infrastructure-white-label";

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE ITEM INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single classified scope item.
 *
 * Each item answers the question: "Does Mister Chameleon support X?" with
 * a structured answer — not just a yes/no, but a clear statement of what
 * is included, where the boundary is, and what to say in a sales or delivery
 * conversation when this item comes up.
 */
export interface ScopeItem {
  /** Stable ID for this scope item. */
  id: ScopeItemId;

  /** Which of the four scope categories this item belongs to. */
  category: ScopeCategory;

  /**
   * Which product/platform domain this item belongs to.
   * Used to group items in sales checklists and scope reviews.
   */
  domain: ScopeDomain;

  /** Short display label — appears in scope checklists and proposals. */
  label: string;

  /**
   * What this scope item covers.
   * Written to be understandable to a non-technical stakeholder.
   * 1–2 sentences describing what the item is, not what MC does with it.
   */
  description: string;

  /**
   * The exact boundary of what is and isn't included.
   * This is the precise, honest statement of scope — the sentence you would
   * put in a contract or proposal to prevent a dispute later.
   *
   * Written as a positive statement for in_product/in_implementation:
   *   "Includes X. Does not include Y."
   *
   * Written as a negative statement for custom_work/unsupported:
   *   "Not included in standard scope. [Consequence or condition]."
   */
  boundary: string;

  // ── Product layer connections ───────────────────────────────────────────────

  /**
   * The capabilities this item is related to.
   * For in_product items: the capabilities it provides.
   * For custom_work/unsupported: the capabilities it would need to interact with.
   */
  relatedCapabilityIds?: readonly CapabilityId[];

  /**
   * The product modules involved in this scope item.
   */
  relatedModuleIds?: readonly ProductModuleId[];

  /**
   * The minimum package tier required for this item (in_product items only).
   * When set, indicates that this item is not available on lower tiers.
   */
  packageMinimum?: PackageId;

  // ── Custom work metadata (custom_work items only) ───────────────────────────

  /**
   * Risk level for custom work items.
   * Only meaningful when category is "custom_work".
   */
  customRisk?: CustomWorkRisk;

  /**
   * Whether this custom work item requires a separate statement of work,
   * or whether it can be accommodated within a scope extension to an existing
   * engagement.
   *
   * true   A new SOW is always required. Never fold this into existing scope.
   * false  Can be scoped as an extension to the current engagement if caught
   *        early enough. Still requires explicit written agreement.
   */
  requiresSeparateQuote?: boolean;

  /**
   * An indicative sense of the additional scope a custom work item adds.
   * Not a price — a scope framing for the account manager.
   *
   * Examples: "1–2 additional engineering days", "2–4 week standalone project",
   *           "ongoing retainer, typically 2–4 hours/month"
   */
  estimatedAdditionalScope?: string;

  // ── Guidance ────────────────────────────────────────────────────────────────

  /**
   * What to say in a sales conversation when this item comes up.
   * Written as a script fragment or talking point — direct, practical,
   * not evasive. The goal is to either resolve the concern or surface a
   * blocker before the deal is signed.
   */
  salesGuidance: string;

  /**
   * What to do or say in a delivery conversation when this item comes up.
   * Particularly important for custom_work and unsupported items, where
   * the instinct is to "just find a workaround" rather than pause.
   */
  deliveryGuidance?: string;

  /**
   * For custom_work and unsupported items: what the client should do instead,
   * or what the supported alternative path looks like.
   * Offering a constructive alternative path is always better than a flat "no."
   */
  alternativePath?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE ITEM DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

// ─── CMS ──────────────────────────────────────────────────────────────────────

const CMS_SUPPORTED_PROVIDERS: ScopeItem = {
  id: "cms-supported-providers",
  category: "in_product",
  domain: "cms",
  label: "Supported CMS Providers",
  description:
    "Native integration with Sanity, Storyblok, Statamic, and the built-in " +
    "mock CMS. Each tenant selects one provider; the platform's rendering " +
    "pipeline is CMS-agnostic.",
  boundary:
    "Includes: full integration with any supported provider listed above. " +
    "Does not include: CMS platforms outside this list, or any provider " +
    "requiring a custom API adapter.",
  relatedCapabilityIds: ["multi-cms-support"],
  salesGuidance:
    "Lead with 'Which CMS are you using today?' If it's on the supported list, " +
    "confirm and move on. If it's not, classify immediately as cms-unsupported-provider " +
    "and handle that conversation before proceeding.",
};

const CMS_INITIAL_CONFIGURATION: ScopeItem = {
  id: "cms-initial-configuration",
  category: "in_implementation",
  domain: "cms",
  label: "Initial CMS Configuration",
  description:
    "Setting up the tenant's chosen CMS provider within the platform during " +
    "onboarding — connecting credentials, validating the query layer, " +
    "and confirming variant content is fetchable.",
  boundary:
    "Includes: connecting a supported CMS provider to the platform tenant. " +
    "Does not include: CMS account setup, schema design in the client's CMS, " +
    "or migration of existing CMS content into the variant key structure.",
  relatedCapabilityIds: ["multi-cms-support"],
  salesGuidance:
    "Covered in all onboarding engagements. No separate line item needed. " +
    "Confirm the client has an active CMS account and developer access before " +
    "scheduling onboarding.",
  deliveryGuidance:
    "Allocate 2–3 hours for CMS configuration and validation during onboarding. " +
    "If the client's CMS schema is complex or non-standard, flag early — this " +
    "may expand into cms-variant-key-structure scope.",
};

const CMS_VARIANT_KEY_STRUCTURE: ScopeItem = {
  id: "cms-variant-key-structure",
  category: "in_implementation",
  domain: "cms",
  label: "Variant Key Structure Design",
  description:
    "Designing the taxonomy of variant keys — the named slots that the " +
    "platform will request from the CMS. Getting this right determines " +
    "how flexible and maintainable the content layer is over time.",
  boundary:
    "Includes: variant key naming, slot hierarchy (hero/proof/CTA), and a " +
    "reference document for populating variant content. Does not include: " +
    "creating the actual CMS schema in the client's CMS tool, or producing " +
    "any variant content.",
  relatedModuleIds: ["adaptive-website", "adaptive-landing-pages"],
  salesGuidance:
    "Part of the standard onboarding engagement. If the client has an unusually " +
    "complex content model (e.g. 10+ variant slots or multi-brand setup), flag " +
    "as potentially requiring additional scoping time.",
  deliveryGuidance:
    "Do this in the first week of onboarding before any content is produced. " +
    "A poorly designed key structure is expensive to refactor later.",
};

const CMS_UNSUPPORTED_PROVIDER: ScopeItem = {
  id: "cms-unsupported-provider",
  category: "custom_work",
  domain: "cms",
  label: "Unsupported CMS Provider",
  description:
    "A CMS platform not in the supported list — common examples include " +
    "Contentful, Dato CMS, Prismic, WordPress REST API, Craft CMS, and " +
    "proprietary headless solutions.",
  boundary:
    "Not included in standard scope. Delivering with an unsupported CMS " +
    "requires a custom CMS adapter — a standalone engineering project that " +
    "must be scoped, quoted, and delivered before the main engagement begins.",
  customRisk: "medium",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "1–3 week standalone engineering project, scoped per provider",
  salesGuidance:
    "Do not sign a standard engagement if the client is on an unsupported CMS. " +
    "The conversation is: 'We don't have a native connector for [CMS] yet. " +
    "We can build one, but that's a separate project we'd need to scope and " +
    "price before starting. Alternatively, are you able to migrate to [supported CMS]?' " +
    "If the client can migrate, recategorise as in_implementation. If not, " +
    "scope the adapter project separately.",
  deliveryGuidance:
    "If discovered mid-delivery: stop. Do not attempt to build an adapter " +
    "within the existing engagement budget. Raise with the account manager " +
    "immediately and issue a change order.",
  alternativePath:
    "Client migrates to a supported CMS (Sanity is the recommended default). " +
    "MC can provide a migration scope estimate if requested.",
};

const CMS_PROPRIETARY_HEADLESS: ScopeItem = {
  id: "cms-proprietary-headless",
  category: "custom_work",
  domain: "cms",
  label: "Proprietary Headless CMS with Custom API",
  description:
    "An in-house or bespoke headless CMS with a non-standard API shape — " +
    "not a named third-party product, but a system the client built or " +
    "heavily customised themselves.",
  boundary:
    "Not included in standard scope. Building an adapter for a proprietary " +
    "system requires access to API documentation, test credentials, and " +
    "significantly more engineering time than a standard unsupported CMS. " +
    "High scope-change risk if the API is poorly documented.",
  customRisk: "high",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "2–6 week engineering project; timeline depends on API documentation quality",
  salesGuidance:
    "Treat this as a blocker until scoped. Request API documentation and a " +
    "sample response before committing to any adapter work. The conversation " +
    "is: 'We'd need to review your API before we can estimate this. Can you " +
    "share documentation and test credentials?'",
  deliveryGuidance:
    "Never start without written API documentation. Agree on an acceptance " +
    "criterion for the adapter (specific query patterns must work) in the SOW.",
  alternativePath:
    "Expose variant content through a supported CMS as a thin content layer, " +
    "keeping the proprietary system for other content needs.",
};

const CMS_HARDCODED_HTML: ScopeItem = {
  id: "cms-hardcoded-html",
  category: "unsupported",
  domain: "cms",
  label: "Hardcoded HTML / No CMS API",
  description:
    "A site where variant content is hardcoded directly in HTML or template " +
    "files with no CMS or content API — the site is edited by deploying new " +
    "code, not by updating content records.",
  boundary:
    "Unsupported. The platform requires a CMS API to fetch variant content at " +
    "request time. A site with no CMS cannot use the adaptive rendering pipeline " +
    "without a fundamental architectural change.",
  salesGuidance:
    "This is a blocker. The platform cannot work without a CMS. The conversation " +
    "is: 'Our platform selects variant content at request time from a connected CMS. " +
    "For this to work, your site needs to move to a CMS-driven content model. " +
    "We can help scope that migration, but it's a prerequisite, not something " +
    "we can work around.'",
  alternativePath:
    "Client adopts a supported CMS (Sanity recommended for new builds). MC can " +
    "scope a content migration project if required.",
};

// ─── Frontend ─────────────────────────────────────────────────────────────────

const FRONTEND_BRAND_THEMING: ScopeItem = {
  id: "frontend-brand-theming",
  category: "in_product",
  domain: "frontend",
  label: "Per-Tenant Brand Theming",
  description:
    "CSS custom property injection at request time from the tenant's brand " +
    "config — primary colour, text colour, border radius, and brand metadata. " +
    "Components inherit via cascade; no code changes needed.",
  boundary:
    "Includes: primary colour, secondary colour, border radius, font stack " +
    "reference, and brand name injection. Does not include: overriding " +
    "component structure, layout, or typography beyond the theme variables.",
  relatedCapabilityIds: ["tenant-theming"],
  salesGuidance:
    "Covers most brand customisation needs out of the box. Confirm the client's " +
    "brand requirements are limited to colour, radius, and font choices. If they " +
    "want to change component structure or layout, classify as custom_work.",
};

const FRONTEND_TENANT_THEME_SETUP: ScopeItem = {
  id: "frontend-tenant-theme-setup",
  category: "in_implementation",
  domain: "frontend",
  label: "Tenant Brand Theme Configuration",
  description:
    "Configuring the tenant's brand colours, radius, and font references in " +
    "the platform's theme config during onboarding.",
  boundary:
    "Includes: populating TenantTheme values from the client's brand guidelines. " +
    "Does not include: creating brand guidelines, selecting fonts, or designing " +
    "colour palettes — these must be provided by the client.",
  relatedCapabilityIds: ["tenant-theming"],
  salesGuidance:
    "Always included in onboarding. Ask the client to prepare a brand reference " +
    "document (hex codes, font names, border radius preference) before the " +
    "onboarding kick-off.",
  deliveryGuidance:
    "Do this on day one of onboarding. Nothing else looks right until the theme " +
    "is configured.",
};

const FRONTEND_CUSTOM_DESIGN_SYSTEM: ScopeItem = {
  id: "frontend-custom-design-system",
  category: "custom_work",
  domain: "frontend",
  label: "Fully Custom Frontend Design System",
  description:
    "A complete visual overhaul of the platform's component library — replacing " +
    "default button styles, card layouts, typography scales, spacing systems, " +
    "and interaction patterns with entirely client-specific equivalents.",
  boundary:
    "Not included in standard scope. The platform ships with a component library " +
    "that can be themed via CSS custom properties (colours, radius, fonts). " +
    "Replacing the underlying component structure or creating custom components " +
    "is a custom front-end engineering project.",
  customRisk: "high",
  requiresSeparateQuote: true,
  estimatedAdditionalScope:
    "3–8 week front-end engineering project; ongoing maintenance cost to stay " +
    "compatible with platform updates",
  salesGuidance:
    "The framing is: 'We can match your brand colours, fonts, and border radius " +
    "out of the box. If you need the components themselves to look fundamentally " +
    "different — different button shapes, custom card structures, bespoke layouts — " +
    "that's a separate front-end project. Most clients find the themed defaults " +
    "are close enough. Can I show you what that looks like with your brand applied?' " +
    "Always demo the themed defaults before agreeing to custom work.",
  deliveryGuidance:
    "Never begin custom component work within a standard engagement. Any custom " +
    "CSS beyond theme variables requires a change order.",
  alternativePath:
    "Apply the theme system first and show the client the result. In most cases " +
    "the themed defaults are acceptable. If specific components need adjustment, " +
    "scope targeted CSS overrides (low risk) rather than a full redesign.",
};

const FRONTEND_COMPONENT_LIBRARY_INTEGRATION: ScopeItem = {
  id: "frontend-component-library-integration",
  category: "custom_work",
  domain: "frontend",
  label: "Third-Party Component Library Integration",
  description:
    "Replacing or augmenting platform components with an external component " +
    "library (e.g. shadcn/ui beyond what the platform already uses, Radix, " +
    "Headless UI, or the client's own internal design system).",
  boundary:
    "Not included in standard scope. Integration with external component " +
    "libraries introduces dependency management risk and may conflict with " +
    "the platform's styling system.",
  customRisk: "medium",
  requiresSeparateQuote: false,
  estimatedAdditionalScope: "Scoped per component; typically 0.5–2 days per component type",
  salesGuidance:
    "Only raise this if the client specifically requests it. The default " +
    "position is: 'We use our own component library. If you need specific " +
    "components from your design system integrated, we can scope that as " +
    "an add-on.'",
  alternativePath:
    "Apply the theme system and CSS variables to match the client's design " +
    "system visually without replacing the component library.",
};

const FRONTEND_FULL_REWRITE: ScopeItem = {
  id: "frontend-full-rewrite",
  category: "unsupported",
  domain: "frontend",
  label: "Full Frontend Rebuild / Custom Stack",
  description:
    "Rebuilding the platform's rendering layer in a different framework — " +
    "Vue, Svelte, Angular, plain HTML — or replacing the Next.js App Router " +
    "architecture with a client's existing tech stack.",
  boundary:
    "Unsupported. The adaptive rendering pipeline is tightly coupled to Next.js " +
    "App Router server components and the React component model. Porting to " +
    "another framework is not a scope item; it would be rebuilding the platform.",
  salesGuidance:
    "Do not engage with this as a requirement. The conversation is: 'The platform " +
    "is built on Next.js and isn't portable to other frameworks. If your team " +
    "needs a specific stack, we should discuss whether the platform is the " +
    "right fit for your use case.'",
  alternativePath:
    "If the client is constrained to a specific stack, assess whether MC's " +
    "headless API layer could serve variant decisions to their own frontend. " +
    "This would be a different product engagement entirely.",
};

// ─── Decisioning ──────────────────────────────────────────────────────────────

const DECISIONING_RULES_ENGINE: ScopeItem = {
  id: "decisioning-rules-engine",
  category: "in_product",
  domain: "decisioning",
  label: "Rules-Based Decisioning Engine",
  description:
    "An ordered rule set that evaluates each visitor's traffic source, device, " +
    "and behavioural history to select the optimal experience plan. Included " +
    "in all package tiers.",
  boundary:
    "Includes: source rules (paid, organic, direct, social, referral), device " +
    "rules, and visit-history rules. Does not include: rules based on data " +
    "not available in the session context (geo-IP, account-based, time-of-day).",
  relatedCapabilityIds: ["rules-decisioning"],
  salesGuidance:
    "Available to all tiers. Explain: 'The rules engine evaluates who each " +
    "visitor is based on where they came from and what they've done before, " +
    "then picks the right experience. It works without any AI cost and has " +
    "zero additional latency.'",
};

const DECISIONING_AI_FALLBACK: ScopeItem = {
  id: "decisioning-ai-fallback",
  category: "in_product",
  domain: "decisioning",
  label: "AI-Augmented Decisioning",
  description:
    "An LLM evaluates visitor signals to select the experience plan when the " +
    "rules engine confidence falls below the configured threshold. Falls back " +
    "to rules gracefully when AI is unavailable.",
  boundary:
    "Included in Growth (optional add-on) and Scale (default). Not available " +
    "on Start. Requires aiDecisionProvider tenant feature flag to be active.",
  relatedCapabilityIds: ["ai-decisioning"],
  packageMinimum: "growth",
  salesGuidance:
    "Position as a confidence layer: 'When the rules engine isn't certain which " +
    "variant to serve — a new source we haven't mapped yet, or a complex " +
    "returning user — the AI makes the call. It extends coverage without " +
    "replacing the rule set.'",
};

const DECISIONING_AB_EXPERIMENTS: ScopeItem = {
  id: "decisioning-ab-experiments",
  category: "in_product",
  domain: "decisioning",
  label: "A/B Experiment Framework",
  description:
    "Built-in experiment decorator that intercepts the decision engine, applies " +
    "bucket assignments, and records exposure events for per-variant CTR readout.",
  boundary:
    "Included in Growth and Scale. Not available on Start. Requires abTesting " +
    "tenant feature flag. Does not include statistical significance calculation " +
    "tooling — readout is raw CTR per bucket.",
  relatedCapabilityIds: ["experiment-support"],
  packageMinimum: "growth",
  salesGuidance:
    "Available from Growth. Explain: 'You can run a proper A/B test on any " +
    "adaptive surface — we split traffic between two variants, track clicks " +
    "independently, and surface the results in the dashboard so you can make " +
    "the call on which to keep.'",
};

const DECISIONING_CUSTOM_RULE_DESIGN: ScopeItem = {
  id: "decisioning-custom-rule-design",
  category: "in_implementation",
  domain: "decisioning",
  label: "Custom Rule Set Design",
  description:
    "MC designing the client's initial decision rule set during onboarding — " +
    "which sources map to which variants, what thresholds trigger which rules, " +
    "and how returning visitor history adjusts the experience.",
  boundary:
    "Includes: rule design for sources and segments observable in the session " +
    "context (UTM, referrer, device, visit count). Does not include: rules " +
    "requiring data not present in the session (external CRM state, IP lookup, " +
    "authenticated user data).",
  relatedCapabilityIds: ["rules-decisioning"],
  salesGuidance:
    "Part of all onboarding engagements. Reassure clients: 'We'll design " +
    "your rule set with you — you don't need to know anything about how the " +
    "engine works. We ask you who your visitors are and what you want them " +
    "to see.'",
  deliveryGuidance:
    "Deliver a written rule design document before configuring the engine. " +
    "Client sign-off on the rule set avoids later disputes about why " +
    "a specific variant was served.",
};

const DECISIONING_NON_STANDARD_LOGIC: ScopeItem = {
  id: "decisioning-non-standard-logic",
  category: "custom_work",
  domain: "decisioning",
  label: "Non-Standard Decisioning Logic",
  description:
    "Decisioning based on data not available in the standard session context — " +
    "examples include: geographic targeting (country/city via IP lookup), " +
    "time-of-day or day-of-week rules, account-based targeting from a CRM, " +
    "industry or company-size rules from an enrichment provider.",
  boundary:
    "Not included in standard scope. The rules engine operates on session-level " +
    "signals only. Extending it to use external data sources requires adding " +
    "a new DecisionInput provider — a custom engineering task.",
  customRisk: "medium",
  requiresSeparateQuote: false,
  estimatedAdditionalScope: "2–5 engineering days per additional data source",
  relatedCapabilityIds: ["rules-decisioning"],
  salesGuidance:
    "When a client asks for geo-targeting or account-based rules: 'That's " +
    "possible as a custom extension — we'd need to add a data provider that " +
    "feeds that signal into the decisioning layer. It's a straightforward " +
    "addition but needs to be scoped separately from the standard setup. " +
    "What's driving the geo requirement — is it compliance, or conversion " +
    "optimisation? Sometimes we can achieve the same outcome with source rules.'",
  deliveryGuidance:
    "Document the new DecisionInput source in a brief technical spec before " +
    "starting. Get sign-off from the account manager that this is covered " +
    "in scope.",
  alternativePath:
    "Many non-standard logic needs can be approximated with source rules " +
    "and UTM parameters. Explore whether the client's traffic is tagged " +
    "in a way that already carries the signal they need.",
};

const DECISIONING_EXTERNAL_ML_MODEL: ScopeItem = {
  id: "decisioning-external-ml-model",
  category: "unsupported",
  domain: "decisioning",
  label: "External ML Model for Decisioning",
  description:
    "Replacing or augmenting the platform's decisioning layer with a client's " +
    "own trained ML model or a third-party prediction API — for example, a " +
    "propensity model, churn predictor, or lookalike audience engine.",
  boundary:
    "Unsupported. The platform's decisioning layer is designed to accept " +
    "structured inputs and produce experience plan outputs using the rules " +
    "and AI providers built into the platform. Integrating external ML inference " +
    "into the critical path is not supported in any configuration.",
  salesGuidance:
    "The framing is: 'We have a built-in AI decisioning layer — it evaluates " +
    "visitor context using our model configuration. Plugging in an external ML " +
    "inference call isn't something we support. If you have a specific prediction " +
    "signal you want to use, tell me more — there may be a way to encode it as " +
    "an input to our rules engine.'",
  alternativePath:
    "If the client has a high-confidence signal from their ML model, pass it " +
    "as a UTM parameter or session attribute and encode it as a rules engine " +
    "input. The decision stays in-platform; the signal comes from outside.",
};

const DECISIONING_CDP_INTEGRATION: ScopeItem = {
  id: "decisioning-cdp-integration",
  category: "custom_work",
  domain: "decisioning",
  label: "CDP Integration for Visitor Enrichment",
  description:
    "Using a Customer Data Platform (e.g. Segment, Amplitude, mParticle) to " +
    "enrich the session context before the decisioning engine runs — passing " +
    "audience membership, predicted LTV, or profile data into variant selection.",
  boundary:
    "Not in standard scope. Requires a custom DecisionInput provider that reads " +
    "from the CDP's identify API at request time. Must be evaluated for latency " +
    "impact before implementing — server-side CDP calls add to TTFB.",
  customRisk: "high",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "2–4 week standalone engineering project; ongoing latency monitoring required",
  salesGuidance:
    "Flag for technical scoping before quoting. Ask: 'What specifically from " +
    "your CDP do you want to use in variant selection? And how latency-sensitive " +
    "is that use case?' If latency is a concern, explore whether the signal can " +
    "be pre-computed and passed as a first-party cookie instead.",
};

// ─── Integration ──────────────────────────────────────────────────────────────

const INTEGRATION_N8N_DISPATCH: ScopeItem = {
  id: "integration-n8n-dispatch",
  category: "in_product",
  domain: "integration",
  label: "n8n Journey Dispatch",
  description:
    "Contact submissions dispatch an enriched four-layer payload to n8n for " +
    "routing to CRM, email sequences, Slack, or any connected workflow tool.",
  boundary:
    "Includes: webhook dispatch to the tenant's n8n endpoint with the enriched " +
    "payload. Does not include: n8n instance setup, workflow design, or CRM " +
    "configuration on the receiving end.",
  relatedCapabilityIds: ["journey-orchestration", "contact-enrichment"],
  relatedModuleIds: ["adaptive-follow-up"],
  salesGuidance:
    "Explain: 'Every contact form submission is automatically sent to n8n " +
    "with the visitor's source, UTM data, session history, and the variant " +
    "they converted on. From n8n you can route it to HubSpot, send a Slack " +
    "notification, trigger an email sequence — anything you have connected.'",
};

const INTEGRATION_N8N_WORKFLOW_DESIGN: ScopeItem = {
  id: "integration-n8n-workflow-design",
  category: "in_implementation",
  domain: "integration",
  label: "n8n Workflow Design",
  description:
    "MC designing and configuring the n8n workflows that receive the enriched " +
    "contact payload and route it to the client's downstream tools.",
  boundary:
    "Includes: up to 2 standard workflow designs (e.g. HubSpot contact create " +
    "+ Slack notification) as part of onboarding scope. Does not include: " +
    "complex multi-branch workflows, custom n8n nodes, or ongoing workflow " +
    "maintenance.",
  relatedModuleIds: ["adaptive-follow-up"],
  salesGuidance:
    "Confirm which tools the client uses (CRM, email, Slack). Standard " +
    "integrations like HubSpot and Mailchimp are quick to configure. " +
    "Custom workflow logic is custom_work.",
  deliveryGuidance:
    "Design the workflow in a staging n8n environment first. Test with a real " +
    "submission before going live. Document the workflow structure for handoff.",
};

const INTEGRATION_CRM_FIELD_MAPPING: ScopeItem = {
  id: "integration-crm-field-mapping",
  category: "in_implementation",
  domain: "integration",
  label: "CRM Field Mapping",
  description:
    "Mapping the enriched contact submission fields to the client's CRM " +
    "contact properties — ensuring traffic source, UTM data, and variant " +
    "information land in the right CRM fields.",
  boundary:
    "Includes: mapping the standard enriched payload fields to existing " +
    "CRM properties. Does not include: creating custom CRM properties, " +
    "building CRM workflows or automation, or syncing historical data.",
  relatedModuleIds: ["adaptive-follow-up"],
  salesGuidance:
    "Ask the client which CRM fields they want to populate with MC data. " +
    "Standard fields are covered in implementation scope. If they need " +
    "new custom properties created in the CRM, that is CRM admin work " +
    "on their side, not MC scope.",
};

const INTEGRATION_CUSTOM_CRM_API: ScopeItem = {
  id: "integration-custom-crm-api",
  category: "custom_work",
  domain: "integration",
  label: "Direct CRM API Integration",
  description:
    "A direct API integration from the platform to a CRM system — bypassing " +
    "n8n and sending enriched contact data directly to HubSpot, Salesforce, " +
    "Pipedrive, or another CRM via their native API.",
  boundary:
    "Not in standard scope. The platform dispatches to n8n and the client's " +
    "n8n workflows handle CRM routing. Direct API integrations require custom " +
    "engineering and create a maintenance dependency on the CRM's API version.",
  customRisk: "medium",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "1–2 week engineering project per CRM; ongoing maintenance for API updates",
  salesGuidance:
    "The standard path is n8n → CRM. Ask: 'Do you have n8n running today, " +
    "or are you open to setting it up? It's the right tool for this connection " +
    "and avoids a custom build.' If n8n is genuinely not an option, scope the " +
    "direct integration as a separate project.",
  alternativePath:
    "n8n is the recommended path. MC can assist in setting up a basic n8n " +
    "instance as part of onboarding if the client doesn't have one.",
};

const INTEGRATION_BI_TOOL_EXPORT: ScopeItem = {
  id: "integration-bi-tool-export",
  category: "custom_work",
  domain: "integration",
  label: "BI Platform Data Export",
  description:
    "Exporting platform event data (sessions, variant selections, CTR events) " +
    "to an external BI tool — Looker, Metabase, Tableau, Power BI, or a " +
    "data warehouse (BigQuery, Snowflake, Redshift).",
  boundary:
    "Not in standard scope. Platform event data lives in Supabase. Exporting " +
    "it to an external BI tool requires an ETL pipeline, scheduled exports, " +
    "or direct database read access — none of which are part of the standard " +
    "platform offering.",
  customRisk: "medium",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "1–3 week data engineering project; ongoing pipeline maintenance",
  salesGuidance:
    "Most clients don't need this — the platform dashboard and monthly report " +
    "cover the relevant metrics. Ask: 'What specifically are you trying to " +
    "analyse that you can't see in the dashboard?' Often the answer reveals " +
    "a dashboard feature gap rather than a BI requirement.",
  alternativePath:
    "The monthly performance report and dashboard cover variant CTR, source " +
    "breakdown, and session trends. Confirm these don't meet the client's " +
    "needs before scoping a BI export.",
};

const INTEGRATION_REALTIME_BIDIRECTIONAL_SYNC: ScopeItem = {
  id: "integration-realtime-bidirectional-sync",
  category: "unsupported",
  domain: "integration",
  label: "Real-Time Bidirectional Sync",
  description:
    "Two-way, real-time data synchronisation between the MC platform and an " +
    "external system — pushing platform events out and receiving external " +
    "state changes in to influence decisioning in real time.",
  boundary:
    "Unsupported. The platform dispatches outbound webhooks on contact " +
    "submission; it does not maintain a persistent connection to or listen " +
    "for events from external systems.",
  salesGuidance:
    "Clarify what the client actually needs. True bidirectional real-time sync " +
    "is almost never what they actually require — usually they want (a) session " +
    "data sent outbound (supported via n8n) or (b) account data used in " +
    "decisioning (see decisioning-cdp-integration). Probe before concluding " +
    "this is truly required.",
  alternativePath:
    "Outbound: n8n dispatch covers real-time outbound events. " +
    "Inbound: encode external signals as UTM parameters or session attributes " +
    "for use in the rules engine.",
};

const INTEGRATION_THIRD_PARTY_TAG_MANAGER: ScopeItem = {
  id: "integration-third-party-tag-manager",
  category: "custom_work",
  domain: "integration",
  label: "Tag Manager Integration",
  description:
    "Firing MC-tracked events into a third-party tag manager (Google Tag " +
    "Manager, Tealium) for forwarding to analytics or advertising platforms.",
  boundary:
    "Not in standard scope. MC tracking is first-party and server-side. " +
    "Connecting it to a tag manager requires client-side event forwarding — " +
    "a JavaScript integration that must be maintained as the platform updates.",
  customRisk: "low",
  requiresSeparateQuote: false,
  estimatedAdditionalScope: "0.5–1 engineering day for basic GTM dataLayer event forwarding",
  salesGuidance:
    "Only needed if the client's analytics stack requires GTM. Ask what they " +
    "need the data for — often they want variant data in GA4, which can be " +
    "achieved without tag manager via a direct approach.",
  alternativePath:
    "For GA4 specifically, see analytics-ga4-passthrough.",
};

// ─── Reporting ────────────────────────────────────────────────────────────────

const REPORTING_PLATFORM_DASHBOARD: ScopeItem = {
  id: "reporting-platform-dashboard",
  category: "in_product",
  domain: "reporting",
  label: "Platform Analytics Dashboard",
  description:
    "Internal dashboard surfacing variant selection frequency, CTA click rates, " +
    "source breakdown, and session trends — drawn from first-party event data.",
  boundary:
    "Included in all tiers. Advanced features (decision audit trail, experiment " +
    "management) require Growth or Scale. Dashboard analytics are an internal " +
    "MC team view — not a white-labelled client-facing product.",
  relatedCapabilityIds: ["dashboard-analytics"],
  salesGuidance:
    "Available to all tiers from day one. Note: the full variant analytics " +
    "dashboard is a planned capability — basic session and event data is " +
    "available now; the polished analytics view is coming soon.",
};

const REPORTING_MONTHLY_REPORT: ScopeItem = {
  id: "reporting-monthly-report",
  category: "in_product",
  domain: "reporting",
  label: "MC-Produced Monthly Performance Report",
  description:
    "The 6-section client performance report produced and delivered by MC each " +
    "month: summary, context segments, variant performance, conversion metrics, " +
    "engine insights, and recommendations.",
  boundary:
    "Included with the managed optimisation retainer (Growth and Scale with " +
    "the optimisation add-on). Not included with Start or self-managed tiers. " +
    "Report covers platform data only — does not include CRM pipeline data " +
    "or off-platform conversion events.",
  relatedCapabilityIds: ["dashboard-analytics"],
  packageMinimum: "growth",
  salesGuidance:
    "The monthly report is what makes the platform's value visible to clients " +
    "who aren't logging into the dashboard. It should always be proposed " +
    "alongside the optimisation retainer.",
};

const REPORTING_CUSTOM_DASHBOARD: ScopeItem = {
  id: "reporting-custom-dashboard",
  category: "custom_work",
  domain: "reporting",
  label: "Custom Analytics Dashboard",
  description:
    "A client-facing, white-labelled, or bespoke analytics dashboard showing " +
    "platform performance data in a custom visual format — beyond what the " +
    "standard internal dashboard provides.",
  boundary:
    "Not in standard scope. Building a custom dashboard requires a front-end " +
    "development project scoped and priced separately.",
  customRisk: "medium",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "2–5 week front-end project; ongoing data query maintenance",
  salesGuidance:
    "Ask: 'What does the ideal dashboard show that the standard one doesn't?' " +
    "Very often the gap is a specific metric or layout preference, not a " +
    "fundamentally different data view. Explore whether the platform roadmap " +
    "already covers the requirement before scoping custom work.",
  alternativePath:
    "The standard dashboard + monthly report covers variant CTR, source " +
    "attribution, and session trends. BI tool export is the path for clients " +
    "who need custom visualisation in their own tooling.",
};

const REPORTING_BI_PLATFORM_INTEGRATION: ScopeItem = {
  id: "reporting-bi-platform-integration",
  category: "custom_work",
  domain: "reporting",
  label: "BI Platform Reporting Integration",
  description:
    "Surfacing MC platform data (variant performance, session metrics, " +
    "conversion events) inside the client's existing BI tooling — Looker " +
    "Studio, Tableau, Metabase, or equivalent.",
  boundary:
    "Not in standard scope. Requires a data export pipeline (see " +
    "integration-bi-tool-export) as a prerequisite, followed by BI-specific " +
    "query and dashboard configuration.",
  customRisk: "medium",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "2–4 weeks total (pipeline + BI setup); prerequisite: data export pipeline in place",
  salesGuidance:
    "Only relevant for clients who already have a BI platform and a data " +
    "culture that uses it. Most SMB clients do not. Qualify before scoping.",
  alternativePath:
    "Monthly performance report delivered by MC covers the core metrics. " +
    "Propose the report first; revisit BI if the client's reporting maturity " +
    "warrants it.",
};

const REPORTING_PII_USER_LEVEL: ScopeItem = {
  id: "reporting-pii-user-level",
  category: "unsupported",
  domain: "reporting",
  label: "PII-Based or User-Level Reporting",
  description:
    "Reporting that identifies individual visitors by name, email, or other " +
    "personally identifiable information — linking platform event data to " +
    "known user profiles.",
  boundary:
    "Unsupported. The platform collects first-party event data without PII. " +
    "Session identifiers are anonymous. User-level reporting would require " +
    "PII collection and a data processing model that is outside the platform's " +
    "privacy architecture.",
  salesGuidance:
    "Hard no. The framing is: 'The platform is privacy-first by design — we " +
    "don't collect or store personally identifiable information in the event " +
    "stream. Visitor history is anonymous. This is a feature, not a limitation " +
    "— it means no consent overhead and no GDPR exposure for our tracking.'",
};

// ─── Analytics ────────────────────────────────────────────────────────────────

const ANALYTICS_FIRST_PARTY_TRACKING: ScopeItem = {
  id: "analytics-first-party-tracking",
  category: "in_product",
  domain: "analytics",
  label: "First-Party Event Tracking",
  description:
    "Server-side recording of page views, CTA click events, and session " +
    "patterns to the platform's first-party data store — no third-party " +
    "cookies, no consent dependency.",
  boundary:
    "Includes: standard event types (page_view, cta_click, session_start). " +
    "Does not include: custom event types beyond the standard schema, or " +
    "client-side events requiring browser JavaScript instrumentation.",
  relatedCapabilityIds: ["visitor-history"],
  salesGuidance:
    "Always included. Emphasise the privacy angle: 'It's all first-party, " +
    "server-side, with no PII — so no cookie banners, no consent walls, " +
    "no GDPR exposure on the tracking layer.'",
};

const ANALYTICS_EVENT_SCHEMA_EXTENSION: ScopeItem = {
  id: "analytics-event-schema-extension",
  category: "custom_work",
  domain: "analytics",
  label: "Custom Event Schema Extension",
  description:
    "Adding new event types to the platform's tracking schema — beyond the " +
    "standard page_view, cta_click, and session_start events. For example: " +
    "scroll depth milestones, video play events, or custom funnel steps.",
  boundary:
    "Not in standard scope. The event schema is typed and validated. Adding " +
    "new event types requires schema changes, validation updates, and " +
    "potentially new analytics queries — a scoped engineering task.",
  customRisk: "low",
  requiresSeparateQuote: false,
  estimatedAdditionalScope: "0.5–2 engineering days per new event type",
  salesGuidance:
    "Ask what additional events the client needs and why. Confirm they're " +
    "not already covered by the standard event types before scoping an " +
    "extension.",
};

const ANALYTICS_GA4_PASSTHROUGH: ScopeItem = {
  id: "analytics-ga4-passthrough",
  category: "custom_work",
  domain: "analytics",
  label: "GA4 Event Passthrough",
  description:
    "Forwarding MC-tracked events (variant selections, CTA clicks) to GA4 " +
    "as custom events, so clients can cross-reference platform performance " +
    "against their GA4 analytics.",
  boundary:
    "Not in standard scope. Requires client-side event forwarding using the " +
    "GA4 Measurement Protocol or a GTM dataLayer push — a JavaScript " +
    "integration maintained separately from the platform.",
  customRisk: "low",
  requiresSeparateQuote: false,
  estimatedAdditionalScope: "0.5–1 engineering day for standard GA4 event forwarding",
  salesGuidance:
    "Common request from clients with an existing GA4 setup. It's quick to " +
    "implement. Ask: 'Which events do you want to see in GA4?' " +
    "Scope it as a light add-on, not a standard delivery item.",
};

const ANALYTICS_THIRD_PARTY_PIXELS: ScopeItem = {
  id: "analytics-third-party-pixels",
  category: "unsupported",
  domain: "analytics",
  label: "Third-Party Pixel Injection into Variants",
  description:
    "Injecting third-party tracking pixels, scripts, or beacons directly " +
    "into variant content — for example, firing a Meta Pixel event or a " +
    "LinkedIn Insight Tag on variant impression.",
  boundary:
    "Unsupported. Variant content is server-rendered and delivered as " +
    "React component output. Third-party script injection into variant " +
    "content is not supported and would create security, performance, " +
    "and consent compliance risks.",
  salesGuidance:
    "The framing is: 'We don't inject third-party scripts into variant " +
    "content — that creates security and performance risks we can't control. " +
    "If you need conversion tracking for specific variants, we can pass the " +
    "data to your analytics layer through a supported route.'",
  alternativePath:
    "Use GA4 event passthrough or n8n dispatch to notify external platforms " +
    "of variant conversion events after the fact.",
};

// ─── Content ──────────────────────────────────────────────────────────────────

const CONTENT_VARIANT_CONTENT_BRIEF: ScopeItem = {
  id: "content-variant-content-brief",
  category: "in_implementation",
  domain: "content",
  label: "Variant Content Brief",
  description:
    "A written brief for each variant slot telling the client what to produce — " +
    "message direction, tone guidance, CTA instruction, and format requirements.",
  boundary:
    "Included in all onboarding engagements. Produces a brief; does not " +
    "produce the actual copy. The client produces variant content against " +
    "the brief. MC reviews and uploads when content review is in scope.",
  salesGuidance:
    "Always included. This is one of the highest-value onboarding deliverables " +
    "— clients who receive a good brief produce better variants and see better " +
    "performance faster.",
  deliveryGuidance:
    "Deliver the brief before any content production starts. Never upload " +
    "content that doesn't match the brief.",
};

const CONTENT_REVIEW_AND_UPLOAD: ScopeItem = {
  id: "content-review-and-upload",
  category: "in_implementation",
  domain: "content",
  label: "Variant Content Review and CMS Upload",
  description:
    "MC reviewing the client's submitted variant content against the brief " +
    "and uploading approved content to the CMS.",
  boundary:
    "Included in Growth and Scale onboarding. Not included in Start or " +
    "light setup. Content must match the brief before upload — off-brief " +
    "content is returned for revision.",
  packageMinimum: "growth",
  salesGuidance:
    "Included with managed onboarding (Growth and Scale). For Start clients, " +
    "content review is their responsibility — make this clear so they're " +
    "not surprised when MC doesn't review and upload for them.",
};

const CONTENT_FULL_COPYWRITING: ScopeItem = {
  id: "content-full-copywriting",
  category: "custom_work",
  domain: "content",
  label: "Full Variant Copywriting Service",
  description:
    "MC writing the variant copy itself — not just briefing the client, but " +
    "producing the hero headlines, proof points, and CTA text for all slots.",
  boundary:
    "Not in standard scope. The platform brief and review process assumes the " +
    "client produces variant copy. Full copywriting is a content engagement " +
    "that must be scoped and priced as an additional service.",
  customRisk: "low",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "Typically 1–3 days depending on slot count and variant count",
  salesGuidance:
    "If the client has no content resource: 'We can write the variant copy " +
    "for you as an additional engagement — typically a day or two of content " +
    "strategy work. It's outside the standard onboarding scope but it's " +
    "something we can quote separately.' Don't agree to write copy inside " +
    "the standard fee.",
};

const CONTENT_BRAND_IDENTITY_DESIGN: ScopeItem = {
  id: "content-brand-identity-design",
  category: "unsupported",
  domain: "content",
  label: "Brand Identity or Visual Design",
  description:
    "Creating logos, brand guidelines, visual identity, illustration, or " +
    "photography for use in variant content.",
  boundary:
    "Unsupported. MC is not a design or brand agency. Visual assets must be " +
    "provided by the client or a third-party design resource.",
  salesGuidance:
    "The framing is: 'We configure and brief; the creative assets come from " +
    "you or your designer. If you don't have a designer, we can recommend " +
    "someone, but brand design isn't something we do.'",
  alternativePath:
    "If the client needs light visual work (resizing, format conversion), " +
    "that is typically manageable informally. Full brand creation is not MC scope.",
};

// ─── Infrastructure ───────────────────────────────────────────────────────────

const INFRASTRUCTURE_STANDARD_SLA: ScopeItem = {
  id: "infrastructure-standard-sla",
  category: "in_product",
  domain: "infrastructure",
  label: "Standard Platform SLA",
  description:
    "The standard availability, response time, and support commitments " +
    "included with all platform subscriptions.",
  boundary:
    "Includes: standard uptime targets, incident response, and support access " +
    "per the subscription agreement. Does not include: dedicated infrastructure, " +
    "enhanced SLA commitments, or white-glove incident management.",
  salesGuidance:
    "For most clients the standard SLA is sufficient. If a client asks " +
    "about uptime guarantees, refer to the subscription agreement terms. " +
    "If they need enhanced SLA, classify as infrastructure-sla-upgrade.",
};

const INFRASTRUCTURE_SLA_UPGRADE: ScopeItem = {
  id: "infrastructure-sla-upgrade",
  category: "custom_work",
  domain: "infrastructure",
  label: "Enhanced SLA / Dedicated Infrastructure",
  description:
    "Contractual uptime guarantees beyond the standard SLA, dedicated " +
    "infrastructure isolation, priority incident response, or custom " +
    "monitoring and alerting.",
  boundary:
    "Not in standard scope. Available as a custom commercial arrangement " +
    "for enterprise clients with specific uptime or isolation requirements.",
  customRisk: "low",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "Commercial arrangement; pricing depends on SLA level required",
  salesGuidance:
    "Rare requirement for the standard MC client profile. If raised, " +
    "escalate to MC leadership for commercial discussion — do not commit " +
    "to specific SLA numbers without leadership sign-off.",
};

const INFRASTRUCTURE_ON_PREMISE: ScopeItem = {
  id: "infrastructure-on-premise",
  category: "unsupported",
  domain: "infrastructure",
  label: "On-Premise or Client-Hosted Deployment",
  description:
    "Deploying the MC platform on the client's own infrastructure — their " +
    "cloud account, private data centre, or air-gapped environment.",
  boundary:
    "Unsupported. The platform is a cloud-hosted managed service. Source " +
    "code is not provided for self-hosting, and the deployment model is " +
    "not designed for client-managed infrastructure.",
  salesGuidance:
    "Hard no, but explain why: 'The platform is a managed service — we run " +
    "and maintain it for you. There's no self-hosted option. If data residency " +
    "is the concern, ask what specifically is driving that requirement — we " +
    "may be able to address it within the managed service model.'",
};

const INFRASTRUCTURE_WHITE_LABEL: ScopeItem = {
  id: "infrastructure-white-label",
  category: "custom_work",
  domain: "infrastructure",
  label: "White-Label Platform",
  description:
    "Rebranding the MC platform — removing MC branding from the dashboard, " +
    "reports, and client-facing materials and replacing it with the client's " +
    "or partner's own brand.",
  boundary:
    "Not in standard scope. White-labelling requires custom commercial " +
    "arrangement and technical configuration. Available for agency partners " +
    "or resellers as a separate engagement.",
  customRisk: "low",
  requiresSeparateQuote: true,
  estimatedAdditionalScope: "Commercial and technical arrangement; typically 1–2 weeks configuration",
  salesGuidance:
    "Only relevant for agency or reseller scenarios. Escalate to MC " +
    "leadership before quoting. Do not agree to white-label arrangements " +
    "without a signed reseller agreement.",
};

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE CATALOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete scope classification catalog — all defined scope items.
 *
 * Ordered by domain, then by category within each domain (in_product first,
 * then in_implementation, custom_work, unsupported last).
 *
 * This is the authoritative list of scope items. Every client-facing scope
 * decision should be traceable to an item in this catalog.
 */
export const SCOPE_CATALOG: readonly ScopeItem[] = [
  // CMS
  CMS_SUPPORTED_PROVIDERS,
  CMS_INITIAL_CONFIGURATION,
  CMS_VARIANT_KEY_STRUCTURE,
  CMS_UNSUPPORTED_PROVIDER,
  CMS_PROPRIETARY_HEADLESS,
  CMS_HARDCODED_HTML,
  // Frontend
  FRONTEND_BRAND_THEMING,
  FRONTEND_TENANT_THEME_SETUP,
  FRONTEND_CUSTOM_DESIGN_SYSTEM,
  FRONTEND_COMPONENT_LIBRARY_INTEGRATION,
  FRONTEND_FULL_REWRITE,
  // Decisioning
  DECISIONING_RULES_ENGINE,
  DECISIONING_AI_FALLBACK,
  DECISIONING_AB_EXPERIMENTS,
  DECISIONING_CUSTOM_RULE_DESIGN,
  DECISIONING_NON_STANDARD_LOGIC,
  DECISIONING_EXTERNAL_ML_MODEL,
  DECISIONING_CDP_INTEGRATION,
  // Integration
  INTEGRATION_N8N_DISPATCH,
  INTEGRATION_N8N_WORKFLOW_DESIGN,
  INTEGRATION_CRM_FIELD_MAPPING,
  INTEGRATION_CUSTOM_CRM_API,
  INTEGRATION_BI_TOOL_EXPORT,
  INTEGRATION_REALTIME_BIDIRECTIONAL_SYNC,
  INTEGRATION_THIRD_PARTY_TAG_MANAGER,
  // Reporting
  REPORTING_PLATFORM_DASHBOARD,
  REPORTING_MONTHLY_REPORT,
  REPORTING_CUSTOM_DASHBOARD,
  REPORTING_BI_PLATFORM_INTEGRATION,
  REPORTING_PII_USER_LEVEL,
  // Analytics
  ANALYTICS_FIRST_PARTY_TRACKING,
  ANALYTICS_EVENT_SCHEMA_EXTENSION,
  ANALYTICS_GA4_PASSTHROUGH,
  ANALYTICS_THIRD_PARTY_PIXELS,
  // Content
  CONTENT_VARIANT_CONTENT_BRIEF,
  CONTENT_REVIEW_AND_UPLOAD,
  CONTENT_FULL_COPYWRITING,
  CONTENT_BRAND_IDENTITY_DESIGN,
  // Infrastructure
  INFRASTRUCTURE_STANDARD_SLA,
  INFRASTRUCTURE_SLA_UPGRADE,
  INFRASTRUCTURE_ON_PREMISE,
  INFRASTRUCTURE_WHITE_LABEL,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all scope items in the given category.
 *
 * @example
 *   const blockers = getScopeByCategory("unsupported");
 *   const deliverables = getScopeByCategory("in_product");
 */
export function getScopeByCategory(category: ScopeCategory): readonly ScopeItem[] {
  return SCOPE_CATALOG.filter((item) => item.category === category);
}

/**
 * Returns all scope items in the given domain.
 *
 * @example
 *   const cmsItems = getScopeByDomain("cms");
 */
export function getScopeByDomain(domain: ScopeDomain): readonly ScopeItem[] {
  return SCOPE_CATALOG.filter((item) => item.domain === domain);
}

/**
 * Returns a specific scope item by ID.
 *
 * @example
 *   const item = getScopeItem("cms-unsupported-provider");
 */
export function getScopeItem(id: ScopeItemId): ScopeItem | undefined {
  return SCOPE_CATALOG.find((item) => item.id === id);
}

/**
 * Returns all scope items related to a given capability.
 *
 * Useful for answering "what are the scope implications of capability X?"
 *
 * @example
 *   const items = getScopeForCapability("ai-decisioning");
 */
export function getScopeForCapability(capId: CapabilityId): readonly ScopeItem[] {
  return SCOPE_CATALOG.filter((item) =>
    (item.relatedCapabilityIds as readonly string[] | undefined)?.includes(capId),
  );
}

/**
 * Returns all scope items related to a given product module.
 *
 * @example
 *   const items = getScopeForModule("adaptive-follow-up");
 */
export function getScopeForModule(moduleId: ProductModuleId): readonly ScopeItem[] {
  return SCOPE_CATALOG.filter((item) =>
    (item.relatedModuleIds as readonly string[] | undefined)?.includes(moduleId),
  );
}

/**
 * Returns all custom_work items requiring a separate quote.
 * Used by account managers to identify items that must not be folded into
 * an existing engagement.
 *
 * @example
 *   const separate = getCustomWorkRequiringQuote();
 */
export function getCustomWorkRequiringQuote(): readonly ScopeItem[] {
  return SCOPE_CATALOG.filter(
    (item) => item.category === "custom_work" && item.requiresSeparateQuote === true,
  );
}

/**
 * Returns all custom_work items at the given risk level.
 *
 * @example
 *   const highRisk = getCustomWorkByRisk("high");
 */
export function getCustomWorkByRisk(risk: CustomWorkRisk): readonly ScopeItem[] {
  return SCOPE_CATALOG.filter(
    (item) => item.category === "custom_work" && item.customRisk === risk,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUALIFICATION CHECKLIST BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A qualification question paired with the scope item it relates to.
 *
 * Account managers use these during discovery to identify scope risks before
 * they become delivery problems.
 */
export interface ScopeQualificationQuestion {
  /** The discovery question to ask. */
  question: string;

  /** Which scope item this question is designed to surface. */
  scopeItemId: ScopeItemId;

  /**
   * What answer should trigger a scope flag.
   * If the client's answer matches this pattern, the scope item is in play.
   */
  flagTrigger: string;
}

/**
 * The standard qualification questions for sales discovery.
 *
 * These are ordered by how often the underlying scope risk appears in practice.
 * AMs should ask all of these in the first discovery call.
 */
export const QUALIFICATION_QUESTIONS: readonly ScopeQualificationQuestion[] = [
  {
    question: "Which CMS are you using today?",
    scopeItemId: "cms-unsupported-provider",
    flagTrigger: "Any CMS not in: Sanity, Storyblok, Statamic",
  },
  {
    question: "Do you have a CMS at all, or is your site managed in code?",
    scopeItemId: "cms-hardcoded-html",
    flagTrigger: "Content is edited by deploying code; no CMS API exists",
  },
  {
    question:
      "Are you expecting to use your own design system or component library on this project?",
    scopeItemId: "frontend-custom-design-system",
    flagTrigger: "Client expects their own components, not styled platform defaults",
  },
  {
    question: "Do you need to target visitors based on their geography, company, or industry?",
    scopeItemId: "decisioning-non-standard-logic",
    flagTrigger: "Yes — requires data not in the session context",
  },
  {
    question: "Do you have a CDP (Segment, Amplitude, mParticle) that you want to use here?",
    scopeItemId: "decisioning-cdp-integration",
    flagTrigger: "Yes — and they want it to influence which variant is served",
  },
  {
    question: "How do you want contact submissions to reach your CRM?",
    scopeItemId: "integration-custom-crm-api",
    flagTrigger: "Direct API integration bypassing n8n",
  },
  {
    question: "Do you have a BI platform (Looker, Tableau, Power BI) you'd want MC data in?",
    scopeItemId: "integration-bi-tool-export",
    flagTrigger: "Yes — they want a data pipeline to their BI tool",
  },
  {
    question: "Do you have specific reporting requirements beyond the platform dashboard?",
    scopeItemId: "reporting-custom-dashboard",
    flagTrigger: "Custom dashboard, white-labelled reports, or individual-level user tracking",
  },
  {
    question: "Is your site hosted on your own infrastructure, or do you need a private deployment?",
    scopeItemId: "infrastructure-on-premise",
    flagTrigger: "Client-hosted, on-premise, or air-gapped requirement",
  },
  {
    question: "Do you have a team that will produce variant copy, or will you need us to write it?",
    scopeItemId: "content-full-copywriting",
    flagTrigger: "Client has no copywriting resource and expects MC to produce copy",
  },
];

/**
 * Runs a simple scope risk assessment given a set of flagged scope item IDs.
 *
 * Returns the flagged items partitioned by category, so an account manager
 * can quickly see what is in_implementation scope, what needs a custom quote,
 * and what are hard blockers.
 *
 * @param flaggedIds  Scope item IDs identified as relevant during discovery.
 *
 * @example
 *   const assessment = assessScopeRisk([
 *     "cms-unsupported-provider",
 *     "decisioning-non-standard-logic",
 *   ]);
 *   // → { blockers: [...], customQuoteRequired: [...], implementationScope: [...] }
 */
export function assessScopeRisk(flaggedIds: readonly ScopeItemId[]): {
  blockers:              readonly ScopeItem[];
  customQuoteRequired:   readonly ScopeItem[];
  implementationScope:   readonly ScopeItem[];
  inProduct:             readonly ScopeItem[];
} {
  const flagged = flaggedIds
    .map((id) => getScopeItem(id))
    .filter((item): item is ScopeItem => item !== undefined);

  return {
    blockers: flagged.filter(
      (item) => item.category === "unsupported",
    ),
    customQuoteRequired: flagged.filter(
      (item) => item.category === "custom_work" && item.requiresSeparateQuote === true,
    ),
    implementationScope: flagged.filter(
      (item) =>
        item.category === "in_implementation" ||
        (item.category === "custom_work" && !item.requiresSeparateQuote),
    ),
    inProduct: flagged.filter(
      (item) => item.category === "in_product",
    ),
  };
}
