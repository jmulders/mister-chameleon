/**
 * Rule Recipe Catalogue
 *
 * The data layer behind the template-first "Add rule" flow. A *recipe* is a
 * goal-oriented, plain-language starting point that a non-technical team member
 * can pick without ever building a condition by hand.
 *
 * ─── Valid-by-construction ────────────────────────────────────────────────────
 *
 *   Every recipe's condition and default plan come from the same preset
 *   catalogue that seeds new tenants (PRESET_CONDITIONS + PRESET_PLANS, the
 *   source used by seedPresetRulesAction). Because the leaves reference only
 *   FIELD_REGISTRY keys with registry-valid values, a rule built from a recipe
 *   always passes validateStoredConfig. The handful of bespoke recipes (entry /
 *   time) are hand-written against the same registry fields and reuse a preset
 *   plan as their default so the outcome stays a valid variant triple.
 *
 * ─── What a recipe intentionally hides ────────────────────────────────────────
 *
 *   The condition. The fill-in step only asks for the *outcome* (which variant
 *   plan, scoped to the tenant's catalogue). The condition rides along inside
 *   the recipe and can still be fine-tuned later via "Edit as advanced".
 *
 * ─── No role recipes in v1 ────────────────────────────────────────────────────
 *
 *   There is no first-class "role" signal (marketeer / bureau / technisch) in
 *   FIELD_REGISTRY, so role recipes are deliberately omitted rather than faked.
 *   The `proxyNote` field exists for any recipe whose plain-language title is a
 *   proxy for a concept it cannot detect exactly — surfaced in the UI so we
 *   never imply detection we don't have.
 *
 * ─── Pure module ──────────────────────────────────────────────────────────────
 *
 *   Imports only types and pure preset data — safe to import from client
 *   components (the gallery + fill-in step render in the browser). Do NOT add
 *   server-only imports here. Variant scoping takes an already-fetched
 *   VariantCatalogue as an argument; the fetch itself (fetchVariantCatalogue)
 *   stays on the server.
 */

import { PRESET_CONDITIONS }                    from "./preset-conditions";
import type { PresetConditionDef }              from "./preset-conditions";
import { PRESET_PLANS, presetPlanToStoredPlan } from "./preset-plans";
import type { RuleCondition, StoredPlan }       from "./stored-rule";
import type { PrecedenceLevel }                 from "./rule-packs";
import type { VariantCatalogue, VariantEntry }  from "./variant-catalogue";

// ── Groups ─────────────────────────────────────────────────────────────────────

/** Goal-oriented grouping shown as sections in the recipe gallery. */
export type RecipeGroup =
  | "funnel"     // where the visitor is in the journey
  | "channel"    // how the visitor arrived
  | "interest"   // what the visitor has been reading (behavioural scoring)
  | "behaviour"  // what the visitor has done (form, friction, conversion)
  | "entry"      // targeted-arrival flags written by an earlier rule
  | "time";      // day / part-of-day

/** Human-readable metadata for each group (section header + one-line intro). */
export const RECIPE_GROUPS: Readonly<Record<RecipeGroup, { label: string; blurb: string }>> = {
  funnel:    { label: "Funnel stage",   blurb: "Where the visitor is in their journey." },
  channel:   { label: "Traffic source", blurb: "How the visitor arrived on the site." },
  interest:  { label: "Interest",       blurb: "What the visitor has been reading this session." },
  behaviour: { label: "Behaviour",      blurb: "What the visitor has done, across forms, friction, and conversion." },
  entry:     { label: "Targeted entry", blurb: "Visitors flagged as arriving with clear intent." },
  time:      { label: "Time",           blurb: "Day of the week or part of the day." },
} as const;

// ── Types ───────────────────────────────────────────────────────────────────────

/**
 * A fully-resolved recipe: everything the gallery + fill-in step need, with a
 * ready-to-use condition and a valid default plan.
 */
