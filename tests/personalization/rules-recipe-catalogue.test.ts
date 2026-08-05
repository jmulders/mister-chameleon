/**
 * Rule Recipe Catalogue + Priority Allocation — Unit Tests
 *
 * Covers the data layer behind the template-first "Add rule" flow:
 *   1. Every recipe resolves to a valid-by-construction condition + plan, and a
 *      config built from ALL recipes (with allocated priorities) passes
 *      validateStoredConfig — the core safety guarantee.
 *   2. Preset-derived recipes match their preset's condition + plan exactly.
 *   3. v1 constraints: no role recipes; proxy recipes carry a proxyNote.
 *   4. allocateUniquePriority — fills first free slot in tier, skips taken,
 *      never collides, handles a full tier.
 *   5. conditionsEqual / findDuplicateByCondition — key-order-insensitive.
 *   6. scopeVariantSlot / scopeRecipePlan — never yields a key the tenant lacks.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  RULE_RECIPES, getRecipe, recipesByGroup, RECIPE_GROUPS,
  scopeVariantSlot, scopeRecipePlan,
} from "@/decision/rules/recipe-catalogue";
import {
  allocateUniquePriority, conditionsEqual, findDuplicateByCondition,
} from "@/decision/rules/allocate-priority";
import { validateStoredConfig }              from "@/decision/rules/stored-rule";
import type { StoredRule, StoredRulesConfig, RuleCondition } from "@/decision/rules/stored-rule";
import { PRECEDENCE_TIERS }                  from "@/decision/rules/rule-packs";
import { PRESET_PLANS, presetPlanToStoredPlan } from "@/decision/rules/preset-plans";
import { PRESET_CONDITIONS }                 from "@/decision/rules/preset-conditions";
import type { VariantCatalogue, VariantEntry } from "@/decision/rules/variant-catalogue";

// ── Helpers ────────────────────────────────────────────────────────────────────

function entry(key: string): VariantEntry {
  return { key, label: key, source: "platform" };
}

/** Turn every recipe into a rule with an allocated unique priority. */
function buildRulesFromAllRecipes(): StoredRule[] {
  const rules: StoredRule[] = [];
  for (const recipe of RULE_RECIPES) {
    const priority = allocateUniquePriority(rules, recipe.tier);
    rules.push({
      id:              `homepage.recipe_${recipe.key}`,
      priority,
      precedenceLevel: recipe.tier,
      packId:          recipe.packId,
      label:           recipe.title,
      condition:       recipe.condition,
      plan:            recipe.defaultPlan,
      reason:          recipe.reason,
      enabled:         true,
      source:          "tenant",
    });
  }
  return rules;
}

// ── 1. Valid-by-construction ────────────────────────────────────────────────────

describe("recipe catalogue — valid by construction", () => {
  it("exposes a non-empty catalogue", () => {
    assert.ok(RULE_RECIPES.length > 0);
  });

  it("every recipe has a complete default plan (hero/proof/cta)", () => {
    for (const r of RULE_RECIPES) {
      assert.ok(r.defaultPlan.heroKey,  `${r.key} missing heroKey`);
      assert.ok(r.defaultPlan.proofKey, `${r.key} missing proofKey`);
      assert.ok(r.defaultPlan.ctaKey,   `${r.key} missing ctaKey`);
    }
  });

  it("a config built from ALL recipes passes validateStoredConfig", () => {
    const rules = buildRulesFromAllRecipes();
    const config: StoredRulesConfig = {
      schemaVersion: 1,
      updatedAt:     "2026-01-01T00:00:00.000Z",
      rules,
      defaultPlan: {
        heroKey:  "hero_direct_brand",
        proofKey: "proof_default",
        ctaKey:   "cta_guide",
        reason:   "Default/direct traffic — brand-led experience.",
      },
      rulesEnabled: true,
    };
    assert.deepEqual(validateStoredConfig(config), []);
  });

  it("allocates a unique priority to every recipe rule", () => {
    const rules = buildRulesFromAllRecipes();
    const priorities = rules.map((r) => r.priority);
    assert.equal(new Set(priorities).size, priorities.length);
  });

  it("keeps each recipe's priority inside its declared tier (room permitting)", () => {
    const rules = buildRulesFromAllRecipes();
    rules.forEach((r, i) => {
      const [min, max] = PRECEDENCE_TIERS[RULE_RECIPES[i].tier].range;
      assert.ok(r.priority >= min && r.priority <= max, `${r.id} priority ${r.priority} outside tier`);
    });
  });
});

