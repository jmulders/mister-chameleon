/**
 * Pricing Model — Fee Catalog & Helpers
 *
 * Defines the concrete fee instances that make up the Mister Chameleon
 * pricing model, composes them into the standard pricing model, and provides
 * helpers for proposal generation and internal tooling.
 *
 * ─── What lives here ─────────────────────────────────────────────────────────
 *
 *   Fee instances     One exported constant per defined fee (SETUP_STANDARD,
 *                     PLATFORM_BASE, MODULE_ADAPTIVE_WEBSITE, etc.)
 *
 *   STANDARD_PRICING_MODEL   The current single-tier model that composes all
 *                            fee instances into one catalog. This is not a
 *                            package — it is the complete menu of available
 *                            fees. Package tiers will select from this menu.
 *
 *   EXAMPLE_PRICING_CONFIG   An illustrative engagement configuration showing
 *                            how fees are selected and assembled into a
 *                            proposal. Intended as a developer and tooling
 *                            reference, not a real client quote.
 *
 *   Helpers               getFee(), getModuleFee(), getServiceFee(),
 *                         buildProposalLineItems(), resolveProposal()
 *
 * ─── Pricing values ──────────────────────────────────────────────────────────
 *
 *   All monetary amounts are stored in minor currency units (pence for GBP).
 *   The amounts below are illustrative defaults suitable for the standard
 *   SMB/growth market segment. They are the starting point for proposals —
 *   not published prices. Account managers adjust within the band.min floor.
 *
 *   To update list prices, change the `band.list` values below.
 *   To update the negotiation floor, change `band.min`.
 *   Do not set `band.min` lower than sustainable margin.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   pricing/types.ts   — all type definitions
 *   pricing/model.ts   ← YOU ARE HERE — fee catalog + model + helpers
 *   pricing/index.ts   — barrel re-export
 */

