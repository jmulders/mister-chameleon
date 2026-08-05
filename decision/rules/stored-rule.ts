/**
 * Stored Rule Types
 *
 * JSON-serialisable representation of a homepage decision rule.
 * Used by the internal rules editor to persist and load rule configurations
 * without editing TypeScript source directly.
 *
 * ─── Relationship to HomepageRule ─────────────────────────────────────────────
 *
 *   HomepageRule (runtime)      — contains a `match` function; used by the
 *                                  RulesDecisionProvider at request time.
 *
 *   StoredRule (serialisable)   — contains a `condition` descriptor; used by
 *                                  the rules editor, written to runtime-rules.json.
 *
 *   compileStoredRule()         — converts StoredRule → HomepageRule by
 *                                  wrapping the condition descriptor in a
 *                                  evaluateCondition() call.
 *
 * ─── Condition model ──────────────────────────────────────────────────────────
 *
 *   Three condition kinds are supported:
 *
 *   1. FieldCondition  — evaluates a single field against a value using an
 *                         operator. Field metadata (kind, valid operators,
 *                         allowed values) lives in field-registry.ts.
 *                         e.g. { type: "field", field: "source",
 *                                operator: "equals", value: "google" }
 *                         Legacy shape without `operator` defaults to "equals"
 *                         for backwards compatibility.
 *
 *   2. NamedCondition  — a named compound predicate with a fixed implementation.
 *                         e.g. { type: "named", name: "returning_cta_clicked" }
 *                         Named conditions exist for predicates that reference
 *                         ctx.history.* in ways that cannot be expressed as a
 *                         single field check without a full DSL.
 *
 *   3. GroupCondition  — a logical group combining child conditions with AND or
 *                         OR.  Groups may be nested; the tree stays
 *                         JSON-serialisable because it contains only plain data.
 *                         e.g. { type: "group", logic: "and", conditions: [...] }
 *
 * ─── JSON-safety guarantee ────────────────────────────────────────────────────
 *
 *   The condition tree is a plain data structure — no functions, no class
 *   instances, no symbols.  It serialises to JSON and back without loss.
 *   compileStoredRule() is the only place where descriptors become predicates,
 *   and it only ever produces pure `(input: DecisionInput) => boolean` closures
 *   that delegate to evaluateCondition().
 *   Arbitrary code execution via the editor is structurally impossible.
 *
 * ─── Runtime evaluation ────────────────────────────────────────────────────────
 *
 *   evaluateCondition(condition, ctx) is the canonical runtime interpreter for
 *   condition trees.  It provides:
 *
 *   - Recursive group evaluation with correct AND / OR short-circuiting.
 *   - Per-leaf error containment: if a field resolver throws (e.g. bad data),
 *     that single leaf returns false and logs a warning — sibling OR branches
 *     are still evaluated, and no exception propagates to the caller.
 *   - Safe unknown-field handling in case a stored rule slips past validation.
 */

import type {
  DecisionInput,
  HeroVariantKey,
  ProofVariantKey,
  CTAVariantKey,
  FeatureVariantKey,
  ConversionVariantKey,
  NotificationVariantKey,
} from "../types";
import {
  FEATURE_VARIANT_KEYS,
  CONVERSION_VARIANT_KEYS,
  NOTIFICATION_VARIANT_KEYS,
} from "../types";
import type { ThemePresetKey } from "@/design-system/theme/presets";
import type { HomepageRule } from "./homepage-rules";
import {
  FIELD_REGISTRY,
  FIELD_OPERATORS,
  NO_VALUE_OPERATORS,
  ARRAY_VALUE_OPERATORS,
  NUMERIC_OPERATORS,
  STRING_ONLY_OPERATORS,
  ALL_FIELD_KEYS,
} from "./field-registry";
import type {
  RuleFieldKey,
  FieldOperator,
  RuleEvaluationContext,
  FieldRuntimeValue,
} from "./field-registry";
import { ALL_CONTEXT_IDS } from "./context-library";
import type { PrecedenceLevel } from "./rule-packs";
import { logger } from "@/lib/logger";

// ── Re-exports for consumers that import from stored-rule ──────────────────────
// These re-exports preserve backwards-compatibility for importers that
// previously pulled FieldOperator / FIELD_OPERATORS from this module.

export type {
  RuleFieldKey,
  FieldOperator,
  RuleEvaluationContext,
  FieldGroup,
  FieldKind,
} from "./field-registry";

export {
  FIELD_OPERATORS,
  FIELD_REGISTRY,
  FIELD_KEYS_BY_GROUP,
  ALL_FIELD_KEYS,
  NO_VALUE_OPERATORS,
  ARRAY_VALUE_OPERATORS,
  NUMERIC_OPERATORS,
  STRING_ONLY_OPERATORS,
  getFieldDefinition,
} from "./field-registry";

// ── Condition field vocabulary ─────────────────────────────────────────────────

/**
 * The set of VisitorContext / VisitorHistory / page-context fields that a
 * FieldCondition can reference.  Alias for RuleFieldKey; exported as
 * ConditionField for backwards compatibility with existing consumers.
 *
 * The full metadata for each field (label, kind, valid operators, allowed
 * values, runtime resolver) lives in FIELD_REGISTRY (field-registry.ts).
 */
export type ConditionField = RuleFieldKey;

// ── Named conditions ───────────────────────────────────────────────────────────

/**
 * Named compound predicates that cannot be expressed as simple field checks.
 * Each name maps to a fixed, hardcoded match function in evaluateCondition().
 */
export const NAMED_CONDITIONS = {
  returning_cta_clicked: {
    label:       "Returning visitor — CTA previously clicked",
    description: "Fires when the visitor's DB history shows hasClickedCta = true. Requires history to be loaded from the database.",
  },
  high_engagement: {
    label:       "High-engagement visitor (3+ page views)",
    description: "Fires when the visitor's DB history shows pageViewCount ≥ 3. Requires history to be loaded from the database.",
  },
} as const satisfies Record<string, { label: string; description: string }>;

export type NamedConditionId = keyof typeof NAMED_CONDITIONS;

// ── Condition types ────────────────────────────────────────────────────────────

/**
 * The value type for a FieldCondition.
 * Exact requirements depend on the operator:
 *   exists / not_exists              → value must be omitted
 *   in / not_in                      → non-empty array of strings or numbers
 *   gt / gte / lt / lte              → number
 *   contains / not_contains          → string
 *   equals / not_equals              → type must match the field's kind
 */
export type FieldConditionValue = string | number | boolean | readonly (string | number)[];

/**
 * A condition that evaluates a single field against a value using an operator.
 *
 * `operator` is optional for backwards compatibility with the pre-R1 MVP shape
 * `{ type: "field", field, value }` where equality was the only operator.
 * A missing `operator` is treated as `"equals"` by both the compiler and the
 * validation helper.
 */
export interface FieldCondition {
  type:  "field";
  field: ConditionField;

  /**
   * Comparison operator.
   * @default "equals"
   * Omit to remain compatible with pre-R1 stored rules.
   */
  operator?: FieldOperator;