// ── 2. Preset fidelity ──────────────────────────────────────────────────────────

describe("recipe catalogue — preset fidelity", () => {
  it("preset-derived recipes reuse the preset's plan exactly", () => {
    for (const r of RULE_RECIPES) {
      if (!r.presetKey) continue;
      assert.deepEqual(r.defaultPlan, presetPlanToStoredPlan(PRESET_PLANS[r.presetKey]));
    }
  });

  it("single-leaf presets emit the field condition unwrapped", () => {
    const newVisitor = getRecipe("new_visitor");
    const preset = PRESET_CONDITIONS.find((p) => p.key === "new_visitor")!;
    assert.equal(preset.leaves.length, 1);
    assert.deepEqual(newVisitor!.condition, preset.leaves[0]);
  });

  it("multi-leaf presets emit a group with the preset's logic", () => {
    const consideration = getRecipe("consideration");
    const cond = consideration!.condition;
    assert.equal(cond.type, "group");
    if (cond.type === "group") {
      assert.equal(cond.logic, "and");
      assert.equal(cond.conditions.length, 2);
    }
  });
});

// ── 3. v1 constraints ───────────────────────────────────────────────────────────

describe("recipe catalogue — v1 constraints", () => {
  it("ships no role recipes", () => {
    for (const r of RULE_RECIPES) {
      assert.ok(!/role|marketeer|bureau|technisch/i.test(r.key), `unexpected role recipe ${r.key}`);
    }
  });

  it("proxy recipes carry an explicit proxyNote", () => {
    assert.ok(getRecipe("enterprise_prospect")!.proxyNote);
    assert.ok(getRecipe("targeted_entry")!.proxyNote);
  });

  it("recipesByGroup returns non-empty sections in fixed order covering all recipes", () => {
    const sections = recipesByGroup();
    const order = sections.map((s) => s.group);
    assert.deepEqual(order, ["funnel", "channel", "interest", "behaviour", "entry", "time"]);
    for (const s of sections) {
      assert.ok(s.recipes.length > 0);
      assert.ok(RECIPE_GROUPS[s.group].label);
    }
    const grouped = sections.reduce((n, s) => n + s.recipes.length, 0);
    assert.equal(grouped, RULE_RECIPES.length);
  });
});

// ── 4. Priority allocation ──────────────────────────────────────────────────────

describe("allocateUniquePriority", () => {
  it("returns the tier minimum when nothing is taken", () => {
    assert.equal(allocateUniquePriority([], "high_intent"), 10);
    assert.equal(allocateUniquePriority([], "hard_state"), 1);
    assert.equal(allocateUniquePriority([], "medium_segmentation"), 20);
    assert.equal(allocateUniquePriority([], "decorative"), 50);
  });

  it("fills the first free slot in the tier, skipping taken priorities", () => {
    const existing = [{ priority: 10 }, { priority: 11 }, { priority: 13 }];
    assert.equal(allocateUniquePriority(existing, "high_intent"), 12);
  });

  it("never returns a priority already in use", () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({ priority: 20 + i }));
    const p = allocateUniquePriority(existing, "medium_segmentation");
    assert.ok(!existing.some((r) => r.priority === p));
  });

  it("falls back to a unique out-of-range number when the tier is full", () => {
    // high_intent range is 10–19: fill all 10 slots.
    const existing = Array.from({ length: 10 }, (_, i) => ({ priority: 10 + i }));
    const p = allocateUniquePriority(existing, "high_intent");
    assert.ok(!existing.some((r) => r.priority === p), "must be unique");
    assert.ok(p >= 20, "fallback appends above the tier");
  });
});