export interface RuleRecipe {
  /** Stable recipe key — also used to prefix generated rule IDs. */
  key:         string;
  /** Plain-language, goal-oriented title (English — admin UI is English). */
  title:       string;
  /** One-sentence description of who this targets and why. */
  description: string;
  /** Emoji for quick visual scanning in the gallery. */
  icon:        string;
  /** Gallery section. */
  group:       RecipeGroup;
  /** Precedence tier — drives the unique-priority allocation on save. */
  tier:        PrecedenceLevel;
  /** Rule pack for organisational grouping (RULE_PACK_REGISTRY key). */
  packId:      string;
  /** Reason string stored on the rule for debug/analytics output. */
  reason:      string;
  /** The valid-by-construction condition. Hidden from the fill-in step. */
  condition:   RuleCondition;
  /** Canonical default outcome — scoped to the tenant catalogue before use. */
  defaultPlan: StoredPlan;
  /** Preset key this recipe derives from, when applicable. */
  presetKey?:  string;
  /**
   * Honesty note shown in the UI when the title is a proxy for a concept the
   * platform cannot detect exactly. Absent for exact-signal recipes.
   */
  proxyNote?:  string;
}

// ── Condition builder ─────────────────────────────────────────────────────────

/**
 * Convert a preset's leaves into a RuleCondition. Single-leaf presets emit the
 * FieldCondition directly (no wrapping group); multi-leaf presets emit a group
 * with the preset's AND/OR logic. Mirrors generate-preset-rules so recipe rules
 * are byte-identical in shape to seeded rules.
 */
function buildPresetCondition(
  leaves: PresetConditionDef["leaves"],
  logic:  "and" | "or",
): RuleCondition {
  if (leaves.length === 1) return leaves[0];
  return { type: "group", logic, conditions: leaves };
}

// ── Recipe definitions ──────────────────────────────────────────────────────────

/**
 * Source metadata for each recipe. A recipe either:
 *   • derives its condition + default plan from a preset (`presetKey`), or
 *   • is bespoke — an inline condition plus a `planFromPreset` whose plan is the
 *     starting outcome (kept as a valid preset plan so the triple is always
 *     valid; the operator picks the real variant at fill-in time).
 */
interface RecipeDef {
  key:         string;
  title:       string;
  description: string;
  icon:        string;
  group:       RecipeGroup;
  tier:        PrecedenceLevel;
  packId:      string;
  reason:      string;
  /** Derive condition + default plan from this preset. */
  presetKey?:      string;
  /** Bespoke condition (used when there is no presetKey). */
  condition?:      RuleCondition;
  /** Bespoke default plan: reuse this preset's plan as the starting outcome. */
  planFromPreset?: string;
  proxyNote?:      string;
}

