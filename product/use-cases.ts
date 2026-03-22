/**
 * Mister Chameleon — Use Case Definitions
 *
 * Reusable customer scenarios that map the product catalog to real-world
 * deployment patterns. Each use case is a named, scoped configuration of
 * platform modules and services that delivers a specific business outcome.
 *
 * ─── How use cases relate to the rest of the model ───────────────────────────
 *
 *   Use cases sit ABOVE the module catalog in the hierarchy:
 *
 *     UseCaseDefinition
 *       └── requiredModules[]   → ProductModule (catalog.ts)
 *             └── layers[]      → ProductLayer  (catalog.ts)
 *                   └── sourceModules[] → runtime code
 *
 *       └── recommendedServices[] → ServiceOffering (catalog.ts)
 *       └── useCaseTypes[]        → UseCaseType (types.ts)
 *                                   ↑ same taxonomy ProductModule.useCases uses
 *
 *   This means:
 *   • From a use case you can reach all modules, all layers, and all source files.
 *   • From a module you can find every use case that depends on it.
 *   • The UseCaseType taxonomy bridges modules ↔ use cases for cross-referencing.
 *
 * ─── Pricing / packaging intent ──────────────────────────────────────────────
 *
 *   UseCaseTier groups use cases by commercial complexity:
 *
 *     "entry"        One module, straightforward setup. Good for a first
 *                    engagement or a focused vertical bet.
 *
 *     "growth"       Two or more modules with orchestration. The core
 *                    adaptive + follow-up combination.
 *
 *     "full-journey" All available modules, history signals, ongoing
 *                    optimisation. Maximum platform footprint.
 *
 *   Future pricing logic can query by tier to produce package suggestions:
 *     getUseCasesByTier("entry")  → entry packages
 *     getUseCasesByTier("growth") → growth packages
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   product/types.ts      → module/layer/service types + UseCaseType taxonomy
 *   product/catalog.ts    → module, layer, service data + query helpers
 *   product/use-cases.ts  ← YOU ARE HERE — use case types, definitions, helpers
 *   product/index.ts      → barrel re-export
 */

import type {
  ProductModuleId,
  ServiceOfferingId,
  UseCaseType,
  ProductModule,
  ServiceOffering,
} from "./types";

import {
  MODULE_INDEX,
  SERVICE_INDEX,
} from "./catalog";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for each use case definition.
 *
 * b2b-lead-gen                 Adaptive homepage + enriched contact for B2B pipeline.
 * adaptive-campaigns           Personalised landing pages per paid campaign.
 * account-based-marketing      Multi-visit recognition and escalating journey depth.
 * recruitment-experience       Source-aware careers and job listing pages.
 * adaptive-follow-up-nurture   Enriched contact payloads for downstream nurture.
 * known-user-experience        Elevated experience for returning engaged visitors.
 */
export type UseCaseId =
  | "b2b-lead-gen"
  | "adaptive-campaigns"
  | "account-based-marketing"
  | "recruitment-experience"
  | "adaptive-follow-up-nurture"
  | "known-user-experience";

/**
 * Page types that appear in use case journeys.
 *
 * Covers the homepage (currently live) and all forward-looking page types
 * the platform will support as it expands beyond the homepage.
 *
 * homepage         The root site page — the platform's current primary surface.
 * landing-page     Campaign-specific or segment-specific entry pages.
 * pricing-page     Pricing and packaging page (high-intent conversion surface).
 * about-page       Company story and social proof page.
 * contact-page     Standalone contact / enquiry page.
 * thank-you-page   Post-submission confirmation — used for nurture triggers.
 * careers-page     Top-level recruitment page listing open roles.
 * job-listing-page Individual job description and application entry point.
 */
export type PageTypeId =
  | "homepage"
  | "landing-page"
  | "pricing-page"
  | "about-page"
  | "contact-page"
  | "thank-you-page"
  | "careers-page"
  | "job-listing-page";

/**
 * Commercial complexity tier for packaging and pricing logic.
 *
 * entry          One module, straightforward configuration. Good first engagement.
 * growth         Two to three modules with orchestration. Core adaptive + follow-up.
 * full-journey   Full module suite with history signals and ongoing optimisation.
 */
export type UseCaseTier = "entry" | "growth" | "full-journey";

