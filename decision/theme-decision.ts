/**
 * Theme Decision Layer
 *
 * Treats theme selection as a first-class decision, unified with the main
 * tenant rules engine (StoredRulesConfig).
 *
 * ─── Unified rules model ──────────────────────────────────────────────────────
 *
 *   Theme decisions are now resolved directly from the tenant's StoredRulesConfig
 *   (the same rules_config table row used for variant slot decisions).
 *
 *   Any StoredRule that has `plan.themeKey` set acts as a contextual theme rule:
 *   when the rule fires, the visitor receives both:
 *     a) the content variants from the plan (heroKey / proofKey / ctaKey)
 *     b) the visual theme from plan.themeKey
 *
 *   This removes the previously isolated ThemeRuleConfig / ThemeRule mini-system
 *   and eliminates the duplicate condition storage problem.
 *
 * ─── Evaluation pipeline ──────────────────────────────────────────────────────
 *
 *   1. Load StoredRulesConfig for the tenant.
 *   2. Filter rules where: `enabled !== false` AND `plan.themeKey` is set.
 *   3. Sort by priority (lower = higher precedence).
 *   4. Evaluate each rule's condition via evaluateCondition().
 *   5. Return the themeKey from the first matching rule's plan.
 *   6. Fall back to the tenant's default theme when no rule matches.
 *
 * ─── Precedence model ────────────────────────────────────────────────────────
 *
 *   Priority 1–9    : campaign / UTM-specific overrides
 *   Priority 10–49  : seasonal events (christmas, halloween, valentines, …)
 *   Priority 50–99  : time-of-day rules (night → dark, morning → fresh)
 *   Priority 100+   : location / device / other context
 *   (none match)    : tenant default theme (design.theme)
 *
 * ─── Session stability ────────────────────────────────────────────────────────
 *
 *   Once a theme is selected for a session, it is locked via the `mc_theme`
 *   httpOnly cookie (short-lived: session duration or 4 hours max).
 *
 *   The lock prevents jarring mid-session switches.  Theme rules are only
 *   re-evaluated when:
 *   a) No `mc_theme` cookie exists (new session or expired).
 *   b) The visitor navigates with a new UTM campaign parameter (campaign override).
 *   c) The tenant admin explicitly clears / updates rules.
 *
 * ─── Debug trace ──────────────────────────────────────────────────────────────
 *
 *   resolveThemeDecision() returns a ThemeDecisionTrace:
 *     tenantDefault    — the fallback theme from design.theme
 *     matchedRuleId    — id of the first matching rule, or null
 *     matchedRuleLabel — human-readable label of the matched rule, or null
 *     resolvedTheme    — final theme key (matched or default)
 *     sessionLocked    — whether the cookie lock was applied
 *     lockSource       — "new" | "existing" | "campaign-override" | "none"
 *
 * ─── Deprecated: ThemeRuleConfig / ThemeRule ─────────────────────────────────
 *
 *   The standalone ThemeRuleConfig / ThemeRule types and SEED_THEME_RULES_CONFIG
 *   are kept for backward compatibility with data already stored in
 *   tenant.design.themeRules.  New code should use StoredRulesConfig directly.
 *   The `resolveThemeDecisionLegacy()` function handles the deprecated path.
 */

import type { ThemePresetKey } from "@/design-system/theme/presets";
import type { ThemeFamilyKey }  from "@/design-system/theme/theme-family";
import type { RuleCondition, ContextLibraryCondition, GroupCondition } from "./rules/stored-rule";
import type { StoredRule, StoredRulesConfig } from "./rules/stored-rule";
import type { RuleEvaluationContext } from "./rules/field-registry";
import { evaluateCondition }    from "./rules/stored-rule";
import { isThemePresetKey }     from "@/design-system/theme/presets";
import { logger }               from "@/lib/logger";

// ── Built-in theme condition templates ───────────────────────────────────────
//
// Canonical condition descriptors for the most common contextual theme triggers.
// These live here (not in the client component) so the runtime resolver can
// look them up by ID without importing UI-only code.
//
// Key format: the bare template ID (e.g. "christmas").
// In ThemeRule.sourceRuleId, built-in templates are prefixed: "template:christmas".