  /**
   * The value to compare against.
   * Must be omitted (or undefined) for "exists" / "not_exists".
   * Must be an array for "in" / "not_in".
   * Must be a number for ordering operators.
   * Must be a string for "contains" / "not_contains".
   */
  value?: FieldConditionValue;
}

/** A named compound predicate with a fixed hardcoded implementation. */
export interface NamedCondition {
  type: "named";
  name: NamedConditionId;
}

/**
 * A logical group of conditions combined with AND or OR.
 *
 * Groups may be nested (validation caps depth at 5).
 * The tree is JSON-serialisable because it contains only plain data.
 *
 * Examples:
 *   // Returning visitor from Google
 *   { type: "group", logic: "and", conditions: [
 *       { type: "field", field: "visitType", operator: "equals", value: "returning" },
 *       { type: "field", field: "source",    operator: "equals", value: "google"    },
 *   ]}
 *
 *   // Google or LinkedIn
 *   { type: "group", logic: "or", conditions: [
 *       { type: "field", field: "source", operator: "equals", value: "google"   },
 *       { type: "field", field: "source", operator: "equals", value: "linkedin" },
 *   ]}
 */
export interface GroupCondition {
  type:       "group";
  logic:      "and" | "or";
  /** Must contain at least one child condition. */
  conditions: readonly RuleCondition[];
}

/**
 * A condition that delegates to a named ContextDefinition from the Context Library.
 *
 * This is the primary way rules should express visitor segments: reference a
 * named context (e.g. "ctx_google_traffic") rather than duplicating a field
 * condition inline.  Context IDs are stable keys in CONTEXT_REGISTRY.
 *
 * Advantages over inline field conditions:
 *   - If the underlying definition changes (e.g. "google_traffic" gains paid-ads
 *     source values), all rules that reference it update automatically.
 *   - The rule editor can present a curated context picker instead of raw fields.
 *   - Debug output shows which named contexts matched, making traces readable.
 *
 * @example
 *   { type: "context", contextId: "ctx_google_traffic" }
 */
export interface ContextCondition {
  type:      "context";
  contextId: string;
}

/**
 * Condition that triggers when one or more named Context Library audience
 * profiles match the current visitor.
 *
 * Context Library definitions live in `context/library/definitions.ts` and are
 * separate from the simpler `CONTEXT_REGISTRY` used by ContextCondition.
 * They are richer audience profiles with criteria-based matching and per-criterion
 * confidence scoring.
 *
 * Logic: OR across `contextIds` — if ANY of the listed definitions match the
 * visitor (and meet the optional confidence threshold) the condition fires.
 *
 * This enables three condition modes in the ThemeRulesEditor:
 *   "raw_condition"         — FieldCondition / NamedCondition / ContextCondition / GroupCondition
 *   "context_match"         — ContextLibraryCondition (one or more library IDs)
 *   "context_plus_condition" — GroupCondition { logic: "and", conditions: [ContextLibraryCondition, rawCondition] }
 *
 * @example
 *   { type: "context_library", contextIds: ["intent-high-saas-evaluator", "lifecycle-active-trial"] }
 *   { type: "context_library", contextIds: ["lifecycle-customer"], minConfidence: 0.8 }
 */
export interface ContextLibraryCondition {
  type: "context_library";
  /**
   * One or more Context Library definition IDs from `context/library/definitions.ts`.
   * The condition fires when ANY listed definition matches (OR logic).
   */
  contextIds: readonly string[];
  /**
   * Minimum confidence threshold for a match to count.
   * Confidence is the ratio of passed criteria / total criteria (0–1).
   * Defaults to 0 (any match qualifies, including partial optional criteria).
   */
  minConfidence?: number;
}

/**
 * A condition that reads a rule-written context flag from `ctx.ruleContext`
 * (the sticky overlay persisted in visitor_behavior_state.rule_context).
 *
 * This is how a later paginaweergave/regel reads a flag an earlier rule wrote
 * (e.g. `gericht_binnengekomen`). It reads the raw overlay directly — it does
 * NOT go through FIELD_REGISTRY — so flag names are free-form, not registry keys.
 * (Overriding a derived registry field is a separate mechanism: the field's
 * resolver consults `ctx.ruleContext[fieldKey]`; see spec §4.)
 *
 * @example
 *   { type: "flag", name: "gericht_binnengekomen", value: true }
 *   { type: "flag", name: "hoge_intentie", operator: "exists" }
 */
export interface FlagCondition {
  type: "flag";
  /** Flag name — a key in `ctx.ruleContext`. Free-form, not a registry key. */
  name: string;
  /**
   * Comparison operator.
   * @default "equals"
   * Also supports "exists" / "not_exists" to test presence of the flag.
   */
  operator?: FieldOperator;
  /**
   * The value to compare against. Omit for "exists" / "not_exists".
   */
  value?: string | number | boolean;
}

/** Any condition that can appear in a StoredRule or as a GroupCondition child. */
export type RuleCondition =
  | FieldCondition
  | NamedCondition
  | ContextCondition
  | ContextLibraryCondition
  | FlagCondition
  | GroupCondition;

// ── Stored plan ────────────────────────────────────────────────────────────────

/**
 * A single context variable a rule writes when it matches ("regels die context
 * schrijven"). The `key` is either an own flag name (read back via a
 * FlagCondition) or a FIELD_REGISTRY field key (overriding that field's derived
 * value for the session; see spec §4).
 *
 * `sticky` (default true) persists the write to
 * visitor_behavior_state.rule_context so a later paginaweergave/regel reads it.
 * A non-sticky write lives only within the current request's evaluation.
 */
export interface RuleContextWrite {
  /** Flag name or registry field key (override). */
  key:     string;
  value:   string | number | boolean;
  /** Default true — persists for the session. */
  sticky?: boolean;
}

/**
 * The variant key triple (+ optional theme override) stored inside a rule
 * or the default plan.
 *
 * `themeKey` is optional — omit it when the rule only affects variant selection.
 * When present it overrides the tenant's design.theme for the session.
 */
export interface StoredPlan {
  heroKey:   HeroVariantKey;
  proofKey:  ProofVariantKey;
  ctaKey:    CTAVariantKey;
  /**
   * Optional theme preset override for this plan.
   * When set the experience pipeline injects this theme instead of the
   * tenant's default design.theme for the visitor's session.
   */
  themeKey?: ThemePresetKey;

  /**
   * Controls how prominently the pricing section is displayed.
   *
   * hidden     — Customer in onboarding/post-conversion. Acquisition pricing
   *              suppressed; replaced by lifecycle CTAs only.
   * teaser     — Awareness/consideration stage. Brief pricing preview only
   *              (e.g. "starting from €79/mo" + link to full page).
   * standard   — Mid-funnel default. Full pricing table shown without
   *              special visual emphasis or urgency signals.
   * emphasized — High-intent / trial-ready. Pricing prominent with stronger
   *              CTA labels, highlight on recommended plan, and optional
   *              urgency copy.
   *
   * When absent, components default to "standard".
   */
  pricingEmphasis?: "hidden" | "teaser" | "standard" | "emphasized";

