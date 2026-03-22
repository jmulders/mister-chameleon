/**
 * Pricing Package Tiers
 *
 * The commercial packaging layer for Mister Chameleon.
 *
 * ─── Two-layer model ──────────────────────────────────────────────────────────
 *
 *   Product layer   (product/module-registry.ts)
 *   Defines the capability architecture of each tier: which modules are active,
 *   which capabilities are unlocked, how they map to use case tiers.
 *   IDs: "essential" | "growth" | "scale"
 *
 *   Commercial layer  (pricing/packages.ts  ← YOU ARE HERE)
 *   Defines the commercial proposition of each tier: pricing references,
 *   support levels, page types, onboarding scope, and positioning.
 *   IDs: "start" | "growth" | "scale"
 *
 *   The two layers connect via PricingPackage.packageId → PackageDefinition.id.
 *   The commercial "start" tier maps to the product "essential" package.
 *   "growth" and "scale" align by name across both layers.
 *
 * ─── Three tiers ──────────────────────────────────────────────────────────────
 *
 *   Start      The entry point. Adaptive homepage, rules decisioning, contact
 *              enrichment, visitor history. One surface, proven to convert.
 *              Guided setup. Monthly optimisation optional add-on.
 *
 *   Growth     Extends Start with campaign landing pages, A/B experiment support,
 *              and the full analytics dashboard. For teams actively running paid
 *              campaigns or wanting data-driven variant iteration.
 *
 *   Scale      The full platform. AI-augmented decisioning, adaptive product and
 *              service pages, and the complete quarterly strategy cycle. For
 *              companies where personalisation is a growth programme, not a feature.
 *
 * ─── How tiers relate to the feature matrix ──────────────────────────────────
 *
 *   Each tier's capabilities come from the product layer (PackageDefinition).
 *   The commercial layer adds the "how it is sold" context to those capabilities:
 *
 *   PricingPackage.cmsSupportLevel      → how many CMSes, migration support
 *   PricingPackage.aiSupportLevel       → rules-only vs AI-augmented vs AI-primary
 *   PricingPackage.dashboardLevel       → what the client can see in the platform
 *   PricingPackage.reportingLevel       → what reports MC delivers
 *   PricingPackage.supportedPageTypes   → which adaptive page surfaces are live
 *   PricingPackage.onboarding           → scope and deliverables of onboarding
 *   PricingPackage.pricing              → which fees from pricing/model.ts apply
 *
 *   The `buildPackageFeatureMatrix()` helper below assembles all of this into
 *   a display-ready structure for pricing page tables and proposal comparison.
 *
 * ─── What lives in the product layer vs here ────────────────────────────────
 *
 *   Product layer (module-registry.ts)       Commercial layer (this file)
 *   ─────────────────────────────────────    ─────────────────────────────────
 *   Which capabilities are included          How those capabilities are scoped
 *   Which modules must be active             What support level each brings
 *   Capability-to-tier alignment             Pricing references and fee IDs
 *   Feature flag generation                  Onboarding scope and deliverables
 *   Upgrade diff computation                 Ideal client profile copy
 *   Capability matrix (true/false)           Commercial matrix (label/note)
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   product/module-registry.ts  → PackageId, PackageDefinition, PACKAGE_REGISTRY
 *   pricing/types.ts            → fee types, PricingConfig, MonetaryAmount
 *   pricing/model.ts            → fee instances, STANDARD_PRICING_MODEL
 *   pricing/packages.ts         ← YOU ARE HERE
 *   pricing/index.ts            → barrel re-export
 */

import type { PackageId }       from "@/product/module-registry";
import type { ProductModuleId } from "@/product/types";
import type { CapabilityId }    from "@/product/features";

import type {
  SetupFeeId,
  ModuleFeeId,
  ServiceFeeId,
  OptimizationFeeId,
  MonetaryAmount,
  PricingConfig,
} from "./types";

import {
  STANDARD_PRICING_MODEL,
  PLATFORM_BASE,
  MODULE_ADAPTIVE_WEBSITE,
  MODULE_ADAPTIVE_LANDING_PAGES,
  MODULE_ADAPTIVE_FOLLOW_UP,
  MODULE_CONTEXT_INTELLIGENCE,
  SETUP_STANDARD,
  SETUP_ACCELERATED,
  formatPrice,
} from "./model";

import { PACKAGE_REGISTRY } from "@/product/module-registry";

// ─────────────────────────────────────────────────────────────────────────────
// COMMERCIAL TIER IDENTIFIER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for the three commercial package tiers.
 *
 * These are the IDs used in proposals, sales tooling, and pricing pages.
 * They map to the product-layer PackageId via PricingPackage.packageId.
 *
 *   start  →  "essential"   Core platform. One surface, rules decisioning.
 *   growth →  "growth"      Adds campaigns, experiments, analytics.
 *   scale  →  "scale"       AI decisioning, product pages, full programme.
 */
