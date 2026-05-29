/**
 * Rule Field Registry
 *
 * The single authoritative source of metadata for every field that can be
 * referenced in a rule condition.  The registry is consumed by three separate
 * subsystems without each needing its own copy of the metadata:
 *
 *   Validation      — validateFieldCondition() in stored-rule.ts reads
 *                     operators and allowedValues from the registry.
 *
 *   Rules editor UI — ConditionEditor in RulesEditor.tsx reads labels,
 *                     operators, and allowedValues to render field/operator/
 *                     value inputs without hardcoding anything.
 *
 *   Runtime eval    — buildMatchPredicate() in stored-rule.ts calls
 *                     FIELD_REGISTRY[field].resolve() to obtain the live
 *                     value from the evaluation context.
 *
 * ─── Adding a new field ───────────────────────────────────────────────────────
 *
 *   1. Add the key to RuleFieldKey.
 *   2. Add a FieldDefinition entry to FIELD_REGISTRY.
 *      • Set kind, operators, and resolve.
 *      • Set allowedValues only for categorical (closed-value) fields.
 *   3. If the value comes from a new context property, add it to
 *      RuleEvaluationContext (optional property so existing call sites are
 *      unaffected until they are ready to populate it).
 *   4. Run `npx tsc --noEmit` — the Record<RuleFieldKey, FieldDefinition>
 *      constraint will catch any missing entries at compile time.
 *
 * ─── JSON-safety guarantee ────────────────────────────────────────────────────
 *
 *   FieldDefinition.resolve is a pure function (no I/O, no side-effects).
 *   It is never serialised; only the field key string is stored in rules.
 *   The rest of the tree (condition types, values) remains JSON-safe.
 */

import type { DecisionInput }    from "../types";
import type { PackageKey }       from "@/tenant/types";
import type { EnrichmentOutput } from "@/enrichment/types";
import type { DayOfWeek, TimeOfDay, SeasonalEvent } from "@/context/time";
import type { ClientContext } from "@/context/client-context";
import type { DerivedContext } from "@/context/derived-context";
import type { InterestScore, InterestContextVars } from "@/interest-profiles/types";

// ── Rule evaluation context ────────────────────────────────────────────────────

/**
 * The full context available to rule predicates at evaluation time.
 *
 * Extends DecisionInput (VisitorContext + VisitorHistory) with optional
 * page-level and tenant-level properties populated by the route that
 * renders the page.  All fields are optional so the model degrades
 * gracefully when called from contexts where some metadata is unavailable;
 * resolve functions return null for absent optional properties.
 *
 * ─── Adding new fields ────────────────────────────────────────────────────────
 *
 *   1. Add the field here (optional, typed).
 *   2. Add its key to RuleFieldKey.
 *   3. Add a FieldDefinition entry (with resolve) to FIELD_REGISTRY.
 *   4. Add a matching entry to CONTEXT_VARIABLES in context/registry.ts.
 *   5. Populate the field in buildDecisionContext() in decision/decision-context.ts.
 */
export type RuleEvaluationContext = DecisionInput & {
  /** Current request pathname, e.g. "/" or "/blog/my-post". */
  pathname?:    string | null;
  /** Active tenant identifier. */
  tenantId?:    string | null;
  /** Page type key, e.g. "landing", "article", "listing". */
  pageType?:    string | null;
  /** Active page-template key, e.g. "standard-landing". */
  templateKey?: string | null;
  /**
   * Tenant subscription tier — "starter" | "growth" | "pro".
   * Maps to the "package" rule field key.
   * Populated by buildDecisionContext() from TenantSettings.packageKey.
   */
  packageKey?:  PackageKey | null;

  /**
   * Merged output from the enrichment pipeline.
   * All fields are optional — only populated fields are present.
   * Populated by applyEnrichment() after runEnrichmentPipeline().
   * Field resolvers access keys via `ctx.enrichment?.field ?? null`.
   */
  enrichment?: Partial<EnrichmentOutput> | null;

  // ── Time context (derived in tenant local timezone) ───────────────────────
  //
  // Populated by buildDecisionContext() via buildTimeContext() from @/context/time.
  // All fields default to null when the time context was not built
  // (e.g. in unit tests that construct the context manually).

  /** Hour of the day in tenant local time, 0–23. */
  currentHour?: number | null;
  /** Lowercase English day of the week in tenant local time. */
  dayOfWeek?: DayOfWeek | null;
  /** True on Saturday and Sunday in tenant local time. */
  isWeekend?: boolean | null;
  /** Month number in tenant local time — 1 = January, 12 = December. */
  month?: number | null;
  /** Date string YYYY-MM-DD in tenant local time. */
  dateKey?: string | null;
  /** Broad time-of-day bucket in tenant local time. */
  timeOfDay?: TimeOfDay | null;
  /** Active seasonal event, or "none" when outside any known window. */
  seasonalEvent?: SeasonalEvent | null;

  /**
   * Client / device context — UA-parsed server fields + browser-collected signals.
   *
   * Server-derived fields (deviceType, osName, osVersion, browserName,
   * browserVersion, engineName) are populated on every request from the
   * User-Agent header via parseUA().
   *
   * Client-derived fields (isTouchDevice, viewportWidth, viewportHeight,
   * pixelRatio, preferredColorScheme, preferredLanguage, timeZone) are
   * populated from the mc_cc cookie, which is written by the
   * ClientContextCollector component on the first page load.
   *
   * Null on the first request (before ClientContextCollector has run);
   * subsequent requests have all fields populated from the cookie.
   */
  clientContext?: ClientContext | null;

  /**
   * Computed signals derived from other context layers (enrichment, time, history, request).
   *
   * Populated by computeDerivedContext() at the end of buildDecisionContext(),
   * after enrichment and time context have been fully assembled.
   *
   * Null on the first render if buildDecisionContext is called without derived
   * computation (e.g. unit tests that construct the context manually).
   */
  derived?: Partial<DerivedContext> | null;

  /**
   * Per-profile interest scores for the current visitor.
   *
   * Populated by buildDecisionContext() after running scoreInterests() against
   * the active interest profiles.  Null when no profiles are defined or the
   * visitor's keyword cloud is empty.
   *
   * Used by both the rules engine (field resolvers) and the AI prompt builder
   * (which renders the primary/secondary interest + confidence).
   */
  interestScores?: readonly InterestScore[] | null;

  /**
   * Pre-computed interest context variables derived from `interestScores`.
   *
   * Contains: interestPrimary, interestSecondary, interestConfidence, perProfile.
   * Null when `interestScores` is null or all scores are zero.
   */
  interestContext?: InterestContextVars | null;

  /**
   * Comma-joined keys of audience segments that matched for this visitor.
   *
   * Populated by evaluateAudienceSegments() after buildDecisionContext() runs.
   * Null when no segments are active or none matched the visitor's context.
   *
   * Example: "high-intent-enterprise,returning-customer"
   * Use the "contains" operator in rules to test for a specific segment key.
   */
  audienceSegmentIds?: string | null;

  /**
   * CRM + behavior merged lifecycle state.
   *
   * Populated by buildDecisionContext() after normalizeCrmProfile() and
   * mergeCrmWithBehavior() have been applied.  Null when the CRM layer has
   * not yet been integrated into the pipeline.
   *
   * Provides: lifecycleStage (final), isCustomer, customerMode, customerAgeDays,
   * crm.planTier, crm.dealStage — all used by CRM rule field resolvers below.
   */
  crmMergedState?: import("@/lib/crm").CrmMergedState | null;
};