  /**
   * Controls which CTA type is shown in pricing-sensitive sections.
   *
   * trial      — Show "Start gratis" / free trial CTA (Starter emphasis).
   * demo       — Show "Plan demo" / "Bekijk demo" CTA (default for Growth/Pro).
   * onboarding — Customer just converted; show "Plan je onboarding" / dashboard CTA.
   * expansion  — Existing customer; show "Upgrade je plan" / enrichment CTA.
   * none       — Suppress acquisition CTA entirely (customer, post-conversion).
   *
   * When absent, components use each plan's canonical ctaType from pricing-table.ts.
   */
  pricingCtaMode?: "trial" | "demo" | "onboarding" | "expansion" | "none";

  /**
   * Optional feature block variant for this plan.
   *
   * Controls the "features" adaptive slot — a content-managed feature grid,
   * highlights strip, or comparison table.  When absent the slot falls back to
   * the tenant's default featureKey or is omitted from the page.
   *
   * feature_grid_primary  — Full feature grid (typical awareness / consideration).
   * feature_highlights    — Condensed differentiator highlights (mid-funnel).
   * feature_comparison    — Side-by-side comparison table (high intent / trial).
   */
  featureKey?: FeatureVariantKey;

  /**
   * Optional conversion block variant for this plan.
   *
   * Controls the "conversion" adaptive slot — a richer conversion section
   * (form, booking embed, or sign-up flow) placed below the main CTA block.
   *
   * conversion_signup   — Email / account signup form (trial / starter).
   * conversion_demo     — Demo request or booking embed (growth / enterprise).
   * conversion_contact  — Contact / enquiry form (careers / post-conversion).
   */
  conversionKey?: ConversionVariantKey;

  /**
   * Optional notification overlay variant for this plan.
   *
   * Controls the "notification" adaptive slot — a toast or banner shown on top
   * of the page layout.  When absent, no notification is shown.
   *
   * notification_default   — Generic informational notice.
   * notification_offer     — Promotional / limited-time offer banner.
   * notification_urgency   — Urgency/scarcity nudge for high-intent visitors.
   * notification_returning — Personalised welcome-back for known visitors.
   */
  notificationKey?: NotificationVariantKey;

  /**
   * Visitor-adaptive hero variant key for compact inner-page banners.
   *
   * Used exclusively by the CMS slug page decision pipeline
   * (`lib/cms-page-decision.ts`) to personalise the `hero` context slot on
   * inner pages without affecting the homepage experience.
   *
   * Targets `hero_page_banner_*` variants (compact, dark ~160–280px header
   * with optional media panel).  The homepage always uses `heroKey` instead;
   * this field is intentionally separate so a rule author can target both
   * surfaces independently from one rule.
   *
   * Resolution order applied by `cms-page-decision.ts`:
   *   1. plan.pageBannerKey  — engine-chosen compact banner (visitor-adaptive)
   *   2. slot.variantKey     — page-specific fallback set by the CMS author
   */
  pageBannerKey?: string;

  /**
   * Per-form-type variant keys chosen by the engine (forms-as-adaptive-blocks).
   * Maps a form type (contact / application / appointment) to a variant key
   * stored in the tenant's `form:<type>` adaptive-block row. When a type is
   * absent, the decide route serves the form's base definition, so behaviour is
   * unchanged unless a rule targets a form variant.
   */
  formVariants?: Record<string, string>;

  /**
   * Per-email-template variant keys chosen by the engine (adaptive emails).
   * Maps an email template key (abm_intro / contact_followup / …) to a variant
   * key stored in the tenant's `email:<templateKey>` adaptive-block row. When a
   * template is absent, the adaptive email uses its resolved template (tenant
   * override over the code default), so behaviour is unchanged unless a rule
   * targets an email variant. A variant may override the subject, preheader,
   * and/or block set.
   */
  emailVariants?: Record<string, string>;

  /**
   * Context writes applied when this rule matches ("regels die context
   * schrijven"). Optional effect alongside (or instead of) the variant choice —
   * a pure "tag-only" rule carries `setContext` and no meaningful variant.
   *
   * In the 2-phase evaluation (spec §5) these are applied in phase A over the
   * overlay before the variant is chosen in phase B; sticky writes are persisted
   * after the response. Absent = no context effect (current behaviour).
   */
  setContext?: RuleContextWrite[];
}

// ── Stored rule ────────────────────────────────────────────────────────────────

/**
 * A JSON-serialisable decision rule.
 * Mirrors HomepageRule but replaces the `match` function with a `condition`
 * descriptor that can be stored, validated, and edited without executing code.
 */
export interface StoredRule {
  /** Stable ID — safe to reference in analytics events. */
  id: string;

  /**
   * Evaluation precedence (lower = higher priority).
   * Rules with lower priority numbers are evaluated first.
   */
  priority: number;

  /** Human-readable label shown in the rules editor and debug panel. */
  label: string;

  /** Declarative condition that replaces the `match` function. */
  condition: RuleCondition;

  /** Variant keys to apply when this rule fires. */
  plan: StoredPlan;

  /** Explanation shown in debug output and analytics. */
  reason: string;

  /**
   * Whether this rule participates in evaluation.
   * When false the rule is skipped by the engine regardless of its condition.
   * Defaults to true when absent (backward compatible with stored rules
   * that were created before this field existed).
   */
  enabled?: boolean;

  /**
   * Origin of this rule, used by the blueprint merge system.
   *
   * "system"    — shipped with the platform; updated automatically on deploy.
   * "blueprint" — installed from a demo or starter blueprint; safe to overwrite.
   * "tenant"    — created or customised by the tenant; never overwritten by merges.
   *
   * Defaults to "tenant" when absent so that rules created before this field
   * existed are never accidentally overwritten.
   */
  source?: "system" | "blueprint" | "tenant";

  /**
   * The rule pack this rule belongs to.
   *
   * References a key in RULE_PACK_REGISTRY (e.g. "pack_traffic_source") or a
   * custom tenant pack ID.  Used for grouping and filtering in the admin UI.
   * Has no effect on rule evaluation — purely organisational metadata.
   *
   * Defaults to undefined (uncategorised) when absent.
   */
  packId?: string;

  /**
   * The named precedence tier this rule operates in.
   *
   * Must be consistent with the priority value:
   *   hard_state          → priority 1–9
   *   high_intent         → priority 10–19
   *   medium_segmentation → priority 20–49
   *   decorative          → priority 50–99
   *
   * If absent, the tier is inferred from the priority at display time by
   * inferPrecedenceLevel().  Explicit declaration is preferred because it makes
   * the intent visible in stored JSON without requiring the caller to know the
   * tier boundaries.
   */
  precedenceLevel?: PrecedenceLevel;
}

// ── Default plan ───────────────────────────────────────────────────────────────

/** The fallback plan applied when no rule matches. */
export interface StoredDefaultPlan extends StoredPlan {
  reason: string;
}

// ── Rules config ───────────────────────────────────────────────────────────────

/**
 * The complete serialisable rules configuration written to runtime-rules.json.
 * `schemaVersion` is intentionally literal so readers can handle migrations.
 */