/**
 * A single measurable success signal for a use case.
 *
 * Kept intentionally simple — metric name + direction + optional context.
 * Specific targets are not encoded here (they vary by client baseline);
 * the context field captures the framing instead.
 */
export interface UseCaseKPI {
  /**
   * The metric being measured.
   * Written as a specific, unambiguous noun phrase.
   * Example: "Homepage contact form conversion rate"
   */
  metric: string;

  /**
   * The desired direction of change.
   *
   * increase   Higher is better (conversion rate, engagement depth, etc.)
   * decrease   Lower is better (bounce rate, cost-per-lead, etc.)
   * achieve    A state to reach rather than a direction (e.g. full enrichment)
   */
  direction: "increase" | "decrease" | "achieve";

  /**
   * Optional framing for how to think about this KPI in context.
   * Not a target number — that belongs in a scoping document.
   * Example: "Segment by traffic source to see variant-level differences"
   */
  notes?: string;
}

/**
 * A page involved in a use case journey, with its adaptive status and role.
 *
 * The `adaptive` flag indicates whether this page should be wired into the
 * platform's adaptive rendering pipeline. Setting it false for supporting
 * pages (thank-you pages, static about pages) keeps the required module
 * footprint honest — not every page in a journey needs to be adaptive.
 */
export interface RecommendedPage {
  /** The page type — must be a valid PageTypeId. */
  type: PageTypeId;

  /**
   * Whether this page should use the adaptive rendering pipeline.
   * true  → DecisionInput is evaluated, variant keys are selected, CMS content
   *         is fetched per the chosen plan.
   * false → Static page; part of the journey but not personalised by the platform.
   */
  adaptive: boolean;

  /** The role this page plays within the use case journey. */
  role: string;
}

/**
 * A reusable customer scenario definition.
 *
 * Describes a named deployment pattern — the combination of modules, pages,
 * services, and KPIs that together deliver a specific business outcome.
 *
 * Use cases are customer-facing in structure: their name, description, and
 * outcomes are written to be readable in proposals and on pricing pages.
 * Their module and service references are implementation-friendly: they resolve
 * to concrete catalog entries via the query helpers below.
 */
export interface UseCaseDefinition {
  /** Stable, URL-safe slug. */
  id: UseCaseId;

  /** Customer-facing display name. */
  name: string;

  /**
   * One to two sentence customer-facing description.
   * Written to be readable in a proposal or pricing page.
   * Avoids internal jargon (no "DecisionInput", "VisitorHistory", etc.).
   */
  description: string;

  /**
   * Concrete outcomes the client achieves when this use case is delivered.
   * Each entry is a specific, honest statement — not a generic promise.
   * Written in the present tense from the client's perspective.
   */
  targetOutcomes: readonly string[];

  /**
   * Product modules required to deliver this use case.
   * The minimum licensed module set. Additional modules may enhance it
   * but are not required for the core value proposition.
   */
  requiredModules: readonly ProductModuleId[];

  /**
   * Pages involved in this use case journey.
   * Includes both adaptive pages (wired to the platform) and supporting
   * static pages (part of the journey but not personalised).
   */
  recommendedPages: readonly RecommendedPage[];

  /**
   * Service engagements that best deliver this use case end-to-end.
   * Ordered from most essential to most advanced.
   */
  recommendedServices: readonly ServiceOfferingId[];

  /**
   * KPIs for measuring success.
   * Typically three to five metrics covering conversion, engagement, and
   * data quality. Specific targets are set per client, not here.
   */
  suggestedKPIs: readonly UseCaseKPI[];

  /**
   * Problem taxonomy tags that connect this use case back to ProductModule.useCases.
   * Used for cross-referencing: "which modules can contribute to this use case?".
   */
  useCaseTypes: readonly UseCaseType[];

  /**
   * Commercial complexity tier — drives packaging and pricing suggestions.
   * See UseCaseTier for the definition of each tier.
   */
  tier: UseCaseTier;

