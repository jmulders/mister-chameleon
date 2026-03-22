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

import type { DecisionInput } from "../types";

// ── Rule evaluation context ────────────────────────────────────────────────────

/**
 * The full context available to rule predicates at evaluation time.
 *
 * Extends DecisionInput (VisitorContext + VisitorHistory) with optional
 * page-level properties populated by the route that renders the page.
 * All page-context fields are optional so the model degrades gracefully
 * when called from contexts where page metadata is unavailable; resolve
 * functions return null for absent optional properties.
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
};

// ── Field metadata types ───────────────────────────────────────────────────────

/** UI grouping for field-picker option groups. */
export type FieldGroup =
  | "traffic"         // acquisition channel, UTM, referrer
  | "device_session"  // device class, visit type, pathname
  | "behavior"        // history signals derived from first-party DB data
  | "tenant_page";    // tenant identity, page type, template key

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
  | "lastHeroKey"
  | "lastCtaKey"
  | "daysSinceFirstSeen"
  // Tenant / page context
  | "tenantId"
  | "pageType"
  | "templateKey";

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