export interface StoredRulesConfig {
  schemaVersion: 1;
  updatedAt:     string;
  rules:         StoredRule[];
  defaultPlan:   StoredDefaultPlan;

  /**
   * Tenant-level master switch for the rules engine.
   * When false the engine skips all rules and falls back to the defaultPlan,
   * regardless of individual rule.enabled values.
   * Defaults to true when absent (backward compatible).
   */
  rulesEnabled?: boolean;
}

// ── Allowed variant key sets ───────────────────────────────────────────────────

export const ALLOWED_HERO_KEYS: readonly HeroVariantKey[] = [
  // Platform defaults
  "hero_default",
  "hero_google_problem",
  "hero_linkedin_vision",
  "hero_direct_brand",
  "hero_consideration",
  "hero_intent_direct",
  "hero_customer_onboarding",
  // B2B SaaS blueprint
  "hero_saas_default",
  "hero_saas_consideration",
  "hero_saas_intent",
  "hero_saas_trial",
  "hero_saas_customer_onboarding",
  // Careers / Werken-bij blueprint
  "hero_careers_default",
  "hero_careers_job_match",
  "hero_careers_high_intent",
  "hero_careers_reassurance",
  // Per-preset demo variants (distinct hero per Quick Preset)
  "hero_trial_ready",
  "hero_returning",
  "hero_enterprise",
  "hero_form_dropoff",
  "hero_customer_expansion",
  "hero_post_conversion",
  "hero_high_friction",
  "hero_churn_risk",
  "hero_careers_job_interest",
  "hero_careers_submitted",
] as const;

export const ALLOWED_PROOF_KEYS: readonly ProofVariantKey[] = [
  // Platform defaults
  "proof_default",
  "proof_cases",
  "proof_vision",
  "proof_platform",
  "proof_stats",
  "proof_reassurance",
  // B2B SaaS blueprint
  "proof_saas_default",
  "proof_saas_consideration",
  "proof_saas_intent",
  "proof_saas_reassurance",
  // Careers / Werken-bij blueprint
  "proof_careers_default",
  "proof_careers_team",
  "proof_careers_reassurance",
] as const;

export const ALLOWED_CTA_KEYS: readonly CTAVariantKey[] = [
  // Platform defaults
  "cta_default",
  "cta_guide",
  "cta_platform",
  "cta_meeting",
  "cta_demo",
  "cta_onboarding",
  "cta_expansion",
  // B2B SaaS blueprint
  "cta_saas_default",
  "cta_saas_demo",
  "cta_saas_trial",
  "cta_saas_onboarding",
  "cta_saas_expansion",
  // Careers / Werken-bij blueprint
  "cta_careers_browse",
  "cta_careers_apply",
  "cta_careers_open",
  "cta_careers_contact",
] as const;

/** All valid feature variant keys — mirrors FEATURE_VARIANT_KEYS from decision/types.ts. */
export const ALLOWED_FEATURE_KEYS: readonly FeatureVariantKey[] = [
  ...FEATURE_VARIANT_KEYS,
] as const;

/** All valid conversion variant keys — mirrors CONVERSION_VARIANT_KEYS from decision/types.ts. */
export const ALLOWED_CONVERSION_KEYS: readonly ConversionVariantKey[] = [
  ...CONVERSION_VARIANT_KEYS,
] as const;

/** All valid notification variant keys — mirrors NOTIFICATION_VARIANT_KEYS from decision/types.ts. */
export const ALLOWED_NOTIFICATION_KEYS: readonly NotificationVariantKey[] = [
  ...NOTIFICATION_VARIANT_KEYS,
] as const;

// ── Validation ─────────────────────────────────────────────────────────────────

export interface ValidationError {
  ruleId?: string;
  field:   string;
  message: string;
}

// ── Extra allowed keys (CMS variants) ─────────────────────────────────────────

/**
 * Optional extra variant key sets passed to validateStoredConfig() by server
 * actions that have already fetched the CMS catalogue.
 *
 * Each array extends the corresponding ALLOWED_*_KEYS whitelist so that
 * CMS-created variants are accepted without relaxing the platform defaults.
 */
export interface ExtraAllowedKeys {
  heroKeys?:  readonly string[];
  proofKeys?: readonly string[];
  ctaKeys?:   readonly string[];
}

/**
 * Validate a StoredRulesConfig against the field registry and allowed key
 * vocabulary.  Returns an array of errors; empty array = valid.
 *
 * Deliberately strict — rejects any value not in the explicit allow-lists
 * to prevent injection of unexpected content via the editor API.
 * Condition trees are validated recursively with a depth cap of 5.
 *
 * @param config     The raw config value (JSON-parsed from the request body).
 * @param extraKeys  Optional CMS variant keys to extend the platform allow-lists.
 *                   Pass the keys fetched by fetchVariantCatalogue() so rules
 *                   that target CMS variants pass validation.
 */
export function validateStoredConfig(
  config:    unknown,
  extraKeys: ExtraAllowedKeys = {},
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config || typeof config !== "object") {
    return [{ field: "root", message: "Config must be an object." }];
  }

  const c = config as Record<string, unknown>;

  // Schema version
  if (c.schemaVersion !== 1) {
    errors.push({ field: "schemaVersion", message: "schemaVersion must be 1." });
  }

  // rulesEnabled (optional boolean)
  if (c.rulesEnabled !== undefined && typeof c.rulesEnabled !== "boolean") {
    errors.push({ field: "rulesEnabled", message: "rulesEnabled must be a boolean." });
  }

  // Merge platform + extra allowed keys for plan validation.
  const allowedHeroKeys:  readonly string[] = extraKeys.heroKeys
    ? [...ALLOWED_HERO_KEYS, ...extraKeys.heroKeys]
    : ALLOWED_HERO_KEYS;
  const allowedProofKeys: readonly string[] = extraKeys.proofKeys
    ? [...ALLOWED_PROOF_KEYS, ...extraKeys.proofKeys]
    : ALLOWED_PROOF_KEYS;
  const allowedCtaKeys:   readonly string[] = extraKeys.ctaKeys
    ? [...ALLOWED_CTA_KEYS, ...extraKeys.ctaKeys]
    : ALLOWED_CTA_KEYS;

  // Default plan
  const dp = c.defaultPlan as Record<string, unknown> | undefined;
  if (!dp) {
    errors.push({ field: "defaultPlan", message: "defaultPlan is required." });
  } else {
    validatePlan(dp, "defaultPlan", undefined, errors, allowedHeroKeys, allowedProofKeys, allowedCtaKeys);
    if (typeof dp.reason !== "string" || dp.reason.trim() === "") {
      errors.push({ field: "defaultPlan.reason", message: "reason must be a non-empty string." });
    }
  }

  // Rules array
  if (!Array.isArray(c.rules)) {
    errors.push({ field: "rules", message: "rules must be an array." });
    return errors;
  }

  const rules    = c.rules as unknown[];
  const seenIds   = new Set<string>();
  const seenPrios = new Set<number>();

  for (let i = 0; i < rules.length; i++) {
    const r   = rules[i] as Record<string, unknown>;
    const idx = `rules[${i}]`;

    // id
    if (typeof r.id !== "string" || r.id.trim() === "") {
      errors.push({ field: `${idx}.id`, message: "id must be a non-empty string." });
    } else if (seenIds.has(r.id)) {
      errors.push({ ruleId: r.id as string, field: `${idx}.id`, message: `Duplicate rule id "${r.id}".` });
    } else {
      seenIds.add(r.id as string);
    }

    // priority
    if (typeof r.priority !== "number" || !Number.isInteger(r.priority) || r.priority < 0) {
      errors.push({ ruleId: r.id as string, field: `${idx}.priority`, message: "priority must be a non-negative integer." });
    } else if (seenPrios.has(r.priority)) {
      errors.push({ ruleId: r.id as string, field: `${idx}.priority`, message: `Duplicate priority ${r.priority}.` });
    } else {
      seenPrios.add(r.priority as number);
    }

    // label
    if (typeof r.label !== "string" || r.label.trim() === "") {
      errors.push({ ruleId: r.id as string, field: `${idx}.label`, message: "label must be a non-empty string." });
    }

    // reason
    if (typeof r.reason !== "string" || r.reason.trim() === "") {
      errors.push({ ruleId: r.id as string, field: `${idx}.reason`, message: "reason must be a non-empty string." });
    }

    // enabled (optional boolean — omitted means true)
    if (r.enabled !== undefined && typeof r.enabled !== "boolean") {
      errors.push({ ruleId: r.id as string, field: `${idx}.enabled`, message: "enabled must be a boolean." });
    }

    // condition
    validateCondition(r.condition, idx, r.id as string | undefined, errors, 0);

    // plan
    validatePlan(r.plan as Record<string, unknown>, idx, r.id as string | undefined, errors, allowedHeroKeys, allowedProofKeys, allowedCtaKeys);
  }

  return errors;
}