export const BUILTIN_THEME_CONDITION_MAP: Readonly<Record<string, RuleCondition>> = {
  "christmas":    { type: "field", field: "seasonalEvent", operator: "equals", value: "christmas" },
  "valentines":   { type: "field", field: "seasonalEvent", operator: "equals", value: "valentines" },
  "halloween":    { type: "field", field: "seasonalEvent", operator: "equals", value: "halloween" },
  "new-year":     { type: "field", field: "seasonalEvent", operator: "equals", value: "new-year" },
  "black-friday": { type: "field", field: "seasonalEvent", operator: "in",     value: ["black-friday", "cyber-monday"] },
  "night":        { type: "field", field: "timeOfDay",    operator: "equals", value: "night" },
  "evening":      { type: "field", field: "timeOfDay",    operator: "equals", value: "evening" },
  "morning":      { type: "field", field: "timeOfDay",    operator: "equals", value: "morning" },
  "any-campaign": { type: "field", field: "utmCampaign",  operator: "exists" },
  "mobile":       { type: "field", field: "device",       operator: "equals", value: "mobile" },
} as const;

/** Priority defaults for built-in theme condition templates. */
export const BUILTIN_THEME_PRIORITY_MAP: Readonly<Record<string, number>> = {
  "any-campaign": 5,
  "christmas":    15,
  "valentines":   20,
  "halloween":    25,
  "new-year":     18,
  "black-friday": 12,
  "night":        55,
  "evening":      60,
  "morning":      65,
  "mobile":       100,
} as const;

// ── Precedence bands ──────────────────────────────────────────────────────────
//
// Recommended priority slots for theme override rules.  Operators configure
// priority manually; these bands serve as editorial guidance shown in the admin
// UI and this comment.
//
// Band 1  (1–9)    — Campaign / UTM overrides.  Highest priority; bypass session lock.
//                    Rule fires only once per landing (UTM-keyed).
// Band 2  (10–29)  — Hard lifecycle states: customer, churned, active trial.
//                    "Lifecycle" family from Context Library.  Prevents weaker
//                    context rules (temporal, acquisition) from overriding a
//                    customer's steady-state theme experience.
// Band 3  (30–49)  — Seasonal events: christmas, halloween, valentines, black-friday.
//                    Contextual but deterministic (calendar-driven).
// Band 4  (50–79)  — Intent / account context: high-intent SaaS evaluator,
//                    target account, CRM lead state.  Intent + Account families.
// Band 5  (80–99)  — Acquisition / journey context: traffic source, funnel stage.
//                    Acquisition + Behavior families.
// Band 6  (100+)   — Soft temporal / situational: time-of-day, device, geo.
//                    Temporal + Geo families.  Lowest priority; used as ambient
//                    fallback when no stronger context fires.

export interface ThemePrecedenceBand {
  label:      string;
  range:      [number, number];
  description: string;
  /** Context Library families that map into this band. */
  contextFamilies?: string[];
}

export const THEME_PRECEDENCE_BANDS: readonly ThemePrecedenceBand[] = [
  {
    label:           "Campaign override",
    range:           [1, 9],
    description:     "UTM / campaign-specific themes. Highest priority, bypasses session lock.",
    contextFamilies: [],
  },
  {
    label:           "Lifecycle state",
    range:           [10, 29],
    description:     "Hard visitor states: customer, active trial, churned. Prevents ambient rules from overriding steady-state experience.",
    contextFamilies: ["lifecycle", "confidence"],
  },
  {
    label:           "Seasonal event",
    range:           [30, 49],
    description:     "Calendar-driven themes: Christmas, Halloween, Black Friday. Deterministic and time-bounded.",
    contextFamilies: ["temporal"],
  },
  {
    label:           "Intent / account",
    range:           [50, 79],
    description:     "High-intent or account-matched visitors. Account and intent signals from enrichment or scoring.",
    contextFamilies: ["intent", "account"],
  },
  {
    label:           "Acquisition / journey",
    range:           [80, 99],
    description:     "Traffic source and journey-stage themes. Lower priority than lifecycle and intent.",
    contextFamilies: ["acquisition", "behavior", "content", "careers", "commerce", "realestate"],
  },
  {
    label:           "Ambient / situational",
    range:           [100, Infinity],
    description:     "Soft contextual themes: time-of-day, device type, geography. Lowest priority fallback.",
    contextFamilies: ["geo"],
  },
] as const;