export type CommercialTierId = "start" | "growth" | "scale";

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT LEVEL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The scope of CMS integration supported in a given package tier.
 *
 * single       One CMS provider. Client chooses at onboarding; switching
 *              requires re-configuration. Suitable for teams already committed
 *              to one provider.
 *
 * multi        Any supported CMS provider — Sanity, Storyblok, Statamic, or
 *              the built-in mock. Provider selected at tenant config time;
 *              switching is a configuration change, not a migration.
 *
 * multi-plus-migration   Same as multi, plus MC will assist with migrating
 *                        existing CMS content into the variant key structure
 *                        during onboarding.
 */
export type CmsSupportLevel =
  | "single"
  | "multi"
  | "multi-plus-migration";

/**
 * How the decisioning engine operates in a given package tier.
 *
 * rules-only        The rules engine evaluates visitor source and history.
 *                   No AI component. Predictable, zero-latency, no LLM cost.
 *
 * rules-with-ai-fallback  The rules engine handles standard cases; the AI
 *                   decision provider activates when confidence falls below
 *                   the configured threshold. AI is an enhancement, not the
 *                   primary mechanism.
 *
 * ai-primary        AI evaluates every request; the rules engine serves as a
 *                   fallback when AI is unavailable. The full capability of
 *                   the decisioning layer, with maximum personalisation depth.
 */
export type AiSupportLevel =
  | "rules-only"
  | "rules-with-ai-fallback"
  | "ai-primary";

/**
 * What the client can see and do in the platform dashboard.
 *
 * basic         Session volume, variant selection counts, and basic event log.
 *               Read-only. Enough to confirm the platform is running.
 *
 * standard      Full variant analytics: per-variant CTR, source breakdown,
 *               serve-share trends, and the reporting preview. Sufficient for
 *               monthly self-managed reviews.
 *
 * advanced      All standard views plus decision audit trail, rule configuration
 *               editor, experiment management, and the content status dashboard.
 *               The full internal toolset.
 */
export type DashboardLevel = "basic" | "standard" | "advanced";

/**
 * The reporting and delivery scope included with a package.
 *
 * data-only         Platform data accessible; no MC-produced reports.
 *                   Clients self-serve from the dashboard.
 *
 * monthly           MC produces and delivers the 6-section monthly performance
 *                   report. Includes the managed review session.
 *
 * monthly-quarterly Monthly report + quarterly strategy review (QBR).
 *                   The full operating model delivered as a service.
 */
export type ReportingLevel =
  | "data-only"
  | "monthly"
  | "monthly-quarterly";

/**
 * Supported adaptive page surfaces included in a tier.
 *
 * homepage          The primary adaptive surface — homepage hero, proof, CTA.
 * landing-pages     Campaign landing pages with UTM-driven variant selection.
 * product-pages     Product and service detail pages (planned capability).
 */
export type SupportedPageType =
  | "homepage"
  | "landing-pages"
  | "product-pages";

/**
 * The scope and delivery style of the onboarding engagement.
 *
 * guided       MC leads setup: configuration, rule design, and go-live.
 *              Client provides content. Typical timeline 2–3 weeks.
 *
 * managed      MC leads setup AND content strategy. Includes variant brief,
 *              messaging guidance, and content review before launch.
 *              Typical timeline 3–4 weeks.
 *
 * accelerated  Compressed managed onboarding (5-day sprint). Requires
 *              client to be fully available throughout. Premium fee.
 */
export type OnboardingScope = "guided" | "managed" | "accelerated";

// ─────────────────────────────────────────────────────────────────────────────
// PACKAGE ONBOARDING DESCRIPTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Describes the onboarding engagement included with a pricing package.
 *
 * This is the structured version of what is described in prose in the
 * package's description — specific enough for internal scoping, commercial
 * enough for a proposal.
 */
export interface PackageOnboarding {
  /** Delivery model for the onboarding engagement. */
  scope: OnboardingScope;

  /** Indicative wall-clock time from contract sign to platform go-live. */
  estimatedTimeline: string;

  /**
   * Whether MC produces a variant content brief as part of onboarding.
   * When true, the client receives written guidance on what to produce
   * before variant content can be uploaded.
   */
  includesContentBrief: boolean;

  /**
   * Whether a strategy session (ICP mapping, messaging hierarchy) is
   * included in the onboarding engagement.
   */
  includesStrategySession: boolean;

  /**
   * Whether MC reviews the client's submitted variant content before upload,
   * confirming it meets the brief's quality bar.
   */
  includesContentReview: boolean;

  /**
   * The setup fee that funds this onboarding scope.
   * References a SetupFeeId from pricing/model.ts.
   */
  setupFeeId: SetupFeeId;

  /**
   * What the client receives at the end of the onboarding engagement.
   * Concrete, specific deliverables — not aspirational outcomes.
   */
  deliverables: readonly string[];