function validatePlan(
  plan:             Record<string, unknown> | undefined,
  idx:              string,
  ruleId:           string | undefined,
  errors:           ValidationError[],
  allowedHeroKeys:  readonly string[] = ALLOWED_HERO_KEYS,
  allowedProofKeys: readonly string[] = ALLOWED_PROOF_KEYS,
  allowedCtaKeys:   readonly string[] = ALLOWED_CTA_KEYS,
): void {
  if (!plan || typeof plan !== "object") {
    errors.push({ ruleId, field: `${idx}.plan`, message: "plan is required." });
    return;
  }

  if (!(allowedHeroKeys as string[]).includes(plan.heroKey as string)) {
    errors.push({ ruleId, field: `${idx}.plan.heroKey`, message: `Invalid heroKey "${plan.heroKey}". Allowed: ${allowedHeroKeys.join(", ")}` });
  }
  if (!(allowedProofKeys as string[]).includes(plan.proofKey as string)) {
    errors.push({ ruleId, field: `${idx}.plan.proofKey`, message: `Invalid proofKey "${plan.proofKey}". Allowed: ${allowedProofKeys.join(", ")}` });
  }
  if (!(allowedCtaKeys as string[]).includes(plan.ctaKey as string)) {
    errors.push({ ruleId, field: `${idx}.plan.ctaKey`, message: `Invalid ctaKey "${plan.ctaKey}". Allowed: ${allowedCtaKeys.join(", ")}` });
  }

  // Optional extended slots — validate when present
  if (plan.featureKey !== undefined) {
    if (!(ALLOWED_FEATURE_KEYS as string[]).includes(plan.featureKey as string)) {
      errors.push({ ruleId, field: `${idx}.plan.featureKey`, message: `Invalid featureKey "${plan.featureKey}". Allowed: ${ALLOWED_FEATURE_KEYS.join(", ")}` });
    }
  }
  if (plan.conversionKey !== undefined) {
    if (!(ALLOWED_CONVERSION_KEYS as string[]).includes(plan.conversionKey as string)) {
      errors.push({ ruleId, field: `${idx}.plan.conversionKey`, message: `Invalid conversionKey "${plan.conversionKey}". Allowed: ${ALLOWED_CONVERSION_KEYS.join(", ")}` });
    }
  }
  if (plan.notificationKey !== undefined) {
    if (!(ALLOWED_NOTIFICATION_KEYS as string[]).includes(plan.notificationKey as string)) {
      errors.push({ ruleId, field: `${idx}.plan.notificationKey`, message: `Invalid notificationKey "${plan.notificationKey}". Allowed: ${ALLOWED_NOTIFICATION_KEYS.join(", ")}` });
    }
  }

  // Form variants map a form TYPE to a tenant-defined variant key. Variant keys
  // are tenant data (not a fixed platform allow-list), so we only validate the
  // shape: known form type → non-empty string.
  if (plan.formVariants !== undefined) {
    const fv = plan.formVariants;
    if (!fv || typeof fv !== "object" || Array.isArray(fv)) {
      errors.push({ ruleId, field: `${idx}.plan.formVariants`, message: "formVariants must be an object mapping a form type to a variant key." });
    } else {
      const validFormTypes = ["contact", "application", "appointment"];
      for (const [type, key] of Object.entries(fv as Record<string, unknown>)) {
        if (!validFormTypes.includes(type)) {
          errors.push({ ruleId, field: `${idx}.plan.formVariants.${type}`, message: `Invalid form type "${type}". Allowed: ${validFormTypes.join(", ")}` });
        } else if (typeof key !== "string" || key.trim() === "") {
          errors.push({ ruleId, field: `${idx}.plan.formVariants.${type}`, message: "variant key must be a non-empty string." });
        }
      }
    }
  }

  // Email variants map an email TEMPLATE key to a tenant-defined variant key.
  // Same shape-only validation as formVariants (keys are tenant data).
  if (plan.emailVariants !== undefined) {
    const ev = plan.emailVariants;
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) {
      errors.push({ ruleId, field: `${idx}.plan.emailVariants`, message: "emailVariants must be an object mapping an email template key to a variant key." });
    } else {
      const validTemplates = ["abm_intro", "application_followup", "contact_followup", "appointment_followup"];
      for (const [tpl, key] of Object.entries(ev as Record<string, unknown>)) {
        if (!validTemplates.includes(tpl)) {
          errors.push({ ruleId, field: `${idx}.plan.emailVariants.${tpl}`, message: `Invalid email template "${tpl}". Allowed: ${validTemplates.join(", ")}` });
        } else if (typeof key !== "string" || key.trim() === "") {
          errors.push({ ruleId, field: `${idx}.plan.emailVariants.${tpl}`, message: "variant key must be a non-empty string." });
        }
      }
    }
  }
}

/** Maximum nesting depth for GroupCondition trees. */
const MAX_CONDITION_DEPTH = 5;