// ── Field metadata types ───────────────────────────────────────────────────────

/** UI grouping for field-picker option groups. */
export type FieldGroup =
  | "traffic"         // acquisition channel, UTM, referrer
  | "device_session"  // device class, visit type, pathname
  | "behavior"        // history signals derived from first-party DB data
  | "tenant_page"     // tenant identity, page type, template key
  | "enrichment"      // external enrichment: geo, company, ads, CRM, ABM
  | "time"            // time of day, day of week, seasonal signals
  | "client_device"   // UA-parsed OS/browser + browser-collected signals (viewport, touch, etc.)
  | "derived"         // computed signals derived from enrichment + time + history
  | "interest"        // interest profile scores derived from visitor keyword cloud
  | "audience";       // audience segment membership derived from segment criteria evaluation

/**
 * The runtime kind of a field's value.
 *
 *   categorical     — narrow string union; closed set of allowedValues enforced
 *   nullable_string — string | null; open-ended; supports equality, contains, exists
 *   number          — numeric; supports equality and ordering operators
 *   boolean         — true | false; supports equality
 */
export type FieldKind = "categorical" | "nullable_string" | "number" | "boolean";

/** The runtime value type produced by a field resolver. */
export type FieldRuntimeValue = string | number | boolean | null | undefined;

// ── Field operators ────────────────────────────────────────────────────────────

/**
 * Every comparison operator the rules engine supports.
 *
 *   equals / not_equals           — strict (===) equality / inequality
 *   in / not_in                   — set membership against an array
 *   greater_than / … / less_than_or_equal — numeric ordering
 *   contains / not_contains       — substring check (strings only)
 *   exists / not_exists           — null / undefined check (no value required)
 */
export const FIELD_OPERATORS = [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
  "not_contains",
  "exists",
  "not_exists",
] as const;

export type FieldOperator = (typeof FIELD_OPERATORS)[number];

// ── Operator classification sets ───────────────────────────────────────────────
// Exported so validation (stored-rule.ts) and the editor UI (RulesEditor.tsx)
// can share the same classification logic without reimplementing it.

/** Operators that require no value (existence tests). */
export const NO_VALUE_OPERATORS = new Set<FieldOperator>([
  "exists",
  "not_exists",
]);

/** Operators that require an array value (set membership tests). */
export const ARRAY_VALUE_OPERATORS = new Set<FieldOperator>([
  "in",
  "not_in",
]);

/** Operators that require a numeric value (ordering tests). */
export const NUMERIC_OPERATORS = new Set<FieldOperator>([
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
]);

/** Operators that require a string value (substring tests). */
export const STRING_ONLY_OPERATORS = new Set<FieldOperator>([
  "contains",
  "not_contains",
]);

// ── Field definition ───────────────────────────────────────────────────────────

export interface FieldDefinition {
  /** Human-readable label for UI dropdowns and error messages. */
  label: string;

  /** One-sentence description shown in editor tooltips. */
  description: string;

  /** UI grouping category — used to build <optgroup> sections. */
  group: FieldGroup;

  /**
   * Value kind.
   * Determines which operators are valid, what type `value` must have,
   * and whether to show a free-text or select value input in the editor.
   */
  kind: FieldKind;

  /** Ordered list of operators that are valid for this field. */
  operators: readonly FieldOperator[];

  /**
   * Closed set of allowed string values.
   * Present only for categorical fields; open-ended fields omit this.
   * The editor renders a <select> when this is present.
   */
  allowedValues?: readonly string[];

  /**
   * Resolve the live value of this field from a rule evaluation context.
   * Returns null / undefined when the value is absent or unavailable.
   * Must be pure — no side effects, no I/O.
   */
  resolve: (ctx: RuleEvaluationContext) => FieldRuntimeValue;
}

// ── Field key union ────────────────────────────────────────────────────────────

export type RuleFieldKey =
  // Traffic / acquisition
  | "source"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "utmContent"
  | "utmTerm"
  | "referrerDomain"
  // Device / session
  | "device"
  | "visitType"
  | "pathname"
  // Behaviour / history
  | "pageViewCount"
  | "ctaClickCount"
  | "hasClickedCta"
  | "hasSeenHeroVariant"
  | "lastHeroKey"
  | "lastCtaKey"
  | "daysSinceFirstSeen"
  // Tenant / page context
  | "tenantId"
  | "package"
  | "pageType"
  | "templateKey"
  // Enrichment — IP classification
  | "ipVersion"
  | "isCloudProvider"
  // Enrichment — Geo
  | "countryCode"
  | "region"
  | "city"
  // Enrichment — Company
  | "companyName"
  | "companyDomain"
  | "companyIndustry"
  | "companySize"
  | "companyMatchConfidence"
  // Enrichment — Ads attribution
  | "adCampaign"
  | "adAdGroup"
  | "adKeyword"
  // Enrichment — CRM
  | "crmMatched"
  | "crmLifecycleStage"
  | "crmSegment"
  // Enrichment — CRM company (HubSpot company-by-domain)
  | "crmCompanyName"
  | "crmCompanyDomain"
  | "crmIndustry"
  | "crmIsCustomer"
  // Enrichment — CRM extended (contact / deal / plan / lifecycle)
  | "crmPlanTier"
  | "crmDealStage"
  | "crmCustomerSince"
  | "crmContractValue"
  | "crmContactId"
  // CRM + behavior merged state
  | "crm.lifecycleStage"
  | "crm.customerMode"
  | "crm.isCustomer"
  | "crm.planTier"
  | "crm.dealStage"
  | "crm.customerAgeDays"
  // Enrichment — Account list (ABM)
  | "targetAccountMatched"
  | "targetAccountTier"
  | "targetAccountList"
  // Enrichment — Geo coordinates
  | "latitude"
  | "longitude"
  // Enrichment — Reverse geocode (address fields)
  | "addressCountry"
  | "addressRegion"
  | "addressCity"
  | "addressMunicipality"
  | "addressPostcode"
  | "addressFormatted"
  | "addressSource"
  // Enrichment — Weather (current conditions via Open-Meteo)
  | "weatherCode"
  | "temperatureNow"
  | "precipitationProbability"
  | "isRaining"
  | "windSpeed"
  | "cloudCover"
  | "weatherSummary"
  | "weatherSource"
  // Enrichment — GA4 Analytics History
  | "gaCurrentCity"
  | "gaCurrentRegion"
  | "gaCurrentCountry"
  | "gaCurrentChannelGroup"
  | "gaLastKnownCity"
  | "gaLastKnownRegion"
  | "gaLastKnownCountry"
  | "gaSessionCount"
  | "gaLastChannelGroup"
  | "gaHistorySource"
  // Enrichment — Normalized current location (GA4 preferred; IP geo fallback)
  | "currentCity"
  | "currentRegion"
  | "currentCountry"
  | "currentLocationSource"
  // Time & seasonality
  | "currentHour"
  | "dayOfWeek"
  | "isWeekend"
  | "month"
  | "dateKey"
  | "timeOfDay"
  | "seasonalEvent"
  // Client / device (UA-parsed + browser-collected via mc_cc cookie)
  | "deviceType"
  | "osName"
  | "osVersion"
  | "browserName"
  | "browserVersion"
  | "engineName"
  | "isTouchDevice"
  | "viewportWidth"
  | "viewportHeight"
  | "preferredColorScheme"
  | "preferredLanguage"
  | "timeZone"
  // Derived — computed from enrichment + time + history
  | "daySegment"
  | "isWorkHours"
  | "isHoliday"
  | "season"
  | "isBadWeather"
  | "temperatureBucket"
  | "companyType"
  | "industryGroup"
  | "channelGroup"
  | "campaignType"
  | "isRetargetedUser"
  | "engagementScore"
  | "pagesVisited"
  | "funnelStage"
  | "visitDepth"
  | "contentInterestCategory"
  | "isResearching"
  | "isReadyToConvert"
  | "primaryInterest"
  // Journey behavioral signals (from visitor_behavior_state)
  | "journey.funnelStage"
  | "journey.intentScore"
  | "journey.engagementScore"
  | "journey.recencyScore"
  | "journey.sequenceScore"
  | "journey.hasVisitedPricing"
  | "journey.hasVisitedAbout"
  | "journey.hasVisitedCases"
  | "journey.hasVisitedContact"
  | "journey.hasSubmittedForm"
  | "journey.hasStartedForm"
  | "journey.matchedSequences"
  // Journey Engine v2 fields
  | "journey.shortTermIntentScore"
  | "journey.longTermAffinityScore"
  | "journey.intentFreshness"
  | "journey.repeatSessionBonus"
  | "journey.confidenceBand"
  | "journey.overallConfidence"
  // Journey Engine v3 — anti-false-positive fields
  | "journey.frictionScore"
  | "journey.signalDiversityScore"
  | "journey.uniqueSignalCount"
  | "journey.burstPenalty"
  // Interest profile scoring
  | "interestPrimary"
  | "interestSecondary"
  | "interestConfidence"
  | "interestPricingScore"
  | "interestProductScore"
  | "interestUseCaseScore"
  | "interestTrustScore"
  | "interestTechnicalScore"
  | "interestCandidateScore"
  | "interestCommerceProductScore"
  | "interestPropertyScore"
  // Audience segment membership
  | "audienceSegmentIds";