// ── Theme rule types ──────────────────────────────────────────────────────────

/**
 * @deprecated Use StoredRule with plan.themeKey instead.
 *
 * A single theme selection rule — part of the now-deprecated ThemeRuleConfig
 * mini-system.  New rules should be created as StoredRules with plan.themeKey.
 *
 * Unlike variant rules (which output heroKey/proofKey/ctaKey), a ThemeRule
 * outputs a single themeKey or familyKey.
 *
 * ─── Condition resolution ─────────────────────────────────────────────────────
 *
 *   The condition for a ThemeRule is resolved at runtime — it is NOT stored
 *   inline.  This prevents condition duplication and ensures the theme rule
 *   always reflects the latest version of the referenced rule.
 *
 *   `sourceRuleId` is the canonical reference:
 *     "template:<id>"  — resolves via BUILTIN_THEME_CONDITION_MAP[id]
 *     "<storedRuleId>" — resolves by matching StoredRule.id in the tenant's
 *                        decision rule config (passed to resolveThemeDecision)
 *
 *   `condition` is kept for backward compatibility with ThemeRules that were
 *   stored before this architecture change.  The resolver uses it as a fallback
 *   when neither `sourceRuleId` resolves nor a valid condition is found.
 */
export interface ThemeRule {
  /** Stable identifier for this rule. */
  id: string;

  /** Evaluation precedence (lower = higher priority). */
  priority: number;

  /** Human-readable label shown in admin and debug panel. */
  label: string;

  /** Whether this rule is active. */
  enabled: boolean;

  /**
   * Reference to the condition source.
   *
   * Format:
   *   "template:<id>"   — one of BUILTIN_THEME_CONDITION_MAP keys, e.g. "template:christmas"
   *   "<storedRuleId>"  — a StoredRule.id from the tenant's decision rule config
   *
   * When set, the condition tree is resolved at evaluation time from the
   * referenced source — it is never duplicated inside the ThemeRule itself.
   */
  sourceRuleId?: string;

  /**
   * @deprecated Use `sourceRuleId` instead.
   *
   * Inline condition descriptor.  Kept for backward compatibility with rules
   * stored before the `sourceRuleId` architecture was introduced.
   * The resolver uses this only when `sourceRuleId` is absent or cannot be
   * resolved.
   */
  condition?: RuleCondition;

  /**
   * The theme preset to apply when this rule fires.
   * Provide exactly one of `themeKey` or `familyKey`.
   */
  themeKey?: ThemePresetKey;

  /**
   * The theme family whose canonical preset to apply when this rule fires.
   * Useful for "when Christmas → pick from warm/festive family" without
   * committing to a specific preset.
   */
  familyKey?: ThemeFamilyKey;

  /**
   * Optional human-readable explanation shown in admin and debug panel.
   * Describes why this rule exists (e.g. "Dutch national team game day").
   */
  reason?: string;
}

/**
 * @deprecated Use StoredRulesConfig with plan.themeKey on individual rules instead.
 *
 * The full theme rules configuration for a tenant.
 * Kept for backward compatibility with data stored in tenant.design.themeRules.
 */
export interface ThemeRuleConfig {
  /** Whether theme rules are evaluated at all for this tenant. */
  rulesEnabled: boolean;

  /** Ordered list of theme rules.  Will be sorted by priority before evaluation. */
  rules: ThemeRule[];
}

// ── Debug trace ────────────────────────────────────────────────────────────────