  /**
   * What the client needs to provide or have ready for onboarding to succeed.
   * Written as a pre-qualification checklist for the sales process.
   */
  clientPrerequisites: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PACKAGE PRICING REFERENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fee selections and indicative pricing for a package tier.
 *
 * PackagePricingRef is a template — not a client-specific PricingConfig.
 * It defines which fees from the model apply to this tier and provides
 * display-ready indicative pricing for proposals and pricing pages.
 *
 * To produce a client-specific PricingConfig from this, use:
 *   buildConfigFromPackage(tierId, clientId)
 */
export interface PackagePricingRef {
  /**
   * The setup fee for this tier.
   * References a SetupFeeId defined in pricing/model.ts.
   */
  setupFeeId: SetupFeeId;

  /**
   * The module fees included in this tier.
   * These are the per-module recurring fees on top of the platform base.
   */
  moduleFeeIds: readonly ModuleFeeId[];

  /**
   * Service fees typically included or recommended for this tier.
   * For some tiers these are bundled (included in onboarding);
   * for others they are recommended add-ons.
   */
  recommendedServiceFeeIds: readonly ServiceFeeId[];

  /**
   * The optimisation retainer add-on recommended for this tier.
   * Optional — clients may self-manage reviews without the retainer.
   */
  recommendedOptimizationFeeId?: OptimizationFeeId;

  /**
   * Indicative monthly recurring total for display purposes.
   * Computed from platform fee + module fees at list price.
   * Does not include setup, service, or optimisation fees.
   *
   * Displayed as "from £X/month" on pricing pages and proposals.
   */
  monthlyFromAmount: MonetaryAmount;

  /**
   * Indicative one-time setup total for display purposes.
   * Reflects the list price of the selected setupFeeId.
   */
  oneTimeFromAmount: MonetaryAmount;

  /**
   * Optional note on pricing for account managers.
   * Examples: "annual commitment saves ~2 months", "module fee often bundled"
   */
  pricingNote?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING PACKAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A commercial package tier — the complete commercial description of what
 * a client receives at this tier, how it is scoped, and how it is priced.
 *
 * PricingPackage is the union of:
 *   - Commercial positioning (name, tagline, ideal client)
 *   - Product references     (packageId → product/module-registry.ts)
 *   - Support levels         (AI, CMS, dashboard, reporting)
 *   - Page surface scope     (which adaptive pages are included)
 *   - Onboarding descriptor  (what MC delivers to get them live)
 *   - Pricing references     (which fees from pricing/model.ts apply)
 */
export interface PricingPackage {
  /**
   * Commercial tier identifier.
   * Used in proposals, pricing pages, and sales tooling.
   */
  id: CommercialTierId;

  /**
   * Commercial display name.
   * Examples: "Start", "Growth", "Scale"
   */
  name: string;

  /**
   * Single-sentence value proposition for a pricing page headline.
   * Answers: "Why does this tier exist?" for a buyer.
   */
  tagline: string;

  /**
   * 2–3 sentence description for a pricing page card or proposal.
   * Written for a non-technical buyer. Focuses on outcome, not feature list.
   */
  description: string;

  // ── Product layer connection ──────────────────────────────────────────────

  /**
   * The product-layer PackageId this commercial tier maps to.
   * Use PACKAGE_REGISTRY[packageId] to access capability lists and module sets.
   */
  packageId: PackageId;

  /**
   * The product modules active in this tier.
   * Mirrors PackageDefinition.modules — duplicated here for ergonomic access
   * without requiring a product-layer import on every consumer.
   */
  includedModules: readonly ProductModuleId[];

  // ── Page surfaces ─────────────────────────────────────────────────────────

  /**
   * The adaptive page surfaces included in this tier.
   *
   * Note: "product-pages" is a planned capability. Including it in the
   * Scale tier definition is intentional — it signals where the roadmap
   * is heading and can be used in "coming soon" pricing table rows.
   */
  supportedPageTypes: readonly SupportedPageType[];

  /**
   * Capabilities that are planned (not yet available) in this tier.
   * Surfaces in the capability matrix as "coming soon" rather than a
   * checkmark or a cross.
   */
  plannedCapabilities?: readonly CapabilityId[];

  // ── Support levels ────────────────────────────────────────────────────────

  /** How many CMSes are supported and whether migration assistance is included. */
  cmsSupportLevel: CmsSupportLevel;

  /** How the decisioning engine operates at this tier. */
  aiSupportLevel: AiSupportLevel;

  /** What the client can see and interact with in the dashboard. */
  dashboardLevel: DashboardLevel;

  /**
   * The reporting scope MC delivers to this client.
   * "data-only" = client self-serves; "monthly" = MC produces monthly report;
   * "monthly-quarterly" = monthly + QBR.
   */
  reportingLevel: ReportingLevel;

  /**
   * Maximum number of active variant slots per page type.
   * A variant slot is a single adaptive region (e.g. hero, proof, CTA).
   * null = unlimited (or not meaningfully bounded at this tier).
   */
  variantSlotsPerPage: number | null;

  // ── Onboarding ────────────────────────────────────────────────────────────