const RECIPE_DEFS: readonly RecipeDef[] = [
  // ── Funnel stage ────────────────────────────────────────────────────────────
  {
    key: "new_visitor", presetKey: "new_visitor",
    title: "Welcome a first-time visitor",
    description: "Someone visiting for the first time, with no behavioural signal yet.",
    icon: "👋", group: "funnel", tier: "decorative", packId: "pack_funnel_stage",
    reason: "First visit, no behavioural signal. Brand intro experience.",
  },
  {
    key: "consideration", presetKey: "consideration",
    title: "Nudge a visitor who's weighing it up",
    description: "A returning visitor who is actively in the consideration stage.",
    icon: "🔍", group: "funnel", tier: "medium_segmentation", packId: "pack_funnel_stage",
    reason: "Returning visitor in active consideration stage.",
  },
  {
    key: "high_intent", presetKey: "high_intent",
    title: "Convert a high-intent visitor",
    description: "Strong buying signals: high-intent stage and an intent score of 65+.",
    icon: "🔥", group: "funnel", tier: "high_intent", packId: "pack_funnel_stage",
    reason: "Strongest buying signals: high-intent stage + score ≥ 65.",
  },
  {
    key: "returning_visitor", presetKey: "returning_visitor",
    title: "Re-engage a returning visitor",
    description: "Anyone coming back for another session, whatever their stage.",
    icon: "🔄", group: "funnel", tier: "medium_segmentation", packId: "pack_funnel_stage",
    reason: "Returning visitor with established intent stage.",
  },
  {
    key: "customer_onboarding", presetKey: "customer_onboarding",
    title: "Guide a new customer through onboarding",
    description: "An existing customer whose journey stage is customer/onboarding.",
    icon: "🎉", group: "funnel", tier: "hard_state", packId: "pack_funnel_stage",
    reason: "Existing customer in onboarding. Lifecycle experience.",
  },

  // ── Traffic source ──────────────────────────────────────────────────────────
  {
    key: "google_campaign", presetKey: "google_campaign",
    title: "Greet visitors arriving from Google",
    description: "Traffic from a Google search or brand campaign, matching the search intent.",
    icon: "🔎", group: "channel", tier: "medium_segmentation", packId: "pack_campaigns",
    reason: "Arrived via Google. Problem-aware hero matches search intent.",
  },
  {
    key: "linkedin_traffic", presetKey: "linkedin_traffic",
    title: "Greet visitors arriving from LinkedIn",
    description: "Traffic from LinkedIn, with a vision-led, thought-leadership framing.",
    icon: "💼", group: "channel", tier: "medium_segmentation", packId: "pack_traffic_source",
    reason: "Arrived via LinkedIn. Vision hero for thought-leadership and social intent.",
  },
  {
    key: "enterprise_prospect", presetKey: "enterprise_prospect",
    title: "Impress an enterprise prospect",
    description: "A LinkedIn visitor already in the consideration stage, a likely enterprise buyer.",
    icon: "🏢", group: "channel", tier: "medium_segmentation", packId: "pack_traffic_source",
    reason: "LinkedIn visit in consideration stage. Vision-led experience.",
    proxyNote: "\"Enterprise\" is inferred from LinkedIn + consideration stage, not from firmographics.",
  },

  // ── Interest (behavioural scoring) ────────────────────────────────────────────
  {
    key: "interest_pricing", presetKey: "interest_pricing",
    title: "Help a pricing researcher decide",
    description: "Their reading this session is focused on pricing (moderate confidence).",
    icon: "💰", group: "interest", tier: "medium_segmentation", packId: "pack_interest",
    reason: "Behavioural scoring: primary interest = pricing_focused with moderate confidence.",
  },
  {
    key: "interest_product", presetKey: "interest_product",
    title: "Show product depth to a feature explorer",
    description: "Their reading this session is focused on product features.",
    icon: "⚙️", group: "interest", tier: "medium_segmentation", packId: "pack_interest",
    reason: "Behavioural scoring: primary interest = product_focused.",
  },
  {
    key: "interest_technical", presetKey: "interest_technical",
    title: "Speak to a technical evaluator",
    description: "Their reading this session is focused on technical / developer content.",
    icon: "🛠️", group: "interest", tier: "medium_segmentation", packId: "pack_interest",
    reason: "Behavioural scoring: primary interest = technical_focused.",
  },
  {
    key: "interest_trust", presetKey: "interest_trust",
    title: "Reassure a security / compliance buyer",
    description: "Their reading this session is focused on trust, security or compliance.",
    icon: "🔒", group: "interest", tier: "medium_segmentation", packId: "pack_interest",
    reason: "Behavioural scoring: primary interest = trust_focused.",
  },
  {
    key: "interest_roi", presetKey: "interest_roi",
    title: "Make the business case for an ROI researcher",
    description: "Their reading this session is focused on ROI / business-case content.",
    icon: "📊", group: "interest", tier: "medium_segmentation", packId: "pack_interest",
    reason: "Behavioural scoring: primary interest = roi_focused.",
  },
  {
    key: "interest_comparison", presetKey: "interest_comparison",
    title: "Win a visitor comparing competitors",
    description: "Their reading this session is focused on comparing alternatives.",
    icon: "⚖️", group: "interest", tier: "medium_segmentation", packId: "pack_interest",
    reason: "Behavioural scoring: primary interest = comparison_focused.",
  },

  // ── Behaviour ─────────────────────────────────────────────────────────────────
  {
    key: "form_dropoff", presetKey: "form_dropoff",
    title: "Win back a form abandoner",
    description: "Started a form but didn't submit it. Re-engage with reassurance.",
    icon: "📝", group: "behaviour", tier: "high_intent", packId: "pack_behaviour",
    reason: "Started the form but abandoned it. Re-engage with reassurance.",
  },
  {
    key: "high_friction", presetKey: "high_friction",
    title: "Simplify things for a struggling visitor",
    description: "A high friction score, so reduce overwhelm and simplify the decision.",
    icon: "⚠️", group: "behaviour", tier: "medium_segmentation", packId: "pack_behaviour",
    reason: "High friction score. Simplify the decision path.",
  },
  {
    key: "post_conversion", presetKey: "post_conversion",
    title: "Celebrate a fresh conversion",
    description: "Just submitted a form. Drop the sales pressure and welcome them.",
    icon: "✅", group: "behaviour", tier: "hard_state", packId: "pack_funnel_stage",
    reason: "Form just submitted. Post-conversion celebration and onboarding.",
  },

  // ── Targeted entry (reads a flag written by the measurement rule) ─────────────
  {
    key: "targeted_entry",
    title: "Reward high intent on arrival",
    description:
      "Visitors flagged as arriving with clear intent (the gericht_binnengekomen flag " +
      "set by the measurement rule). Lead straight with the intent experience.",
    icon: "🎯", group: "entry", tier: "high_intent", packId: "pack_behaviour",
    reason: "Flagged gericht_binnengekomen on arrival. Lead with the intent experience.",
    condition: { type: "flag", name: "gericht_binnengekomen", value: true },
    planFromPreset: "high_intent",
    proxyNote:
      "Requires the \"Gericht binnengekomen (meet)\" rule to be active, since it writes the flag this recipe reads.",
  },

  // ── Time ──────────────────────────────────────────────────────────────────────
  {
    key: "time_weekend",
    title: "Show a different message at the weekend",
    description: "Anyone visiting on Saturday or Sunday (tenant local time).",
    icon: "📅", group: "time", tier: "decorative", packId: "pack_funnel_stage",
    reason: "Weekend visit. Low-signal time-based hint.",
    condition: { type: "field", field: "isWeekend", operator: "equals", value: true },
    planFromPreset: "consideration",
  },
  {
    key: "time_evening",
    title: "Show a different message in the evening",
    description: "Anyone visiting between 18:00 and 21:59 (tenant local time).",
    icon: "🌙", group: "time", tier: "decorative", packId: "pack_funnel_stage",
    reason: "Evening visit. Low-signal time-based hint.",
    condition: { type: "field", field: "timeOfDay", operator: "equals", value: "evening" },
    planFromPreset: "consideration",
  },
];

