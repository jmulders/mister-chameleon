/**
 * Config-health analyzer — D7 spoor 1 (deterministic, no AI, no DB in the path).
 *
 * A PURE function over a tenant's StoredRulesConfig that surfaces the config
 * mistakes this platform has actually been bitten by (see docs/design/
 * config-intelligence.md), BEFORE `validateStoredConfig` rejects the whole config
 * or a rule silently never fires. It is unit-testable in isolation: field/operator
 * knowledge and rule-fire stats are INJECTED (with real defaults), so nothing here
 * touches the DB, the AI layer, or the request path.
 *
 * Checks (MVP):
 *   • duplicate-priority   (error)   — two rules share a priority (validateStoredConfig
 *                                      rejects the ENTIRE config on this; warn early + targeted).
 *   • unknown-field        (error)   — a field condition references a field not in FIELD_REGISTRY.
 *   • invalid-operator     (error)   — an operator not allowed for that field.
 *   • empty-value-set      (warning) — in/not_in with an empty/absent array → can never be true.
 *   • dead-variant         (warning) — a catalogue variant key no rule (or the default plan) uses.
 *   • shadowed-rule        (warning) — a rule with the SAME condition as a higher-priority rule.
 *   • always-true-shadow   (warning) — rules after an always-true rule are unreachable.
 *   • never-fired          (info)    — a rule that has not fired in N days (from rule_fire_daily).
 *
 * NOTE: full condition subsumption (a condition logically implied by another) is a
 * later extension — this MVP only catches identical / always-true conditions.
 */

import type { StoredRulesConfig, StoredRule, RuleCondition, StoredPlan } from "./stored-rule";
import { ALLOWED_HERO_KEYS, ALLOWED_PROOF_KEYS, ALLOWED_CTA_KEYS } from "./stored-rule";
import { FIELD_REGISTRY } from "./field-registry";

export type FindingSeverity = "error" | "warning" | "info";

export interface ConfigHealthFinding {
  severity:   FindingSeverity;
  /** Stable machine code for the finding type. */
  code:
    | "duplicate-priority" | "unknown-field" | "invalid-operator" | "empty-value-set"
    | "dead-variant" | "shadowed-rule" | "always-true-shadow" | "never-fired";
  /** Human-readable explanation of the problem. */
  message:    string;
  /** The rule the finding is about (absent for config-wide findings like dead variants). */
  ruleId?:    string;
  ruleLabel?: string;
  /** The offending field / variant key, when relevant. */
  subject?:   string;
}

export interface RuleFireStat {
  /** True when the rule has fired at least once in the window. */
  fired:              boolean;
  /** Days since the rule last fired, or null when it has never fired. */
  daysSinceLastFire:  number | null;
}

export interface ConfigHealthInput {
  /** Valid field keys. Default: the FIELD_REGISTRY keys. */
  fieldKeys?:      ReadonlySet<string>;
  /** Allowed operators for a field. Default: FIELD_REGISTRY[field].operators. */
  operatorsFor?:   (field: string) => readonly string[] | undefined;
  /** Catalogue variant keys per slot. Default: the platform ALLOWED_*_KEYS. */
  variantKeys?:    { hero: readonly string[]; proof: readonly string[]; cta: readonly string[] };
  /** Per-rule fire stats (from rule_fire_daily). Omit to skip the never-fired check. */
  fireStats?:      Record<string, RuleFireStat>;
  /** A rule idle for this many days is flagged never-fired (info). Default 30. */
  neverFiredDays?: number;
}

const DEFAULT_FIELD_KEYS = new Set<string>(Object.keys(FIELD_REGISTRY));
const OPS_IN = new Set(["in", "not_in"]);

/** Walk a condition tree, invoking `visit` on every leaf field condition. */
function walkFieldConditions(cond: RuleCondition, visit: (c: { field?: string; operator?: string; value?: unknown }) => void): void {
  if (!cond || typeof cond !== "object") return;
  if (cond.type === "group") {
    for (const child of (cond as { conditions?: readonly RuleCondition[] }).conditions ?? []) walkFieldConditions(child, visit);
    return;
  }
  if (cond.type === "field") {
    const c = cond as { field?: string; operator?: string; value?: unknown };
    visit({ field: c.field, operator: c.operator, value: c.value });
  }
}

/** An AND-group with no children is vacuously TRUE (matches every visitor). */
function isAlwaysTrue(cond: RuleCondition): boolean {
  return Boolean(
    cond && typeof cond === "object" &&
    cond.type === "group" &&
    (cond as { logic?: string }).logic === "and" &&
    ((cond as { conditions?: readonly unknown[] }).conditions?.length ?? 0) === 0,
  );
}

/** Referenced variant keys across all rule plans + the default plan. */
function referencedVariantKeys(config: StoredRulesConfig): { hero: Set<string>; proof: Set<string>; cta: Set<string> } {
  const hero = new Set<string>(), proof = new Set<string>(), cta = new Set<string>();
  const add = (p: StoredPlan | undefined) => {
    if (!p) return;
    if (p.heroKey)  hero.add(p.heroKey);
    if (p.proofKey) proof.add(p.proofKey);
    if (p.ctaKey)   cta.add(p.ctaKey);
  };
  for (const r of config.rules) if (!r.webhookOnly) add(r.plan);
  add(config.defaultPlan as StoredPlan);
  return { hero, proof, cta };
}

/**
 * Analyze a tenant rules config → a list of health findings (most severe first).
 * Pure: no DB / AI / network. Deterministic order.
 */
