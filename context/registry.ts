/**
 * Context Variable Registry
 *
 * Central, typed catalog of every runtime context variable available to
 * the decision engine, rules system, and AI providers.
 *
 * ─── Purpose ─────────────────────────────────────────────────────────────────
 *
 *   This file is the single source of truth for:
 *
 *   • What variables exist and what they represent
 *   • What type each variable holds (string | enum | number | boolean)
 *   • Where each variable originates (request / session / history / tenant / page)
 *   • Which operators are valid for each variable type
 *   • Whether the variable is exposed to rules, to AI, or both
 *   • An example value for documentation and testing
 *
 * ─── Relationship to field-registry.ts ───────────────────────────────────────
 *
 *   decision/rules/field-registry.ts — the decision-engine layer.
 *   Contains `resolve` functions used by the runtime rule evaluator.
 *   Keys MUST match the key strings in this registry when availableToRules = true.
 *
 *   context/registry.ts (this file) — the catalog layer.
 *   No I/O, no resolvers. Pure descriptive metadata consumed by:
 *     • Admin dictionary view          (shows all variables to operators)
 *     • AI providers                   (filter availableToAI entries)
 *     • Rules UI and validation        (filter availableToRules, map operators)
 *     • buildDecisionContext()         (knows which fields to populate)
 *
 * ─── Enrichment variables ─────────────────────────────────────────────────────
 *
 *   Variables sourced from the external enrichment layer (source: "enrichment")
 *   are populated asynchronously by runEnrichmentPipeline() and attached to
 *   DecisionContext.enrichment. Field resolvers access them via ctx.enrichment?.field.
 *
 * ─── Operator compatibility ───────────────────────────────────────────────────
 *
 *   ContextOperator mirrors FieldOperator from decision/rules/field-registry.ts.
 *   If you add an operator to FieldOperator, add it here too.
 *
 * ─── Adding a new variable ────────────────────────────────────────────────────
 *
 *   1. Add an entry to CONTEXT_VARIABLES below (this file).
 *   2. If availableToRules = true:
 *      a. Add the key to RuleFieldKey in decision/rules/field-registry.ts.
 *      b. Add a FieldDefinition entry (with resolve) to FIELD_REGISTRY there.
 *   3. If the variable requires a new data source, extend BuildDecisionContextOptions
 *      and buildDecisionContext() in decision/decision-context.ts.
 */

// ── Operator types ─────────────────────────────────────────────────────────────
//
// Mirrors FieldOperator from decision/rules/field-registry.ts.
// Defined locally here to keep context/ free of decision/ imports.

export type ContextOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "contains"
  | "not_contains"
  | "exists"
  | "not_exists";

// ── Variable types and sources ─────────────────────────────────────────────────

/**
 * The runtime value kind of a context variable.
 *
 *   string  — free-form string, possibly null (open-ended)
 *   enum    — string constrained to a closed set of allowedValues
 *   number  — numeric value (integer or float)
 *   boolean — true or false
 */
export type ContextVarType = "string" | "enum" | "number" | "boolean";

/**
 * Where the variable's value originates.
 *
 *   request    — HTTP request headers, URL, or User-Agent (synchronous)
 *   session    — Browser cookie state (synchronous from cookie header)
 *   history    — First-party session event history (async Supabase query)
 *   tenant     — Tenant configuration (loaded at server startup or per-request)
 *   page       — Page-level metadata available during RSC render
 *   enrichment — Async external data (geo, company, CRM, ads, account list)
 *   time       — Current date/time derived in the tenant's local timezone
 *   client     — Browser-collected signals (viewport, touch, colour scheme, timezone,
 *                preferred language).  Server-derived fields (OS, browser, engine)
 *                sourced from the User-Agent header are also grouped here for
 *                discoverability. Values are persisted in the mc_cc cookie so they
 *                are available on all subsequent server-side renders.
 *   derived    — Computed signals derived from other layers (enrichment, time, history,
 *                request).  Pure server-side computation, no I/O.  Populated by
 *                computeDerivedContext() after the full pipeline has run.
 *   intent     — Explicit intent predictions derived from all other context layers by
 *                a deterministic heuristic scoring engine.  Populated by
 *                computeIntentContext() after derived context is available.
 *                Exposes intentPrimary, intentSecondary, intentConfidence, and
 *                per-intent scores (0–100) for demo, research, comparison, trial, job.
 */
export type ContextVarSource =
  | "request"
  | "session"
  | "history"
  | "tenant"
  | "page"
  | "enrichment"
  | "time"
  | "client"
  | "derived"
  | "intent";

// ── Operator shortlists per type ───────────────────────────────────────────────
//
// Canonical mapping from variable type to the operators that make sense for it.
// Used by getOperatorsForType() and the context registry entries below.
// Rule UI and validation helpers can derive valid operator lists from these
// rather than hardcoding them per-field.

/** Operators valid for enum and categorical string variables. */
export const OPS_ENUM: readonly ContextOperator[] = [
  "equals", "not_equals", "in", "not_in", "exists", "not_exists",
];

/** Operators valid for open-ended string variables. */
export const OPS_STRING: readonly ContextOperator[] = [
  "equals", "not_equals", "in", "not_in",
  "contains", "not_contains",
  "exists", "not_exists",
];

/** Operators valid for numeric variables. */
export const OPS_NUMBER: readonly ContextOperator[] = [
  "equals", "not_equals",
  "greater_than", "greater_than_or_equal",
  "less_than", "less_than_or_equal",
  "exists", "not_exists",
];

/** Operators valid for boolean variables. */
export const OPS_BOOLEAN: readonly ContextOperator[] = [
  "equals", "not_equals", "exists", "not_exists",
];

/**
 * Returns the canonical operator list for a given variable type.
 * Used by rules UI and validation to avoid per-field operator hardcoding.
 */
export function getOperatorsForType(type: ContextVarType): readonly ContextOperator[] {
  switch (type) {
    case "enum":    return OPS_ENUM;
    case "string":  return OPS_STRING;
    case "number":  return OPS_NUMBER;
    case "boolean": return OPS_BOOLEAN;
  }
}

// ── Context variable definition ────────────────────────────────────────────────

/**
 * Metadata descriptor for a single runtime context variable.
 *
 * All fields are read-only; the registry is immutable at runtime.
 */
export interface ContextVariableDef {
  /**
   * Stable identifier matching the corresponding key in RuleEvaluationContext
   * (and RuleFieldKey when availableToRules = true).
   */
  readonly key: string;

  /** Human-readable label for admin UI and rule editors. */
  readonly label: string;

  /** One-sentence explanation of what the variable represents. */
  readonly description: string;

  /** Runtime value kind — determines valid operators and input widget. */
  readonly type: ContextVarType;

  /** Which part of the request lifecycle populates this variable. */
  readonly source: ContextVarSource;

  /**
   * Valid comparison operators for this variable.
   * Derived from `type` via getOperatorsForType() for most variables;
   * overridable per-variable when a narrower set makes sense.
   */
  readonly operators: readonly ContextOperator[];

  /**
   * Whether this variable is exposed to the rules builder.
   * When true, a matching entry in FIELD_REGISTRY (field-registry.ts) is required.
   * When false, the variable exists in the context but cannot be used in rules.
   */
  readonly availableToRules: boolean;

  /**
   * Whether this variable is sent to AI decision providers.
   * AI providers receive a filtered context snapshot of only these variables.
   */
  readonly availableToAI: boolean;

  /**
   * Closed set of allowed values — present only for enum-type variables.
   * The rules UI renders a <select> instead of a free-text input when present.
   */
  readonly allowedValues?: readonly string[];

  /**
   * Illustrative example value for admin documentation and test fixtures.
   * Never used at runtime.
   */
  readonly exampleValue?: string | number | boolean;
}

// ── Context variable registry ──────────────────────────────────────────────────

/**
 * The complete, ordered catalog of all runtime context variables.
 *
 * Grouped by source in display order:
 *   1. Request signals          — source: "request"
 *   2. Session signals          — source: "session"
 *   3. Behavioural history      — source: "history"
 *   4. Tenant configuration     — source: "tenant"
 *   5. Page-level metadata      — source: "page"
 *   6. Enrichment               — source: "enrichment"
 *   7. Time                     — source: "time"
 *   8. Client / browser         — source: "client"
 *   9. Derived / computed       — source: "derived"
 *  10. Intent predictions       — source: "intent"
 *
 * Status flags for variables not yet fully wired into the runtime:
 *   availableToRules: false — data exists but cannot be used in rule conditions
 *   availableToAI:    false — data exists but is not included in AI context
 */