/**
 * How a contextual theme override was triggered.
 *
 * "raw_condition"          — Condition is a FieldCondition, NamedCondition,
 *                            ContextCondition (CONTEXT_REGISTRY), or GroupCondition
 *                            composed of those types.
 * "context_match"          — Condition is a ContextLibraryCondition referencing
 *                            one or more audience-profile IDs from context/library/.
 * "context_plus_condition" — A GroupCondition with logic:"and" wrapping a
 *                            ContextLibraryCondition AND one or more raw conditions.
 *                            Both parts must evaluate true.
 * "session_lock"           — mc_theme cookie was present; rules were not re-evaluated.
 * "default"                — No rule matched; tenant default theme was used.
 */
export type ThemeTriggerMode =
  | "raw_condition"
  | "context_match"
  | "context_plus_condition"
  | "session_lock"
  | "default";

/**
 * A single candidate rule that was evaluated during theme resolution.
 * Included in ThemeDecisionTrace.candidates for debug / explain UI.
 */
export interface ThemeRuleCandidate {
  /** StoredRule.id */
  ruleId:       string;
  /** Human-readable label from the rule. */
  label:        string;
  /** Evaluation precedence (lower = higher priority). */
  priority:     number;
  /** The theme that would be applied if this rule fires. */
  themeKey:     ThemePresetKey;
  /** Condition type / trigger mode for this rule. */
  triggerMode:  Exclude<ThemeTriggerMode, "session_lock" | "default">;
  /** Whether this rule was evaluated (false only if skipped due to error). */
  evaluated:    boolean;
  /** Whether the rule's condition matched. */
  matched:      boolean;
  /**
   * Context Library IDs that were checked by this rule's condition.
   * Only populated when triggerMode is "context_match" or "context_plus_condition".
   */
  matchedContextLibraryIds?: string[];
}

/**
 * Diagnostic output from resolveThemeDecision().
 *
 * Surfaced in the admin debug panel and in the decision trace analytics event.
 */
export interface ThemeDecisionTrace {
  /** The tenant's configured fallback theme (from design.theme). */
  tenantDefault:    ThemePresetKey;
  /** The rule that matched, or null when using the default. */
  matchedRuleId:    string | null;
  /** The matched rule's human-readable label, or null. */
  matchedRuleLabel: string | null;
  /** The theme that was ultimately resolved. */
  resolvedTheme:    ThemePresetKey;
  /**
   * Whether the resolved theme came from an existing session lock cookie
   * rather than fresh rule evaluation.
   */
  sessionLocked:    boolean;
  /**
   * How the session lock state was determined.
   *
   * "new"               — no prior lock; theme was freshly evaluated
   * "existing"          — prior lock respected; rules not re-evaluated
   * "campaign-override" — prior lock bypassed due to new UTM campaign
   * "none"              — session stability not applicable (server-only context)
   */
  lockSource:       "new" | "existing" | "campaign-override" | "none";
  /** Priority of the matched rule, or null when using the default. */
  matchedPriority:  number | null;
  /**
   * How the winning theme was triggered.
   * "default" when no rule matched; "session_lock" when cookie was respected.
   */
  triggerMode:      ThemeTriggerMode;
  /**
   * Context Library audience-profile IDs that were matched by the winning rule.
   * Empty array when triggerMode is not "context_match" or "context_plus_condition".
   */
  matchedContextLibraryIds: string[];
  /**
   * All theme-eligible rules that were evaluated, in priority order.
   * Includes both matched and unmatched rules.
   * Empty when sessionLocked is true (rules were not evaluated).
   */
  candidates: ThemeRuleCandidate[];
}

// ── Condition introspection ───────────────────────────────────────────────────

/**
 * Classify a rule condition into its ThemeTriggerMode and extract the Context
 * Library IDs it references (if any).
 *
 * Classification rules:
 *   1. Top-level ContextLibraryCondition           → "context_match"
 *   2. GroupCondition(AND) containing BOTH a
 *      ContextLibraryCondition AND at least one
 *      raw condition                               → "context_plus_condition"
 *   3. Anything else                               → "raw_condition"
 */