  /** Full description of the onboarding engagement included with this tier. */
  onboarding: PackageOnboarding;

  // ── Pricing ───────────────────────────────────────────────────────────────

  /** Fee references and indicative pricing for this tier. */
  pricing: PackagePricingRef;

  // ── Commercial positioning ────────────────────────────────────────────────

  /**
   * Who this tier is designed for.
   * 1–2 sentences. Written as a client-facing "is this you?" statement.
   */
  idealFor: string;

  /**
   * Who should consider the next tier instead.
   * Prevents over-selling by being honest about tier limits.
   * Omit for the highest tier.
   */
  notSuitableFor?: string;

  /**
   * The next commercial tier in the upgrade path.
   * Used in pricing tables for "upgrade to unlock" messaging.
   */
  upgradesTo?: CommercialTierId;

  /**
   * Internal notes for account managers scoping this package.
   * Not shown in client-facing materials.
   */
  accountManagerNotes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PACKAGE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the indicative "from" monthly price for a set of module fee IDs.
 *
 * Platform base + selected modules at list price, in minor currency units.
 * Used to populate PackagePricingRef.monthlyFromAmount.
 */
function computeMonthlyFrom(moduleFeeIds: readonly ModuleFeeId[]): number {
  const platformBase = PLATFORM_BASE.band?.list ?? 0;
  const modulesTotal = moduleFeeIds.reduce((sum, id) => {
    const fee = STANDARD_PRICING_MODEL.moduleFees.find((f) => f.id === id);
    return sum + (fee?.band?.list ?? 0);
  }, 0);
  return platformBase + modulesTotal;
}

// ── START ─────────────────────────────────────────────────────────────────────

const START_MODULE_FEES: readonly ModuleFeeId[] = [
  "module-adaptive-website",
  "module-adaptive-follow-up",
  "module-context-intelligence",
];

export const START_PACKAGE: PricingPackage = {
  id: "start",
  name: "Start",
  tagline: "Adaptive homepage and enriched contact pipeline, live in under two weeks.",
  description:
    "The proven entry point into personalised web performance. Your homepage " +
    "adapts its message to every visitor's source and history from day one. " +
    "Every contact submission arrives enriched with attribution context ready " +
    "for your CRM. One adaptive surface. Rules-based decisioning. No AI cost.",

  packageId: "essential",
  includedModules: [
    "adaptive-website",
    "adaptive-follow-up",
    "context-intelligence",
  ],

  supportedPageTypes: ["homepage"],
  plannedCapabilities: [],

  cmsSupportLevel: "multi",
  aiSupportLevel: "rules-only",
  dashboardLevel: "standard",
  reportingLevel: "data-only",
  variantSlotsPerPage: 3,

  onboarding: {
    scope: "guided",
    estimatedTimeline: "2–3 weeks",
    includesContentBrief: true,
    includesStrategySession: false,
    includesContentReview: false,
    setupFeeId: "setup-standard",
    deliverables: [
      "Platform account and tenant configuration",
      "Context rule design (source, device, and history rules)",
      "Variant slot structure with initial content keys",
      "Tracking script installation and event verification",
      "Variant content brief (hero, proof, CTA — client produces copy)",
      "Go-live checklist sign-off and 30-day post-launch check-in",
    ],
    clientPrerequisites: [
      "Developer access to install the tracking script on the site",
      "CMS provider chosen and credentials available",
      "Initial variant copy produced or in progress before go-live",
      "Marketing contact available for 2 × 1-hour calls during onboarding",
    ],
  },

  pricing: {
    setupFeeId: "setup-standard",
    moduleFeeIds: START_MODULE_FEES,
    recommendedServiceFeeIds: [],
    recommendedOptimizationFeeId: "optimization-monthly",
    monthlyFromAmount: {
      amount: computeMonthlyFrom(START_MODULE_FEES),
      currency: "GBP",
    },
    oneTimeFromAmount: {
      amount: SETUP_STANDARD.band?.list ?? 0,
      currency: "GBP",
    },
    pricingNote:
      "Module fees for Adaptive Website and Follow-up are often presented " +
      "as a single bundled platform fee on proposals for clarity. " +
      "Monthly optimisation retainer (£750/month, 3-month minimum) is " +
      "strongly recommended — it drives the ongoing variant improvements " +
      "that justify the platform investment.",
  },

  idealFor:
    "B2B companies with a meaningful inbound traffic mix who want their homepage " +
    "to convert better across all their sources without a custom development project.",
  notSuitableFor:
    "Teams running active paid campaigns who need per-campaign landing page " +
    "control — consider Growth. Companies needing AI-driven personalisation " +
    "depth from day one — consider Scale.",
  upgradesTo: "growth",
  accountManagerNotes:
    "The primary conversion from Start to Growth is typically triggered by a " +
    "client starting paid campaigns and wanting dedicated landing pages. " +
    "Plant the seed early: 'When you start running ads, we can add campaign " +
    "landing pages as the next module.' This creates a natural upgrade moment " +
    "rather than a sales conversation.",
};

// ── GROWTH ────────────────────────────────────────────────────────────────────

const GROWTH_MODULE_FEES: readonly ModuleFeeId[] = [
  "module-adaptive-website",
  "module-adaptive-landing-pages",
  "module-adaptive-follow-up",
  "module-context-intelligence",
];

export const GROWTH_PACKAGE: PricingPackage = {
  id: "growth",
  name: "Growth",
  tagline: "Everything in Start, plus campaign landing pages and data-driven variant testing.",
  description:
    "Built for teams actively running paid or organic campaigns who need more " +
    "than a single adaptive surface. Campaign landing pages adapt per audience. " +
    "A/B experiment support turns variant hunches into evidence. The full " +
    "analytics dashboard shows what's working, week over week.",

  packageId: "growth",
  includedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
    "adaptive-follow-up",
    "context-intelligence",
  ],