  /**
   * Indicative verticals or company types that fit this use case well.
   * Not exhaustive — used for sales qualification and proposal targeting.
   */
  targetVerticals: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// USE CASE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. B2B Lead Generation Website ───────────────────────────────────────────

const B2B_LEAD_GEN: UseCaseDefinition = {
  id: "b2b-lead-gen",
  name: "B2B Lead Generation Website",
  description:
    "A homepage that shows each visitor the most relevant message based on " +
    "where they came from and how they have previously engaged — turning more " +
    "inbound traffic into qualified pipeline without increasing ad spend.",
  targetOutcomes: [
    "Google visitors see a problem-framed message; LinkedIn visitors see a vision-led message; direct visitors see a brand-led message — automatically, on every request",
    "Returning visitors who previously clicked a CTA are shown a higher-intent experience without any manual segmentation",
    "Every contact form submission arrives with the traffic source, session depth, and the exact variant that converted the visitor",
    "Sales conversations start with context: the rep knows which channel brought the lead and which message resonated",
  ],
  requiredModules: [
    "adaptive-website",
    "context-intelligence",
    "adaptive-follow-up",
  ],
  recommendedPages: [
    {
      type: "homepage",
      adaptive: true,
      role: "Primary adaptive entry point — hero, proof, and CTA adapt to visitor source and history",
    },
    {
      type: "contact-page",
      adaptive: false,
      role: "Conversion endpoint — static form page; enrichment happens server-side on submission",
    },
    {
      type: "thank-you-page",
      adaptive: false,
      role: "Post-submission confirmation; triggers n8n workflow dispatch",
    },
  ],
  recommendedServices: [
    "onboarding",
    "content-modeling",
    "optimisation",
  ],
  suggestedKPIs: [
    {
      metric: "Homepage contact form conversion rate",
      direction: "increase",
      notes: "Primary conversion metric — segment by traffic source to see variant-level differences",
    },
    {
      metric: "Cost-per-qualified-contact by traffic source",
      direction: "decrease",
      notes: "Isolate which channels produce the best conversion rate after adaptive messaging is applied",
    },
    {
      metric: "Variant selection distribution",
      direction: "achieve",
      notes: "Aim for all three variants being selected — indicates traffic mix is healthy and rules are firing correctly",
    },
    {
      metric: "Returning visitor conversion rate vs first-visit baseline",
      direction: "increase",
      notes: "History-aware rules should lift returning visitor conversion; measure as a cohort",
    },
    {
      metric: "Contact enrichment completeness",
      direction: "achieve",
      notes: "% of form submissions that arrive in n8n with source + variant + session depth populated",
    },
  ],
  useCaseTypes: [
    "traffic-to-conversion",
    "visitor-personalisation",
    "campaign-attribution",
    "lead-qualification",
  ],
  tier: "growth",
  targetVerticals: [
    "B2B SaaS",
    "Management consulting",
    "Professional services",
    "Marketing agencies",
    "Tech-enabled services",
  ],
};

// ── 2. Adaptive Campaign Landing Pages ───────────────────────────────────────

const ADAPTIVE_CAMPAIGNS: UseCaseDefinition = {
  id: "adaptive-campaigns",
  name: "Adaptive Campaign Landing Pages",
  description:
    "Dedicated campaign URLs that read UTM parameters and visitor context " +
    "on arrival and render the content variant that best matches the audience " +
    "each campaign was targeting — one URL, many first impressions.",
  targetOutcomes: [
    "Paid Google campaigns land on a page speaking to problem-aware searchers; paid LinkedIn campaigns land on a page speaking to vision-aware buyers",
    "A single canonical URL serves multiple audiences without duplicating page infrastructure or splitting campaign budgets across separate destinations",
    "Campaign attribution flows from UTM to form submission to CRM with no manual tagging by the sales team",
    "Underperforming campaign/variant combinations surface in the enrichment data before the campaign budget is exhausted",
  ],
  requiredModules: [
    "adaptive-landing-pages",
    "context-intelligence",
  ],
  recommendedPages: [
    {
      type: "landing-page",
      adaptive: true,
      role: "Primary adaptive campaign destination — variant selected from UTM source and campaign parameters",
    },
    {
      type: "thank-you-page",
      adaptive: false,
      role: "Post-conversion confirmation page; can fire n8n dispatch if adaptive-follow-up is also active",
    },
  ],
  recommendedServices: [
    "onboarding",
    "content-modeling",
  ],
  suggestedKPIs: [
    {
      metric: "Landing page conversion rate by campaign",
      direction: "increase",
      notes: "Compare adaptive vs non-adaptive baseline if migrating from a static landing page",
    },
    {
      metric: "CTA click-through rate by variant",
      direction: "increase",
      notes: "Identifies which variant angle resonates most with each campaign audience",
    },
    {
      metric: "Bounce rate by traffic source",
      direction: "decrease",
      notes: "Mismatched variant selection shows up as elevated bounce rate for that source",
    },
    {
      metric: "Cost-per-conversion by campaign/variant combination",
      direction: "decrease",
      notes: "The core paid media efficiency metric — should improve as variant matching tightens",
    },
  ],
  useCaseTypes: [
    "traffic-to-conversion",
    "campaign-attribution",
    "visitor-personalisation",
    "content-optimisation",
  ],
  tier: "entry",
  targetVerticals: [
    "B2B SaaS",
    "E-commerce (B2B segment)",
    "Professional services",
    "Events and conferences",
    "Financial services",
  ],
};

// ── 3. Account-Based Marketing Journey ───────────────────────────────────────

const ACCOUNT_BASED_MARKETING: UseCaseDefinition = {
  id: "account-based-marketing",
  name: "Account-Based Marketing Journey",
  description:
    "The platform recognises returning visitors from target accounts across " +
    "multiple sessions and escalates the experience at each visit — from " +
    "awareness messaging on a first touch to a direct meeting CTA on the third — " +
    "without any login or CRM lookup required.",
  targetOutcomes: [
    "First-time visitors see an awareness-oriented experience; visitors who have already clicked a CTA see a meeting-ready experience — the platform escalates automatically",
    "Visitors with three or more page views receive the platform-confidence variant that speaks to evaluation-stage buyers",
    "Contact submissions from multi-visit accounts arrive with full session history: visit count, CTA engagement, pages viewed, and the variant served on each touch",
    "Sales teams can see which accounts are in an active evaluation cycle from the enrichment data, before the contact form is submitted",
  ],
  requiredModules: [
    "adaptive-website",
    "context-intelligence",
    "adaptive-follow-up",
  ],
  recommendedPages: [
    {
      type: "homepage",
      adaptive: true,
      role: "First-touch entry point — source-aware variant selection on initial visit",
    },
    {
      type: "pricing-page",
      adaptive: true,
      role: "High-intent evaluation page — returning visitors get a more direct, confidence-building experience",
    },
    {
      type: "about-page",
      adaptive: false,
      role: "Trust-building supporting page — static; linked from adaptive pages for deeper evaluation",
    },
    {
      type: "contact-page",
      adaptive: false,
      role: "Conversion endpoint — enriched with full multi-visit history on submission",
    },
  ],
  recommendedServices: [
    "onboarding",
    "content-modeling",
    "strategy",
    "optimisation",
  ],
  suggestedKPIs: [
    {
      metric: "Second-visit conversion rate vs single-visit baseline",
      direction: "increase",
      notes: "Measures whether the escalated experience for returning visitors drives more submissions",
    },
    {
      metric: "Average sessions before contact form submission",
      direction: "decrease",
      notes: "History-aware escalation should reduce the time-to-contact for engaged accounts",
    },
    {
      metric: "Multi-touch contact attribution completeness",
      direction: "achieve",
      notes: "% of submissions with visit count, CTA history, and variant-per-session populated in the n8n payload",
    },
    {
      metric: "CTA click rate on returning-visitor escalation variant",
      direction: "increase",
      notes: "Direct measurement of whether the RETURNING_CTA_CLICKED_RULE and HIGH_ENGAGEMENT_RULE are selecting the right plan",
    },
    {
      metric: "Pipeline velocity for multi-session contacts vs single-session",
      direction: "increase",
      notes: "ABM hypothesis: pre-warmed, multi-session contacts should progress through the pipeline faster",
    },
  ],
  useCaseTypes: [
    "visitor-personalisation",
    "lead-qualification",
    "journey-orchestration",
    "campaign-attribution",
    "platform-observability",
  ],
  tier: "full-journey",
  targetVerticals: [
    "Enterprise B2B SaaS",
    "Management consulting",
    "Financial services",
    "Professional services firms running ABM programmes",
  ],
};

// ── 4. Recruitment Experience ─────────────────────────────────────────────────

const RECRUITMENT_EXPERIENCE: UseCaseDefinition = {
  id: "recruitment-experience",
  name: "Recruitment Experience",
  description:
    "Careers pages and job listings that adapt their messaging to the channel " +
    "that brought the candidate — LinkedIn passive browsers see a culture and " +
    "growth angle, Google job searchers see a role-clarity and apply-now angle, " +
    "referred candidates see a social proof and team angle.",
  targetOutcomes: [
    "Candidates arriving from LinkedIn see employer brand and growth messaging; candidates from job search see role clarity and apply prompts — on the same page URL",
    "Application click-through rate improves without increasing recruitment ad spend or building separate landing pages per channel",
    "Candidate source is recorded at page view and carried through to the application CTA click, giving the talent team channel attribution data without a separate ATS integration",
    "The careers page communicates a consistent brand while adapting its emphasis to what each audience cares about most",
  ],
  requiredModules: [
    "adaptive-website",
  ],
  recommendedPages: [
    {
      type: "careers-page",
      adaptive: true,
      role: "Primary adaptive recruitment entry point — culture, growth, and role-clarity angles selected by traffic source",
    },
    {
      type: "job-listing-page",
      adaptive: true,
      role: "Role detail page — apply CTA and social proof adapt to candidate source for higher click-through",
    },
    {
      type: "thank-you-page",
      adaptive: false,
      role: "Post-application confirmation — static; optionally triggers a candidate welcome sequence",
    },
  ],
  recommendedServices: [
    "onboarding",
    "content-modeling",
  ],
  suggestedKPIs: [
    {
      metric: "Application CTA click-through rate by traffic source",
      direction: "increase",
      notes: "Core metric — compare LinkedIn, Google, and direct cohorts to validate variant matching",
    },
    {
      metric: "Careers page bounce rate by traffic source",
      direction: "decrease",
      notes: "Mis-matched variant selection shows up immediately as an elevated bounce rate",
    },
    {
      metric: "Time on careers page by traffic source",
      direction: "increase",
      notes: "Engagement depth indicator — longer sessions suggest the variant resonated",
    },
    {
      metric: "Channel attribution completeness on application CTAs",
      direction: "achieve",
      notes: "% of application CTA clicks with source and variant recorded in the tracking layer",
    },
  ],
  useCaseTypes: [
    "traffic-to-conversion",
    "visitor-personalisation",
    "campaign-attribution",
  ],
  tier: "entry",
  targetVerticals: [
    "Scale-up and growth-stage businesses with active hiring",
    "Recruitment agencies",
    "Professional services firms competing for talent",
    "Tech companies with multiple audience segments (engineers vs commercial)",
  ],
};

// ── 5. Adaptive Follow-Up / Nurture ──────────────────────────────────────────

const ADAPTIVE_FOLLOW_UP_NURTURE: UseCaseDefinition = {
  id: "adaptive-follow-up-nurture",
  name: "Adaptive Follow-Up and Nurture",
  description:
    "Every contact or enquiry submission is automatically enriched with the " +
    "full session context — campaign source, pages visited, engagement signals, " +
    "and the variant the visitor converted on — and dispatched to the team's " +
    "workflow tools for personalised, context-aware follow-up.",
  targetOutcomes: [
    "Sales teams receive contact notifications with traffic source, visit depth, CTA engagement history, and the exact variant that converted the lead — before the first call",
    "CRM records are populated with channel attribution and variant data automatically, without manual data entry or post-submission surveys",
    "Nurture sequences branch based on the channel and variant context: LinkedIn leads get a different opening email than Google leads",
    "No enrichment data is lost when contacts are submitted from mobile or across multiple sessions — the server-side assembly is session-persistent",
  ],
  requiredModules: [
    "adaptive-follow-up",
    "context-intelligence",
  ],
  recommendedPages: [
    {
      type: "contact-page",
      adaptive: false,
      role: "Form submission endpoint — enrichment is assembled server-side, not from the form itself",
    },
    {
      type: "thank-you-page",
      adaptive: false,
      role: "Post-submission confirmation — n8n workflow triggered immediately on this page load",
    },
    {
      type: "homepage",
      adaptive: true,
      role: "Optional: adaptive homepage feeding session history into the enrichment payload on form submission",
    },
  ],
  recommendedServices: [
    "onboarding",
    "strategy",
  ],
  suggestedKPIs: [
    {
      metric: "Enrichment completeness rate",
      direction: "achieve",
      notes: "% of contact submissions where source, variant, session depth, and CTA history are all present in the n8n payload",
    },
    {
      metric: "n8n webhook dispatch success rate",
      direction: "achieve",
      notes: "% of submissions that result in a confirmed dispatch — failures indicate webhook misconfiguration",
    },
    {
      metric: "Time-to-first-response for enriched vs non-enriched contacts",
      direction: "decrease",
      notes: "Teams with full context should respond faster and more relevantly — measure as a cohort comparison",
    },
    {
      metric: "Nurture email open rate by variant served",
      direction: "increase",
      notes: "If nurture sequences branch by variant, this validates whether the branching logic is correct",
    },
  ],
  useCaseTypes: [
    "lead-qualification",
    "campaign-attribution",
    "journey-orchestration",
  ],
  tier: "growth",
  targetVerticals: [
    "B2B SaaS with longer sales cycles",
    "Consulting and advisory firms",
    "High-consideration professional services",
    "Any business running outbound nurture sequences post-enquiry",
  ],
};

// ── 6. Known-User Customer Experience ────────────────────────────────────────

const KNOWN_USER_EXPERIENCE: UseCaseDefinition = {
  id: "known-user-experience",
  name: "Known-User Customer Experience",
  description:
    "Visitors who have previously engaged — read content, clicked a CTA, or " +
    "submitted an enquiry — receive an experience tailored to where they are " +
    "in the relationship, not where they are in the funnel on this session alone.",
  targetOutcomes: [
    "Returning visitors who previously clicked a CTA see a meeting-oriented experience without any login or cookie consent dependency — the platform uses first-party session history",
    "High-engagement visitors (3+ page views across sessions) see a platform-confidence experience that speaks to an evaluator already familiar with the proposition",
    "Customers returning after a project engagement see an expansion or referral angle rather than a cold-acquisition message",
    "The experience degrades gracefully for visitors whose history cannot be retrieved — they receive the standard source-based experience rather than an error",
  ],
  requiredModules: [
    "context-intelligence",
    "adaptive-website",
  ],
  recommendedPages: [
    {
      type: "homepage",
      adaptive: true,
      role: "Primary surface for known-user variant selection — history signals feed the decision engine on each return visit",
    },
    {
      type: "pricing-page",
      adaptive: true,
      role: "High-intent returning visitor destination — known users in evaluation should see a direct, comparison-friendly experience",
    },
    {
      type: "about-page",
      adaptive: false,
      role: "Trust anchor page — static; returned visitors often browse here before converting",
    },
    {
      type: "contact-page",
      adaptive: false,
      role: "Conversion endpoint — known users converting here carry their full history into the enrichment payload",
    },
  ],
  recommendedServices: [
    "content-modeling",
    "optimisation",
    "strategy",
  ],
  suggestedKPIs: [
    {
      metric: "Returning visitor conversion rate vs first-visit cohort",
      direction: "increase",
      notes: "The primary test: does recognising and escalating for returning visitors produce a measurable lift?",
    },
    {
      metric: "CTA click rate on the returning-visitor variant",
      direction: "increase",
      notes: "Direct validation that the RETURNING_CTA_CLICKED_RULE and HIGH_ENGAGEMENT_RULE are selecting the right plan",
    },
    {
      metric: "Session depth for returning visitors (pages per session)",
      direction: "increase",
      notes: "Higher engagement depth indicates the variant is prompting further exploration rather than immediate exit",
    },
    {
      metric: "fromDatabase hit rate in history retrieval",
      direction: "achieve",
      notes: "% of returning visitor requests where history is successfully read from the database — guards against rule false-positives on history failures",
    },
    {
      metric: "Multi-session pipeline velocity",
      direction: "increase",
      notes: "Known users who eventually convert should progress through the sales pipeline faster than cold-first-visit leads",
    },
  ],
  useCaseTypes: [
    "visitor-personalisation",
    "lead-qualification",
    "content-optimisation",
    "platform-observability",
  ],
  tier: "full-journey",
  targetVerticals: [
    "Professional services with recurring client relationships",
    "B2B SaaS with expansion revenue motions",
    "Consulting firms with alumni or referral traffic",
    "Any business where repeat visits before purchase are common",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLED COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All use case definitions, ordered by commercial entry point first.
 *
 * The ordering reflects a natural sales progression:
 *   entry use cases (recruitment, campaigns) → growth (b2b lead gen, follow-up)
 *   → full-journey (ABM, known-user)
 */
export const USE_CASES: readonly UseCaseDefinition[] = [
  B2B_LEAD_GEN,
  ADAPTIVE_CAMPAIGNS,
  ADAPTIVE_FOLLOW_UP_NURTURE,
  RECRUITMENT_EXPERIENCE,
  ACCOUNT_BASED_MARKETING,
  KNOWN_USER_EXPERIENCE,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP INDEX
// ─────────────────────────────────────────────────────────────────────────────

/** Mapped type for O(1) use case lookup by ID. */
export type UseCaseIndex = Readonly<Record<UseCaseId, UseCaseDefinition>>;

/**
 * Index of all use cases by ID.
 *
 * @example
 *   const uc = USE_CASE_INDEX["b2b-lead-gen"];
 *   console.log(uc.requiredModules);
 */
export const USE_CASE_INDEX: UseCaseIndex = Object.fromEntries(
  USE_CASES.map((uc) => [uc.id, uc]),
) as UseCaseIndex;

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure functions for common cross-references.
// All resolve to full objects from the catalog rather than returning raw IDs.

/**
 * Returns all use cases at the given commercial tier.
 *
 * Useful for generating package suggestions:
 *   getUseCasesByTier("entry")        → entry packages
 *   getUseCasesByTier("growth")       → growth packages
 *   getUseCasesByTier("full-journey") → enterprise packages
 *
 * @example
 *   const entryUseCases = getUseCasesByTier("entry");
 */
export function getUseCasesByTier(tier: UseCaseTier): UseCaseDefinition[] {
  return USE_CASES.filter((uc) => uc.tier === tier);
}

/**
 * Returns all use cases that require the given module.
 *
 * Useful for cross-referencing from the module catalog:
 *   "which customer scenarios depend on this module?"
 *
 * @example
 *   const dependents = getUseCasesForModule("context-intelligence");
 */
export function getUseCasesForModule(moduleId: ProductModuleId): UseCaseDefinition[] {
  return USE_CASES.filter((uc) =>
    (uc.requiredModules as readonly string[]).includes(moduleId),
  );
}

/**
 * Returns all use cases that include the given page type in their journey.
 *
 * @example
 *   const useCases = getUseCasesForPage("pricing-page");
 */
export function getUseCasesForPage(pageType: PageTypeId): UseCaseDefinition[] {
  return USE_CASES.filter((uc) =>
    uc.recommendedPages.some((p) => p.type === pageType),
  );
}

/**
 * Returns all use cases that share at least one use case type tag with the
 * given use case — useful for "related use cases" suggestions.
 *
 * The source use case itself is excluded from the results.
 *
 * @example
 *   const related = getRelatedUseCases("b2b-lead-gen");
 */
export function getRelatedUseCases(id: UseCaseId): UseCaseDefinition[] {
  const source = USE_CASE_INDEX[id];
  const sourceTypes = new Set<string>(source.useCaseTypes);
  return USE_CASES.filter(
    (uc) =>
      uc.id !== id &&
      (uc.useCaseTypes as readonly string[]).some((t) => sourceTypes.has(t)),
  );
}

/**
 * Resolves the required module IDs of a use case to full ProductModule objects.
 *
 * @example
 *   const modules = getRequiredModulesForUseCase("account-based-marketing");
 *   modules.forEach(m => console.log(m.label, m.status));
 */
export function getRequiredModulesForUseCase(id: UseCaseId): ProductModule[] {
  const uc = USE_CASE_INDEX[id];
  return uc.requiredModules.map((mid) => MODULE_INDEX[mid]);
}

/**
 * Resolves the recommended service IDs of a use case to full ServiceOffering objects.
 *
 * @example
 *   const services = getRecommendedServicesForUseCase("b2b-lead-gen");
 *   services.forEach(s => console.log(s.label, s.type));
 */
export function getRecommendedServicesForUseCase(id: UseCaseId): ServiceOffering[] {
  const uc = USE_CASE_INDEX[id];
  return uc.recommendedServices.map((sid) => SERVICE_INDEX[sid]);
}

/**
 * Returns all adaptive pages in a use case — i.e. pages that need to be
 * wired into the platform's rendering pipeline.
 *
 * Useful for scoping: "how many adaptive pages does this use case require?"
 *
 * @example
 *   const adaptivePages = getAdaptivePagesForUseCase("b2b-lead-gen");
 */
export function getAdaptivePagesForUseCase(id: UseCaseId): RecommendedPage[] {
  return USE_CASE_INDEX[id].recommendedPages.filter((p) => p.adaptive);
}