function classifyCondition(condition: RuleCondition): {
  triggerMode: Exclude<ThemeTriggerMode, "session_lock" | "default">;
  contextLibraryIds: string[];
} {
  // Direct context_library condition
  if (condition.type === "context_library") {
    return {
      triggerMode:       "context_match",
      contextLibraryIds: [...(condition as ContextLibraryCondition).contextIds],
    };
  }

  // GroupCondition: inspect children
  if (condition.type === "group") {
    const group = condition as GroupCondition;
    const children = group.conditions ?? [];

    const libConditions = children.filter(
      (c): c is ContextLibraryCondition => c.type === "context_library",
    );
    const rawConditions = children.filter((c) => c.type !== "context_library");

    if (libConditions.length > 0 && rawConditions.length > 0 && group.logic === "and") {
      return {
        triggerMode:       "context_plus_condition",
        contextLibraryIds: libConditions.flatMap((c) => [...c.contextIds]),
      };
    }

    if (libConditions.length > 0 && rawConditions.length === 0) {
      return {
        triggerMode:       "context_match",
        contextLibraryIds: libConditions.flatMap((c) => [...c.contextIds]),
      };
    }
  }

  return { triggerMode: "raw_condition", contextLibraryIds: [] };
}

// ── Evaluation ────────────────────────────────────────────────────────────────

/**
 * Resolve the condition for a ThemeRule, using `sourceRuleId` to look up the
 * condition from the canonical sources — never duplicating it in the ThemeRule.
 *
 * Resolution order:
 *   1. "template:<id>"  → BUILTIN_THEME_CONDITION_MAP[id]
 *   2. "<storedRuleId>" → tenantRules.find(r => r.id === sourceRuleId)?.condition
 *   3. Fallback         → rule.condition (backward-compat inline condition)
 *
 * Returns undefined when no condition can be resolved (rule is unconfigured).
 */
function resolveThemeRuleCondition(
  rule:        ThemeRule,
  tenantRules: readonly StoredRule[],
): RuleCondition | undefined {
  const src = rule.sourceRuleId;

  if (src) {
    if (src.startsWith("template:")) {
      const templateId = src.slice("template:".length);
      const cond = BUILTIN_THEME_CONDITION_MAP[templateId];
      if (cond) return cond;
      logger.warn("[theme-decision] Unknown built-in template id — rule skipped", {
        ruleId:     rule.id,
        templateId,
      });
      return undefined;
    }

    // Bare StoredRule.id reference
    const storedRule = tenantRules.find((r) => r.id === src);
    if (storedRule) return storedRule.condition;

    logger.warn("[theme-decision] sourceRuleId not found in tenant rules — rule skipped", {
      ruleId:       rule.id,
      sourceRuleId: src,
    });
    return undefined;
  }

  // Backward compat: inline condition (pre-sourceRuleId ThemeRules)
  return rule.condition;
}

/**
 * Evaluate theme rules against the visitor context using the unified
 * StoredRulesConfig engine.
 *
 * Any StoredRule with `plan.themeKey` set participates in theme evaluation.
 * Rules are evaluated in priority order; the first matching rule whose plan
 * has a themeKey wins.
 *
 * Returns:
 *   - the resolved ThemePresetKey (matched rule or tenant default)
 *   - a ThemeDecisionTrace for debug / analytics
 *
 * Never throws — returns tenantDefault on any error.
 *
 * @param config        The tenant's StoredRulesConfig from rules_config table.
 *                      Pass null / undefined to use tenantDefault.
 * @param ctx           Visitor evaluation context.
 * @param tenantDefault The tenant's default theme (design.theme fallback).
 * @param sessionTheme  Currently locked theme from mc_theme cookie, or null.
 * @param utmCampaign   Current UTM campaign parameter, or null.
 *                      @deprecated Read from ctx.utmCampaign; kept for backward compat.
 */