import type {
  SetupFee,
  PlatformFee,
  ModuleFee,
  ServiceFee,
  OptimizationFee,
  PricingModel,
  PricingConfig,
  ProposalLineItem,
  ResolvedProposal,
  AnyPricingFee,
  MonetaryAmount,
  PricingFeeId,
  ModuleFeeId,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS (monetary)
// ─────────────────────────────────────────────────────────────────────────────

/** Construct a GBP MonetaryAmount from a pence integer. */
function gbp(pence: number): MonetaryAmount {
  return { amount: pence, currency: "GBP" };
}

/**
 * Format a MonetaryAmount as a display string.
 * £2,500.00 for GBP, $2,500.00 for USD, €2,500.00 for EUR.
 */
export function formatPrice(amount: MonetaryAmount): string {
  const value = amount.amount / 100;
  const symbols: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
  const symbol = symbols[amount.currency] ?? amount.currency;
  return `${symbol}${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP FEES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard setup fee.
 *
 * Full onboarding implementation: site audit, context rule configuration,
 * CMS integration, variant population guide, platform go-live, and
 * 30-day post-launch check-in.
 */
export const SETUP_STANDARD: SetupFee = {
  id: "setup-standard",
  category: "setup",
  label: "Platform Setup & Onboarding",
  description:
    "Full platform implementation including site integration, context rule " +
    "configuration, initial variant structure, and go-live support.",
  internalNotes:
    "Covers 2–3 weeks of MC engineer + AM time. Does not include content production " +
    "(client provides copy). Requires client dev access for script installation.",
  billingCadence: "one-time",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 250000,   // £2,500
    min: 150000,    // £1,500 minimum
    note: "subject to site complexity",
  },
  required: true,
  visibleOnProposal: true,
  proposalSection: "one-time",
  deliverables: [
    "Platform account and tenant configuration",
    "Context detection and decision rule setup",
    "CMS variant slot structure and initial keys",
    "Tracking script installation and event verification",
    "Go-live checklist and 30-day post-launch review",
  ],
  timeline: "2–3 weeks",
  payableOnSigning: true,
};

/**
 * Accelerated setup fee.
 *
 * Compressed 5-business-day sprint for clients with urgent timelines.
 * Requires client to be fully available for decision-making throughout.
 */
export const SETUP_ACCELERATED: SetupFee = {
  id: "setup-accelerated",
  category: "setup",
  label: "Accelerated Setup (5-Day Sprint)",
  description:
    "Compressed 5-business-day implementation for clients with urgent launch " +
    "deadlines. All standard setup deliverables, condensed timeline.",
  internalNotes:
    "Requires dedicated client availability throughout the sprint week. " +
    "Not suitable if client dev resource is limited. Higher rate reflects " +
    "MC team prioritisation cost.",
  billingCadence: "one-time",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 400000,   // £4,000
    min: 350000,    // £3,500 minimum
    note: "requires confirmed client availability throughout sprint week",
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "one-time",
  deliverables: [
    "Platform account and tenant configuration",
    "Context detection and decision rule setup",
    "CMS variant slot structure and initial keys",
    "Tracking script installation and event verification",
    "Go-live handover and documentation",
  ],
  timeline: "5 business days",
  payableOnSigning: true,
};

/**
 * Light setup fee.
 *
 * Minimal guided configuration for technically capable clients who will
 * handle most of the implementation work themselves.
 */
export const SETUP_LIGHT: SetupFee = {
  id: "setup-light",
  category: "setup",
  label: "Guided Setup (Self-Service)",
  description:
    "Light-touch configuration support for teams who will complete most of " +
    "the implementation work themselves, with MC guidance.",
  internalNotes:
    "Appropriate when the client has an in-house developer comfortable with " +
    "the platform. MC provides documentation, reviews configuration, and " +
    "signs off go-live. Not suitable for first-time clients without technical resource.",
  billingCadence: "one-time",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 100000,   // £1,000
    min:   75000,   // £750 minimum
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "one-time",
  deliverables: [
    "Implementation guide and configuration documentation",
    "One configuration review session (2 hours)",
    "Go-live checklist sign-off",
  ],
  timeline: "Client-paced, typically 1–2 weeks",
  payableOnSigning: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM FEE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base platform license fee.
 *
 * Covers access to the Mister Chameleon platform infrastructure for one
 * tenant. Every client engagement includes this fee. Billed monthly;
 * annual commitment available at a discounted rate.
 */
export const PLATFORM_BASE: PlatformFee = {
  id: "platform-base",
  category: "platform",
  label: "Platform License",
  description:
    "Monthly access to the Mister Chameleon platform: context engine, " +
    "adaptive rendering, decisioning, and first-party tracking.",
  internalNotes:
    "This covers infrastructure costs and base platform access. Module fees " +
    "are additive on top. The annual commitment saves ~2 months vs monthly.",
  billingCadence: "monthly",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 50000,   // £500/month
    min:  35000,   // £350/month minimum
  },
  required: true,
  visibleOnProposal: true,
  proposalSection: "recurring",
  includes: [
    "Context detection and visitor segmentation",
    "Adaptive rendering engine (up to 3 variant slots)",
    "First-party event tracking and session recording",
    "Decision engine: rules-based and AI-assisted",
    "Platform dashboard and analytics",
    "Standard SLA and support",
  ],
  annualDiscountAvailable: true,
  annualBand: {
    currency: "GBP",
    list: 480000,  // £4,800/year (equivalent to £400/month — 20% saving)
    min:  360000,  // £3,600/year minimum
    note: "12-month commitment, invoiced annually",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MODULE FEES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adaptive Website module fee.
 *
 * The primary module. Covers the adaptive homepage and site experience —
 * context-aware variant selection across the main site pages.
 */
export const MODULE_ADAPTIVE_WEBSITE: ModuleFee = {
  id: "module-adaptive-website",
  category: "module",
  label: "Adaptive Website Module",
  description:
    "Context-aware variant serving across your main website. Personalises " +
    "hero, proof, and CTA content based on visitor source, device, and " +
    "behavioural signals.",
  internalNotes:
    "The flagship module — most clients start here. Typically included " +
    "as part of the base platform fee in the standard package. " +
    "List price reflects the standalone rate.",
  billingCadence: "monthly",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 30000,   // £300/month
    min:  20000,   // £200/month minimum
    note: "often included in platform base for standard engagements",
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "recurring",
  linkedModuleId: "adaptive-website",
  capabilities: [
    "Source-based variant selection (paid, organic, direct, social)",
    "Device-aware content adaptation (mobile, desktop)",
    "Hero, proof, and CTA variant slots",
    "A/B experiment framework with per-variant CTR tracking",
    "Rules-based and AI-assisted decisioning",
  ],
  requiresSetup: true,
};

/**
 * Adaptive Landing Pages module fee.
 *
 * Campaign-specific landing pages with variant-keyed content per traffic
 * source or UTM parameter. Separate from the main site.
 */
export const MODULE_ADAPTIVE_LANDING_PAGES: ModuleFee = {
  id: "module-adaptive-landing-pages",
  category: "module",
  label: "Adaptive Landing Pages Module",
  description:
    "Variant-keyed landing pages that match content to campaign source, " +
    "UTM parameters, and audience segment for higher campaign conversion rates.",
  internalNotes:
    "Add-on to Adaptive Website. Requires campaign-aligned variant content " +
    "from the client. Significant setup time if multiple campaign types.",
  billingCadence: "monthly",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 25000,   // £250/month
    min:  15000,   // £150/month minimum
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "recurring",
  linkedModuleId: "adaptive-landing-pages",
  capabilities: [
    "UTM-parameter and campaign source variant mapping",
    "Per-campaign hero, proof, and CTA variant slots",
    "Conversion tracking and per-landing-page CTR reporting",
    "Landing page A/B experiment framework",
  ],
  requiresSetup: true,
};

/**
 * Adaptive Follow-up module fee.
 *
 * On-site contact enrichment and n8n-powered journey dispatch. Bridges
 * the platform's visitor intelligence to CRM and email automation.
 */
export const MODULE_ADAPTIVE_FOLLOW_UP: ModuleFee = {
  id: "module-adaptive-follow-up",
  category: "module",
  label: "Adaptive Follow-up Module",
  description:
    "Enriches form submissions with visitor context and dispatches tailored " +
    "follow-up journeys via n8n — connecting on-site behaviour to CRM, " +
    "email, and sales workflows.",
  internalNotes:
    "Requires n8n instance (client-managed or MC-hosted). Additional " +
    "setup time for workflow design. Engineering-heavy module — confirm " +
    "client has CRM integration appetite before proposing.",
  billingCadence: "monthly",
  basis: "range",
  band: {
    currency: "GBP",
    list: 35000,   // £350/month
    min:  25000,   // £250/month minimum
    note: "subject to integration complexity and workflow count",
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "recurring",
  linkedModuleId: "adaptive-follow-up",
  capabilities: [
    "Contact submission enrichment with visitor source and segment data",
    "n8n workflow dispatch based on visitor context",
    "CRM field mapping and pipeline signal injection",
    "Follow-up submission rate tracking",
  ],
  requiresSetup: true,
};

/**
 * Context Intelligence module fee.
 *
 * Visitor history, multi-touch session signals, and platform diagnostics.
 * Surfaces the 'why' behind the platform's decisions.
 */
export const MODULE_CONTEXT_INTELLIGENCE: ModuleFee = {
  id: "module-context-intelligence",
  category: "module",
  label: "Context Intelligence Module",
  description:
    "Visitor history tracking, multi-touch session signals, and diagnostic " +
    "tooling that shows what the platform decided and why — for known " +
    "returning users.",
  internalNotes:
    "Higher-value add-on for clients with significant returning visitor " +
    "traffic. Less relevant for pure acquisition sites. Beta module — " +
    "confirm feature maturity before proposing.",
  billingCadence: "monthly",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 20000,   // £200/month
    min:  15000,   // £150/month minimum
    note: "beta module — confirm availability before including in proposal",
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "recurring",
  linkedModuleId: "context-intelligence",
  capabilities: [
    "Returning visitor identification and history tracking",
    "Multi-touch session depth signals",
    "Known-user variant escalation logic",
    "Decision audit trail — what was served and why",
  ],
  requiresSetup: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE FEES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Onboarding service fee.
 *
 * The structured delivery engagement that gets the platform live. Often
 * bundled with the setup fee — the setup fee covers the technical work,
 * the service fee covers the MC team's project management and strategy input.
 *
 * In practice, these are often presented as a single "Onboarding & Setup"
 * line item on proposals. They are modelled separately to make the cost
 * components explicit for internal planning.
 */
export const SERVICE_ONBOARDING: ServiceFee = {
  id: "service-onboarding",
  category: "service",
  label: "Onboarding Engagement",
  description:
    "Structured launch project covering variant strategy, content brief, " +
    "platform configuration, and go-live support.",
  internalNotes:
    "Often combined with the setup fee in proposals. Separate line items " +
    "are clearer when the client has a developer doing the technical setup " +
    "themselves (light setup) but still wants MC strategy input.",
  billingCadence: "project",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 150000,   // £1,500
    min:  100000,   // £1,000 minimum
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "one-time",
  linkedServiceId: "onboarding",
  deliverables: [
    "ICP and variant strategy workshop (2 hours)",
    "Variant content brief for all active slots",
    "Decision rule design document",
    "Go-live review and sign-off session",
  ],
  minimumTerm: undefined,
};

/**
 * Content modelling service fee.
 *
 * A focused content strategy and production engagement for clients who need
 * structured help developing their variant content — not just a brief,
 * but MC-led content design work.
 */
export const SERVICE_CONTENT_MODELING: ServiceFee = {
  id: "service-content-modeling",
  category: "service",
  label: "Content Modelling Engagement",
  description:
    "Structured content design engagement: ICP mapping, variant messaging " +
    "hierarchy, copy production for all active variant slots, and CMS upload.",
  internalNotes:
    "Requires a content strategist resource. Not included in standard setup. " +
    "Scope can vary significantly — quote based on number of variant slots " +
    "and complexity of the messaging matrix.",
  billingCadence: "project",
  basis: "range",
  band: {
    currency: "GBP",
    list: 250000,   // £2,500
    min:  150000,   // £1,500 minimum
    note: "subject to number of variant slots and content complexity",
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "one-time",
  linkedServiceId: "content-modeling",
  deliverables: [
    "ICP and messaging hierarchy document",
    "Variant copy for all scoped slots (hero, proof, CTA)",
    "Content brief for ongoing refresh cycles",
    "CMS upload and verification",
  ],
};

/**
 * Optimisation retainer service fee.
 *
 * Ongoing monthly iteration service — MC runs the performance reviews,
 * manages experiments, and implements improvements. This is the service
 * layer; the OptimizationFee covers the structured cycle delivery.
 *
 * In practice, SERVICE_OPTIMISATION_RETAINER and OPTIMIZATION_MONTHLY are
 * often presented as a single "Managed Optimisation" line item. They are
 * modelled separately to distinguish service delivery cost from cycle
 * execution cost.
 */
export const SERVICE_OPTIMISATION_RETAINER: ServiceFee = {
  id: "service-optimisation-retainer",
  category: "service",
  label: "Managed Optimisation Retainer",
  description:
    "MC-managed ongoing optimisation: monthly performance reviews, " +
    "experiment management, variant updates, and improvement implementation.",
  internalNotes:
    "The core recurring service product. Often proposed alongside " +
    "OPTIMIZATION_MONTHLY. Minimum 3-month commitment. " +
    "Consider bundling with optimization fee on proposals for simplicity.",
  billingCadence: "monthly",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 75000,   // £750/month
    min:  50000,   // £500/month minimum
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "recurring",
  linkedServiceId: "optimisation",
  deliverables: [
    "Monthly performance report (full 6-section report)",
    "Variant and rule change implementation (up to 3 per month)",
    "Experiment design, setup, and decision management",
    "Monthly review session (AM-facilitated)",
  ],
  minimumTerm: "3 months",
};

/**
 * Strategy advisory service fee.
 *
 * Quarterly or ad-hoc advisory sessions for ICP positioning, channel-to-
 * variant mapping, and growth strategy aligned with the platform's data.
 */
export const SERVICE_STRATEGY_ADVISORY: ServiceFee = {
  id: "service-strategy-advisory",
  category: "service",
  label: "Strategy Advisory",
  description:
    "Advisory sessions covering ICP refinement, channel-to-variant mapping, " +
    "and growth strategy informed by the platform's performance data.",
  internalNotes:
    "Often delivered as part of the quarterly strategy review cycle. " +
    "Can be scoped as a standalone engagement (workshop + memo) or as " +
    "an ongoing quarterly add-on alongside the optimisation retainer.",
  billingCadence: "quarterly",
  basis: "range",
  band: {
    currency: "GBP",
    list: 200000,   // £2,000/quarter
    min:  150000,   // £1,500/quarter minimum
    note: "per quarterly session; includes written strategy memo",
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "recurring",
  linkedServiceId: "strategy",
  deliverables: [
    "Pre-session analysis and 90-day performance narrative",
    "Strategy session (90 minutes, client leadership + MC team)",
    "Quarterly strategy memo with KPI targets and priorities",
    "Content priorities brief for the next quarter",
  ],
  minimumTerm: "1 quarter",
};

// ─────────────────────────────────────────────────────────────────────────────
// OPTIMIZATION FEES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monthly optimisation cycle retainer.
 *
 * The core recurring add-on that delivers the operating model as a managed
 * service. Includes monthly performance reviews and experiment cycle coverage.
 * Quarterly strategy reviews are available as an upgrade (OPTIMIZATION_QUARTERLY).
 */
export const OPTIMIZATION_MONTHLY: OptimizationFee = {
  id: "optimization-monthly",
  category: "optimization",
  label: "Monthly Optimisation Retainer",
  description:
    "Structured monthly optimisation service: performance reviews, experiment " +
    "management, content refresh cycles, and variant improvement implementation.",
  internalNotes:
    "The standard optimization add-on. Should be proposed for any client " +
    "where MC is managing ongoing improvements rather than just providing " +
    "the tool. Minimum 3-month commitment to see meaningful results.",
  billingCadence: "monthly",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 75000,   // £750/month
    min:  50000,   // £500/month minimum
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "recurring",
  includedCycles: [
    "monthly-performance-review",
    "experiment-review",
    "content-refresh",
  ],
  hoursPerMonth: 4,
  includes: [
    "Monthly performance review session (AM-facilitated, 60 minutes)",
    "Monthly performance report (full 6-section client report)",
    "Experiment monitoring and decision management",
    "Content refresh cycle (up to 3 variant updates per month)",
    "Action backlog management and follow-through",
  ],
  minimumTerm: "3 months",
};

/**
 * Quarterly optimisation and strategy retainer.
 *
 * The premium tier of the optimisation add-on. Includes everything in the
 * monthly retainer plus the quarterly strategy review cycle (QBR).
 * Lower monthly rate compared to two separate line items.
 */
export const OPTIMIZATION_QUARTERLY: OptimizationFee = {
  id: "optimization-quarterly",
  category: "optimization",
  label: "Quarterly Optimisation & Strategy Retainer",
  description:
    "Full optimisation service including monthly performance reviews, " +
    "experiment management, and quarterly strategy reviews (QBR) with " +
    "client leadership.",
  internalNotes:
    "The full operating model as a service. Appropriate for clients with " +
    "active leadership engagement and a genuine growth orientation. " +
    "Produces the most value per pound of retainer. Minimum 6-month commitment.",
  billingCadence: "monthly",
  basis: "fixed",
  band: {
    currency: "GBP",
    list: 120000,   // £1,200/month
    min:   90000,   // £900/month minimum
    note:  "includes quarterly strategy review sessions (4× per year)",
  },
  required: false,
  visibleOnProposal: true,
  proposalSection: "recurring",
  includedCycles: [
    "monthly-performance-review",
    "quarterly-strategy-review",
    "experiment-review",
    "content-refresh",
  ],
  hoursPerMonth: 6,
  includes: [
    "Monthly performance review session (AM-facilitated, 60 minutes)",
    "Monthly performance report (full 6-section client report)",
    "Quarterly strategy review (QBR) with client leadership (90 minutes)",
    "Quarterly strategy memo and KPI target-setting",
    "Experiment monitoring and decision management",
    "Content refresh cycle (up to 3 variant updates per month)",
    "Action backlog management and follow-through",
  ],
  minimumTerm: "6 months",
};

// ─────────────────────────────────────────────────────────────────────────────
// STANDARD PRICING MODEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The standard Mister Chameleon pricing model.
 *
 * This is the complete fee catalog — every available fee variant across all
 * five categories. It is not a package or tier; it is the menu from which
 * PricingConfig instances select.
 *
 * A typical engagement selects:
 *   1 setup fee + platform fee + 1–3 module fees + 0–1 service fees + 0–1 optimization fee
 *
 * Future: package tiers (starter, growth, enterprise) will be built as
 * named PricingConfig presets that select from this model.
 */
export const STANDARD_PRICING_MODEL: PricingModel = {
  id: "standard",
  name: "Standard Engagement Model",
  description:
    "The complete Mister Chameleon fee catalog. All engagement types — " +
    "from a minimal self-service setup to a full managed optimisation " +
    "retainer — are assembled from the fees defined here.",
  version: "1.0",
  defaultCurrency: "GBP",

  setupFees: [
    SETUP_STANDARD,
    SETUP_ACCELERATED,
    SETUP_LIGHT,
  ],

  platformFee: PLATFORM_BASE,

  moduleFees: [
    MODULE_ADAPTIVE_WEBSITE,
    MODULE_ADAPTIVE_LANDING_PAGES,
    MODULE_ADAPTIVE_FOLLOW_UP,
    MODULE_CONTEXT_INTELLIGENCE,
  ],

  serviceFees: [
    SERVICE_ONBOARDING,
    SERVICE_CONTENT_MODELING,
    SERVICE_OPTIMISATION_RETAINER,
    SERVICE_STRATEGY_ADVISORY,
  ],

  optimizationFees: [
    OPTIMIZATION_MONTHLY,
    OPTIMIZATION_QUARTERLY,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE PRICING CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Example pricing configuration — a typical growth-stage B2B client.
 *
 * Illustrates how a PricingConfig is assembled from the STANDARD_PRICING_MODEL.
 * This is a developer and tooling reference, not a real client quote.
 *
 * Scenario: a B2B SaaS company launching Adaptive Website + Landing Pages,
 * with the monthly optimisation retainer and content modelling engagement.
 *
 * One-time total:   £2,500 (setup) + £2,500 (content modelling) = £5,000
 * Monthly total:    £500 (platform) + £300 (website module) + £250 (landing pages)
 *                 + £750 (optimisation retainer) = £1,800/month
 */
export const EXAMPLE_PRICING_CONFIG: PricingConfig = {
  id: "example-b2b-growth-2024-01",
  modelId: "standard",
  modelVersion: "1.0",
  currency: "GBP",
  scenarioLabel: "B2B Growth — Adaptive Website + Landing Pages + Managed Optimisation",

  selectedSetupFeeId: "setup-standard",
  selectedModuleFeeIds: [
    "module-adaptive-website",
    "module-adaptive-landing-pages",
  ],
  selectedServiceFeeIds: [
    "service-content-modeling",
  ],
  selectedOptimizationFeeId: "optimization-monthly",

  // No overrides — all list prices apply
  priceOverrides: undefined,

  proposalNotes:
    "Prices shown are monthly unless noted. Setup fee is payable on contract " +
    "signature. Minimum 3-month commitment on the optimisation retainer. " +
    "Annual platform license available at £4,800/year (saving ~£1,200 vs monthly).",

  createdAt: "2024-01-15",
};

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a flat index of all fees in the model, keyed by fee ID.
 * Used internally by lookup helpers and proposal builders.
 */
function buildFeeIndex(model: PricingModel): Map<PricingFeeId, AnyPricingFee> {
  const index = new Map<PricingFeeId, AnyPricingFee>();
  model.setupFees.forEach((f) => index.set(f.id, f));
  index.set(model.platformFee.id, model.platformFee);
  model.moduleFees.forEach((f) => index.set(f.id, f));
  model.serviceFees.forEach((f) => index.set(f.id, f));
  model.optimizationFees.forEach((f) => index.set(f.id, f));
  return index;
}

// Lazy singleton index for the standard model.
let _standardFeeIndex: Map<PricingFeeId, AnyPricingFee> | undefined;
function getStandardFeeIndex(): Map<PricingFeeId, AnyPricingFee> {
  _standardFeeIndex ??= buildFeeIndex(STANDARD_PRICING_MODEL);
  return _standardFeeIndex;
}

/**
 * Returns any fee from the standard model by ID.
 *
 * @example
 *   const fee = getFee("module-adaptive-website");
 */
export function getFee(id: PricingFeeId): AnyPricingFee | undefined {
  return getStandardFeeIndex().get(id);
}

/**
 * Returns the module fee for a given module fee ID.
 *
 * @example
 *   const fee = getModuleFee("module-adaptive-website");
 */
export function getModuleFee(id: ModuleFeeId): ModuleFee | undefined {
  const fee = STANDARD_PRICING_MODEL.moduleFees.find((f) => f.id === id);
  return fee;
}

/**
 * Returns all module fees linked to a given ProductModuleId.
 *
 * @example
 *   const fees = getModuleFeesByModule("adaptive-website");
 */
export function getModuleFeesByModule(
  moduleId: ModuleFee["linkedModuleId"],
): readonly ModuleFee[] {
  return STANDARD_PRICING_MODEL.moduleFees.filter(
    (f) => f.linkedModuleId === moduleId,
  );
}

/**
 * Returns a service fee by its fee ID.
 *
 * @example
 *   const fee = getServiceFee("service-content-modeling");
 */
export function getServiceFee(
  id: ServiceFee["id"],
): ServiceFee | undefined {
  return STANDARD_PRICING_MODEL.serviceFees.find((f) => f.id === id);
}

/**
 * Returns all service fees linked to a given ServiceOfferingId.
 *
 * @example
 *   const fees = getServiceFeesByOffering("content-modeling");
 */
export function getServiceFeesByOffering(
  serviceId: ServiceFee["linkedServiceId"],
): readonly ServiceFee[] {
  return STANDARD_PRICING_MODEL.serviceFees.filter(
    (f) => f.linkedServiceId === serviceId,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSAL GENERATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the price for a fee, applying any override from the config.
 *
 * Returns the override if present, otherwise falls back to the fee's
 * list price. Returns zero if no price is available (custom/included fees).
 */
function resolvePrice(
  fee: AnyPricingFee,
  config: PricingConfig,
): { price: MonetaryAmount; isOverridden: boolean } {
  const override = config.priceOverrides?.[fee.id];
  if (override) {
    return { price: override, isOverridden: true };
  }
  if (fee.band) {
    return {
      price: gbp(fee.band.list),
      isOverridden: false,
    };
  }
  // Fallback for custom/included fees with no band
  return { price: gbp(0), isOverridden: false };
}

/**
 * Build the ordered list of ProposalLineItems for a given PricingConfig.
 *
 * Selects the fees specified in the config, applies any price overrides,
 * and returns them in proposal order: one-time first, then recurring.
 *
 * The platform base fee is always included as the first recurring item.
 *
 * @example
 *   const items = buildProposalLineItems(EXAMPLE_PRICING_CONFIG);
 *   // → [SetupFee line, PlatformFee line, ModuleFee lines, ...]
 */
export function buildProposalLineItems(
  config: PricingConfig,
  model: PricingModel = STANDARD_PRICING_MODEL,
): readonly ProposalLineItem[] {
  const index = buildFeeIndex(model);
  const items: ProposalLineItem[] = [];

  // Resolve a fee into a line item
  function toLineItem(fee: AnyPricingFee): ProposalLineItem {
    const { price, isOverridden } = resolvePrice(fee, config);
    return {
      feeId: fee.id,
      category: fee.category,
      label: fee.label,
      description: fee.description,
      billingCadence: fee.billingCadence,
      price,
      isOverridden,
      proposalSection: fee.proposalSection,
    };
  }

  // 1. Setup fee
  const setupFee = index.get(config.selectedSetupFeeId);
  if (setupFee) items.push(toLineItem(setupFee));

  // 2. Service fees (one-time / project ones first)
  for (const id of config.selectedServiceFeeIds) {
    const fee = index.get(id);
    if (fee && fee.proposalSection === "one-time") {
      items.push(toLineItem(fee));
    }
  }

  // 3. Platform base (always included)
  items.push(toLineItem(model.platformFee));

  // 4. Module fees
  for (const id of config.selectedModuleFeeIds) {
    const fee = index.get(id);
    if (fee) items.push(toLineItem(fee));
  }

  // 5. Service fees (recurring retainers)
  for (const id of config.selectedServiceFeeIds) {
    const fee = index.get(id);
    if (fee && fee.proposalSection === "recurring") {
      items.push(toLineItem(fee));
    }
  }

  // 6. Optimisation add-on (optional)
  if (config.selectedOptimizationFeeId) {
    const fee = index.get(config.selectedOptimizationFeeId);
    if (fee) items.push(toLineItem(fee));
  }

  return items;
}

/**
 * Resolve a PricingConfig into a fully assembled ResolvedProposal.
 *
 * Builds line items, computes totals, and returns a display-ready structure
 * suitable for rendering into a proposal document or PDF.
 *
 * Quarterly fees are expressed as monthly equivalent (÷ 3) for the
 * monthlyRecurringTotal calculation.
 *
 * @example
 *   const proposal = resolveProposal(EXAMPLE_PRICING_CONFIG);
 *   console.log(formatPrice(proposal.monthlyRecurringTotal)); // £1,800.00
 */
export function resolveProposal(
  config: PricingConfig,
  model: PricingModel = STANDARD_PRICING_MODEL,
): ResolvedProposal {
  const allItems = buildProposalLineItems(config, model);

  const oneTimeItems = allItems.filter((i) => i.proposalSection === "one-time");
  const recurringItems = allItems.filter((i) => i.proposalSection === "recurring");

  const oneTimeTotal = oneTimeItems.reduce(
    (sum, item) => sum + item.price.amount,
    0,
  );

  // Compute monthly-equivalent recurring total
  const monthlyRecurring = recurringItems.reduce((sum, item) => {
    const amount = item.price.amount;
    if (item.billingCadence === "quarterly") return sum + Math.round(amount / 3);
    if (item.billingCadence === "annually")  return sum + Math.round(amount / 12);
    return sum + amount; // monthly or one-time recurring
  }, 0);

  return {
    configId: config.id,
    scenarioLabel: config.scenarioLabel,
    currency: config.currency,
    oneTimeItems,
    recurringItems,
    oneTimeTotal: gbp(oneTimeTotal),
    monthlyRecurringTotal: gbp(monthlyRecurring),
    notes: config.proposalNotes,
  };
}
