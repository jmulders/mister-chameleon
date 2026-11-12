/**
 * The rules config that applying a blueprint writes.
 *
 * This used to be put together inline in the server action and written without
 * a check. Three things went wrong with it:
 *
 *   - it was stored as a JSON string in a jsonb column, which the engine reads
 *     back as a string and rejects ("Config must be an object");
 *   - on a tenant without a config it had no schemaVersion and no reason on
 *     the default plan, which validation also rejects;
 *   - blueprint rules carry fixed priorities (10, 20, …) that collide with
 *     rules the tenant already has, and one duplicate priority makes the
 *     engine reject the whole config.
 *
 * A rejected config does not show an error anywhere: the tenant silently gets
 * the platform's built-in rules. So the config is built here, as an object,
 * with free priorities, and validated before anything is written.
 *
 * Pure: no I/O.
 */
import {
  validateStoredConfig,
  type StoredDefaultPlan,
  type StoredRule,
  type StoredRulesConfig,
} from "@/decision/rules/stored-rule";
import type { Blueprint } from "./blueprint-types";

export interface BlueprintRulesResult {
  config:       StoredRulesConfig;
  rulesCreated: number;
  rulesSkipped: number;
  /** Validation errors; when not empty the config must not be written. */
  errors:       string[];
}

const DEFAULT_PLAN: StoredDefaultPlan = {
  heroKey:  "hero_default",
  proofKey: "proof_default",
  ctaKey:   "cta_default",
  reason:   "Default experience.",
};

/** The first priority at or above `wanted` that no rule uses yet. */
function freePriority(wanted: number, taken: Set<number>): number {
  let p = Number.isFinite(wanted) ? Math.max(0, Math.floor(wanted)) : 0;
  while (taken.has(p)) p++;
  taken.add(p);
  return p;
}

export function buildBlueprintRulesConfig(
  existing:  StoredRulesConfig | null,
  blueprint: Pick<Blueprint, "key" | "rules">,
  force:     boolean,
  nowIso:    string,
): BlueprintRulesResult {
  const blueprintRules = blueprint.rules.map((r, i) => ({
    ...r,
    id: `${blueprint.key}_rule_${i + 1}`,
  })) as unknown as StoredRule[];

  const keep: StoredRule[] = !force && existing?.rules?.length ? [...existing.rules] : [];
  const keptIds  = new Set(keep.map((r) => r.id));
  const taken    = new Set(keep.map((r) => r.priority));

  const added: StoredRule[] = [];
  for (const rule of blueprintRules) {
    if (keptIds.has(rule.id)) continue;
    added.push({ ...rule, priority: freePriority(rule.priority, taken) });
  }

  const config: StoredRulesConfig = {
    ...(existing ?? {}),
    schemaVersion: 1,
    updatedAt:     nowIso,
    rules:         [...keep, ...added],
    defaultPlan:   existing?.defaultPlan ?? DEFAULT_PLAN,
  };

  // The same leniency as a runtime read: variant keys may come from the
  // tenant's CMS, which this pure function cannot see.
  const errors = validateStoredConfig(config, undefined, { allowUnknownVariantKeys: true })
    .map((e) => (typeof e === "string" ? e : `${e.field}: ${e.message}`));

  return {
    config,
    rulesCreated: added.length,
    rulesSkipped: blueprintRules.length - added.length,
    errors,
  };
}