export function resolveThemeDecision(
  config:        StoredRulesConfig | null | undefined,
  ctx:           RuleEvaluationContext,
  tenantDefault: ThemePresetKey,
  sessionTheme?: ThemePresetKey | null,
  utmCampaign?:  string | null,
): ThemeDecisionTrace {
  // ── Session lock check ──────────────────────────────────────────────────────
  //
  // If the visitor already has a locked theme from a prior page view in this
  // session, respect it — UNLESS the current request carries a UTM parameter
  // that a high-priority override rule (priority 1–9) targets.
  //
  // "UTM override" logic:
  //   Any rule with priority < 10 and plan.themeKey that references ANY of the
  //   five UTM fields (source, medium, campaign, content, term) is treated as
  //   a campaign override rule.  When such a rule exists AND its target UTM
  //   field is present on this request, the session lock is bypassed so the
  //   rule can fire and apply the correct theme for this landing.
  //
  //   This covers both `utm_campaign`-keyed rules AND `utm_source`-keyed rules
  //   (e.g. "Google traffic" rules that check utm_source=google).

  if (sessionTheme && isThemePresetKey(sessionTheme)) {
    // Collect the UTM fields that are non-null on this request.
    const activeUtmFields = new Set<string>();
    if (ctx.utmSource   ?? utmCampaign) {
      if (ctx.utmSource)   activeUtmFields.add("utmSource");
      if (ctx.utmMedium)   activeUtmFields.add("utmMedium");
      if (ctx.utmCampaign ?? utmCampaign) activeUtmFields.add("utmCampaign");
      if (ctx.utmContent)  activeUtmFields.add("utmContent");
      if (ctx.utmTerm)     activeUtmFields.add("utmTerm");
    }

    // Check if any campaign-priority rule targets one of the present UTM fields.
    const hasUtmOverrideRule =
      activeUtmFields.size > 0 &&
      config?.rules.some((r) => {
        if (r.enabled === false || r.priority >= 10 || !r.plan.themeKey) return false;
        const condStr = JSON.stringify(r.condition);
        return (
          (activeUtmFields.has("utmSource")   && condStr.includes("utmSource"))   ||
          (activeUtmFields.has("utmMedium")   && condStr.includes("utmMedium"))   ||
          (activeUtmFields.has("utmCampaign") && condStr.includes("utmCampaign")) ||
          (activeUtmFields.has("utmContent")  && condStr.includes("utmContent"))  ||
          (activeUtmFields.has("utmTerm")     && condStr.includes("utmTerm"))
        );
      });

    if (!hasUtmOverrideRule) {
      return {
        tenantDefault,
        matchedRuleId:             null,
        matchedRuleLabel:          null,
        resolvedTheme:             sessionTheme,
        sessionLocked:             true,
        lockSource:                "existing",
        matchedPriority:           null,
        triggerMode:               "session_lock",
        matchedContextLibraryIds:  [],
        candidates:                [],
      };
    }
  }

  // ── No config / rules disabled ──────────────────────────────────────────────
  if (!config || config.rulesEnabled === false || config.rules.length === 0) {
    return {
      tenantDefault,
      matchedRuleId:             null,
      matchedRuleLabel:          null,
      resolvedTheme:             tenantDefault,
      sessionLocked:             false,
      lockSource:                sessionTheme ? "campaign-override" : "new",
      matchedPriority:           null,
      triggerMode:               "default",
      matchedContextLibraryIds:  [],
      candidates:                [],
    };
  }

  // ── Filter to rules that carry a theme outcome ──────────────────────────────
  const themeRules = config.rules
    .filter((r) => r.enabled !== false && r.plan.themeKey && isThemePresetKey(r.plan.themeKey))
    .sort((a, b) => a.priority - b.priority);

  if (themeRules.length === 0) {
    return {
      tenantDefault,
      matchedRuleId:             null,
      matchedRuleLabel:          null,
      resolvedTheme:             tenantDefault,
      sessionLocked:             false,
      lockSource:                sessionTheme ? "campaign-override" : "new",
      matchedPriority:           null,
      triggerMode:               "default",
      matchedContextLibraryIds:  [],
      candidates:                [],
    };
  }

  // ── Rule evaluation ─────────────────────────────────────────────────────────
  const candidates: ThemeRuleCandidate[] = [];

  for (const rule of themeRules) {
    const { triggerMode: ruleTriggerMode, contextLibraryIds } = classifyCondition(rule.condition);
    let matched    = false;
    let evaluated  = false;

    try {
      matched   = evaluateCondition(rule.condition, ctx);
      evaluated = true;
    } catch (err) {
      logger.warn("[theme-decision] Rule condition threw — skipping", {
        ruleId: rule.id,
        error:  err instanceof Error ? err.message : String(err),
      });
    }

    // Track for the candidates list regardless of outcome
    candidates.push({
      ruleId:                   rule.id,
      label:                    rule.label,
      priority:                 rule.priority,
      themeKey:                 rule.plan.themeKey as ThemePresetKey,
      triggerMode:              ruleTriggerMode,
      evaluated,
      matched,
      ...(contextLibraryIds.length > 0
        ? { matchedContextLibraryIds: contextLibraryIds }
        : {}),
    });

    if (!evaluated || !matched) continue;

    const resolvedTheme = rule.plan.themeKey as ThemePresetKey;

    logger.debug(`[theme-decision] Rule matched (priority ${rule.priority})`, {
      ruleId:        rule.id,
      ruleLabel:     rule.label,
      resolvedTheme,
      triggerMode:   ruleTriggerMode,
    });

    return {
      tenantDefault,
      matchedRuleId:             rule.id,
      matchedRuleLabel:          rule.label,
      resolvedTheme,
      sessionLocked:             false,
      lockSource:                sessionTheme ? "campaign-override" : "new",
      matchedPriority:           rule.priority,
      triggerMode:               ruleTriggerMode,
      matchedContextLibraryIds:  contextLibraryIds,
      candidates,
    };
  }

  // ── Default fallback ────────────────────────────────────────────────────────
  logger.debug("[theme-decision] No rule matched — using tenant default theme", {
    tenantDefault,
  });

  return {
    tenantDefault,
    matchedRuleId:             null,
    matchedRuleLabel:          null,
    resolvedTheme:             tenantDefault,
    sessionLocked:             false,
    lockSource:                sessionTheme ? "campaign-override" : "new",
    matchedPriority:           null,
    triggerMode:               "default",
    matchedContextLibraryIds:  [],
    candidates,
  };
}