function validateCondition(
  condition: unknown,
  idx:       string,
  ruleId:    string | undefined,
  errors:    ValidationError[],
  depth:     number,
): void {
  if (!condition || typeof condition !== "object") {
    errors.push({ ruleId, field: `${idx}.condition`, message: "condition is required." });
    return;
  }

  const c = condition as Record<string, unknown>;

  if (c.type === "field") {
    validateFieldCondition(c, idx, ruleId, errors);
    return;
  }

  if (c.type === "named") {
    const validNames = Object.keys(NAMED_CONDITIONS) as NamedConditionId[];
    if (!validNames.includes(c.name as NamedConditionId)) {
      errors.push({ ruleId, field: `${idx}.condition.name`, message: `Invalid named condition "${c.name}". Allowed: ${validNames.join(", ")}` });
    }
    return;
  }

  if (c.type === "context") {
    if (typeof c.contextId !== "string" || c.contextId.trim() === "") {
      errors.push({ ruleId, field: `${idx}.condition.contextId`, message: "contextId must be a non-empty string." });
      return;
    }
    if (!(ALL_CONTEXT_IDS as string[]).includes(c.contextId as string)) {
      errors.push({
        ruleId,
        field:   `${idx}.condition.contextId`,
        message: `Unknown contextId "${c.contextId}". Allowed: ${ALL_CONTEXT_IDS.join(", ")}`,
      });
    }
    return;
  }

  if (c.type === "group") {
    if (depth >= MAX_CONDITION_DEPTH) {
      errors.push({ ruleId, field: `${idx}.condition`, message: `Group condition nesting exceeds maximum depth of ${MAX_CONDITION_DEPTH}.` });
      return;
    }
    if (c.logic !== "and" && c.logic !== "or") {
      errors.push({ ruleId, field: `${idx}.condition.logic`, message: `Group logic must be "and" or "or", got "${c.logic}".` });
    }
    if (!Array.isArray(c.conditions)) {
      errors.push({ ruleId, field: `${idx}.condition.conditions`, message: "Group conditions must be an array." });
      return;
    }
    if ((c.conditions as unknown[]).length === 0) {
      errors.push({ ruleId, field: `${idx}.condition.conditions`, message: "Group conditions must contain at least one condition." });
      return;
    }
    const children = c.conditions as unknown[];
    for (let i = 0; i < children.length; i++) {
      validateCondition(children[i], `${idx}[group[${i}]]`, ruleId, errors, depth + 1);
    }
    return;
  }

  if (c.type === "context_library") {
    if (!Array.isArray(c.contextIds) || (c.contextIds as unknown[]).length === 0) {
      errors.push({ ruleId, field: `${idx}.condition.contextIds`, message: 'context_library condition requires a non-empty "contextIds" array.' });
      return;
    }
    for (const id of c.contextIds as unknown[]) {
      if (typeof id !== "string" || (id as string).trim() === "") {
        errors.push({ ruleId, field: `${idx}.condition.contextIds`, message: "All contextIds must be non-empty strings." });
        return;
      }
    }
    if (c.minConfidence !== undefined) {
      const conf = c.minConfidence as unknown;
      if (typeof conf !== "number" || (conf as number) < 0 || (conf as number) > 1) {
        errors.push({ ruleId, field: `${idx}.condition.minConfidence`, message: "minConfidence must be a number between 0 and 1." });
      }
    }
    return;
  }

  errors.push({ ruleId, field: `${idx}.condition.type`, message: `Unknown condition type "${c.type}". Must be "field", "named", "context", "context_library", or "group".` });
}

function validateFieldCondition(
  c:      Record<string, unknown>,
  idx:    string,
  ruleId: string | undefined,
  errors: ValidationError[],
): void {
  // ── Field key ────────────────────────────────────────────────────────────────
  const allKeys = ALL_FIELD_KEYS as string[];
  if (!allKeys.includes(c.field as string)) {
    errors.push({
      ruleId,
      field:   `${idx}.condition.field`,
      message: `Invalid field "${c.field}". Allowed: ${allKeys.join(", ")}`,
    });
    return;
  }

  const field    = c.field as RuleFieldKey;
  const fieldDef = FIELD_REGISTRY[field];

  // ── Operator ─────────────────────────────────────────────────────────────────
  // Backwards compat: missing operator defaults to "equals".
  const operatorRaw = c.operator ?? "equals";

  if (!(FIELD_OPERATORS as readonly string[]).includes(operatorRaw as string)) {
    errors.push({
      ruleId,
      field:   `${idx}.condition.operator`,
      message: `Invalid operator "${operatorRaw}". Allowed: ${FIELD_OPERATORS.join(", ")}`,
    });
    return;
  }

  const operator = operatorRaw as FieldOperator;

  if (!fieldDef.operators.includes(operator)) {
    errors.push({
      ruleId,
      field:   `${idx}.condition.operator`,
      message: `Operator "${operator}" is not valid for field "${field}". Allowed for this field: ${fieldDef.operators.join(", ")}`,
    });
    return;
  }

  // ── Value ─────────────────────────────────────────────────────────────────────

  // Existence operators require no value
  if (NO_VALUE_OPERATORS.has(operator)) {
    if (c.value !== undefined && c.value !== null) {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" must not have a value.` });
    }
    return;
  }

  // All remaining operators require a value
  if (c.value === undefined || c.value === null) {
    errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" requires a value.` });
    return;
  }

  // Array operators: non-empty array of strings or numbers
  if (ARRAY_VALUE_OPERATORS.has(operator)) {
    if (!Array.isArray(c.value) || (c.value as unknown[]).length === 0) {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" requires a non-empty array value.` });
      return;
    }
    const allPrimitive = (c.value as unknown[]).every(
      (v) => typeof v === "string" || typeof v === "number",
    );
    if (!allPrimitive) {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" array elements must be strings or numbers.` });
      return;
    }
    // Categorical fields: each element must be in the allowed set
    if (fieldDef.kind === "categorical" && fieldDef.allowedValues) {
      for (const v of c.value as (string | number)[]) {
        if (!fieldDef.allowedValues.includes(String(v))) {
          errors.push({
            ruleId,
            field:   `${idx}.condition.value`,
            message: `Value "${v}" is not allowed for field "${field}". Allowed: ${fieldDef.allowedValues.join(", ")}`,
          });
        }
      }
    }
    return;
  }

  // Numeric ordering operators: value must be a number
  if (NUMERIC_OPERATORS.has(operator)) {
    if (typeof c.value !== "number") {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" requires a numeric value.` });
    }
    return;
  }

  // String-content operators: value must be a string
  if (STRING_ONLY_OPERATORS.has(operator)) {
    if (typeof c.value !== "string") {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" requires a string value.` });
    }
    return;
  }

  // equals / not_equals: value type must match field kind
  if (fieldDef.kind === "number") {
    if (typeof c.value !== "number") {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Field "${field}" is numeric; value must be a number.` });
    }
    return;
  }

  if (fieldDef.kind === "boolean") {
    if (typeof c.value !== "boolean") {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Field "${field}" is boolean; value must be true or false.` });
    }
    return;
  }

  // categorical / nullable_string: value must be a string
  if (typeof c.value !== "string") {
    errors.push({ ruleId, field: `${idx}.condition.value`, message: `Field "${field}" expects a string value.` });
    return;
  }

  // Categorical: value must be in the allowed set
  if (fieldDef.kind === "categorical" && fieldDef.allowedValues) {
    if (!fieldDef.allowedValues.includes(c.value as string)) {
      errors.push({
        ruleId,
        field:   `${idx}.condition.value`,
        message: `Invalid value "${c.value}" for field "${field}". Allowed: ${fieldDef.allowedValues.join(", ")}`,
      });
    }
  }
}

