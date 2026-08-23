/**
 * rules-usage
 *
 * Pure cross-reference between an adaptive block and a tenant's stored rules,
 * so the admin can show "used in N rules" and the delete guard can refuse a
 * deletion that would orphan a rule.
 *
 * A block's identity is its routing `key` (which, for the core slots, IS the
 * variant key a rule plan references) plus any finer `adaptiveVariants[].variantKey`
 * (referenced by plan.formVariants / plan.emailVariants). A rule "uses" a block
 * when its plan references any of those keys through a slot field
 * (heroKey/proofKey/ctaKey/featureKey/conversionKey/notificationKey) or a
 * form/email variant map. The default plan counts too — orphaning it also breaks
 * rendering.
 *
 * Pure functions (no I/O) so they are unit-testable and reusable on both the
 * server guard and the admin page.
 */

import type { AdaptiveBlockData } from "@/cms/types";
import type { StoredRulesConfig, StoredPlan } from "@/decision/rules/stored-rule";
import { ADAPTIVE_SLOT_REGISTRY } from "@/decision/types";

/** A rule (or the default plan) that references a block, and the field that matched. */
export interface RuleUsageRef {
  /** Rule id, or "__default__" for the default plan. */
  readonly ruleId: string;
  readonly label: string;
  /** The plan field that referenced the block (e.g. "ctaKey", "formVariants"). */
  readonly field: string;
  readonly isDefault: boolean;
}

type BlockKeys = Pick<AdaptiveBlockData, "key" | "adaptiveVariants">;

/** Every variant key a block provides: its routing key plus any adaptive sub-variant keys. */
export function blockVariantKeys(block: BlockKeys): Set<string> {
  const keys = new Set<string>();
  if (block.key) keys.add(block.key);
  for (const v of block.adaptiveVariants ?? []) {
    if (v?.variantKey) keys.add(v.variantKey);
  }
  return keys;
}

// The plan field per slot: slot id "cta" -> "ctaKey", etc.
const SLOT_PLAN_FIELDS = ADAPTIVE_SLOT_REGISTRY.map((s) => `${s.id}Key` as keyof StoredPlan);

/** Flatten the variant keys a plan references, each tagged with the field it came from. */
function planReferences(plan: StoredPlan): Array<{ field: string; key: string }> {
  const refs: Array<{ field: string; key: string }> = [];
  for (const field of SLOT_PLAN_FIELDS) {
    const val = plan[field];
    if (typeof val === "string" && val) refs.push({ field: String(field), key: val });
  }
  const maps: Array<[string, Record<string, string> | undefined]> = [
    ["formVariants", plan.formVariants],
    ["emailVariants", plan.emailVariants],
  ];
  for (const [field, map] of maps) {
    if (!map) continue;
    for (const key of Object.values(map)) {
      if (typeof key === "string" && key) refs.push({ field, key });
    }
  }
  return refs;
}

/** Find every rule (and the default plan) whose plan references any of the block's variant keys. */
export function findRulesUsingBlock(
  block: BlockKeys,
  config: StoredRulesConfig | null | undefined,
): RuleUsageRef[] {
  if (!config) return [];
  const provided = blockVariantKeys(block);
  if (provided.size === 0) return [];

  const out: RuleUsageRef[] = [];
  for (const rule of config.rules ?? []) {
    const hit = planReferences(rule.plan).find((r) => provided.has(r.key));
    if (hit) out.push({ ruleId: rule.id, label: rule.label, field: hit.field, isDefault: false });
  }
  if (config.defaultPlan) {
    const hit = planReferences(config.defaultPlan).find((r) => provided.has(r.key));
    if (hit) out.push({ ruleId: "__default__", label: "Default plan", field: hit.field, isDefault: true });
  }
  return out;
}

/**
 * Build a map of variant key -> referencing rules across a whole rules config,
 * for annotating a list of blocks in one pass (the admin "used in N rules" badge).
 */
export function buildRuleUsageIndex(
  config: StoredRulesConfig | null | undefined,
): Map<string, RuleUsageRef[]> {
  const index = new Map<string, RuleUsageRef[]>();
  if (!config) return index;
  const add = (key: string, ref: RuleUsageRef) => {
    const list = index.get(key);
    if (list) list.push(ref);
    else index.set(key, [ref]);
  };
  for (const rule of config.rules ?? []) {
    for (const r of planReferences(rule.plan)) {
      add(r.key, { ruleId: rule.id, label: rule.label, field: r.field, isDefault: false });
    }
  }
  if (config.defaultPlan) {
    for (const r of planReferences(config.defaultPlan)) {
      add(r.key, { ruleId: "__default__", label: "Default plan", field: r.field, isDefault: true });
    }
  }
  return index;
}
