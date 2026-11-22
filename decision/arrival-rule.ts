/**
 * Rules that rest only on where the visitor came from.
 *
 * Confidence gating (decision/apply-confidence-gating.ts) holds the hero, the
 * proof and the CTA at their defaults until enough behaviour is known. That
 * guards against a rule that reads a weak behavioural signal, such as one page
 * view, and rewrites the page on it.
 *
 * A rule on the traffic source is a different thing. "Arrived through the
 * LinkedIn campaign" is a fact of this request, as certain on the first page
 * view as on the tenth. Found on 22 Nov 2026 on a live tenant: its rule
 * "source is linkedin → the LinkedIn hero" never showed that hero to a first
 * visitor, because a first visitor has no behaviour yet. The page that should
 * carry on the story of the ad was the default page.
 *
 * So a rule whose whole condition is about arrival is let through the gate.
 * "About arrival" is the traffic group of the field registry: source, the UTM
 * parameters, the ad click ids and the referrer. Anything else in the
 * condition (visit type, time of day, device, company, intent, a flag, a
 * segment) keeps the rule behind the gate, also inside an "or", because the
 * match may then have come from that other part.
 *
 * Pure: no I/O.
 */

import { FIELD_REGISTRY, type FieldDefinition } from "./rules/field-registry";
import type { RuleCondition, StoredRule } from "./rules/stored-rule";

/** The slots the confidence gate guards. The theme is not let through. */
export type ArrivalPlanKeys = {
  heroKey?:  string;
  proofKey?: string;
  ctaKey?:   string;
};

function isTrafficField(field: string): boolean {
  const def = (FIELD_REGISTRY as Record<string, FieldDefinition | undefined>)[field];
  return def?.group === "traffic";
}

/** True when every part of the condition is a check on a traffic field. */
export function restsOnArrivalOnly(condition: RuleCondition | null | undefined): boolean {
  if (!condition || typeof condition !== "object") return false;
  if (condition.type === "field") return isTrafficField(condition.field);
  if (condition.type === "group") {
    const parts = Array.isArray(condition.conditions) ? condition.conditions : [];
    return parts.length > 0 && parts.every((part) => restsOnArrivalOnly(part));
  }
  return false;
}

/**
 * The slots a matched rule may set past the confidence gate: its own hero,
 * proof and CTA when the rule rests on arrival only, nothing otherwise.
 *
 * The keys are handed back so the gate can check that a slot still carries the
 * rule's own value. A slot that something else changed afterwards (AI, an
 * experiment) is gated as before.
 */
export function arrivalPlanOf(
  rule: Pick<StoredRule, "condition" | "plan"> | null | undefined,
): ArrivalPlanKeys | null {
  if (!rule || !restsOnArrivalOnly(rule.condition)) return null;
  const plan = (rule.plan ?? {}) as ArrivalPlanKeys;
  return {
    ...(typeof plan.heroKey  === "string" ? { heroKey:  plan.heroKey }  : {}),
    ...(typeof plan.proofKey === "string" ? { proofKey: plan.proofKey } : {}),
    ...(typeof plan.ctaKey   === "string" ? { ctaKey:   plan.ctaKey }   : {}),
  };
}