  supportedPageTypes: ["homepage", "landing-pages"],
  plannedCapabilities: ["dashboard-analytics"],

  cmsSupportLevel: "multi",
  aiSupportLevel: "rules-with-ai-fallback",
  dashboardLevel: "standard",
  reportingLevel: "monthly",
  variantSlotsPerPage: 5,

  onboarding: {
    scope: "managed",
    estimatedTimeline: "3–4 weeks",
    includesContentBrief: true,
    includesStrategySession: true,
    includesContentReview: true,
    setupFeeId: "setup-standard",
    deliverables: [
      "ICP and messaging hierarchy session (2 hours)",
      "Platform account and tenant configuration",
      "Context rule design for homepage and landing pages",
      "Variant slot structure across all active surfaces",
      "Tracking and event verification (homepage + landing pages)",
      "Variant content brief — per slot, per audience segment",
      "MC review of submitted variant content before upload",
      "Go-live sign-off, 30-day check-in, and first monthly review",
    ],
    clientPrerequisites: [
      "Developer access to install the tracking script on all relevant pages",
      "CMS provider chosen with at least one connected page template",
      "At least one paid or organic campaign running (or imminently launching)",
      "Marketing contact available for 3 × 1-hour sessions during onboarding",
      "Initial variant copy brief completed before the strategy session",
    ],
  },

  pricing: {
    setupFeeId: "setup-standard",
    moduleFeeIds: GROWTH_MODULE_FEES,
    recommendedServiceFeeIds: ["service-content-modeling"],
    recommendedOptimizationFeeId: "optimization-monthly",
    monthlyFromAmount: {
      amount: computeMonthlyFrom(GROWTH_MODULE_FEES),
      currency: "GBP",
    },
    oneTimeFromAmount: {
      amount: SETUP_STANDARD.band?.list ?? 0,
      currency: "GBP",
    },
    pricingNote:
      "Adaptive Landing Pages module (£250/month) activates when the module " +
      "ships — include in proposals as a near-term addition with an indicative " +
      "date. Content modelling engagement (£2,500 project) is strongly " +
      "recommended alongside Growth onboarding — most clients have not produced " +
      "segment-specific copy before and need structured guidance to populate " +
      "the variant matrix effectively.",
  },

  idealFor:
    "B2B growth teams running paid and organic campaigns who want every landing " +
    "page and homepage visit to work harder — with experiments to prove what works " +
    "and a monthly report to act on it.",
  notSuitableFor:
    "Companies needing AI-led decisioning or adaptive product/service page depth " +
    "beyond the homepage — consider Scale.",
  upgradesTo: "scale",
  accountManagerNotes:
    "The landing pages module is currently 'planned'. Position it to Growth " +
    "clients as the imminent next step: 'It's in our roadmap for this quarter — " +
    "we're building it for clients exactly like you.' Confirm internal ETA before " +
    "using this framing. The content modelling engagement is almost always worth " +
    "proposing here — Growth clients who skip it tend to under-populate their " +
    "variant matrix and plateau faster.",
};

// ── SCALE ─────────────────────────────────────────────────────────────────────

const SCALE_MODULE_FEES: readonly ModuleFeeId[] = [
  "module-adaptive-website",
  "module-adaptive-landing-pages",
  "module-adaptive-follow-up",
  "module-context-intelligence",
];

export const SCALE_PACKAGE: PricingPackage = {
  id: "scale",
  name: "Scale",
  tagline: "The full platform — AI decisioning, product pages, and a quarterly growth programme.",
  description:
    "For companies where personalisation is a strategic growth lever, not just " +
    "a homepage feature. AI-augmented decisioning handles the cases rules cannot. " +
    "Adaptive product and service pages extend personalisation across the full " +
    "conversion journey. Quarterly strategy reviews align the platform's output " +
    "with business direction at leadership level.",

  packageId: "scale",
  includedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
    "adaptive-follow-up",
    "context-intelligence",
  ],