export function analyzeRulesConfig(config: StoredRulesConfig, input: ConfigHealthInput = {}): ConfigHealthFinding[] {
  const fieldKeys   = input.fieldKeys ?? DEFAULT_FIELD_KEYS;
  const operatorsFor = input.operatorsFor ?? ((f: string) => (FIELD_REGISTRY as Record<string, { operators?: readonly string[] }>)[f]?.operators);
  const variantKeys = input.variantKeys ?? { hero: ALLOWED_HERO_KEYS, proof: ALLOWED_PROOF_KEYS, cta: ALLOWED_CTA_KEYS };
  const neverFiredDays = input.neverFiredDays ?? 30;

  const findings: ConfigHealthFinding[] = [];
  const rules = config.rules ?? [];
  const label = (r: StoredRule) => r.label || r.id;

  // ── duplicate-priority ──────────────────────────────────────────────────────
  const byPriority = new Map<number, StoredRule[]>();
  for (const r of rules) {
    const list = byPriority.get(r.priority) ?? [];
    list.push(r);
    byPriority.set(r.priority, list);
  }
  for (const [prio, group] of byPriority) {
    if (group.length > 1) {
      for (const r of group) {
        findings.push({
          severity: "error", code: "duplicate-priority", ruleId: r.id, ruleLabel: label(r),
          message: `Duplicate priority ${prio}: ${group.length} rules share it. validateStoredConfig rejects the whole config on this — give each rule a unique priority.`,
        });
      }
    }
  }

  // ── condition checks (unknown-field / invalid-operator / empty-value-set) ────
  for (const r of rules) {
    if (r.webhookOnly) continue; // webhook-only rules aren't part of variant matching
    walkFieldConditions(r.condition, ({ field, operator, value }) => {
      if (field && !fieldKeys.has(field)) {
        findings.push({
          severity: "error", code: "unknown-field", ruleId: r.id, ruleLabel: label(r), subject: field,
          message: `Condition references unknown field "${field}" — not in the field registry, so it can never match.`,
        });
        return; // operator/value checks are meaningless for an unknown field
      }
      if (field && operator) {
        const allowed = operatorsFor(field);
        if (allowed && !allowed.includes(operator)) {
          findings.push({
            severity: "error", code: "invalid-operator", ruleId: r.id, ruleLabel: label(r), subject: field,
            message: `Operator "${operator}" is not valid for field "${field}" — the condition can never be evaluated as intended.`,
          });
        }
      }
      if (operator && OPS_IN.has(operator) && (!Array.isArray(value) || value.length === 0)) {
        findings.push({
          severity: "warning", code: "empty-value-set", ruleId: r.id, ruleLabel: label(r), subject: field,
          message: `"${operator}" on "${field}" has an empty value set — this condition can never be true.`,
        });
      }
    });
  }

  // ── dead-variant ────────────────────────────────────────────────────────────
  const referenced = referencedVariantKeys(config);
  const deadIn = (slot: "hero" | "proof" | "cta", allowed: readonly string[], ref: Set<string>) => {
    for (const key of allowed) {
      if (!ref.has(key)) {
        findings.push({
          severity: "warning", code: "dead-variant", subject: key,
          message: `Dead ${slot} variant "${key}": defined in the catalogue but no rule or the default plan selects it.`,
        });
      }
    }
  };
  deadIn("hero",  variantKeys.hero,  referenced.hero);
  deadIn("proof", variantKeys.proof, referenced.proof);
  deadIn("cta",   variantKeys.cta,   referenced.cta);

  // ── shadowing / unreachability (identical condition + always-true) ───────────
  // Evaluate in priority order (lower number first) among enabled variant rules.
  const ordered = rules
    .filter((r) => r.enabled !== false && !r.webhookOnly)
    .slice()
    .sort((a, b) => a.priority - b.priority || rules.indexOf(a) - rules.indexOf(b));

  const seenConditions = new Map<string, StoredRule>();
  let alwaysTrueAbove: StoredRule | null = null;
  for (const r of ordered) {
    if (alwaysTrueAbove) {
      findings.push({
        severity: "warning", code: "always-true-shadow", ruleId: r.id, ruleLabel: label(r),
        message: `Unreachable: a higher-priority rule "${label(alwaysTrueAbove)}" (priority ${alwaysTrueAbove.priority}) always matches, so this rule never gets a turn.`,
      });
      continue;
    }
    const key = JSON.stringify(r.condition ?? null);
    const prior = seenConditions.get(key);
    if (prior) {
      findings.push({
        severity: "warning", code: "shadowed-rule", ruleId: r.id, ruleLabel: label(r),
        message: `Shadowed by higher-priority rule "${label(prior)}" (priority ${prior.priority}) with an identical condition — this rule never fires.`,
      });
    } else {
      seenConditions.set(key, r);
    }
    if (isAlwaysTrue(r.condition)) alwaysTrueAbove = r;
  }

  // ── never-fired (info; needs injected fire stats) ────────────────────────────
  if (input.fireStats) {
    for (const r of rules) {
      if (r.enabled === false || r.webhookOnly) continue;
      const stat = input.fireStats[r.id];
      if (!stat) continue;
      if (!stat.fired || (stat.daysSinceLastFire != null && stat.daysSinceLastFire >= neverFiredDays)) {
        const detail = stat.daysSinceLastFire == null ? "has never fired" : `has not fired in ${stat.daysSinceLastFire} days`;
        findings.push({
          severity: "info", code: "never-fired", ruleId: r.id, ruleLabel: label(r),
          message: `Rule ${detail} — candidate for removal.`,
        });
      }
    }
  }

  // Most severe first, stable within a severity.
  const rank: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Convenience: counts per severity (for a compact panel badge). */
export function summarizeFindings(findings: readonly ConfigHealthFinding[]): { error: number; warning: number; info: number } {
  return findings.reduce(
    (acc, f) => { acc[f.severity]++; return acc; },
    { error: 0, warning: 0, info: 0 },
  );
}