// ── Runtime condition evaluator ────────────────────────────────────────────────

/**
 * Evaluate a RuleCondition against a live evaluation context.
 *
 * This is the runtime heart of the rules engine.  It walks the condition tree
 * recursively, applying each leaf to the resolved field value and combining
 * groups with the correct AND / OR short-circuit semantics.
 *
 * ─── Resilience contract ──────────────────────────────────────────────────────
 *
 *   Field resolver throws
 *     → the affected leaf returns false; a warning is logged with the field
 *       key.  Sibling OR branches are still evaluated — a broken UTM resolver
 *       does not prevent a source-based OR branch from matching.
 *
 *   Unknown field key (corrupt rule that slipped past validation)
 *     → returns false with a warning; no exception propagates.
 *
 *   Unknown condition type (corrupt serialised tree)
 *     → returns false; the outer catch also logs unexpectedly shaped nodes.
 *
 *   Unexpected error at any level
 *     → outer catch returns false and logs a warning; the caller never sees
 *       an exception from evaluateCondition.
 *
 * ─── Group semantics ──────────────────────────────────────────────────────────
 *
 *   AND  — every() — first false short-circuits; a broken leaf returns false
 *          and therefore short-circuits the AND group as well (safe degrada-
 *          tion: the rule is not matched when a required condition is broken).
 *
 *   OR   — some() — first true short-circuits; a broken leaf returns false,
 *          allowing remaining branches to be tried before giving up.
 *
 *   Empty group → false (vacuously unsatisfiable; should not appear in
 *   validated rules but is handled defensively).
 *
 * @param condition - The condition node to evaluate.
 * @param ctx       - Full evaluation context for this request (DecisionInput
 *                    extended with optional page-level fields).
 * @returns true if the condition is satisfied; false otherwise (including
 *          on any internal error).
 */