// ── Legacy: ThemeRuleConfig evaluation ────────────────────────────────────────
//
// The original ThemeRuleConfig / ThemeRule mini-system is preserved here for
// backward compatibility with data stored in tenant.design.themeRules.
// Production callers should use resolveThemeDecision() with StoredRulesConfig.

/**
 * @deprecated Use resolveThemeDecision() with StoredRulesConfig instead.
 *
 * Evaluates the legacy ThemeRuleConfig mini-system.  Only called when the
 * tenant still has data stored under tenant.design.themeRules.
 */
export function resolveThemeDecisionLegacy(
  config:        ThemeRuleConfig | null | undefined,
  tenantRules:   readonly StoredRule[],
  ctx:           RuleEvaluationContext,
  tenantDefault: ThemePresetKey,
  sessionTheme?: ThemePresetKey | null,
  utmCampaign?:  string | null,
): ThemeDecisionTrace {
  if (sessionTheme && isThemePresetKey(sessionTheme)) {
    const hasCampaignRule =
      utmCampaign &&
      config?.rules.some((r) => {
        if (!r.enabled || r.priority >= 10) return false;
        const src = r.sourceRuleId ?? "";
        if (src === "template:any-campaign") return true;
        if (r.condition) return JSON.stringify(r.condition).includes(utmCampaign);
        return false;
      });
    if (!hasCampaignRule) {
      return {
        tenantDefault, matchedRuleId: null, matchedRuleLabel: null,
        resolvedTheme: sessionTheme, sessionLocked: true, lockSource: "existing",
        matchedPriority: null, triggerMode: "session_lock",
        matchedContextLibraryIds: [], candidates: [],
      };
    }
  }

  if (!config || !config.rulesEnabled || config.rules.length === 0) {
    return {
      tenantDefault, matchedRuleId: null, matchedRuleLabel: null,
      resolvedTheme: tenantDefault, sessionLocked: false,
      lockSource: sessionTheme ? "campaign-override" : "new",
      matchedPriority: null, triggerMode: "default",
      matchedContextLibraryIds: [], candidates: [],
    };
  }

  const sorted = [...config.rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const condition = resolveThemeRuleCondition(rule, tenantRules);
    if (!condition) continue;

    let matched = false;
    try { matched = evaluateCondition(condition, ctx); } catch { continue; }
    if (!matched) continue;

    let resolvedTheme: ThemePresetKey | undefined;
    if (rule.themeKey && isThemePresetKey(rule.themeKey)) {
      resolvedTheme = rule.themeKey;
    } else if (rule.familyKey) {
      try {
        const { getCanonicalPreset } =
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("@/design-system/theme/theme-family") as typeof import("@/design-system/theme/theme-family");
        resolvedTheme = getCanonicalPreset(rule.familyKey);
      } catch { continue; }
    }
    if (!resolvedTheme) continue;

    return {
      tenantDefault, matchedRuleId: rule.id, matchedRuleLabel: rule.label,
      resolvedTheme, sessionLocked: false,
      lockSource: sessionTheme ? "campaign-override" : "new",
      matchedPriority: rule.priority, triggerMode: "raw_condition",
      matchedContextLibraryIds: [], candidates: [],
    };
  }

  return {
    tenantDefault, matchedRuleId: null, matchedRuleLabel: null,
    resolvedTheme: tenantDefault, sessionLocked: false,
    lockSource: sessionTheme ? "campaign-override" : "new",
    matchedPriority: null, triggerMode: "default",
    matchedContextLibraryIds: [], candidates: [],
  };
}