  supportedPageTypes: ["homepage", "landing-pages", "product-pages"],
  plannedCapabilities: ["adaptive-product-page", "adaptive-landing-page", "dashboard-analytics"],

  cmsSupportLevel: "multi-plus-migration",
  aiSupportLevel: "ai-primary",
  dashboardLevel: "advanced",
  reportingLevel: "monthly-quarterly",
  variantSlotsPerPage: null,

  onboarding: {
    scope: "managed",
    estimatedTimeline: "3–5 weeks",
    includesContentBrief: true,
    includesStrategySession: true,
    includesContentReview: true,
    setupFeeId: "setup-standard",
    deliverables: [
      "ICP and messaging hierarchy workshop (2 hours with leadership)",
      "Platform account and tenant configuration",
      "AI decisioning configuration and confidence policy setup",
      "Context rule design across all active surfaces",
      "Variant slot structure for homepage, landing pages, and product pages",
      "Full tracking and event verification across all surfaces",
      "Variant content brief — per slot, per audience, per page type",
      "MC review and upload of approved variant content",
      "CMS content migration assistance (if existing structured content)",
      "Go-live sign-off, 30-day check-in, and first monthly + quarterly review scheduling",
    ],
    clientPrerequisites: [
      "Developer access across all relevant site pages and templates",
      "CMS provider confirmed with access credentials",
      "Existing CMS content inventory (if migration assistance requested)",
      "Active campaigns running or launching within 60 days of go-live",
      "Marketing lead and senior stakeholder available for onboarding sessions",
      "Commitment to the quarterly strategy review cadence at leadership level",
    ],
  },

  pricing: {
    setupFeeId: "setup-standard",
    moduleFeeIds: SCALE_MODULE_FEES,
    recommendedServiceFeeIds: [
      "service-content-modeling",
      "service-strategy-advisory",
    ],
    recommendedOptimizationFeeId: "optimization-quarterly",
    monthlyFromAmount: {
      amount: computeMonthlyFrom(SCALE_MODULE_FEES),
      currency: "GBP",
    },
    oneTimeFromAmount: {
      amount: SETUP_STANDARD.band?.list ?? 0,
      currency: "GBP",
    },
    pricingNote:
      "Scale clients typically include the quarterly optimisation retainer " +
      "(£1,200/month, 6-month minimum) rather than the monthly variant — the QBR " +
      "is where the platform's strategic value is clearest to leadership. " +
      "For urgent timelines, SETUP_ACCELERATED (£4,000) is the alternative to " +
      "the standard setup. Content modelling is strongly recommended as a launch " +
      "project — Scale clients have the most variant surface area and benefit most " +
      "from structured copy guidance.",
  },