export const CONTEXT_VARIABLES: readonly ContextVariableDef[] = [

  // ── Request signals ─────────────────────────────────────────────────────────

  {
    key:              "source",
    label:            "Traffic source",
    description:      "Detected acquisition channel, resolved from UTM params or the Referer header.",
    type:             "enum",
    source:           "request",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["google", "linkedin", "direct", "unknown"],
    exampleValue:     "linkedin",
  },

  {
    key:              "device",
    label:            "Device type",
    description:      "Visitor device class inferred from the User-Agent header.",
    type:             "enum",
    source:           "request",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["mobile", "desktop"],
    exampleValue:     "desktop",
  },

  {
    key:              "referrerDomain",
    label:            "Referrer domain",
    description:      "Parsed hostname from the HTTP Referer header, e.g. \"linkedin.com\".",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "linkedin.com",
  },

  {
    key:              "utmSource",
    label:            "UTM source",
    description:      "utm_source query parameter value, e.g. \"newsletter\" or \"google\".",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "newsletter",
  },

  {
    key:              "utmMedium",
    label:            "UTM medium",
    description:      "utm_medium query parameter value, e.g. \"cpc\" or \"email\".",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "cpc",
  },

  {
    key:              "utmCampaign",
    label:            "UTM campaign",
    description:      "utm_campaign query parameter value, e.g. \"spring_sale\".",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "spring_sale",
  },

  {
    key:              "utmContent",
    label:            "UTM content",
    description:      "utm_content query parameter — identifies a specific link or ad creative.",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "hero_banner_v2",
  },

  {
    key:              "utmTerm",
    label:            "UTM term",
    description:      "utm_term query parameter — paid-search keyword.",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "personalization software",
  },

  // Ad-click identifiers — opaque tokens the ad platforms append to the landing
  // URL. Most useful in rules via is-set / is-not-set (e.g. "gclid is set" ⇒ the
  // visit came through a Google ad). Not sent to AI providers (tracking tokens).
  {
    key:              "gclid",
    label:            "Google click ID (gclid)",
    description:      "Google Ads click identifier from the gclid query parameter. Set when the visit arrived via a Google ad.",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "Cj0KCQjw...",
  },

  {
    key:              "fbclid",
    label:            "Meta click ID (fbclid)",
    description:      "Meta / Facebook click identifier from the fbclid query parameter. Set when the visit arrived via a Meta ad.",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "IwAR2...",
  },

  {
    key:              "msclkid",
    label:            "Microsoft click ID (msclkid)",
    description:      "Microsoft Ads click identifier from the msclkid query parameter. Set when the visit arrived via a Microsoft / Bing ad.",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "a1b2c3d4e5f6...",
  },

  {
    key:              "ttclid",
    label:            "TikTok click ID (ttclid)",
    description:      "TikTok click identifier from the ttclid query parameter. Set when the visit arrived via a TikTok ad.",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "E.C.2...",
  },

  {
    key:              "hasCampaignParam",
    label:            "Has campaign parameter",
    description:      "True when the visit carries a utm_campaign — a readable alternative to \"utmCampaign not_exists\" in rule conditions.",
    type:             "boolean",
    source:           "request",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     false,
  },

  {
    key:              "ipAddress",
    label:            "IP address",
    description:      "Visitor IP address resolved from the incoming request headers (x-forwarded-for or socket remote address). Used for geo / company enrichment; not sent to AI providers.",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "203.0.113.42",
  },

  // ── Session signals ─────────────────────────────────────────────────────────

  {
    key:              "visitType",
    label:            "Visit type",
    description:      "First touch (new) or repeat visit (returning), resolved from the mc_seen cookie.",
    type:             "enum",
    source:           "session",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["new", "returning"],
    exampleValue:     "returning",
  },

  // ── Behavioural history (first-party, from Supabase events) ────────────────

  {
    key:              "pageViewCount",
    label:            "Page views (prior)",
    description:      "Number of page_view events recorded for this session before the current render.",
    type:             "number",
    source:           "history",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     3,
  },

  {
    key:              "hasClickedCta",
    label:            "Has clicked CTA",
    description:      "True when this session has at least one recorded cta_click event.",
    type:             "boolean",
    source:           "history",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "ctaClickCount",
    label:            "CTA click count",
    description:      "Total number of cta_click events recorded for this session.",
    type:             "number",
    source:           "history",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     1,
  },

  {
    key:              "hasSeenHeroVariant",
    label:            "Has seen hero variant",
    description:      "True when a hero variant has been recorded as served for this session.",
    type:             "boolean",
    source:           "history",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     true,
  },

  {
    key:              "lastHeroKey",
    label:            "Last hero variant",
    description:      "Hero variant key from the most recent served_variant row for this session.",
    type:             "string",
    source:           "history",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "hero_linkedin_vision",
  },

  {
    key:              "lastCtaKey",
    label:            "Last CTA variant",
    description:      "CTA variant key from the most recent served_variant row for this session.",
    type:             "string",
    source:           "history",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "cta_guide",
  },

  {
    key:              "daysSinceFirstSeen",
    label:            "Days since first seen",
    description:      "Whole days since the earliest recorded event for this session.",
    type:             "number",
    source:           "history",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     7,
  },

  {
    key:              "hasSubmittedForm",
    label:            "Has submitted form",
    description:      "True when this session has at least one recorded form_submission event. (Future — not yet wired.)",
    type:             "boolean",
    source:           "history",
    operators:        OPS_BOOLEAN,
    availableToRules: false,
    availableToAI:    false,
    exampleValue:     false,
  },

  // ── Behavioral journey signals (from visitor_behavior_state) ────────────────
  //
  // Derived from the journey event stream via the behavioral personalization
  // layer.  Available when visitor_behavior_state has been populated for this
  // (tenant, session) — i.e. after at least one journey event has been processed.
  //
  // Field resolver: ctx.history.journey?.<camelCaseField>

  {
    key:              "journey.funnelStage",
    label:            "Journey funnel stage",
    description:
      "Visitor funnel stage derived from behavioral signals (scoring + sequences + milestones). " +
      "awareness → consideration → intent → high_intent → customer. " +
      "null when no journey state exists yet (first visit).",
    type:             "enum",
    source:           "history",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["awareness", "consideration", "intent", "high_intent", "customer"],
    exampleValue:     "intent",
  },

  {
    key:              "journey.intentScore",
    label:            "Journey intent score",
    description:
      "Aggregate intent score (0–100) derived from scoring rules with recency decay. " +
      "Higher values indicate stronger purchase intent.",
    type:             "number",
    source:           "history",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     45,
  },

  {
    key:              "journey.engagementScore",
    label:            "Journey engagement score",
    description:
      "Depth-of-engagement score (0–100) based on page views, CTA clicks, downloads, and form interactions.",
    type:             "number",
    source:           "history",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     30,
  },

  {
    key:              "journey.recencyScore",
    label:            "Journey recency score",
    description:
      "Recency score (0–100) reflecting how recently the visitor was active. " +
      "100 = active today, 70 = within 7 days, 30 = within 30 days, 10 = within 90 days.",
    type:             "number",
    source:           "history",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     70,
  },

  {
    key:              "journey.sequenceScore",
    label:            "Journey sequence score",
    description:
      "Bonus intent score from fully matched behavior sequence patterns (e.g. about → pricing).",
    type:             "number",
    source:           "history",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     30,
  },

  {
    key:              "journey.hasVisitedPricing",
    label:            "Has visited pricing page",
    description:      "True when this session has viewed the pricing page at least once.",
    type:             "boolean",
    source:           "history",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     true,
  },

  {
    key:              "journey.hasVisitedAbout",
    label:            "Has visited about page",
    description:      "True when this session has viewed the about page at least once.",
    type:             "boolean",
    source:           "history",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "journey.hasVisitedCases",
    label:            "Has visited cases page",
    description:      "True when this session has viewed a case study or portfolio page.",
    type:             "boolean",
    source:           "history",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "journey.hasVisitedContact",
    label:            "Has visited contact page",
    description:      "True when this session has viewed the contact page.",
    type:             "boolean",
    source:           "history",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "journey.hasSubmittedForm",
    label:            "Journey: has submitted form",
    description:
      "True when this session has a recorded form_submit journey event. " +
      "Used to identify converted visitors.",
    type:             "boolean",
    source:           "history",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "journey.hasStartedForm",
    label:            "Journey: has started form",
    description:
      "True when this session has started (but not necessarily submitted) a form. " +
      "Combined with hasSubmittedForm=false, signals an abandoned form.",
    type:             "boolean",
    source:           "history",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "journey.matchedSequences",
    label:            "Matched behavior sequences",
    description:
      "Slugs of behavior_sequence_patterns that were fully matched for this session. " +
      "Example: [\"about_to_pricing\"]. Use the 'contains' operator to target a specific slug.",
    type:             "string",
    source:           "history",
    operators:        ["contains", "not_contains", "exists", "not_exists"],
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "about_to_pricing",
  },

  // ── Tenant configuration ────────────────────────────────────────────────────

  {
    key:              "package",
    label:            "Package tier",
    description:      "Active subscription tier for this tenant, controlling which blocks and features are enabled.",
    type:             "enum",
    source:           "tenant",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["starter", "growth", "pro"],
    exampleValue:     "growth",
  },

  {
    key:              "tenantId",
    label:            "Tenant ID",
    description:      "Unique identifier for the active tenant, resolved from the request hostname.",
    type:             "string",
    source:           "request",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "workengine",
  },

  // ── Page-level metadata ─────────────────────────────────────────────────────

  {
    key:              "pathname",
    label:            "Page pathname",
    description:      "URL pathname of the currently rendered page, e.g. \"/\" or \"/blog/my-post\".",
    type:             "string",
    source:           "page",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "/",
  },

  {
    key:              "entryPath",
    label:            "Entry path (landing page)",
    description:      "Pathname of the session's first page view, persisted sticky. Lets a later view target \"entered on a deep page\" (e.g. entryPath != \"/\").",
    type:             "string",
    source:           "page",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "/pricing",
  },

  {
    key:              "isBot",
    label:            "Is bot / crawler",
    description:      "True when the request looks like a crawler/bot (User-Agent heuristic + cloud-provider IP as a proxy). Bots are excluded from variant-serving and measurement.",
    type:             "boolean",
    source:           "request",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     false,
  },

  {
    key:              "pageType",
    label:            "Page type",
    description:      "Content category of the current page, e.g. \"landing\", \"article\", \"listing\".",
    type:             "string",
    source:           "page",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "landing",
  },

  {
    key:              "templateKey",
    label:            "Template key",
    description:      "Page template identifier active for the current render.",
    type:             "string",
    source:           "page",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "standard-landing",
  },

  {
    key:              "experimentActive",
    label:            "Experiment active",
    description:      "True when an A/B experiment is currently running for this tenant and page. (Future — not yet wired.)",
    type:             "boolean",
    source:           "page",
    operators:        OPS_BOOLEAN,
    availableToRules: false,
    availableToAI:    false,
    exampleValue:     false,
  },

  // ── Enrichment — IP classification ──────────────────────────────────────────

  {
    key:              "ipVersion",
    label:            "IP version",
    description:      "Address family of the visitor's request IP: \"ipv4\" or \"ipv6\". " +
                      "Null when the IP is absent or unclassifiable.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    allowedValues:    ["ipv4", "ipv6"],
    exampleValue:     "ipv4",
  },

  {
    key:              "isCloudProvider",
    label:            "Is cloud provider",
    description:      "True when the visitor's IP belongs to a known cloud hosting provider, CDN, or datacenter " +
                      "(Google, Amazon, Microsoft, Cloudflare, etc.). " +
                      "Used to skip company-identification enrichment for automated/bot traffic. " +
                      "Null when network signals are unavailable.",
    type:             "boolean",
    source:           "enrichment",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     false,
  },

  // ── Enrichment — Geo ────────────────────────────────────────────────────────

  {
    key:              "countryCode",
    label:            "Country code",
    description:      "ISO 3166-1 alpha-2 country code resolved from the visitor's IP address, e.g. \"NL\" or \"US\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "NL",
  },

  {
    key:              "region",
    label:            "Region / state",
    description:      "State or province name resolved from the visitor's IP, e.g. \"Noord-Holland\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Noord-Holland",
  },

  {
    key:              "city",
    label:            "City",
    description:      "City name resolved from the visitor's IP, e.g. \"Amsterdam\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Amsterdam",
  },

  // ── Enrichment — Location (CBS buurt) ──────────────────────────────────────
  // Resolved by the cbs-location stage from the visitor's neighbourhood (buurt),
  // via IP geo, an explicit form postcode/place, or a scenario override.

  {
    key:              "locationAreaCode",
    label:            "Location area code (buurt)",
    description:      "CBS buurtcode the neighbourhood statistics were resolved for (NL), e.g. \"BU03630000\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "BU03630000",
  },

  {
    key:              "locationUrbanityClass",
    label:            "Location urbanity class",
    description:      "CBS urbanity class (MateVanStedelijkheid) for the visitor's buurt: 1 (zeer sterk stedelijk) to 5 (niet stedelijk); density-derived fallback when suppressed.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     2,
  },

  {
    key:              "locationIncomeBand",
    label:            "Location income band",
    description:      "Coarse average-income band for the visitor's buurt, e.g. \"low\" / \"mid\" / \"high\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "high",
  },

  {
    key:              "locationBusinessShare",
    label:            "Location business share",
    description:      "Business establishments per inhabitant in the visitor's buurt (0–1).",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     0.3,
  },

  // ── Enrichment — CBS location (D5 Fase 0: energy / solar / WOZ / sector) ────
  {
    key:              "locationAvgGasUsage",
    label:            "Location avg gas use (m³)",
    description:      "Average natural-gas use per home in the visitor's buurt (m³/year, CBS 85984NED).",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     1200,
  },
  {
    key:              "locationAvgElectricityUsage",
    label:            "Location avg electricity use (kWh)",
    description:      "Average electricity delivery per home in the visitor's buurt (kWh/year, CBS 85984NED).",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     2900,
  },
  {
    key:              "locationSolarPct",
    label:            "Location solar homes (%)",
    description:      "Share of homes with solar power in the visitor's buurt (%, CBS 85984NED).",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     18.5,
  },
  {
    key:              "locationAvgWozValue",
    label:            "Location avg WOZ value (€)",
    description:      "Average WOZ (property) value of homes in the visitor's buurt (euro, CBS 85984NED).",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     385000,
  },
  {
    key:              "locationDominantBusinessSector",
    label:            "Location dominant sector",
    description:      "Dominant SBI business sector in the visitor's buurt, e.g. \"financial_realestate\", \"agriculture\" (CBS 85984NED).",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "financial_realestate",
  },

  // ── Enrichment — Company identification ────────────────────────────────────

  {
    key:              "companyName",
    label:            "Company name",
    description:      "Display name of the company resolved from reverse-IP lookup, e.g. \"Acme Corp\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Acme Corp",
  },

  {
    key:              "companyDomain",
    label:            "Company domain",
    description:      "Primary domain of the identified company, e.g. \"acme.com\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "acme.com",
  },

  {
    key:              "companyIndustry",
    label:            "Company industry",
    description:      "Industry vertical of the identified company, e.g. \"Software\" or \"Financial Services\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Software",
  },

  {
    key:              "companySize",
    label:            "Company size",
    description:      "Employee size bucket for the identified company, e.g. \"51-200\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "51-200",
  },

  // ── Enrichment — Leadinfo (firmographics via the Leadinfo dataLayer) ─────────
  {
    key: "leadinfoMatched", label: "Leadinfo matched",
    description: "True when Leadinfo identified a company for this visitor (via the dataLayer).",
    type: "boolean", source: "enrichment", operators: OPS_BOOLEAN,
    availableToRules: true, availableToAI: true, exampleValue: true,
  },
  {
    key: "leadinfoCompanyName", label: "Leadinfo company name",
    description: "Company name from Leadinfo, e.g. \"Steets B.V.\".",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "Steets B.V.",
  },
  {
    key: "leadinfoCompanyDomain", label: "Leadinfo company domain",
    description: "Primary domain from Leadinfo, e.g. \"steets.nl\".",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "steets.nl",
  },
  {
    key: "leadinfoCompanyCountry", label: "Leadinfo company country",
    description: "ISO country code from Leadinfo, e.g. \"NL\".",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "NL",
  },
  {
    key: "leadinfoCocNumber", label: "Leadinfo KvK number",
    description: "Dutch Chamber of Commerce (KvK) number from Leadinfo.",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "32094701",
  },
  {
    key: "leadinfoBranchCode", label: "Leadinfo SBI code",
    description: "Industry branch code from Leadinfo (SBI for NL).",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "7311",
  },
  {
    key: "leadinfoBranchCodeSic87", label: "Leadinfo SIC-87 code",
    description: "SIC-87 industry branch code from Leadinfo (international).",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "73110",
  },
  {
    key: "leadinfoSalesVolume", label: "Leadinfo sales volume",
    description: "Annual sales volume from Leadinfo (raw value or bucket).",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "378106",
  },
  {
    key: "leadinfoEmployees", label: "Leadinfo employees (bucket)",
    description: "Employee size bucket from Leadinfo, e.g. \"11-50\".",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "11-50",
  },
  {
    key: "leadinfoEmployeesTotal", label: "Leadinfo employees (count)",
    description: "Total employee count from Leadinfo.",
    type: "number", source: "enrichment", operators: OPS_NUMBER,
    availableToRules: true, availableToAI: true, exampleValue: 52,
  },

  // ── Lead Base — returning-visitor signals (close the personalization loop) ──
  {
    key: "isReturningVisitor", label: "Returning visitor",
    description: "True when this visitor has a prior stored profile (visited before).",
    type: "boolean", source: "enrichment", operators: OPS_BOOLEAN,
    availableToRules: true, availableToAI: true, exampleValue: true,
  },
  {
    key: "leadScore", label: "Lead score",
    description: "Composite hot-lead score (0–100) from the stored profile.",
    type: "number", source: "enrichment", operators: OPS_NUMBER,
    availableToRules: true, availableToAI: true, exampleValue: 72,
  },
  {
    key: "isHotLead", label: "Hot lead",
    description: "True when the lead score clears the hot threshold (default 60).",
    type: "boolean", source: "enrichment", operators: OPS_BOOLEAN,
    availableToRules: true, availableToAI: true, exampleValue: true,
  },
  {
    key: "isKnownLead", label: "Known lead",
    description: "True when the stored profile is a named (known) lead or a customer.",
    type: "boolean", source: "enrichment", operators: OPS_BOOLEAN,
    availableToRules: true, availableToAI: true, exampleValue: true,
  },
  {
    key: "isCustomer", label: "Customer",
    description: "True when the stored profile is a customer.",
    type: "boolean", source: "enrichment", operators: OPS_BOOLEAN,
    availableToRules: true, availableToAI: true, exampleValue: false,
  },
  {
    key: "returningLeadLevel", label: "Returning lead level",
    description: "Prior identity level: anonymous | recognised | known | customer.",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "known",
  },
  {
    key: "returningLeadStatus", label: "Returning lead status",
    description: "Prior lifecycle status: visitor | engaged | mql | sql | customer | churned.",
    type: "string", source: "enrichment", operators: OPS_STRING,
    availableToRules: true, availableToAI: true, exampleValue: "sql",
  },
  {
    key: "priorVisitCount", label: "Prior visit count",
    description: "Number of visits recorded before this one.",
    type: "number", source: "enrichment", operators: OPS_NUMBER,
    availableToRules: true, availableToAI: true, exampleValue: 4,
  },
  {
    key: "daysSinceLastVisit", label: "Days since last visit",
    description: "Whole days since the visitor's previous visit.",
    type: "number", source: "enrichment", operators: OPS_NUMBER,
    availableToRules: true, availableToAI: true, exampleValue: 7,
  },

  {
    key:              "companyMatchConfidence",
    label:            "Company match confidence",
    description:      "Confidence score (0–1) for the reverse-IP company match. Null when no match or provider does not emit a score.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     0.85,
  },

  {
    key:              "companyMatchSource",
    label:            "Company match source",
    description:      "Which provider produced the company match, e.g. \"clearbit\", \"6sense\", \"ip2company\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    false,
    exampleValue:     "clearbit",
  },

  // ── Enrichment — Ads attribution ───────────────────────────────────────────

  {
    key:              "adCampaign",
    label:            "Ad campaign",
    description:      "Ad platform campaign name or ID from UTM params or platform API, e.g. \"spring-2025-brand\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "spring-2025-brand",
  },

  {
    key:              "adAdGroup",
    label:            "Ad group",
    description:      "Ad group or ad set name from UTM content or platform API, e.g. \"brand-exact-match\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "brand-exact-match",
  },

  {
    key:              "adKeyword",
    label:            "Ad keyword",
    description:      "Search keyword that triggered the ad, from utm_term or platform API, e.g. \"crm software\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "crm software",
  },

  // ── Enrichment — CRM match ─────────────────────────────────────────────────

  {
    key:              "crmMatched",
    label:            "CRM matched",
    description:      "True when a CRM contact record was matched for this visitor.",
    type:             "boolean",
    source:           "enrichment",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     true,
  },

  {
    key:              "crmLifecycleStage",
    label:            "CRM lifecycle stage",
    description:      "HubSpot / Salesforce lifecycle stage, e.g. \"mql\", \"sql\", \"opportunity\", \"customer\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "mql",
  },

  {
    key:              "crmSegment",
    label:            "CRM segment",
    description:      "Marketing segment label from the CRM, e.g. \"enterprise-prospect\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "enterprise-prospect",
  },

  {
    key:              "crmAccountOwner",
    label:            "CRM account owner",
    description:      "Name of the account owner or SDR from the CRM, e.g. \"Sarah Johnson\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     "Sarah Johnson",
  },

  // ── Enrichment — CRM company match (HubSpot company-by-domain) ────────────

  {
    key:              "crmCompanyId",
    label:            "CRM company ID",
    description:      "HubSpot Company object ID for the matched company, e.g. \"12345678\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     "12345678",
  },

  {
    key:              "crmCompanyName",
    label:            "CRM company name",
    description:      "Company name from the CRM, e.g. \"Acme Corp\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Acme Corp",
  },

  {
    key:              "crmCompanyDomain",
    label:            "CRM company domain",
    description:      "Primary domain of the matched company from the CRM, e.g. \"acme.com\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "acme.com",
  },

  {
    key:              "crmIndustry",
    label:            "CRM industry",
    description:      "Industry field from the CRM company record, e.g. \"SOFTWARE\", \"FINANCIAL_SERVICES\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "SOFTWARE",
  },

  {
    key:              "crmIsCustomer",
    label:            "CRM is customer",
    description:      "True when the CRM lifecycle stage for this company is \"customer\".",
    type:             "boolean",
    source:           "enrichment",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  // ── Enrichment — Account list (ABM) ───────────────────────────────────────

  {
    key:              "targetAccountMatched",
    label:            "Target account matched",
    description:      "True when this visitor's company is on a target account list.",
    type:             "boolean",
    source:           "enrichment",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     true,
  },

  {
    key:              "targetAccountTier",
    label:            "Target account tier",
    description:      "Account tier label for the matched account, e.g. \"tier-1\", \"tier-2\", \"tier-3\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "tier-1",
  },

  {
    key:              "targetAccountList",
    label:            "Target account list",
    description:      "Name of the account list that was matched, e.g. \"Q2-2025-ICP\" or \"named-accounts-emea\".",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Q2-2025-ICP",
  },

  // ── Enrichment — Geo coordinates (from IP-geo provider) ─────────────────────

  {
    key:              "latitude",
    label:            "Latitude",
    description:      "Approximate latitude resolved from the visitor's IP address (city-level precision, ≈ 10–50 km radius). " +
                      "Populated by MaxMind, IPinfo, or CDN coordinate headers. " +
                      "Null when no geo provider returned coordinate data.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     52.3676,
  },

  {
    key:              "longitude",
    label:            "Longitude",
    description:      "Approximate longitude resolved from the visitor's IP address (city-level precision, ≈ 10–50 km radius). " +
                      "Populated by MaxMind, IPinfo, or CDN coordinate headers. " +
                      "Null when no geo provider returned coordinate data.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     4.9041,
  },

  // ── Enrichment — Reverse geocode (address fields from lat/lng) ───────────────

  {
    key:              "addressCountry",
    label:            "Address country",
    description:      "ISO 3166-1 alpha-2 country code from the reverse-geocode lookup, e.g. \"NL\". " +
                      "May differ from countryCode (IP-derived) when the lat/lng provider returns a more precise location. " +
                      "Null when the reverse-geocode enricher is disabled or coordinates were unavailable.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "NL",
  },

  {
    key:              "addressRegion",
    label:            "Address region",
    description:      "State, province, or region name from reverse-geocode, e.g. \"Noord-Holland\". " +
                      "Null when the enricher is disabled or coordinates were unavailable.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Noord-Holland",
  },

  {
    key:              "addressCity",
    label:            "Address city",
    description:      "City name from reverse-geocode, e.g. \"Amsterdam\". " +
                      "Null when the enricher is disabled or coordinates were unavailable.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Amsterdam",
  },

  {
    key:              "addressMunicipality",
    label:            "Address municipality",
    description:      "Municipality or district name from reverse-geocode. " +
                      "May differ from addressCity in areas where the city is part of a larger municipality. " +
                      "Null when the enricher is disabled, the provider did not return this field, or coordinates were unavailable.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    false,
    exampleValue:     "Amsterdam",
  },

  {
    key:              "addressPostcode",
    label:            "Address postcode",
    description:      "Postal or ZIP code from reverse-geocode, e.g. \"1012\". " +
                      "Null when the enricher is disabled or coordinates were unavailable.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "1012",
  },

  {
    key:              "addressFormatted",
    label:            "Address formatted",
    description:      "Full human-readable formatted address from reverse-geocode, " +
                      "e.g. \"Nieuwezijds Voorburgwal, Amsterdam, Noord-Holland, Netherlands\". " +
                      "Useful as a display label or supplementary AI context hint. " +
                      "Null when the enricher is disabled or all providers failed.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     "Damrak, Amsterdam, Noord-Holland, Netherlands",
  },

  {
    key:              "addressSource",
    label:            "Address source",
    description:      "Which reverse-geocode provider produced the address fields: \"locationiq\", \"bigdatacloud\", or \"nominatim\". " +
                      "Null when the enricher is disabled or all providers failed.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    false,
    exampleValue:     "bigdatacloud",
  },

  // ── Enrichment — Weather (current conditions from lat/lng via Open-Meteo) ────

  {
    key:              "weatherCode",
    label:            "Weather code",
    description:      "WMO weather interpretation code for the visitor's current location (0–99). " +
                      "0 = clear sky, 1–3 = partly cloudy, 45/48 = fog, 51–67 = drizzle/rain, " +
                      "71–77 = snow, 80–82 = showers, 95/96/99 = thunderstorm. " +
                      "Null when the weather enricher is disabled or coordinates were unavailable.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     2,
  },

  {
    key:              "temperatureNow",
    label:            "Temperature now",
    description:      "Current air temperature at 2 m height in degrees Celsius, rounded to one decimal place. " +
                      "Null when the weather enricher is disabled or coordinates were unavailable.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     8.5,
  },

  {
    key:              "precipitationProbability",
    label:            "Precipitation probability",
    description:      "Hourly precipitation probability as a percentage (0–100). " +
                      "Null when the weather enricher is disabled or coordinates were unavailable.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     40,
  },

  {
    key:              "isRaining",
    label:            "Is raining",
    description:      "True when the weather code indicates active precipitation " +
                      "(drizzle, rain, freezing rain, snow, showers, or thunderstorm). " +
                      "Null when the weather enricher is disabled or coordinates were unavailable.",
    type:             "boolean",
    source:           "enrichment",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "windSpeed",
    label:            "Wind speed",
    description:      "Wind speed at 10 m height in km/h, rounded to one decimal place. " +
                      "Null when the weather enricher is disabled or coordinates were unavailable.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     15.2,
  },

  {
    key:              "cloudCover",
    label:            "Cloud cover",
    description:      "Sky cloud cover percentage (0–100). " +
                      "Null when the weather enricher is disabled or coordinates were unavailable.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     60,
  },

  {
    key:              "weatherSummary",
    label:            "Weather summary",
    description:      "Human-readable weather summary, e.g. \"Partly cloudy, 8°C, 15 km/h wind\". " +
                      "Suitable as an AI context hint or display label. " +
                      "Null when the weather enricher is disabled or coordinates were unavailable.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     "Partly cloudy, 8°C, 15 km/h wind",
  },

  {
    key:              "weatherSource",
    label:            "Weather source",
    description:      "Provider that produced the weather data. Currently always \"open-meteo\" when the stage runs successfully. " +
                      "Null when the weather enricher is disabled or all providers failed.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    false,
    exampleValue:     "open-meteo",
  },

  // ── Enrichment — GA4 Analytics History ───────────────────────────────────────
  //
  // Two pairs of fields distinguish the most-recent GA4 session from a prior one.
  //
  //   gaCurrent*    — city / region / country / channel from the visitor's most-recent
  //                   GA4 session date (row[0] when ordered by date DESC).
  //                   Always populated when GA4 returned ≥1 row.
  //
  //   gaLastKnown*  — same fields from the previous GA4 session (row[1]).
  //                   Null when only one date-row exists — no prior session to compare.
  //
  // This split lets rules and AI distinguish "visitor's location this session"
  // from "visitor's location last time we saw them".

  {
    key:              "gaCurrentCity",
    label:            "GA4 current city",
    description:      "City from the visitor's most-recent GA4 session (latest date row, ordered by " +
                      "date DESC). Populated whenever the GA4 History stage returns ≥1 row for this " +
                      "visitor. Never overwrites live geo city. " +
                      "Null when GA4 History is disabled or the visitor has no recorded sessions.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Amsterdam",
  },

  {
    key:              "gaCurrentRegion",
    label:            "GA4 current region",
    description:      "Region (state / province) from the visitor's most-recent GA4 session. " +
                      "Null when GA4 History is disabled or no sessions exist.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Noord-Holland",
  },

  {
    key:              "gaCurrentCountry",
    label:            "GA4 current country",
    description:      "Country from the visitor's most-recent GA4 session. " +
                      "Human-readable country name as returned by GA4, e.g. \"Netherlands\". " +
                      "Null when GA4 History is disabled or no sessions exist.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Netherlands",
  },

  {
    key:              "gaCurrentChannelGroup",
    label:            "GA4 current channel group",
    description:      "Default Channel Group from the visitor's most-recent GA4 session, " +
                      "e.g. \"Organic Search\", \"Direct\", \"Paid Search\", \"Email\", \"Referral\". " +
                      "Derived from GA4's sessionDefaultChannelGrouping dimension. " +
                      "Null when GA4 History is disabled or no sessions exist.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Organic Search",
  },

  {
    key:              "gaLastKnownCity",
    label:            "GA4 previous city",
    description:      "City from the visitor's previous GA4 session (second-most-recent date row). " +
                      "Null when only one date-row exists — no distinct prior session is available. " +
                      "Use gaCurrentCity for the most-recent session.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Rotterdam",
  },

  {
    key:              "gaLastKnownRegion",
    label:            "GA4 previous region",
    description:      "Region from the visitor's previous GA4 session. " +
                      "Null when only one date-row exists.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Zuid-Holland",
  },

  {
    key:              "gaLastKnownCountry",
    label:            "GA4 previous country",
    description:      "Country from the visitor's previous GA4 session. " +
                      "Human-readable country name as returned by GA4. " +
                      "Null when only one date-row exists.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Netherlands",
  },

  {
    key:              "gaSessionCount",
    label:            "GA4 session count",
    description:      "Total number of GA4 sessions recorded for this visitor within the configured " +
                      "lookback window (default 90 days). Useful as a proxy for visitor engagement / " +
                      "return frequency. Null when no sessions are found or the GA4 stage did not run.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     7,
  },

  {
    key:              "gaRowsReturned",
    label:            "GA4 rows returned",
    description:      "Number of date-rows returned by the GA4 Data API for this visitor. " +
                      "0 = visitor not yet seen in GA4; 1 = current session only (no prior); " +
                      "≥2 = current + previous session data available. " +
                      "Null when the GA4 History stage did not run.",
    type:             "number",
    source:           "enrichment",
    operators:        OPS_NUMBER,
    availableToRules: false,
    availableToAI:    false,
    exampleValue:     2,
  },

  {
    key:              "gaLastChannelGroup",
    label:            "GA4 previous channel group",
    description:      "Default Channel Group from the visitor's previous GA4 session. " +
                      "Null when only one date-row exists. " +
                      "Use gaCurrentChannelGroup for the most-recent session.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Organic Search",
  },

  {
    key:              "gaHistorySource",
    label:            "GA4 history source",
    description:      "Which source produced the GA4 history fields. Currently always \"ga4\" " +
                      "when the stage runs successfully. Null when the GA4 History stage was " +
                      "not run or produced no results.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    false,
    exampleValue:     "ga4",
  },

  // ── Normalized current location (GA4 preferred; IP geo fallback) ─────────────
  //
  // These four fields provide a single authoritative "where is this visitor now"
  // answer, abstracting over the two possible sources:
  //
  //   "ga4"    — gaCurrentCity / gaCurrentRegion / gaCurrentCountry were used.
  //              GA4 derives location from Google's own signals and is often more
  //              accurate for human-readable city and country names than IP geo.
  //
  //   "ip_geo" — GA4 history was unavailable (stage skipped / not configured /
  //              0 rows returned).  city / region / countryCode from IP geo were
  //              used instead.  Note: IP geo gives an ISO 2-letter country code
  //              when currentCountry is sourced from "ip_geo".
  //
  // IMPORTANT: IP-based geo always runs independently regardless of which
  // source populates current*.  Latitude, longitude, networkAsn, networkOrg,
  // networkDomain, and all company enrichment continue to come from IP geo.

  {
    key:              "currentCity",
    label:            "Current city",
    description:      "Best-available current city name for this visitor. " +
                      "Source: GA4 current city when available (preferred), otherwise IP geo city. " +
                      "Null when neither source produced a value. " +
                      "See currentLocationSource to know which source was used.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Amsterdam",
  },

  {
    key:              "currentRegion",
    label:            "Current region",
    description:      "Best-available current region (state / province) for this visitor. " +
                      "Source: GA4 current region when available (preferred), otherwise IP geo region. " +
                      "Null when neither source produced a value.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Noord-Holland",
  },

  {
    key:              "currentCountry",
    label:            "Current country",
    description:      "Best-available current country for this visitor. " +
                      "When sourced from GA4: human-readable name, e.g. \"Netherlands\". " +
                      "When sourced from IP geo: ISO 3166-1 alpha-2 code, e.g. \"NL\". " +
                      "Check currentLocationSource to know the active format.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Netherlands",
  },

  {
    key:              "currentLocationSource",
    label:            "Current location source",
    description:      "Which source populated the currentCity / currentRegion / currentCountry fields. " +
                      "\"ga4\" = Google Analytics 4 history (preferred — more accurate human-readable names). " +
                      "\"ip_geo\" = IP-based geo (MaxMind / CDN headers) — used when GA4 history is unavailable. " +
                      "Null when no location data was resolved from either source.",
    type:             "string",
    source:           "enrichment",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "ga4",
  },

  // ── Client / device (server UA parsing + browser-collected, via mc_cc cookie) ─

  {
    key:              "deviceType",
    label:            "Device type (extended)",
    description:      "Extended device class from User-Agent: mobile, tablet, or desktop. " +
                      "Adds tablet as a distinct category vs. the legacy binary device field.",
    type:             "enum",
    source:           "client",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["mobile", "tablet", "desktop"],
    exampleValue:     "desktop",
  },

  {
    key:              "osName",
    label:            "OS name",
    description:      "Operating system family parsed from the User-Agent header, " +
                      "e.g. \"Windows\", \"macOS\", \"iOS\", \"Android\".",
    type:             "string",
    source:           "client",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "macOS",
  },

  {
    key:              "osVersion",
    label:            "OS version",
    description:      "OS version string parsed from the User-Agent, e.g. \"10.0\", \"14.4\", \"12\".",
    type:             "string",
    source:           "client",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "14.4",
  },

  {
    key:              "browserName",
    label:            "Browser name",
    description:      "Browser name parsed from the User-Agent, e.g. \"Chrome\", \"Firefox\", \"Safari\", \"Edge\".",
    type:             "string",
    source:           "client",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Chrome",
  },

  {
    key:              "browserVersion",
    label:            "Browser major version",
    description:      "Browser major version number as a string, e.g. \"120\", \"17\". " +
                      "Use numeric operators with coercion, or string equality for exact matching.",
    type:             "string",
    source:           "client",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "120",
  },

  {
    key:              "engineName",
    label:            "Rendering engine",
    description:      "Browser rendering engine from the User-Agent, e.g. \"Blink\", \"Gecko\", \"WebKit\", \"Trident\".",
    type:             "string",
    source:           "client",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "Blink",
  },

  {
    key:              "isTouchDevice",
    label:            "Is touch device",
    description:      "True when the visitor's primary input supports touch (coarse pointer). " +
                      "Collected client-side on first page load; null until then.",
    type:             "boolean",
    source:           "client",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "viewportWidth",
    label:            "Viewport width",
    description:      "Browser viewport width in CSS pixels at collection time. " +
                      "Collected client-side on first page load; null until then.",
    type:             "number",
    source:           "client",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     1440,
  },

  {
    key:              "viewportHeight",
    label:            "Viewport height",
    description:      "Browser viewport height in CSS pixels at collection time. " +
                      "Collected client-side on first page load; null until then.",
    type:             "number",
    source:           "client",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     900,
  },

  {
    key:              "pixelRatio",
    label:            "Pixel ratio",
    description:      "Device pixel ratio (screen density): 1.0 = standard, 2.0 = Retina/HiDPI. " +
                      "Collected client-side on first page load; null until then.",
    type:             "number",
    source:           "client",
    operators:        OPS_NUMBER,
    availableToRules: false,
    availableToAI:    false,
    exampleValue:     2,
  },

  {
    key:              "preferredColorScheme",
    label:            "Preferred colour scheme",
    description:      "Result of the prefers-color-scheme media query. " +
                      "Collected client-side on first page load; null until then.",
    type:             "enum",
    source:           "client",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    false,
    allowedValues:    ["light", "dark", "no-preference"],
    exampleValue:     "dark",
  },

  {
    key:              "preferredLanguage",
    label:            "Preferred language",
    description:      "Primary language tag from navigator.languages, e.g. \"en-US\", \"nl\". " +
                      "Collected client-side on first page load; null until then.",
    type:             "string",
    source:           "client",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "nl",
  },

  {
    key:              "timeZone",
    label:            "Time zone",
    description:      "IANA timezone identifier from the browser, e.g. \"Europe/Amsterdam\". " +
                      "Collected client-side on first page load; null until then.",
    type:             "string",
    source:           "client",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "Europe/Amsterdam",
  },

  // ── Time (derived in tenant local timezone) ─────────────────────────────

  {
    key:              "currentHour",
    label:            "Current hour",
    description:      "Hour of the day in the tenant's local timezone, 0–23. Use with numeric operators, e.g. ≥ 18 for evening traffic.",
    type:             "number",
    source:           "time",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     14,
  },

  {
    key:              "dayOfWeek",
    label:            "Day of week",
    description:      "Lowercase English day of the week in the tenant's local timezone, e.g. \"monday\" or \"saturday\".",
    type:             "enum",
    source:           "time",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    exampleValue:     "friday",
  },

  {
    key:              "isWeekend",
    label:            "Is weekend",
    description:      "True on Saturday and Sunday in the tenant's local timezone.",
    type:             "boolean",
    source:           "time",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "month",
    label:            "Month",
    description:      "Current month in the tenant's local timezone — 1 = January, 12 = December.",
    type:             "number",
    source:           "time",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     12,
  },

  {
    key:              "dateKey",
    label:            "Date key",
    description:      "Current date in YYYY-MM-DD format in the tenant's local timezone, e.g. \"2025-12-24\".",
    type:             "string",
    source:           "time",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     "2025-12-24",
  },

  {
    key:              "timeOfDay",
    label:            "Time of day",
    description:      "Broad time-of-day bucket in the tenant's local timezone: morning (6–11), afternoon (12–17), evening (18–21), or night (22–5).",
    type:             "enum",
    source:           "time",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["morning", "afternoon", "evening", "night"],
    exampleValue:     "afternoon",
  },

  {
    key:              "seasonalEvent",
    label:            "Seasonal event",
    description:
      "Active seasonal window in the tenant's local timezone, or \"none\" outside any known window. " +
      "Base values are derived from pure calendar math (no API). " +
      "When country-aware enrichment runs, the value may be overridden with enrichment-extended events " +
      "(cyber-monday, back-to-school) resolved via the Nager.Date public-holidays API or business-event rules.",
    type:             "enum",
    source:           "time",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    // Base values: computed from calendar math in context/time.ts.
    // Enrichment-extended values (cyber-monday, back-to-school): set by the
    // seasonal-event enrichment stage in enrichment/providers/seasonal-event.ts
    // when countryCode is available. Both sets are valid at runtime.
    allowedValues:    [
      "none",
      "new-year",
      "christmas",
      "easter",
      "black-friday",
      "halloween",
      "valentines",
      "cyber-monday",   // enrichment-extended: Monday after US Thanksgiving
      "back-to-school", // enrichment-extended: Aug 1 – Sep 15 in supported locales
    ],
    exampleValue:     "none",
  },

  // ── Derived — Time ──────────────────────────────────────────────────────────

  {
    key:              "daySegment",
    label:            "Day segment",
    description:
      "Granular time-of-day bucket in tenant local time (6 buckets vs 4 in timeOfDay). " +
      "early-morning (0–5), morning (6–8), midday (9–12), afternoon (13–17), evening (18–21), night (22–23).",
    type:             "enum",
    source:           "derived",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["early-morning", "morning", "midday", "afternoon", "evening", "night"],
    exampleValue:     "afternoon",
  },

  {
    key:              "isWorkHours",
    label:            "Is work hours",
    description:
      "True on Monday–Friday between 09:00 and 17:59 in tenant local time. " +
      "Useful for distinguishing B2B business-hours traffic from personal off-hours browsing.",
    type:             "boolean",
    source:           "derived",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     true,
  },

  {
    key:              "isHoliday",
    label:            "Is holiday / seasonal event",
    description:
      "True when a seasonal event is currently active (seasonalEvent ≠ \"none\" and not null). " +
      "Derived from the seasonalEvent time context field.",
    type:             "boolean",
    source:           "derived",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "season",
    label:            "Season",
    description:
      "Meteorological season derived from the current month in the tenant's local timezone. " +
      "spring (Mar–May), summer (Jun–Aug), autumn (Sep–Nov), winter (Dec–Feb).",
    type:             "enum",
    source:           "derived",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["spring", "summer", "autumn", "winter"],
    exampleValue:     "autumn",
  },

  // ── Derived — Weather ───────────────────────────────────────────────────────

  {
    key:              "isBadWeather",
    label:            "Is bad weather",
    description:
      "True when weather conditions are adverse: active precipitation, strong wind (> 40 km/h), " +
      "or very heavy cloud cover (> 85 %). Derived from weather enrichment fields. " +
      "Null when the weather enrichment stage has not run.",
    type:             "boolean",
    source:           "derived",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "temperatureBucket",
    label:            "Temperature bucket",
    description:
      "Human-readable temperature label derived from temperatureNow. " +
      "freezing (< 0 °C), cold (0–9 °C), mild (10–19 °C), warm (20–29 °C), hot (≥ 30 °C). " +
      "Null when weather enrichment has not run.",
    type:             "enum",
    source:           "derived",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["freezing", "cold", "mild", "warm", "hot"],
    exampleValue:     "mild",
  },

  // ── Derived — Company ───────────────────────────────────────────────────────

  {
    key:              "companyType",
    label:            "Company type",
    description:
      "Company size segment derived from the companySize enrichment field. " +
      "startup (1–50), smb (51–200), mid-market (201–1 000), enterprise (1 001+). " +
      "Null when no company was identified.",
    type:             "enum",
    source:           "derived",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["enterprise", "mid-market", "smb", "startup", "unknown"],
    exampleValue:     "enterprise",
  },

  {
    key:              "industryGroup",
    label:            "Industry group",
    description:
      "Broad industry group derived from companyIndustry or crmIndustry. " +
      "Normalises verbose industry strings into 7 actionable groups. " +
      "Null when no industry information is available.",
    type:             "enum",
    source:           "derived",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["tech", "finance", "healthcare", "manufacturing", "retail", "professional-services", "other"],
    exampleValue:     "tech",
  },

  // ── Derived — Campaign context ──────────────────────────────────────────────

  {
    key:              "channelGroup",
    label:            "Channel group",
    description:
      "Marketing channel group derived from UTM medium, UTM source, and traffic source. " +
      "Normalises raw UTM values into standard channel buckets: " +
      "paid-search, paid-social, organic-search, organic-social, email, direct, referral, other.",
    type:             "enum",
    source:           "derived",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["paid-search", "paid-social", "organic-search", "organic-social", "email", "direct", "referral", "other"],
    exampleValue:     "paid-search",
  },

  {
    key:              "campaignType",
    label:            "Campaign type",
    description:
      "Campaign intent category derived from UTM medium and campaign name. " +
      "brand, demand-gen, retargeting, content, event, other, or unknown (no UTM).",
    type:             "enum",
    source:           "derived",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["brand", "demand-gen", "retargeting", "content", "event", "other", "unknown"],
    exampleValue:     "demand-gen",
  },

  {
    key:              "isRetargetedUser",
    label:            "Is retargeted user",
    description:
      "True when the visitor has been to the site before (visitType = \"returning\" " +
      "or pageViewCount > 0).  Useful for showing a different message to returning visitors.",
    type:             "boolean",
    source:           "derived",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     true,
  },

  // ── Derived — Behavior & Engagement ─────────────────────────────────────────

  {
    key:              "engagementScore",
    label:            "Engagement score",
    description:
      "Composite engagement score from 0 to 100. " +
      "Combines page views (0–40), CTA interactions (0–30), returning-visitor bonus (20), " +
      "and session-age signal (10).",
    type:             "number",
    source:           "derived",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     45,
  },

  {
    key:              "pagesVisited",
    label:            "Pages visited",
    description:
      "Total pages visited in this session (mirrors history.pageViewCount). " +
      "Exposed as a derived variable for clearer AI context naming.",
    type:             "number",
    source:           "derived",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     4,
  },

  // ── Derived — Funnel & Lifecycle ─────────────────────────────────────────────

  {
    key:              "funnelStage",
    label:            "Funnel stage",
    description:
      "Inferred funnel stage based on history signals and CRM lifecycle. " +
      "awareness → consideration → intent → decision. " +
      "\"decision\" when visitor has clicked a CTA or matches a CRM decision stage.",
    type:             "enum",
    source:           "derived",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["awareness", "consideration", "intent", "decision"],
    exampleValue:     "consideration",
  },

  {
    key:              "visitDepth",
    label:            "Visit depth",
    description:
      "How many pages deep into the site the visitor is in this session " +
      "(mirrors pageViewCount). Semantic alias useful in funnel-based rules.",
    type:             "number",
    source:           "derived",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    false,
    exampleValue:     3,
  },

  // ── Derived — Intent Signals ─────────────────────────────────────────────────

  {
    key:              "contentInterestCategory",
    label:            "Content interest category",
    description:
      "The content category of the current page, inferred from the URL pathname and pageType. " +
      "homepage, product, pricing, content (blog/resources), about, or other.",
    type:             "enum",
    source:           "derived",
    operators:        OPS_ENUM,
    availableToRules: true,
    availableToAI:    true,
    allowedValues:    ["homepage", "product", "pricing", "content", "about", "other"],
    exampleValue:     "product",
  },

  {
    key:              "isResearching",
    label:            "Is researching",
    description:
      "True when the visitor shows research behaviour: 3+ page views without a conversion " +
      "signal (no CTA clicks, not in a decision-stage CRM lifecycle).",
    type:             "boolean",
    source:           "derived",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     true,
  },

  {
    key:              "isReadyToConvert",
    label:            "Is ready to convert",
    description:
      "True when the visitor shows strong purchase intent: has clicked a CTA in this session, " +
      "or CRM lifecycle stage is \"sql\", \"opportunity\", or \"customer\".",
    type:             "boolean",
    source:           "derived",
    operators:        OPS_BOOLEAN,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     false,
  },

  {
    key:              "primaryInterest",
    label:            "Primary interest",
    description:
      "Best-available label for what the visitor is most interested in. " +
      "Priority: utmTerm → contentInterestCategory → industryGroup. " +
      "Null when none of these signals are available.",
    type:             "string",
    source:           "derived",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "pricing",
  },

  // ── Intent predictions (explicit intent layer) ───────────────────────────────
  //
  // Computed by computeIntentContext() in context/intent-context.ts.
  // All intent variables live under ctx.intent.* in DecisionContext.
  //
  // availableToRules is set to false for the score and reason fields since
  // rule-engine integration requires corresponding entries in
  // decision/rules/field-registry.ts.  intentPrimary and intentSecondary
  // are enum types and are rule-eligible.
  //
  // All intent variables are availableToAI so the AI decision provider
  // receives the full intent picture.

  {
    key:              "intentPrimary",
    label:            "Primary intent",
    description:
      "The visitor's inferred primary intent — the intent type with the highest signal score. " +
      "demo: wants a product demo or sales conversation. " +
      "research: gathering information, reading content. " +
      "comparison: actively comparing solutions or pricing. " +
      "trial: ready to sign up or start a free trial. " +
      "job: looking for employment. " +
      "unknown: insufficient signals to determine intent.",
    type:             "enum",
    source:           "intent",
    operators:        OPS_ENUM,
    availableToRules: false,
    availableToAI:    true,
    allowedValues:    ["demo", "research", "comparison", "trial", "job", "unknown"],
    exampleValue:     "research",
  },

  {
    key:              "intentSecondary",
    label:            "Secondary intent",
    description:
      "The runner-up intent type when its score ≥ 20 (the secondary-intent threshold). " +
      "Null when no secondary intent is strong enough or when all signals converge on one type. " +
      "Same allowed values as intentPrimary.",
    type:             "enum",
    source:           "intent",
    operators:        OPS_ENUM,
    availableToRules: false,
    availableToAI:    true,
    allowedValues:    ["demo", "research", "comparison", "trial", "job"],
    exampleValue:     "comparison",
  },

  {
    key:              "intentConfidence",
    label:            "Intent confidence",
    description:
      "Normalised confidence score for intentPrimary, from 0 to 1 (two decimal places). " +
      "Derived as: primaryScore ÷ 100. " +
      "0 = no positive signals; 0.5 = possible but uncertain; ≥ 0.7 = strong signal.",
    type:             "number",
    source:           "intent",
    operators:        OPS_NUMBER,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     0.65,
  },

  {
    key:              "intentDemoScore",
    label:            "Demo intent score",
    description:
      "Propensity score (0–100) for demo/sales intent. " +
      "Contributing signals: CRM stage sql/opportunity, pathname /demo or /contact, " +
      "funnelStage=decision, isReadyToConvert, paid-search at intent stage.",
    type:             "number",
    source:           "intent",
    operators:        OPS_NUMBER,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     35,
  },

  {
    key:              "intentResearchScore",
    label:            "Research intent score",
    description:
      "Propensity score (0–100) for research/exploration intent. " +
      "Contributing signals: isResearching, content page, organic-search channel, " +
      "content campaign, 3+ page views, informational UTM term.",
    type:             "number",
    source:           "intent",
    operators:        OPS_NUMBER,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     60,
  },

  {
    key:              "intentComparisonScore",
    label:            "Comparison intent score",
    description:
      "Propensity score (0–100) for comparison/evaluation intent. " +
      "Contributing signals: pathname /compare or /vs or /alternatives, " +
      "pricing page, UTM term containing 'vs' or 'alternative', funnelStage=consideration.",
    type:             "number",
    source:           "intent",
    operators:        OPS_NUMBER,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     45,
  },

  {
    key:              "intentTrialScore",
    label:            "Trial intent score",
    description:
      "Propensity score (0–100) for trial/sign-up intent. " +
      "Contributing signals: pathname /trial or /signup, UTM campaign for trial, " +
      "funnelStage=decision, pricing page + ctaClick, email channel.",
    type:             "number",
    source:           "intent",
    operators:        OPS_NUMBER,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     20,
  },

  {
    key:              "intentJobScore",
    label:            "Job-seeking intent score",
    description:
      "Propensity score (0–100) for job-seeking intent. " +
      "Contributing signals: pathname /jobs or /careers or /vacancies, " +
      "vacancy/careers template key, jobs UTM campaign.",
    type:             "number",
    source:           "intent",
    operators:        OPS_NUMBER,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     0,
  },

  {
    key:              "intentReason",
    label:            "Intent reason",
    description:
      "Short human-readable explanation of why intentPrimary was inferred. " +
      "Shows the intent type, its score, and the top contributing signals. " +
      "For debug overlay and AI context only — not suitable for rule conditions.",
    type:             "string",
    source:           "intent",
    operators:        OPS_STRING,
    availableToRules: false,
    availableToAI:    true,
    exampleValue:     "research (score 60) — isResearching (+40) · content page (+25) · organic-search (+15)",
  },

  // ── Interest profile signals ────────────────────────────────────────────────
  //
  // Derived from the visitor's browsing history: pages visited accumulate
  // metaKeywords into a keyword cloud, which is scored against platform-managed
  // interest profiles (stored in the interest_profiles DB table).
  //
  // How to use:
  //   interestPrimary    — filter/personalise by the visitor's primary topic area
  //   interestConfidence — guard: only act when confidence > 0.5
  //   interestLogisticsScore — segment visitors specifically interested in logistics
  //
  // Per-profile score variables (e.g. interestLogisticsScore) are generated
  // dynamically at runtime for each active profile and are not listed here
  // individually (their keys follow the pattern "interest<PascalKey>Score").

  {
    key:              "interestPrimary",
    label:            "Primary interest profile",
    description:
      "Key of the interest profile with the highest score for this visitor, " +
      "based on keywords from pages they have visited this session. " +
      "Empty string when no signal is available. " +
      "Example values: \"logistics\", \"warehousing\", \"hr-tech\".",
    type:             "string",
    source:           "history",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "logistics",
  },

  {
    key:              "interestSecondary",
    label:            "Secondary interest profile",
    description:
      "Key of the interest profile with the second-highest score. " +
      "Useful for visitors with mixed interests. " +
      "Empty string when fewer than two profiles have any signal.",
    type:             "string",
    source:           "history",
    operators:        OPS_STRING,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     "warehousing",
  },

  {
    key:              "interestConfidence",
    label:            "Interest confidence score",
    description:
      "Normalized confidence score (0.0–1.0) for the primary interest profile. " +
      "1.0 means the visitor's entire keyword cloud matches only this profile; " +
      "0.0 means no matching keywords were found. " +
      "Use as a guard: only personalize when confidence > 0.5.",
    type:             "number",
    source:           "history",
    operators:        OPS_NUMBER,
    availableToRules: true,
    availableToAI:    true,
    exampleValue:     0.8,
  },

];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/**
 * Keyed map for O(1) look-up by variable key.
 */
export const CONTEXT_VARIABLE_MAP: Readonly<Record<string, ContextVariableDef>> =
  Object.fromEntries(CONTEXT_VARIABLES.map((v) => [v.key, v]));

/**
 * Look up a single context variable definition by its key.
 * Returns `undefined` for unknown keys — never throws.
 *
 * @example
 * getContextVar("source")?.allowedValues  // ["google", "linkedin", "direct", "unknown"]
 * getContextVar("bogus")                  // undefined
 */
export function getContextVar(key: string): ContextVariableDef | undefined {
  return CONTEXT_VARIABLE_MAP[key];
}

/**
 * Returns all variables available to the rules engine
 * (availableToRules = true), in registry order.
 *
 * Suitable for populating a field-picker in the rules UI.
 *
 * @example
 * const ruleFields = getVarsForRules();
 * // → [{key:"source",...}, {key:"device",...}, ...]
 */
export function getVarsForRules(): readonly ContextVariableDef[] {
  return CONTEXT_VARIABLES.filter((v) => v.availableToRules);
}

/**
 * Returns all variables available to AI decision providers
 * (availableToAI = true), in registry order.
 *
 * AI providers receive a filtered context snapshot built from these keys.
 *
 * @example
 * const aiFields = getVarsForAI();
 */
export function getVarsForAI(): readonly ContextVariableDef[] {
  return CONTEXT_VARIABLES.filter((v) => v.availableToAI);
}

/**
 * Returns all variables from a specific source layer.
 *
 * @example
 * getVarsBySource("history")  // pageViewCount, hasClickedCta, …
 */
export function getVarsBySource(source: ContextVarSource): readonly ContextVariableDef[] {
  return CONTEXT_VARIABLES.filter((v) => v.source === source);
}

/**
 * Returns all variables of a specific type.
 *
 * @example
 * getVarsByType("boolean")  // hasClickedCta, hasSeenHeroVariant, …
 */
export function getVarsByType(type: ContextVarType): readonly ContextVariableDef[] {
  return CONTEXT_VARIABLES.filter((v) => v.type === type);
}

/**
 * Returns all variables grouped by source, in canonical source order.
 *
 * Used by the admin context dictionary to render source sections.
 */
export const CONTEXT_VARS_BY_SOURCE: Readonly<Record<ContextVarSource, readonly ContextVariableDef[]>> = {
  request:    getVarsBySource("request"),
  session:    getVarsBySource("session"),
  history:    getVarsBySource("history"),
  tenant:     getVarsBySource("tenant"),
  page:       getVarsBySource("page"),
  enrichment: getVarsBySource("enrichment"),
  time:       getVarsBySource("time"),
  client:     getVarsBySource("client"),
  derived:    getVarsBySource("derived"),
  intent:     getVarsBySource("intent"),
};

/** Canonical source display order for the admin UI. */
export const CONTEXT_SOURCE_ORDER: readonly ContextVarSource[] = [
  "request",
  "session",
  "history",
  "tenant",
  "page",
  "enrichment",
  "time",
  "client",
  "derived",
  "intent",
];

/**
 * Human-readable labels for each source layer.
 * Used by the admin dictionary heading row.
 */
export const CONTEXT_SOURCE_LABELS: Readonly<Record<ContextVarSource, string>> = {
  request:    "Request",
  session:    "Session / Cookie",
  history:    "Behavioural History",
  tenant:     "Tenant Configuration",
  page:       "Page",
  enrichment: "External Enrichment",
  time:       "Time & Seasonality",
  client:     "Client / Browser",
  derived:    "Derived & Computed",
  intent:     "Intent Predictions",
};

// ── Rules compatibility helpers ────────────────────────────────────────────────

/**
 * Returns the canonical operator list for a context variable key.
 *
 * Uses the variable's `operators` field from the registry.
 * Returns an empty array for unknown keys (safe default for UI rendering).
 *
 * This is the authoritative source for which operators are valid for a given
 * context key — both the rules UI and the rules validator should call this
 * rather than maintaining their own per-key lists.
 *
 * @example
 * getOperatorsForKey("source")         // ["equals","not_equals","in",...]
 * getOperatorsForKey("pageViewCount")  // ["equals","greater_than",...]
 * getOperatorsForKey("bogus")          // []
 */
export function getOperatorsForKey(key: string): readonly ContextOperator[] {
  return CONTEXT_VARIABLE_MAP[key]?.operators ?? [];
}

/**
 * Returns a flat list of every valid context variable key.
 * Useful for validating that a rule references a known key.
 *
 * @example
 * const validKeys = getAllContextKeys();
 * if (!validKeys.includes(userInput)) { ... }
 */
export function getAllContextKeys(): readonly string[] {
  return CONTEXT_VARIABLES.map((v) => v.key);
}

/**
 * Returns a flat list of all keys where availableToRules = true.
 * Used by rule validators to reject conditions that reference
 * variables not intended for rule use.
 *
 * @example
 * const ruleKeys = getRuleContextKeys();
 * if (!ruleKeys.includes(condition.field)) throw new Error("Unknown field");
 */
export function getRuleContextKeys(): readonly string[] {
  return getVarsForRules().map((v) => v.key);
}

/**
 * True when `key` is a registered rule-eligible context variable key.
 * Use in rules validation to reject arbitrary field names.
 *
 * @example
 * if (!isValidRuleKey(field)) { errors.push(`Unknown field: ${field}`); }
 */
export function isValidRuleKey(key: string): boolean {
  return CONTEXT_VARIABLE_MAP[key]?.availableToRules === true;
}