// ── Operator shortlists per kind ───────────────────────────────────────────────
// Defined here so FIELD_REGISTRY entries stay DRY — each kind reuses one list.

const OPS_CATEGORICAL: readonly FieldOperator[] = [
  "equals", "not_equals", "in", "not_in", "exists", "not_exists",
];

const OPS_NULLABLE_STRING: readonly FieldOperator[] = [
  "equals", "not_equals", "in", "not_in",
  "contains", "not_contains",
  "exists", "not_exists",
];

const OPS_NUMBER: readonly FieldOperator[] = [
  "equals", "not_equals", "in", "not_in",
  "greater_than", "greater_than_or_equal",
  "less_than", "less_than_or_equal",
  "exists", "not_exists",
];

const OPS_BOOLEAN: readonly FieldOperator[] = [
  "equals", "not_equals", "exists", "not_exists",
];

// ── Field registry ─────────────────────────────────────────────────────────────

/**
 * The complete map of rule field keys to their metadata and resolver.
 * TypeScript enforces that every RuleFieldKey has a definition — add a key
 * to the union above and the compiler will require a matching entry here.
 */
export const FIELD_REGISTRY: Readonly<Record<RuleFieldKey, FieldDefinition>> = {

  // ── Traffic / acquisition ────────────────────────────────────────────────────

  source: {
    label:         "Traffic source",
    description:   "Detected acquisition channel — Google, LinkedIn, direct, or unknown.",
    group:         "traffic",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["google", "linkedin", "direct", "unknown"],
    resolve:       (ctx) => ctx.source,
  },

  utmSource: {
    label:       "UTM source",
    description: "utm_source query parameter, e.g. \"newsletter\", \"google\", \"twitter\".",
    group:       "traffic",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.utmSource,
  },

  utmMedium: {
    label:       "UTM medium",
    description: "utm_medium query parameter, e.g. \"cpc\", \"email\", \"social\".",
    group:       "traffic",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.utmMedium,
  },

  utmCampaign: {
    label:       "UTM campaign",
    description: "utm_campaign query parameter, e.g. \"spring_sale\", \"product_launch\".",
    group:       "traffic",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.utmCampaign,
  },

  utmContent: {
    label:       "UTM content",
    description: "utm_content query parameter — identifies a specific link or ad creative.",
    group:       "traffic",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.utmContent,
  },

  utmTerm: {
    label:       "UTM term",
    description: "utm_term query parameter — paid-search keyword.",
    group:       "traffic",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.utmTerm,
  },

  referrerDomain: {
    label:       "Referrer domain",
    description: "Parsed hostname from the Referer header, e.g. \"linkedin.com\", \"google.com\".",
    group:       "traffic",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.referrerDomain,
  },

  // ── Device / session ─────────────────────────────────────────────────────────

  device: {
    label:         "Device type",
    description:   "Visitor device class inferred from the User-Agent header.",
    group:         "device_session",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["mobile", "desktop"],
    resolve:       (ctx) => ctx.device,
  },

  visitType: {
    label:         "Visit type",
    description:   "First touch (new) or repeat visit (returning), resolved from the mc_seen cookie.",
    group:         "device_session",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["new", "returning"],
    resolve:       (ctx) => ctx.visitType,
  },

  pathname: {
    label:       "Page pathname",
    description: "URL pathname of the page being rendered, e.g. \"/\" or \"/blog/my-post\".",
    group:       "device_session",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.pathname ?? null,
  },

  // ── Behaviour / history ───────────────────────────────────────────────────────

  pageViewCount: {
    label:       "Page view count",
    description: "Number of page_view events for this session prior to the current render.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.pageViewCount,
  },

  ctaClickCount: {
    label:       "CTA click count",
    description: "Total number of cta_click events recorded for this session.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.ctaClickCount,
  },

  hasClickedCta: {
    label:       "Has clicked CTA",
    description: "True when the session has at least one recorded cta_click event.",
    group:       "behavior",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.history.hasClickedCta,
  },

  hasSeenHeroVariant: {
    label:       "Has seen hero variant",
    description: "True when a hero variant has been recorded as served for this session.",
    group:       "behavior",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.history.lastHeroKey !== null,
  },

  lastHeroKey: {
    label:       "Last hero variant",
    description: "Hero variant key from the most recently recorded served_variant for this session.",
    group:       "behavior",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.history.lastHeroKey,
  },

  lastCtaKey: {
    label:       "Last CTA variant",
    description: "CTA variant key from the most recently recorded served_variant for this session.",
    group:       "behavior",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.history.lastCtaKey,
  },

  daysSinceFirstSeen: {
    label:       "Days since first seen",
    description: "Whole days since the earliest event for this session. Null when history is unavailable.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => {
      if (!ctx.history.fromDatabase || !ctx.history.firstSeenAt) return null;
      const ms = ctx.resolvedAt - new Date(ctx.history.firstSeenAt).getTime();
      return Math.max(0, Math.floor(ms / 86_400_000));
    },
  },

  // ── Tenant / page context ─────────────────────────────────────────────────────

  tenantId: {
    label:       "Tenant ID",
    description: "Active tenant identifier — populated by the page route at render time.",
    group:       "tenant_page",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.tenantId ?? null,
  },

  package: {
    label:         "Package tier",
    description:   "Active subscription tier for this tenant: starter, growth, or pro.",
    group:         "tenant_page",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["starter", "growth", "pro"],
    resolve:       (ctx) => ctx.packageKey ?? null,
  },

  pageType: {
    label:       "Page type",
    description: "Content category of the current page, e.g. \"landing\", \"article\", \"listing\".",
    group:       "tenant_page",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.pageType ?? null,
  },

  templateKey: {
    label:       "Template key",
    description: "Page template identifier active for the current render, e.g. \"standard-landing\".",
    group:       "tenant_page",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.templateKey ?? null,
  },

  // ── Enrichment — IP classification ───────────────────────────────────────────

  ipVersion: {
    label:       "IP version",
    description: "Address family of the visitor's request IP: \"ipv4\" or \"ipv6\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.ipVersion ?? null,
  },

  isCloudProvider: {
    label:       "Is cloud provider",
    description: "True when the visitor's IP belongs to a known cloud hosting provider, CDN, or datacenter.",
    group:       "enrichment",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.enrichment?.isCloudProvider ?? null,
  },

  // ── Enrichment — Geo ──────────────────────────────────────────────────────────

  countryCode: {
    label:       "Country code",
    description: "ISO 3166-1 alpha-2 country code from IP geo enrichment, e.g. \"NL\", \"US\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.countryCode ?? null,
  },

  region: {
    label:       "Region / state",
    description: "State or province name from IP geo enrichment, e.g. \"Noord-Holland\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.region ?? null,
  },

  city: {
    label:       "City",
    description: "City name from IP geo enrichment, e.g. \"Amsterdam\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.city ?? null,
  },

  // ── Enrichment — Company identification ────────────────────────────────────────

  companyName: {
    label:       "Company name",
    description: "Display name of the company identified by reverse-IP lookup.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.companyName ?? null,
  },

  companyDomain: {
    label:       "Company domain",
    description: "Primary domain of the identified company, e.g. \"acme.com\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.companyDomain ?? null,
  },

  companyIndustry: {
    label:       "Company industry",
    description: "Industry vertical of the identified company, e.g. \"Software\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.companyIndustry ?? null,
  },

  companySize: {
    label:       "Company size",
    description: "Employee size bucket, e.g. \"51-200\", \"201-1000\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.companySize ?? null,
  },

  companyMatchConfidence: {
    label:       "Company match confidence",
    description: "Confidence score (0–1) for the reverse-IP company identification match.",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.companyMatchConfidence ?? null,
  },

  // ── Enrichment — Ads attribution ──────────────────────────────────────────────

  adCampaign: {
    label:       "Ad campaign",
    description: "Ad platform campaign name or ID, from UTM params or platform API.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.adCampaign ?? null,
  },

  adAdGroup: {
    label:       "Ad group",
    description: "Ad group or ad set name, from utm_content or platform API.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.adAdGroup ?? null,
  },

  adKeyword: {
    label:       "Ad keyword",
    description: "Search keyword that triggered the ad, from utm_term or platform API.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.adKeyword ?? null,
  },

  // ── Enrichment — CRM match ────────────────────────────────────────────────────

  crmMatched: {
    label:       "CRM matched",
    description: "True when a CRM contact record was matched for this visitor.",
    group:       "enrichment",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.enrichment?.crmMatched ?? null,
  },

  crmLifecycleStage: {
    label:       "CRM lifecycle stage",
    description: "HubSpot / Salesforce lifecycle stage, e.g. \"mql\", \"sql\", \"customer\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.crmLifecycleStage ?? null,
  },

  crmSegment: {
    label:       "CRM segment",
    description: "Marketing segment label from the CRM, e.g. \"enterprise-prospect\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.crmSegment ?? null,
  },

  // ── Enrichment — CRM company (HubSpot company-by-domain) ─────────────────────

  crmCompanyName: {
    label:       "CRM company name",
    description: "Company name from the CRM, e.g. \"Acme Corp\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.crmCompanyName ?? null,
  },

  crmCompanyDomain: {
    label:       "CRM company domain",
    description: "Primary domain of the matched company from the CRM, e.g. \"acme.com\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.crmCompanyDomain ?? null,
  },

  crmIndustry: {
    label:       "CRM industry",
    description: "Industry field from the CRM company record, e.g. \"SOFTWARE\", \"FINANCIAL_SERVICES\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.crmIndustry ?? null,
  },

  crmIsCustomer: {
    label:       "CRM is customer",
    description: "True when the CRM lifecycle stage for this company is \"customer\".",
    group:       "enrichment",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.enrichment?.crmIsCustomer ?? null,
  },

  // ── Enrichment — CRM extended (contact / deal / plan) ────────────────────────

  crmPlanTier: {
    label:       "CRM plan tier",
    description: "Subscription plan tier from CRM, e.g. \"basic\", \"pro\", \"enterprise\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.crmPlanTier ?? null,
  },

  crmDealStage: {
    label:       "CRM deal stage",
    description: "Current deal or opportunity stage from CRM, e.g. \"Proposal\", \"Negotiation\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.crmDealStage ?? null,
  },

  crmCustomerSince: {
    label:       "CRM customer since (ISO date)",
    description: "ISO-8601 date when the contact became a customer. Use with string operators.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.crmCustomerSince ?? null,
  },

  crmContractValue: {
    label:       "CRM contract value",
    description: "Annual contract value in platform currency (numeric).",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.crmContractValue ?? null,
  },

  crmContactId: {
    label:       "CRM contact ID",
    description: "CRM contact ID (HubSpot / Salesforce). Use exists/not_exists to check if matched.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.crmContactId ?? null,
  },

  // ── CRM + behavior merged state ───────────────────────────────────────────────

  "crm.lifecycleStage": {
    label:       "Lifecycle stage (merged)",
    description: "Final lifecycle stage — CRM when matched, behavioral funnel stage otherwise.",
    group:       "enrichment",
    kind:        "categorical",
    operators:   OPS_CATEGORICAL,
    allowedValues: ["unknown", "lead", "opportunity", "customer", "churned"],
    resolve:     (ctx) => ctx.crmMergedState?.lifecycleStage ?? null,
  },

  "crm.customerMode": {
    label:       "Customer mode",
    description: "Current customer experience mode: onboarding, active_usage, expansion, churn_risk, or acquisition.",
    group:       "enrichment",
    kind:        "categorical",
    operators:   OPS_CATEGORICAL,
    allowedValues: [
      "acquisition_mode",
      "onboarding_mode",
      "active_usage_mode",
      "expansion_mode",
      "churn_risk_mode",
    ],
    resolve:     (ctx) => ctx.crmMergedState?.customerMode ?? null,
  },

  "crm.isCustomer": {
    label:       "Is customer (merged)",
    description: "True when the visitor is a paying customer — CRM or behavioral confirmation.",
    group:       "enrichment",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.crmMergedState?.isCustomer ?? null,
  },

  "crm.planTier": {
    label:       "Plan tier (merged)",
    description: "Resolved plan tier — CRM when matched, null otherwise.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.crmMergedState?.crm?.planTier ?? null,
  },

  "crm.dealStage": {
    label:       "Deal stage (merged)",
    description: "Resolved deal stage — CRM when matched, null otherwise.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.crmMergedState?.crm?.dealStage ?? null,
  },

  "crm.customerAgeDays": {
    label:       "Customer age (days)",
    description: "Days since this visitor became a customer (from CRM customerSince). Null if not available.",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.crmMergedState?.customerAgeDays ?? null,
  },

  // ── Enrichment — Account list (ABM) ──────────────────────────────────────────

  targetAccountMatched: {
    label:       "Target account matched",
    description: "True when this visitor's company is on a target account list.",
    group:       "enrichment",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.enrichment?.targetAccountMatched ?? null,
  },

  targetAccountTier: {
    label:       "Target account tier",
    description: "Account tier label for the matched account, e.g. \"tier-1\", \"tier-2\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.targetAccountTier ?? null,
  },

  targetAccountList: {
    label:       "Target account list",
    description: "Name of the account list matched, e.g. \"Q2-2025-ICP\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.targetAccountList ?? null,
  },

  // ── Enrichment — Geo coordinates ─────────────────────────────────────────

  latitude: {
    label:       "Latitude",
    description: "Approximate latitude from IP-geo lookup (city-level precision). Null when no geo provider returned coordinate data.",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.latitude ?? null,
  },

  longitude: {
    label:       "Longitude",
    description: "Approximate longitude from IP-geo lookup (city-level precision). Null when no geo provider returned coordinate data.",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.longitude ?? null,
  },

  // ── Enrichment — Reverse geocode ──────────────────────────────────────────

  addressCountry: {
    label:       "Address country",
    description: "ISO 3166-1 alpha-2 country code from reverse-geocode, e.g. \"NL\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.addressCountry ?? null,
  },

  addressRegion: {
    label:       "Address region",
    description: "State/province/region from reverse-geocode, e.g. \"Noord-Holland\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.addressRegion ?? null,
  },

  addressCity: {
    label:       "Address city",
    description: "City name from reverse-geocode, e.g. \"Amsterdam\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.addressCity ?? null,
  },

  addressMunicipality: {
    label:       "Address municipality",
    description: "Municipality or district from reverse-geocode.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.addressMunicipality ?? null,
  },

  addressPostcode: {
    label:       "Address postcode",
    description: "Postal/ZIP code from reverse-geocode, e.g. \"1012\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.addressPostcode ?? null,
  },

  addressFormatted: {
    label:       "Address formatted",
    description: "Full human-readable formatted address from reverse-geocode.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.addressFormatted ?? null,
  },

  addressSource: {
    label:       "Address source",
    description: "Which reverse-geocode provider produced the address fields.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.addressSource ?? null,
  },

  // ── Enrichment — Weather ──────────────────────────────────────────────────

  weatherCode: {
    label:       "Weather code",
    description: "WMO weather interpretation code (0–99) for the visitor's current location.",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.weatherCode ?? null,
  },

  temperatureNow: {
    label:       "Temperature now",
    description: "Current air temperature in °C at the visitor's location (1 dp).",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.temperatureNow ?? null,
  },

  precipitationProbability: {
    label:       "Precipitation probability",
    description: "Hourly precipitation probability as a percentage (0–100).",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.precipitationProbability ?? null,
  },

  isRaining: {
    label:       "Is raining",
    description: "True when the weather code indicates active precipitation.",
    group:       "enrichment",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.enrichment?.isRaining ?? null,
  },

  windSpeed: {
    label:       "Wind speed",
    description: "Wind speed at 10 m height in km/h (1 dp).",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.windSpeed ?? null,
  },

  cloudCover: {
    label:       "Cloud cover",
    description: "Sky cloud cover percentage (0–100).",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.cloudCover ?? null,
  },

  weatherSummary: {
    label:       "Weather summary",
    description: "Human-readable weather summary, e.g. \"Partly cloudy, 8°C, 15 km/h wind\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.weatherSummary ?? null,
  },

  weatherSource: {
    label:       "Weather source",
    description: "Provider that produced the weather data, e.g. \"open-meteo\".",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.weatherSource ?? null,
  },

  // ── Enrichment — GA4 Analytics History ───────────────────────────────────
  //
  // Two pairs of fields distinguish the most-recent session from a prior one:
  //   gaCurrent*    — most recent GA4 session date (row[0] ordered by date DESC)
  //   gaLastKnown*  — previous GA4 session date (row[1]); null when only one date-row

  gaCurrentCity: {
    label:       "GA4 current city",
    description: "City from the visitor's most-recent GA4 session. Null when no GA4 history is available.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.gaCurrentCity ?? null,
  },

  gaCurrentRegion: {
    label:       "GA4 current region",
    description: "Region (state/province) from the visitor's most-recent GA4 session. Null when no GA4 history is available.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.gaCurrentRegion ?? null,
  },

  gaCurrentCountry: {
    label:       "GA4 current country",
    description: "Country from the visitor's most-recent GA4 session (e.g. \"Netherlands\"). Null when no GA4 history is available.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.gaCurrentCountry ?? null,
  },

  gaCurrentChannelGroup: {
    label:       "GA4 current channel group",
    description: "Default Channel Group from the visitor's most-recent GA4 session, e.g. \"Organic Search\", \"Direct\". Null when no GA4 history is available.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.gaCurrentChannelGroup ?? null,
  },

  gaLastKnownCity: {
    label:       "GA4 previous city",
    description: "City from a previous GA4 session. Null when only one date-row exists (no distinct prior session).",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.gaLastKnownCity ?? null,
  },

  gaLastKnownRegion: {
    label:       "GA4 previous region",
    description: "Region from a previous GA4 session. Null when only one date-row exists.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.gaLastKnownRegion ?? null,
  },

  gaLastKnownCountry: {
    label:       "GA4 previous country",
    description: "Country from a previous GA4 session (e.g. \"Netherlands\"). Null when only one date-row exists.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.gaLastKnownCountry ?? null,
  },

  gaSessionCount: {
    label:       "GA4 session count",
    description: "Total sessions for this visitor in the configured lookback window. Null when no history is available.",
    group:       "enrichment",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.enrichment?.gaSessionCount ?? null,
  },

  gaLastChannelGroup: {
    label:       "GA4 previous channel group",
    description: "Default Channel Group from a previous GA4 session, e.g. \"Organic Search\", \"Direct\". Null when only one date-row exists.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.gaLastChannelGroup ?? null,
  },

  gaHistorySource: {
    label:       "GA4 history source",
    description: "Source that produced the GA4 history fields. Always \"ga4\" when the stage ran successfully.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.gaHistorySource ?? null,
  },

  // ── Normalized current location (GA4 preferred; IP geo fallback) ────────────
  //
  // currentCity / currentRegion / currentCountry collapse the two location
  // sources (GA4 history and IP geo) into a single authoritative value.
  // Rules should prefer these over gaCurrentCity / city / countryCode when
  // they just want "where is this visitor right now" without caring about
  // the source.
  //
  // currentLocationSource tells rules and AI exactly which source was used,
  // enabling source-aware logic when needed.

  currentCity: {
    label:       "Current city",
    description: "Best-available current city: GA4 city preferred, IP geo city as fallback. Null when neither resolved.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.currentCity ?? null,
  },

  currentRegion: {
    label:       "Current region",
    description: "Best-available current region: GA4 region preferred, IP geo region as fallback. Null when neither resolved.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.currentRegion ?? null,
  },

  currentCountry: {
    label:       "Current country",
    description: "Best-available current country. GA4 gives a human-readable name (e.g. \"Netherlands\"); IP geo gives ISO code (e.g. \"NL\"). See currentLocationSource for the active format.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.currentCountry ?? null,
  },

  currentLocationSource: {
    label:       "Current location source",
    description: "Which source populated currentCity/currentRegion/currentCountry. \"ga4\" = GA4 Analytics History (preferred). \"ip_geo\" = IP-based geo fallback. Null when no location resolved.",
    group:       "enrichment",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.enrichment?.currentLocationSource ?? null,
  },

  // ── Time & seasonality ────────────────────────────────────────────────────
  //
  // All resolvers fall back to null when the field is absent so a missing
  // time context never crashes rule evaluation — the condition is simply
  // treated as "no match" for operators that require a value.

  currentHour: {
    label:       "Current hour",
    description: "Hour of the day in tenant local time (0–23). Use ≥ 18 for evening, < 9 for early morning, etc.",
    group:       "time",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.currentHour ?? null,
  },

  dayOfWeek: {
    label:         "Day of week",
    description:   "Lowercase English day of the week in tenant local time.",
    group:         "time",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    resolve:       (ctx) => ctx.dayOfWeek ?? null,
  },

  isWeekend: {
    label:       "Is weekend",
    description: "True on Saturday and Sunday in tenant local time.",
    group:       "time",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.isWeekend ?? null,
  },

  month: {
    label:       "Month",
    description: "Current month in tenant local time — 1 = January, 12 = December.",
    group:       "time",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.month ?? null,
  },

  dateKey: {
    label:       "Date key",
    description: "Current date as YYYY-MM-DD in tenant local time, e.g. \"2025-12-24\". Useful for targeting a specific calendar date.",
    group:       "time",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.dateKey ?? null,
  },

  timeOfDay: {
    label:         "Time of day",
    description:   "Broad time-of-day bucket in tenant local time: morning (6–11), afternoon (12–17), evening (18–21), or night (22–5).",
    group:         "time",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["morning", "afternoon", "evening", "night"],
    resolve:       (ctx) => ctx.timeOfDay ?? null,
  },

  seasonalEvent: {
    label:         "Seasonal event",
    description:   "Active seasonal window, or \"none\" when outside all known windows. Static events (date-math): christmas, new-year, easter, black-friday, halloween, valentines. Enrichment events (country-aware): cyber-monday, back-to-school.",
    group:         "time",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["none", "new-year", "christmas", "easter", "black-friday", "cyber-monday", "back-to-school", "halloween", "valentines"],
    resolve:       (ctx) => ctx.seasonalEvent ?? null,
  },

  // ── Client / device ────────────────────────────────────────────────────────────
  //
  // Server-derived fields (deviceType, osName, …, engineName) are populated on
  // every request from the User-Agent header.
  //
  // Client-derived fields (isTouchDevice, viewportWidth, …, timeZone) come from
  // the mc_cc cookie, written by ClientContextCollector on first page load.
  // They resolve to null until the browser has sent its signals (typically null
  // only on the very first page view for a given visitor).

  deviceType: {
    label:         "Device type (extended)",
    description:   "Extended device class from User-Agent: mobile, tablet, or desktop.",
    group:         "client_device",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["mobile", "tablet", "desktop"],
    resolve:       (ctx) => ctx.clientContext?.deviceType ?? null,
  },

  osName: {
    label:       "OS name",
    description: "Operating system family from User-Agent, e.g. \"Windows\", \"macOS\", \"iOS\", \"Android\".",
    group:       "client_device",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.clientContext?.osName ?? null,
  },

  osVersion: {
    label:       "OS version",
    description: "OS version string from User-Agent, e.g. \"10.0\", \"14.4\", \"12\".",
    group:       "client_device",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.clientContext?.osVersion ?? null,
  },

  browserName: {
    label:       "Browser name",
    description: "Browser name from User-Agent, e.g. \"Chrome\", \"Firefox\", \"Safari\", \"Edge\".",
    group:       "client_device",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.clientContext?.browserName ?? null,
  },

  browserVersion: {
    label:       "Browser major version",
    description: "Browser major version from User-Agent, e.g. \"120\", \"17\".",
    group:       "client_device",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.clientContext?.browserVersion ?? null,
  },

  engineName: {
    label:       "Rendering engine",
    description: "Browser rendering engine from User-Agent, e.g. \"Blink\", \"Gecko\", \"WebKit\".",
    group:       "client_device",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.clientContext?.engineName ?? null,
  },

  isTouchDevice: {
    label:       "Is touch device",
    description: "True when the visitor's primary input supports touch (browser-collected). Null before ClientContextCollector has run.",
    group:       "client_device",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.clientContext?.isTouchDevice ?? null,
  },

  viewportWidth: {
    label:       "Viewport width",
    description: "Browser viewport width in CSS pixels (browser-collected). Null before ClientContextCollector has run.",
    group:       "client_device",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.clientContext?.viewportWidth ?? null,
  },

  viewportHeight: {
    label:       "Viewport height",
    description: "Browser viewport height in CSS pixels (browser-collected). Null before ClientContextCollector has run.",
    group:       "client_device",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.clientContext?.viewportHeight ?? null,
  },

  preferredColorScheme: {
    label:         "Preferred colour scheme",
    description:   "prefers-color-scheme result from the browser: \"light\", \"dark\", or \"no-preference\". Null before ClientContextCollector has run.",
    group:         "client_device",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["light", "dark", "no-preference"],
    resolve:       (ctx) => ctx.clientContext?.preferredColorScheme ?? null,
  },

  preferredLanguage: {
    label:       "Preferred language",
    description: "Primary language tag from navigator.languages (browser-collected), e.g. \"en-US\", \"nl\". Null before ClientContextCollector has run.",
    group:       "client_device",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.clientContext?.preferredLanguage ?? null,
  },

  timeZone: {
    label:       "Time zone",
    description: "IANA timezone from the browser, e.g. \"Europe/Amsterdam\" (browser-collected). Null before ClientContextCollector has run.",
    group:       "client_device",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.clientContext?.timeZone ?? null,
  },

  // ── Derived — Time ────────────────────────────────────────────────────────────

  daySegment: {
    label:         "Day segment",
    description:   "Granular time-of-day bucket: early-morning, morning, midday, afternoon, evening, or night.",
    group:         "derived",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["early-morning", "morning", "midday", "afternoon", "evening", "night"],
    resolve:       (ctx) => ctx.derived?.daySegment ?? null,
  },

  isWorkHours: {
    label:       "Is work hours",
    description: "True Monday–Friday 09:00–17:59 in tenant local time.",
    group:       "derived",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.derived?.isWorkHours ?? null,
  },

  isHoliday: {
    label:       "Is holiday",
    description: "True when a seasonal event is currently active (seasonalEvent ≠ \"none\").",
    group:       "derived",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.derived?.isHoliday ?? null,
  },

  season: {
    label:         "Season",
    description:   "Meteorological season: spring (Mar–May), summer (Jun–Aug), autumn (Sep–Nov), winter (Dec–Feb).",
    group:         "derived",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["spring", "summer", "autumn", "winter"],
    resolve:       (ctx) => ctx.derived?.season ?? null,
  },

  // ── Derived — Weather ─────────────────────────────────────────────────────────

  isBadWeather: {
    label:       "Is bad weather",
    description: "True when weather is adverse: active precipitation, wind > 40 km/h, or cloud cover > 85 %.",
    group:       "derived",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.derived?.isBadWeather ?? null,
  },

  temperatureBucket: {
    label:         "Temperature bucket",
    description:   "Bucketed temperature: freezing (< 0 °C), cold (0–9), mild (10–19), warm (20–29), hot (≥ 30).",
    group:         "derived",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["freezing", "cold", "mild", "warm", "hot"],
    resolve:       (ctx) => ctx.derived?.temperatureBucket ?? null,
  },

  // ── Derived — Company ─────────────────────────────────────────────────────────

  companyType: {
    label:         "Company type",
    description:   "Company size segment: startup (1–50), smb (51–200), mid-market (201–1 000), enterprise (1 001+).",
    group:         "derived",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["enterprise", "mid-market", "smb", "startup", "unknown"],
    resolve:       (ctx) => ctx.derived?.companyType ?? null,
  },

  industryGroup: {
    label:         "Industry group",
    description:   "Broad industry group: tech, finance, healthcare, manufacturing, retail, professional-services, or other.",
    group:         "derived",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["tech", "finance", "healthcare", "manufacturing", "retail", "professional-services", "other"],
    resolve:       (ctx) => ctx.derived?.industryGroup ?? null,
  },

  // ── Derived — Campaign context ────────────────────────────────────────────────

  channelGroup: {
    label:         "Channel group",
    description:   "Marketing channel: paid-search, paid-social, organic-search, organic-social, email, direct, referral, or other.",
    group:         "derived",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["paid-search", "paid-social", "organic-search", "organic-social", "email", "direct", "referral", "other"],
    resolve:       (ctx) => ctx.derived?.channelGroup ?? null,
  },

  campaignType: {
    label:         "Campaign type",
    description:   "Campaign intent: brand, demand-gen, retargeting, content, event, other, or unknown (no UTM).",
    group:         "derived",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["brand", "demand-gen", "retargeting", "content", "event", "other", "unknown"],
    resolve:       (ctx) => ctx.derived?.campaignType ?? null,
  },

  isRetargetedUser: {
    label:       "Is retargeted user",
    description: "True when the visitor has been to the site before (returning visit type or prior page views).",
    group:       "derived",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.derived?.isRetargetedUser ?? null,
  },

  // ── Derived — Behavior & Engagement ──────────────────────────────────────────

  engagementScore: {
    label:       "Engagement score",
    description: "Composite engagement score 0–100 based on page views, CTA clicks, visit type, and session age.",
    group:       "derived",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.derived?.engagementScore ?? null,
  },

  pagesVisited: {
    label:       "Pages visited",
    description: "Total pages visited in this session (mirrors history.pageViewCount).",
    group:       "derived",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.derived?.pagesVisited ?? null,
  },

  // ── Derived — Funnel & Lifecycle ──────────────────────────────────────────────

  funnelStage: {
    label:         "Funnel stage",
    description:   "Inferred funnel stage: awareness, consideration, intent, or decision.",
    group:         "derived",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["awareness", "consideration", "intent", "decision"],
    resolve:       (ctx) => ctx.derived?.funnelStage ?? null,
  },

  visitDepth: {
    label:       "Visit depth",
    description: "How many pages deep into the site the visitor has gone this session.",
    group:       "derived",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.derived?.visitDepth ?? null,
  },

  // ── Derived — Intent Signals ──────────────────────────────────────────────────

  contentInterestCategory: {
    label:         "Content interest category",
    description:   "Content category of the current page: homepage, product, pricing, content, about, or other.",
    group:         "derived",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["homepage", "product", "pricing", "content", "about", "other"],
    resolve:       (ctx) => ctx.derived?.contentInterestCategory ?? null,
  },

  isResearching: {
    label:       "Is researching",
    description: "True when visitor shows research behaviour: 3+ page views without a conversion signal.",
    group:       "derived",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.derived?.isResearching ?? null,
  },

  isReadyToConvert: {
    label:       "Is ready to convert",
    description: "True when visitor shows purchase intent: has clicked a CTA, or CRM stage is sql/opportunity/customer.",
    group:       "derived",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.derived?.isReadyToConvert ?? null,
  },

  primaryInterest: {
    label:       "Primary interest",
    description: "Best-available interest label: utmTerm → contentInterestCategory → industryGroup.",
    group:       "derived",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.derived?.primaryInterest ?? null,
  },

  // ── Journey behavioral signals ────────────────────────────────────────────────
  //
  // Resolved from ctx.history.journey (populated by fetchJourneyState).
  // All fields return null when no journey state exists (first visit / no events).

  "journey.funnelStage": {
    label:         "Journey funnel stage",
    description:   "Funnel stage from behavioral scoring + sequences: awareness → consideration → intent → high_intent → customer.",
    group:         "behavior",
    kind:          "categorical",
    operators:     OPS_CATEGORICAL,
    allowedValues: ["awareness", "consideration", "intent", "high_intent", "customer"],
    resolve:       (ctx) => ctx.history.journey?.funnelStage ?? null,
  },

  "journey.intentScore": {
    label:       "Journey intent score",
    description: "Aggregate intent score 0–100 derived from scoring rules with recency decay.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.intentScore ?? null,
  },

  "journey.engagementScore": {
    label:       "Journey engagement score",
    description: "Depth-of-engagement score 0–100: page views, CTA clicks, downloads, form interactions.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.engagementScore ?? null,
  },

  "journey.recencyScore": {
    label:       "Journey recency score",
    description: "Recency score 0–100 based on last activity: 100=today, 70=<7d, 30=<30d, 10=<90d.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.recencyScore ?? null,
  },

  "journey.sequenceScore": {
    label:       "Journey sequence score",
    description: "Bonus score from fully-matched behavior sequence patterns.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.sequenceScore ?? null,
  },

  "journey.hasVisitedPricing": {
    label:       "Has visited pricing",
    description: "True when this session has viewed the pricing page at least once.",
    group:       "behavior",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.history.journey?.hasVisitedPricing ?? null,
  },

  "journey.hasVisitedAbout": {
    label:       "Has visited about",
    description: "True when this session has viewed the about page at least once.",
    group:       "behavior",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.history.journey?.hasVisitedAbout ?? null,
  },

  "journey.hasVisitedCases": {
    label:       "Has visited cases",
    description: "True when this session has viewed a case study or portfolio page.",
    group:       "behavior",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.history.journey?.hasVisitedCases ?? null,
  },

  "journey.hasVisitedContact": {
    label:       "Has visited contact",
    description: "True when this session has viewed the contact page.",
    group:       "behavior",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.history.journey?.hasVisitedContact ?? null,
  },

  "journey.hasSubmittedForm": {
    label:       "Journey: has submitted form",
    description: "True when this session has a recorded form_submit journey event (conversion confirmed).",
    group:       "behavior",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => ctx.history.journey?.hasSubmittedForm ?? null,
  },

  "journey.hasStartedForm": {
    label:       "Journey: has started form",
    description: "True when this session started (but not necessarily submitted) a form.",
    group:       "behavior",
    kind:        "boolean",
    operators:   OPS_BOOLEAN,
    resolve:     (ctx) => (ctx.history.journey?.formStartCount ?? 0) > 0,
  },

  "journey.matchedSequences": {
    label:       "Matched sequences",
    description: "Comma-joined slugs of matched behavior sequences. Use 'contains' to target a specific slug.",
    group:       "behavior",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => {
      const seqs = ctx.history.journey?.matchedSequences;
      if (!seqs || seqs.length === 0) return null;
      return seqs.join(",");
    },
  },

  // ── Journey Engine v2 ─────────────────────────────────────────────────────

  "journey.shortTermIntentScore": {
    label:       "Short-term intent score",
    description: "Intent contribution from events in the last 24 hours (0–100). High = visitor is actively researching right now.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.shortTermIntentScore ?? null,
  },

  "journey.longTermAffinityScore": {
    label:       "Long-term affinity score",
    description: "Sustained intent score from events 7–90 days ago (0–100). High = informed, returning visitor.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.longTermAffinityScore ?? null,
  },

  "journey.intentFreshness": {
    label:       "Intent freshness",
    description: "Ratio 0–1 of how much intent is from today vs. historical. Near 1.0 = mostly today; near 0.0 = mostly historical.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.intentFreshness ?? null,
  },

  "journey.repeatSessionBonus": {
    label:       "Repeat-session bonus",
    description: "0–1 indicator of return-visitor behaviour. 0 = first-time or same-day; 1.0 = events spanning 7+ days.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.repeatSessionBonus ?? null,
  },

  "journey.confidenceBand": {
    label:       "Confidence band",
    description: "Current behavioral confidence band: low, medium, high, or very_high. Controls which adaptive slots are personalised.",
    group:       "behavior",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.history.journey?.confidence?.band ?? null,
  },

  "journey.overallConfidence": {
    label:       "Overall behavioral confidence",
    description: "Weighted composite confidence score 0–1. Combines intent, sequence, and funnel-stage confidence.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.confidence?.overallConfidence ?? null,
  },

  // ── Journey Engine v3 — anti-false-positive ───────────────────────────────

  "journey.frictionScore": {
    label:       "Friction score",
    description: "Composite noise/friction score 0–100. High values (≥ 60) gate high_intent; ≥ 70 gates intent. Use to target visitors with genuinely diverse intent vs. repetitive single-signal browsing.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.frictionScore ?? null,
  },

  "journey.signalDiversityScore": {
    label:       "Signal diversity score",
    description: "Ratio 0–1 of distinct high-value signal types fired (pricing, about, contact, CTA, form, download, sequence, return). High diversity indicates genuine multi-faceted interest.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.signalDiversityScore ?? null,
  },

  "journey.uniqueSignalCount": {
    label:       "Unique signal count",
    description: "Number of distinct high-value signal types that have fired (0–10). Required to be ≥ 2 for high_intent promotion (without a sequence), ≥ 1 for intent.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.uniqueSignalCount ?? null,
  },

  "journey.burstPenalty": {
    label:       "Burst penalty",
    description: "Burst detection penalty 0–0.5. Triggered when ≥ 4 events occur within 60 s with < 3 distinct signal keys. High burst (≥ 0.3) blocks hero adaptive output.",
    group:       "behavior",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.history.journey?.burstPenalty ?? null,
  },

  // ── Interest profile scoring ──────────────────────────────────────────────────
  //
  // Derived from the visitor's keyword cloud (accumulated from metaKeywords on
  // visited pages) scored against platform-managed interest profiles.
  //
  // scoreInterests() runs after the keyword cloud is accumulated; results are
  // attached to RuleEvaluationContext as interestScores / interestContext.
  //
  // Usage:
  //   interestPrimary    — filter by topic area (e.g. "equals" "pricing")
  //   interestConfidence — guard: only act when confidence > 0.5
  //   interestPricingScore — segment visitors interested specifically in pricing

  interestPrimary: {
    label:       "Primary interest profile",
    description: "Key of the interest profile with the highest score for this visitor. Empty string when no keyword signal is available.",
    group:       "interest",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.interestContext?.interestPrimary ?? null,
  },

  interestSecondary: {
    label:       "Secondary interest profile",
    description: "Key of the interest profile with the second-highest score. Empty string when fewer than two profiles have any signal.",
    group:       "interest",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => ctx.interestContext?.interestSecondary ?? null,
  },

  interestConfidence: {
    label:       "Interest confidence score",
    description: "Normalized confidence score (0–1) for the primary interest profile. Use as a guard: only personalise when confidence ≥ 0.3.",
    group:       "interest",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.interestContext?.interestConfidence ?? null,
  },

  interestPricingScore: {
    label:       "Pricing interest score",
    description: "Normalized score (0–1) for the 'pricing' interest profile. High when the visitor has viewed pricing-related content.",
    group:       "interest",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.interestContext?.perProfile["pricing"] ?? null,
  },

  interestProductScore: {
    label:       "Product interest score",
    description: "Normalized score (0–1) for the 'product' interest profile. High when the visitor has viewed product feature content.",
    group:       "interest",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.interestContext?.perProfile["product"] ?? null,
  },

  interestUseCaseScore: {
    label:       "Use-case interest score",
    description: "Normalized score (0–1) for the 'use-case' interest profile. High when the visitor has viewed use-case or case-study content.",
    group:       "interest",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.interestContext?.perProfile["use-case"] ?? null,
  },

  interestTrustScore: {
    label:       "Trust interest score",
    description: "Normalized score (0–1) for the 'trust' interest profile. High when the visitor has viewed security, compliance, or social-proof content.",
    group:       "interest",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.interestContext?.perProfile["trust"] ?? null,
  },

  interestTechnicalScore: {
    label:       "Technical interest score",
    description: "Normalized score (0–1) for the 'technical' interest profile. High when the visitor has viewed developer docs or integration content.",
    group:       "interest",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.interestContext?.perProfile["technical"] ?? null,
  },

  interestCandidateScore: {
    label:       "Candidate interest score",
    description: "Normalized score (0–1) for the 'candidate' interest profile. High when the visitor has viewed careers or job-related content.",
    group:       "interest",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.interestContext?.perProfile["candidate"] ?? null,
  },

  interestCommerceProductScore: {
    label:       "Commerce-product interest score",
    description: "Normalized score (0–1) for the 'commerce-product' interest profile. High when the visitor has viewed product-detail or shop content.",
    group:       "interest",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.interestContext?.perProfile["commerce-product"] ?? null,
  },

  interestPropertyScore: {
    label:       "Property interest score",
    description: "Normalized score (0–1) for the 'property' interest profile. High when the visitor has viewed real-estate or property listings.",
    group:       "interest",
    kind:        "number",
    operators:   OPS_NUMBER,
    resolve:     (ctx) => ctx.interestContext?.perProfile["property"] ?? null,
  },

  // ── Audience segment membership ──────────────────────────────────────────────
  //
  // Populated by evaluateAudienceSegments() after buildDecisionContext() has
  // run and all other context layers (interest, journey, enrichment) are ready.
  // Null when no segments are active or none matched the visitor.
  //
  // Usage:
  //   audienceSegmentIds contains "high-intent-enterprise"
  //   audienceSegmentIds exists   (visitor matched at least one segment)

  audienceSegmentIds: {
    label:       "Audience segment IDs",
    description: "Comma-joined keys of audience segments that matched for this visitor. Use 'contains' to test for a specific segment key, or 'exists' to check if any segment matched.",
    group:       "audience",
    kind:        "nullable_string",
    operators:   OPS_NULLABLE_STRING,
    resolve:     (ctx) => (ctx as RuleEvaluationContext & { audienceSegmentIds?: string | null }).audienceSegmentIds ?? null,
  },
};