  idealFor:
    "Companies where the website is a primary revenue channel, with an active " +
    "multi-channel demand programme and leadership prepared to use platform data " +
    "in strategic decision-making every quarter.",
  notSuitableFor: undefined,  // Highest tier — no upgrade path
  upgradesTo: undefined,
  accountManagerNotes:
    "Scale is a programme sale, not a feature sale. The conversation should " +
    "be about growth outcomes over a 6–12 month horizon, not about specific " +
    "capabilities. Anchor on: 'What does this platform need to deliver for you " +
    "to consider it a strategic success in 12 months?' Then show how the quarterly " +
    "review cycle connects platform data to that outcome. The price point only makes " +
    "sense if the client genuinely uses the QBR cadence — qualify for this before " +
    "proposing Scale.",
};

// ─────────────────────────────────────────────────────────────────────────────
// PACKAGE TIER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Index type for fast commercial tier lookup.
 */
export type PricingPackageRegistry = Readonly<Record<CommercialTierId, PricingPackage>>;

/**
 * All three commercial tiers, indexed by CommercialTierId.
 *
 * The authoritative source of truth for the commercial packaging layer.
 *
 * @example
 *   const tier = PRICING_PACKAGES["growth"];
 *   console.log(tier.name, tier.pricing.monthlyFromAmount);
 *
 *   // Iterate all tiers for a pricing comparison table:
 *   Object.values(PRICING_PACKAGES).map(t => ({
 *     name: t.name,
 *     from: formatPrice(t.pricing.monthlyFromAmount),
 *   }));
 */
export const PRICING_PACKAGES: PricingPackageRegistry = {
  start:  START_PACKAGE,
  growth: GROWTH_PACKAGE,
  scale:  SCALE_PACKAGE,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the PricingPackage for a given CommercialTierId.
 *
 * @example
 *   const pkg = getPackage("growth");
 */
export function getPackage(id: CommercialTierId): PricingPackage {
  return PRICING_PACKAGES[id];
}

/**
 * Returns the ordered list of tiers from lowest to highest.
 *
 * @example
 *   const tiers = getOrderedTiers();
 *   // → [START_PACKAGE, GROWTH_PACKAGE, SCALE_PACKAGE]
 */
export function getOrderedTiers(): readonly PricingPackage[] {
  return [START_PACKAGE, GROWTH_PACKAGE, SCALE_PACKAGE];
}

/**
 * Returns all tiers that include the given page type.
 *
 * @example
 *   const tiers = getTiersForPageType("landing-pages");
 *   // → [GROWTH_PACKAGE, SCALE_PACKAGE]
 */
export function getTiersForPageType(
  pageType: SupportedPageType,
): readonly PricingPackage[] {
  return getOrderedTiers().filter((t) =>
    (t.supportedPageTypes as readonly string[]).includes(pageType),
  );
}

/**
 * Returns the lowest tier that supports the given AI level.
 *
 * @example
 *   const min = getMinimumTierForAiLevel("ai-primary");
 *   // → SCALE_PACKAGE
 */
export function getMinimumTierForAiLevel(
  level: AiSupportLevel,
): PricingPackage | undefined {
  return getOrderedTiers().find((t) => t.aiSupportLevel === level);
}

/**
 * Returns the upgrade path from the given tier to the highest tier.
 * Returns an empty array if already at the highest tier.
 *
 * @example
 *   const path = getUpgradePath("start");
 *   // → [GROWTH_PACKAGE, SCALE_PACKAGE]
 */
export function getUpgradePath(id: CommercialTierId): readonly PricingPackage[] {
  const tiers = getOrderedTiers();
  const idx = tiers.findIndex((t) => t.id === id);
  return idx === -1 ? [] : tiers.slice(idx + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING CONFIG GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a PricingConfig template for a given tier.
 *
 * This is a starting point for proposal generation — the AM will review and
 * may apply price overrides or swap optional fee selections before finalising.
 *
 * The config uses the package's recommended fees as defaults. Optional fees
 * (recommended optimisation retainer, service fees) are included by default
 * because they represent the full-value engagement — the AM can remove them
 * if the client is not taking managed services.
 *
 * @param tierId         The commercial tier to generate a config for.
 * @param configId       A unique ID for this config (proposal slug or UUID).
 * @param scenarioLabel  Optional human-readable label for this scenario.
 *
 * @example
 *   const config = buildConfigFromTier("growth", "acme-corp-2024-03");
 *   const proposal = resolveProposal(config);
 *   console.log(formatPrice(proposal.monthlyRecurringTotal)); // £1,800.00
 */
export function buildConfigFromTier(
  tierId: CommercialTierId,
  configId: string,
  scenarioLabel?: string,
): PricingConfig {
  const pkg = PRICING_PACKAGES[tierId];
  const ref = pkg.pricing;

  return {
    id: configId,
    modelId: "standard",
    modelVersion: STANDARD_PRICING_MODEL.version,
    currency: "GBP",
    scenarioLabel: scenarioLabel ?? `${pkg.name} tier — ${configId}`,
    selectedSetupFeeId: ref.setupFeeId,
    selectedModuleFeeIds: ref.moduleFeeIds,
    selectedServiceFeeIds: ref.recommendedServiceFeeIds,
    selectedOptimizationFeeId: ref.recommendedOptimizationFeeId,
    priceOverrides: undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE MATRIX  (commercial display layer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single row in the commercial feature matrix.
 *
 * Each row represents one dimension of the commercial comparison.
 * The value per tier is a human-readable string (for display in a pricing
 * table) rather than a raw type value.
 */
export interface FeatureMatrixRow {
  /** The dimension being compared. */
  dimension: string;

  /**
   * Category for grouping rows in the comparison table.
   * Mirrors the CapabilityCategory taxonomy where applicable.
   */
  category:
    | "surfaces"
    | "decisioning"
    | "data"
    | "integration"
    | "reporting"
    | "onboarding"
    | "pricing";

  /** Value for the Start tier. */
  start: string;

  /** Value for the Growth tier. */
  growth: string;

  /** Value for the Scale tier. */
  scale: string;

  /**
   * Whether this row should be highlighted in the comparison table.
   * Used to draw attention to key differentiating dimensions.
   */
  highlight?: boolean;
}

/**
 * Builds the commercial feature matrix — the "compare plans" table.
 *
 * Returns one row per commercial dimension, with values for each tier.
 * Suitable for direct rendering in a pricing page React component.
 *
 * ─── How this relates to the product capability matrix ─────────────────────
 *
 *   buildCapabilityMatrix() in product/module-registry.ts returns a
 *   boolean grid of capability × package (true/false per cell).
 *
 *   buildPackageFeatureMatrix() (this function) returns a string grid
 *   of dimension × tier — the *commercial* language for the same
 *   underlying capability differences. Both are correct; they serve
 *   different audiences:
 *
 *     Capability matrix   →  Internal tooling, tenant provisioning
 *     Feature matrix      →  Pricing page, proposal comparison table
 *
 * @example
 *   const rows = buildPackageFeatureMatrix();
 *   rows.forEach(row =>
 *     console.log(row.dimension, row.start, row.growth, row.scale)
 *   );
 */
export function buildPackageFeatureMatrix(): readonly FeatureMatrixRow[] {
  return [
    // ── Surfaces ──────────────────────────────────────────────────────────────
    {
      dimension: "Adaptive Homepage",
      category: "surfaces",
      start: "✓  Hero, proof & CTA",
      growth: "✓  Hero, proof & CTA",
      scale: "✓  Hero, proof & CTA",
    },
    {
      dimension: "Campaign Landing Pages",
      category: "surfaces",
      start: "—",
      growth: "✓  UTM-matched per campaign",
      scale: "✓  UTM-matched per campaign",
      highlight: true,
    },
    {
      dimension: "Product / Service Pages",
      category: "surfaces",
      start: "—",
      growth: "—",
      scale: "Coming soon",
      highlight: true,
    },
    {
      dimension: "Variant slots per page",
      category: "surfaces",
      start: "Up to 3",
      growth: "Up to 5",
      scale: "Unlimited",
    },

    // ── Decisioning ───────────────────────────────────────────────────────────
    {
      dimension: "Rules-Based Decisioning",
      category: "decisioning",
      start: "✓  Source, device & history rules",
      growth: "✓  Source, device & history rules",
      scale: "✓  Source, device & history rules",
    },
    {
      dimension: "AI-Augmented Decisioning",
      category: "decisioning",
      start: "—",
      growth: "Optional add-on",
      scale: "✓  Confidence-gated, rules fallback",
      highlight: true,
    },
    {
      dimension: "A/B Experiment Support",
      category: "decisioning",
      start: "—",
      growth: "✓  Bucket assignment + readout",
      scale: "✓  Bucket assignment + readout",
      highlight: true,
    },

    // ── Data ──────────────────────────────────────────────────────────────────
    {
      dimension: "First-Party Visitor History",
      category: "data",
      start: "✓  Cross-session, no PII",
      growth: "✓  Cross-session, no PII",
      scale: "✓  Cross-session, no PII",
    },
    {
      dimension: "Enriched Contact Submissions",
      category: "data",
      start: "✓  Source, UTMs, variant, session",
      growth: "✓  Source, UTMs, variant, session",
      scale: "✓  Source, UTMs, variant, session",
    },
    {
      dimension: "Variant Analytics Dashboard",
      category: "data",
      start: "Basic metrics",
      growth: "Standard dashboard (coming soon)",
      scale: "Advanced + decision audit trail",
      highlight: true,
    },
    {
      dimension: "CMS Support",
      category: "data",
      start: "Any supported CMS",
      growth: "Any supported CMS",
      scale: "Any supported CMS + migration support",
    },

    // ── Reporting ─────────────────────────────────────────────────────────────
    {
      dimension: "Monthly Performance Report",
      category: "reporting",
      start: "Self-serve (dashboard data)",
      growth: "✓  MC-produced, 6-section report",
      scale: "✓  MC-produced, 6-section report",
      highlight: true,
    },
    {
      dimension: "Quarterly Strategy Review",
      category: "reporting",
      start: "—",
      growth: "—",
      scale: "✓  QBR with client leadership",
      highlight: true,
    },
    {
      dimension: "Managed Optimisation Retainer",
      category: "reporting",
      start: "Optional add-on",
      growth: "Recommended add-on",
      scale: "✓  Included (quarterly cycle)",
    },

    // ── Onboarding ────────────────────────────────────────────────────────────
    {
      dimension: "Onboarding Style",
      category: "onboarding",
      start: "Guided (MC-led setup)",
      growth: "Managed (strategy + content brief)",
      scale: "Managed (workshop + full content + migration)",
    },
    {
      dimension: "ICP & Strategy Session",
      category: "onboarding",
      start: "—",
      growth: "✓  2-hour session",
      scale: "✓  Leadership workshop",
    },
    {
      dimension: "Variant Content Brief",
      category: "onboarding",
      start: "✓  Included",
      growth: "✓  Included + MC content review",
      scale: "✓  Included + MC content review",
    },
    {
      dimension: "Estimated Go-Live Timeline",
      category: "onboarding",
      start: "2–3 weeks",
      growth: "3–4 weeks",
      scale: "3–5 weeks",
    },

    // ── Pricing ───────────────────────────────────────────────────────────────
    {
      dimension: "Setup (one-time)",
      category: "pricing",
      start: formatPrice({ amount: SETUP_STANDARD.band?.list ?? 0, currency: "GBP" }),
      growth: formatPrice({ amount: SETUP_STANDARD.band?.list ?? 0, currency: "GBP" }),
      scale: formatPrice({ amount: SETUP_STANDARD.band?.list ?? 0, currency: "GBP" }),
    },
    {
      dimension: "Platform + Modules (monthly, from)",
      category: "pricing",
      start: formatPrice(START_PACKAGE.pricing.monthlyFromAmount),
      growth: formatPrice(GROWTH_PACKAGE.pricing.monthlyFromAmount),
      scale: formatPrice(SCALE_PACKAGE.pricing.monthlyFromAmount),
      highlight: true,
    },
  ];
}