// ── Resolution ───────────────────────────────────────────────────────────────

/** Fast lookup of preset condition defs by key. */
const PRESET_BY_KEY: ReadonlyMap<string, PresetConditionDef> = new Map(
  PRESET_CONDITIONS.map((p) => [p.key, p]),
);

/**
 * Resolve a RecipeDef into a full RuleRecipe with a ready condition + plan.
 * Throws on a dangling preset reference — a programmer error caught by tests and
 * typecheck, never reached at runtime with the definitions above.
 */
function resolveRecipe(def: RecipeDef): RuleRecipe {
  let condition: RuleCondition;
  let planKey:   string;

  if (def.presetKey) {
    const preset = PRESET_BY_KEY.get(def.presetKey);
    if (!preset) throw new Error(`Recipe "${def.key}" references unknown preset "${def.presetKey}".`);
    condition = buildPresetCondition(preset.leaves, preset.logic);
    planKey   = def.presetKey;
  } else {
    if (!def.condition)      throw new Error(`Recipe "${def.key}" has neither presetKey nor condition.`);
    if (!def.planFromPreset) throw new Error(`Recipe "${def.key}" is bespoke but has no planFromPreset.`);
    condition = def.condition;
    planKey   = def.planFromPreset;
  }

  const presetPlan = PRESET_PLANS[planKey];
  if (!presetPlan) throw new Error(`Recipe "${def.key}" references unknown preset plan "${planKey}".`);

  return {
    key:         def.key,
    title:       def.title,
    description: def.description,
    icon:        def.icon,
    group:       def.group,
    tier:        def.tier,
    packId:      def.packId,
    reason:      def.reason,
    condition,
    defaultPlan: presetPlanToStoredPlan(presetPlan),
    ...(def.presetKey ? { presetKey: def.presetKey } : {}),
    ...(def.proxyNote ? { proxyNote: def.proxyNote } : {}),
  };
}