// ── Seed configuration ────────────────────────────────────────────────────────

/**
 * @deprecated Use SEED_RULES_CONFIG from stored-rule.ts and set plan.themeKey
 * on individual StoredRules instead.
 *
 * A minimal seed ThemeRuleConfig with illustrative rules for new tenants.
 * Rules are all disabled by default — operators enable them explicitly.
 *
 * Precedence bands shown:
 *   priority 5  — campaign override (highest, bypasses session lock)
 *   priority 15 — Christmas seasonal
 *   priority 20 — Valentine's Day seasonal
 *   priority 25 — Halloween seasonal
 *   priority 55 — Night time (time-of-day)
 */
export const SEED_THEME_RULES_CONFIG: ThemeRuleConfig = {
  rulesEnabled: false,
  rules: [
    {
      id:           "theme.campaign_override",
      priority:     5,
      label:        "Campaign theme override",
      enabled:      false,
      sourceRuleId: "template:any-campaign",
      themeKey:     "startup-energy",
      reason:       "Apply a specific theme when a campaign UTM is present.",
    },
    {
      id:           "theme.christmas",
      priority:     15,
      label:        "Christmas season",
      enabled:      false,
      sourceRuleId: "template:christmas",
      themeKey:     "warm-professional",
      reason:       "Warm seasonal theme during the Christmas period.",
    },
    {
      id:           "theme.valentines",
      priority:     20,
      label:        "Valentine's Day",
      enabled:      false,
      sourceRuleId: "template:valentines",
      themeKey:     "valentine-pink",
      reason:       "Romantic pink theme for Valentine's Day.",
    },
    {
      id:           "theme.halloween",
      priority:     25,
      label:        "Halloween",
      enabled:      false,
      sourceRuleId: "template:halloween",
      themeKey:     "dark-contrast",
      reason:       "Dark, high-contrast theme for Halloween.",
    },
    {
      id:           "theme.night",
      priority:     55,
      label:        "Night time (22:00–05:59)",
      enabled:      false,
      sourceRuleId: "template:night",
      themeKey:     "dark-contrast",
      reason:       "Dark theme for evening/night visitors.",
    },
  ],
};