// ── Registry helpers ───────────────────────────────────────────────────────────

/** All registered field keys, in registry definition order. */
export const ALL_FIELD_KEYS: readonly RuleFieldKey[] =
  Object.keys(FIELD_REGISTRY) as RuleFieldKey[];

/** Field keys grouped by FieldGroup, preserving registry order within each group. */
export const FIELD_KEYS_BY_GROUP: Readonly<Record<FieldGroup, readonly RuleFieldKey[]>> = {
  traffic:        ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "traffic"),
  device_session: ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "device_session"),
  behavior:       ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "behavior"),
  tenant_page:    ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "tenant_page"),
  enrichment:     ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "enrichment"),
  time:           ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "time"),
  client_device:  ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "client_device"),
  derived:        ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "derived"),
  interest:       ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "interest"),
  audience:       ALL_FIELD_KEYS.filter((k) => FIELD_REGISTRY[k].group === "audience"),
};

/**
 * Type-safe field lookup — throws a clear error if `key` is not registered.
 * Use in runtime paths where an invalid key indicates a corrupt stored rule
 * that slipped past validation.
 */
export function getFieldDefinition(key: string): FieldDefinition {
  const def = (FIELD_REGISTRY as Record<string, FieldDefinition | undefined>)[key];
  if (!def) throw new Error(`[field-registry] Unknown rule field: "${key}"`);
  return def;
}