/** The full, resolved recipe catalogue, in gallery display order. */
export const RULE_RECIPES: readonly RuleRecipe[] = RECIPE_DEFS.map(resolveRecipe);

/** Look up a single recipe by key. */
export function getRecipe(key: string): RuleRecipe | undefined {
  return RULE_RECIPES.find((r) => r.key === key);
}

/** Recipes grouped by section, preserving definition order within each group. */
export function recipesByGroup(): { group: RecipeGroup; recipes: RuleRecipe[] }[] {
  const order: RecipeGroup[] = ["funnel", "channel", "interest", "behaviour", "entry", "time"];
  return order
    .map((group) => ({ group, recipes: RULE_RECIPES.filter((r) => r.group === group) }))
    .filter((section) => section.recipes.length > 0);
}

// ── Variant scoping ───────────────────────────────────────────────────────────
//
//   The fill-in step must never let an operator pick a variant key the tenant
//   doesn't actually have. These helpers take the already-fetched
//   VariantCatalogue and (a) expose the valid options for a slot and (b) coerce
//   a recipe's canonical default plan onto keys that exist for the tenant.

/** Result of scoping a single slot's desired key against the tenant catalogue. */
export interface ScopedVariantSlot {
  /** The valid options to offer in the dropdown (the tenant's entries). */
  options:      VariantEntry[];
  /** A key guaranteed to exist in `options` (unless options is empty). */
  resolvedKey:  string;
  /** True when the desired key was not available and a fallback was chosen. */
  fallbackUsed: boolean;
}

/**
 * Scope a desired variant key against the tenant's valid entries for one slot.
 * If the desired key exists it wins; otherwise the first available entry is used
 * and `fallbackUsed` flags it. When the tenant has no entries for the slot the
 * desired key is returned unchanged (the platform catalogue always populates
 * hero/proof/cta, so this only bites optional slots).
 */
export function scopeVariantSlot(entries: VariantEntry[], desiredKey: string): ScopedVariantSlot {
  if (entries.some((e) => e.key === desiredKey)) {
    return { options: entries, resolvedKey: desiredKey, fallbackUsed: false };
  }
  if (entries.length > 0) {
    return { options: entries, resolvedKey: entries[0].key, fallbackUsed: true };
  }
  return { options: entries, resolvedKey: desiredKey, fallbackUsed: false };
}

/** Which slots were coerced to a fallback because the canonical key was absent. */
export type PlanSlot = "hero" | "proof" | "cta";

export interface ScopedRecipePlan {
  /** A plan whose hero/proof/cta keys are all valid for the tenant. */
  plan:      StoredPlan;
  /** Slots whose canonical default was unavailable and fell back. */
  fallbacks: PlanSlot[];
}

/**
 * Coerce a recipe's canonical default plan onto variant keys that exist in the
 * tenant catalogue, so the fill-in step opens on a guaranteed-valid outcome.
 * The catalogue keys are, by definition, valid variant keys for the tenant — the
 * casts below re-narrow the scoped string back to the plan's key union and are
 * safe at runtime.
 */
export function scopeRecipePlan(plan: StoredPlan, catalogue: VariantCatalogue): ScopedRecipePlan {
  const hero  = scopeVariantSlot(catalogue.hero,  plan.heroKey);
  const proof = scopeVariantSlot(catalogue.proof, plan.proofKey);
  const cta   = scopeVariantSlot(catalogue.cta,   plan.ctaKey);

  const fallbacks: PlanSlot[] = [];
  if (hero.fallbackUsed)  fallbacks.push("hero");
  if (proof.fallbackUsed) fallbacks.push("proof");
  if (cta.fallbackUsed)   fallbacks.push("cta");

  return {
    plan: {
      ...plan,
      heroKey:  hero.resolvedKey  as StoredPlan["heroKey"],
      proofKey: proof.resolvedKey as StoredPlan["proofKey"],
      ctaKey:   cta.resolvedKey   as StoredPlan["ctaKey"],
    },
    fallbacks,
  };
}
