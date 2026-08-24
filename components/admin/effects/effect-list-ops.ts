/**
 * effect-list-ops
 *
 * Pure list operations behind EffectListEditor (the shared picker used by the
 * block drawer, the Design -> Block styles editors and the per-block-type editor).
 * Kept free of React/DOM so the one-effect-per-group and in-place-swap rules can
 * be unit-tested once and hold for every picker surface.
 *
 * The core rule: at most ONE effect per group (entrance / emphasis / continuous).
 * Adding a second effect in an occupied group replaces the one already there;
 * cross-group combinations (e.g. a reveal entrance + a hover-lift) stay allowed.
 */

import { effectDefinition, effectGroup } from "@/design-system/effects/effect-defs";
import type { BlockEffectConfig } from "@/design-system/effects/effect-ref";

export interface AddResult {
  next: BlockEffectConfig[];
  /** Label of the same-group effect that was replaced, or null when nothing was replaced. */
  replacedLabel: string | null;
}

/** Add an effect, enforcing one-per-group: any existing same-group effect is replaced. */
export function addEffectToList(list: BlockEffectConfig[], id: string): AddResult {
  const def = effectDefinition(id);
  if (!def) return { next: list, replacedLabel: null };
  if (list.some((e) => e.effect === id)) return { next: list, replacedLabel: null }; // already present
  const replaced = list.find((e) => effectGroup(e.effect) === def.group);
  const next = [...list.filter((e) => effectGroup(e.effect) !== def.group), { effect: id }];
  return {
    next,
    replacedLabel: replaced ? effectDefinition(replaced.effect)?.label ?? replaced.effect : null,
  };
}

/**
 * Swap one added effect for another, in place, carrying over params whose keys
 * still exist on the new effect. No-op on a duplicate target; callers gate
 * cross-group collisions via isSwapTargetDisabled so a plain replace is safe.
 */
export function swapEffectInList(
  list: BlockEffectConfig[], oldId: string, newId: string,
): BlockEffectConfig[] {
  if (oldId === newId) return list;
  const newDef = effectDefinition(newId);
  if (!newDef) return list;
  if (list.some((e) => e.effect === newId)) return list; // no duplicates
  const oldCfg = list.find((e) => e.effect === oldId);
  const kept: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(oldCfg?.params ?? {})) {
    if (newDef.params?.some((p) => p.key === k)) kept[k] = v;
  }
  const newCfg: BlockEffectConfig =
    Object.keys(kept).length > 0 ? { effect: newId, params: kept } : { effect: newId };
  return list.map((e) => (e.effect === oldId ? newCfg : e));
}

/**
 * True when swapping `currentId` to `candidateId` should be disabled in the
 * per-card dropdown: it would duplicate an effect already in the list, or land in
 * a group another card already occupies (which would break one-per-group).
 */
export function isSwapTargetDisabled(
  list: BlockEffectConfig[], currentId: string, candidateId: string,
): boolean {
  if (candidateId === currentId) return false;
  if (list.some((e) => e.effect === candidateId)) return true; // duplicate
  const candGroup = effectGroup(candidateId);
  const occupiedElsewhere = new Set(
    list.filter((e) => e.effect !== currentId).map((e) => effectGroup(e.effect)),
  );
  return candGroup !== undefined && occupiedElsewhere.has(candGroup);
}