// ── 5. Duplicate detection ──────────────────────────────────────────────────────

describe("conditionsEqual / findDuplicateByCondition", () => {
  const a: RuleCondition = { type: "field", field: "source", operator: "equals", value: "google" };
  const aReordered = { value: "google", operator: "equals", field: "source", type: "field" } as unknown as RuleCondition;
  const b: RuleCondition = { type: "field", field: "source", operator: "equals", value: "linkedin" };

  it("treats key-order-different conditions as equal", () => {
    assert.ok(conditionsEqual(a, aReordered));
  });

  it("distinguishes genuinely different conditions", () => {
    assert.ok(!conditionsEqual(a, b));
  });

  it("finds an existing rule with the same condition (any enabled state)", () => {
    const existing = [
      { condition: b, enabled: true,  id: "r1" },
      { condition: a, enabled: false, id: "r2" },
    ];
    const dup = findDuplicateByCondition(existing, aReordered);
    assert.equal(dup?.id, "r2");
  });

  it("returns undefined when the condition is new", () => {
    const existing = [{ condition: b, id: "r1" }];
    assert.equal(findDuplicateByCondition(existing, a), undefined);
  });

  it("matches a real recipe against itself", () => {
    const recipe = getRecipe("high_intent")!;
    const existing = [{ condition: recipe.condition, id: "seeded" }];
    assert.ok(findDuplicateByCondition(existing, recipe.condition));
  });
});

// ── 6. Variant scoping ──────────────────────────────────────────────────────────

describe("scopeVariantSlot / scopeRecipePlan", () => {
  it("keeps the desired key when the tenant has it", () => {
    const res = scopeVariantSlot([entry("hero_a"), entry("hero_b")], "hero_b");
    assert.equal(res.resolvedKey, "hero_b");
    assert.equal(res.fallbackUsed, false);
  });

  it("falls back to the first entry when the desired key is absent", () => {
    const res = scopeVariantSlot([entry("hero_a"), entry("hero_b")], "hero_missing");
    assert.equal(res.resolvedKey, "hero_a");
    assert.equal(res.fallbackUsed, true);
  });

  it("returns the desired key unchanged when the catalogue slot is empty", () => {
    const res = scopeVariantSlot([], "hero_x");
    assert.equal(res.resolvedKey, "hero_x");
    assert.equal(res.fallbackUsed, false);
  });

  it("coerces a recipe plan onto tenant-valid keys and reports fallbacks", () => {
    const recipe = getRecipe("high_intent")!; // hero_intent_direct / proof_stats / cta_meeting
    const catalogue: VariantCatalogue = {
      hero:       [entry("hero_intent_direct"), entry("hero_x")], // hero present
      proof:      [entry("proof_only")],                          // proof absent → fallback
      cta:        [entry("cta_meeting")],                         // cta present
      feature:    [],
      conversion: [],
    };
    const { plan, fallbacks } = scopeRecipePlan(recipe.defaultPlan, catalogue);
    assert.equal(plan.heroKey, "hero_intent_direct");
    assert.equal(plan.proofKey, "proof_only");
    assert.equal(plan.ctaKey, "cta_meeting");
    assert.deepEqual(fallbacks, ["proof"]);
    // Every resolved key exists in its slot.
    assert.ok(catalogue.hero.some((e) => e.key === plan.heroKey));
    assert.ok(catalogue.proof.some((e) => e.key === plan.proofKey));
    assert.ok(catalogue.cta.some((e) => e.key === plan.ctaKey));
  });
});