export function evaluateCondition(
  condition: RuleCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  try {
    return evalNode(condition, ctx);
  } catch (err) {
    // Unexpected error that was not caught by the inner handlers — log and
    // degrade safely so the caller never sees an exception.
    logger.warn("[decision] Unexpected error evaluating condition", {
      conditionType: (condition as { type?: string }).type,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ── Internal evaluator nodes ───────────────────────────────────────────────────

/**
 * Inner dispatcher — no try/catch so errors propagate to evaluateCondition's
 * outer catch.  evaluateCondition is called recursively for group children so
 * that each child gets independent error containment.
 */
function evalNode(condition: RuleCondition, ctx: RuleEvaluationContext): boolean {
  if (condition.type === "field") {
    return evalFieldCondition(condition, ctx);
  }
  if (condition.type === "named") {
    return evalNamedCondition(condition, ctx);
  }
  if (condition.type === "context") {
    return evalContextCondition(condition, ctx);
  }
  if (condition.type === "context_library") {
    return evalContextLibraryCondition(condition, ctx);
  }
  if (condition.type === "group") {
    return evalGroupCondition(condition, ctx);
  }
  // Unreachable in a well-formed tree — TypeScript exhaustiveness guard.
  return false;
}

function evalFieldCondition(
  condition: FieldCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  const { field, operator = "equals", value } = condition;

  // Defensive lookup — should always succeed for rules that passed validation.
  const def = (FIELD_REGISTRY as Record<string, (typeof FIELD_REGISTRY)[RuleFieldKey] | undefined>)[field];
  if (!def) {
    logger.warn("[decision] Unknown rule field encountered at runtime — returning false", { field });
    return false;
  }

  // Resolve the live field value.  Wrap separately so a resolver bug surfaces
  // with the field name, not just an opaque runtime error.
  let actual: FieldRuntimeValue;
  try {
    actual = def.resolve(ctx);
  } catch (resolveErr) {
    logger.warn("[decision] Field resolver threw — treating field as absent", {
      field,
      operator,
      error: resolveErr instanceof Error ? resolveErr.message : String(resolveErr),
    });
    return false;
  }

  return applyOperator(actual, operator, value);
}

function evalNamedCondition(
  condition: NamedCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  switch (condition.name) {
    case "returning_cta_clicked":
      return ctx.history.fromDatabase === true && ctx.history.hasClickedCta === true;

    case "high_engagement":
      return ctx.history.fromDatabase === true && ctx.history.pageViewCount >= 3;
  }
}

/**
 * Evaluate a ContextCondition by looking up the definition in CONTEXT_REGISTRY
 * and delegating to evaluateCondition() on its underlying condition.
 *
 * Uses a lazy import to avoid a circular dependency:
 *   stored-rule → context-library → stored-rule (for evaluateCondition)
 *
 * The dynamic require is synchronous (Node.js module cache); it introduces no
 * async overhead.  The eslint-disable covers the require() call.
 */
function evalContextCondition(
  condition: ContextCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  // Inline import to break the potential circular reference.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { evaluateContext } = require("./context-library") as typeof import("./context-library");
  return evaluateContext(condition.contextId, ctx);
}

/**
 * Evaluate a ContextLibraryCondition by running matchContextDefinitions() from
 * context/library and checking whether any of the listed definition IDs matched
 * at or above the optional confidence threshold.
 *
 * Uses a lazy require() to break the module cycle:
 *   stored-rule → context/library → (no dependency on stored-rule)
 *
 * The dynamic require is synchronous (Node.js module cache); it introduces no
 * async overhead.
 */
function evalContextLibraryCondition(
  condition: ContextLibraryCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  const { matchContextDefinitions } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/context/library") as typeof import("@/context/library");

  const { contextIds, minConfidence = 0 } = condition;

  if (!contextIds || contextIds.length === 0) return false;

  const matches = matchContextDefinitions(ctx, { statuses: ["active", "suggested"] });

  const matchedIdSet = new Set(
    matches
      .filter((m) => m.confidence >= minConfidence)
      .map((m) => m.definition.id),
  );

  return contextIds.some((id) => matchedIdSet.has(id));
}

function evalGroupCondition(
  condition: GroupCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  const { logic, conditions } = condition;

  // An empty group is vacuously false — should not appear in validated rules.
  if (conditions.length === 0) return false;

  if (logic === "and") {
    // Use evaluateCondition (not evalNode) for each child so every child gets
    // its own error containment.  A broken child returns false, short-circuiting
    // the AND — the rule does not match when a required condition is broken.
    return conditions.every((child) => evaluateCondition(child, ctx));
  }

  // OR: a broken child returns false, allowing remaining branches to be tried.
  return conditions.some((child) => evaluateCondition(child, ctx));
}

// ── Operator application ───────────────────────────────────────────────────────

/**
 * Apply a FieldOperator to a resolved field value and an expected stored value.
 *
 * Returns false (rather than throwing) on type mismatches — this is the last
 * safety net for corrupt rules that somehow slipped past both validation and the
 * field-resolver try/catch in evalFieldCondition.
 *
 * All 12 operators are handled exhaustively; TypeScript will report an error
 * if a new operator is added to FieldOperator without a matching case here.
 */
function applyOperator(
  actual:   unknown,
  operator: FieldOperator,
  expected: FieldConditionValue | undefined,
): boolean {
  switch (operator) {
    case "equals":
      return actual === expected;

    case "not_equals":
      return actual !== expected;

    case "in":
      return Array.isArray(expected) &&
        (expected as (string | number)[]).includes(actual as string | number);

    case "not_in":
      return Array.isArray(expected) &&
        !(expected as (string | number)[]).includes(actual as string | number);

    case "greater_than":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;

    case "greater_than_or_equal":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;

    case "less_than":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;

    case "less_than_or_equal":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;

    case "contains":
      return typeof actual === "string" && typeof expected === "string" && actual.includes(expected);

    case "not_contains":
      return typeof actual === "string" && typeof expected === "string" && !actual.includes(expected);

    case "exists":
      return actual !== null && actual !== undefined;

    case "not_exists":
      return actual === null || actual === undefined;
  }
}

// ── Compiler ───────────────────────────────────────────────────────────────────

/**
 * Compile a StoredRule into a runtime HomepageRule by wrapping its condition
 * descriptor in an evaluateCondition() call.
 *
 * The produced `match` function is a pure closure over the condition literal.
 * All evaluation — including recursive group traversal, field resolution, and
 * operator application — is delegated to evaluateCondition(), which provides
 * its own per-condition error containment.
 *
 * The RulesDecisionProvider adds an outer per-rule try/catch as a belt-and-
 * suspenders safety net (e.g. for hardcoded HomepageRule predicates that bypass
 * this path), but under normal operation evaluateCondition never throws.
 */
export function compileStoredRule(stored: StoredRule): HomepageRule {
  return {
    id:       stored.id,
    priority: stored.priority,
    label:    stored.label,
    match:    buildMatchPredicate(stored.condition),
    plan:     stored.plan,
    reason:   stored.reason,
    // Propagate the enabled flag so the provider can skip disabled rules.
    // Omit when true (or absent) to keep the object shape lean.
    ...(stored.enabled === false ? { enabled: false } : {}),
  };
}

/**
 * Build a `(input: DecisionInput) => boolean` predicate that delegates to
 * evaluateCondition.  The cast to RuleEvaluationContext is safe because all
 * fields added by that type are optional, and every resolve() implementation
 * handles null / undefined gracefully.
 */
function buildMatchPredicate(condition: RuleCondition): (input: DecisionInput) => boolean {
  return (input: DecisionInput): boolean =>
    evaluateCondition(condition, input as RuleEvaluationContext);
}

// ── Seed config ────────────────────────────────────────────────────────────────

/**
 * The initial StoredRulesConfig that mirrors the hard-coded HOMEPAGE_RULES.
 * Used when runtime-rules.json does not yet exist.
 */
export const SEED_RULES_CONFIG: StoredRulesConfig = {
  schemaVersion: 1,
  updatedAt: new Date(0).toISOString(),
  rules: [
    {
      id:              "homepage.returning_cta_clicked",
      priority:        5,
      precedenceLevel: "hard_state",
      packId:          "pack_behaviour",
      label:           "Returning visitor — CTA previously clicked",
      // Migrated: was { type: "named", name: "returning_cta_clicked" }
      condition:       { type: "context", contextId: "ctx_returning_cta_clicked" },
      plan: {
        heroKey:  "hero_direct_brand",
        proofKey: "proof_cases",
        ctaKey:   "cta_meeting",
      },
      reason: "Returning visitor who previously clicked CTA — escalated to meeting intent.",
      source: "system",
    },
    {
      id:              "homepage.high_engagement",
      priority:        7,
      precedenceLevel: "hard_state",
      packId:          "pack_behaviour",
      label:           "High-engagement returning visitor (3+ page views)",
      // Migrated: was { type: "named", name: "high_engagement" }
      condition:       { type: "context", contextId: "ctx_high_engagement" },
      plan: {
        heroKey:  "hero_direct_brand",
        proofKey: "proof_vision",
        ctaKey:   "cta_meeting",
      },
      reason: "Highly engaged returning visitor (3+ page views) — platform-confidence experience.",
      source: "system",
    },
    {
      id:              "homepage.google",
      priority:        10,
      precedenceLevel: "high_intent",
      packId:          "pack_traffic_source",
      label:           "Google traffic",
      // Migrated: was { type: "field", field: "source", operator: "equals", value: "google" }
      condition:       { type: "context", contextId: "ctx_google_traffic" },
      plan: {
        heroKey:  "hero_google_problem",
        proofKey: "proof_cases",
        ctaKey:   "cta_guide",
      },
      reason: "Traffic source indicates search/problem intent.",
      source: "system",
    },
    {
      id:              "homepage.linkedin",
      priority:        20,
      precedenceLevel: "medium_segmentation",
      packId:          "pack_traffic_source",
      label:           "LinkedIn traffic",
      // Migrated: was { type: "field", field: "source", operator: "equals", value: "linkedin" }
      condition:       { type: "context", contextId: "ctx_linkedin_traffic" },
      plan: {
        heroKey:  "hero_linkedin_vision",
        proofKey: "proof_vision",
        ctaKey:   "cta_platform",
      },
      reason: "Traffic source indicates thought-leadership/social intent.",
      source: "system",
    },
  ],
  defaultPlan: {
    heroKey:  "hero_direct_brand",
    proofKey: "proof_platform",
    ctaKey:   "cta_meeting",
    reason:   "Default/direct traffic gets brand-led experience.",
  },
};

// ── Human-readable helpers ─────────────────────────────────────────────────────

/**
 * Format a RuleCondition as a short human-readable string for list views.
 * Uses field labels from FIELD_REGISTRY rather than raw key names.
 * Groups render as parenthesised AND/OR expressions.
 */
export function formatCondition(condition: RuleCondition): string {
  if (condition.type === "field") {
    const fieldLabel = FIELD_REGISTRY[condition.field]?.label ?? condition.field;
    const op = condition.operator ?? "equals";

    if (op === "exists" || op === "not_exists") {
      return `${fieldLabel} ${op}`;
    }
    if (op === "in" || op === "not_in") {
      const list = Array.isArray(condition.value)
        ? (condition.value as (string | number)[]).join(", ")
        : String(condition.value ?? "");
      return `${fieldLabel} ${op} [${list}]`;
    }
    return `${fieldLabel} ${op} ${condition.value}`;
  }

  if (condition.type === "named") {
    return NAMED_CONDITIONS[condition.name].label;
  }

  if (condition.type === "context") {
    // Lazy import to avoid circular dep
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CONTEXT_REGISTRY } = require("./context-library") as typeof import("./context-library");
    const ctx = CONTEXT_REGISTRY[condition.contextId];
    return ctx ? `ctx: ${ctx.label}` : `ctx: ${condition.contextId}`;
  }

  if (condition.type === "group") {
    const sep   = ` ${condition.logic.toUpperCase()} `;
    const parts = condition.conditions.map(formatCondition);
    return parts.length === 1 ? parts[0] : `(${parts.join(sep)})`;
  }

  return "(unknown condition)";
}
