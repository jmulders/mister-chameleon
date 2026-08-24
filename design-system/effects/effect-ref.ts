/**
 * Block effect references, three-tier resolution, and SSR attribute emission.
 *
 * Mirrors design-system/theme/block-token-set.ts (BlockTokenRef → resolve →
 * style) but for effects: a block points at a named effect set and/or inline
 * effects; resolveBlockEffects merges the three tiers; effectsToAttrs turns the
 * resolved list into the className / style / data-* the SSR wrapper carries and
 * the versioned client runtime reads.
 *
 * Pure module (types + string maths), no React/DOM.
 */

import {
  EFFECT_SCHEMA_VERSION, effectDefinition, isKnownEffect, type EffectDefinition,
} from "./effect-defs";

/**
 * Validate + normalise an untrusted effect-config array against the registry
 * (the storage boundary for the managed library). Drops unknown effect ids and
 * unknown params, and clamps numeric params to their declared range. This is what
 * enforces "declarative only, no raw JS": nothing outside the registry survives.
 */
export function sanitizeEffectConfigs(raw: unknown): BlockEffectConfig[] {
  if (!Array.isArray(raw)) return [];
  const out: BlockEffectConfig[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const effect = (item as { effect?: unknown }).effect;
    if (typeof effect !== "string" || !isKnownEffect(effect) || seen.has(effect)) continue;
    const def = effectDefinition(effect)!;
    seen.add(effect);
    const rawParams = (item as { params?: unknown }).params;
    const params: Record<string, string | number> = {};
    if (rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)) {
      for (const p of def.params ?? []) {
        const v = (rawParams as Record<string, unknown>)[p.key];
        if (v === undefined || v === null) continue;
        if (p.type === "number") {
          const n = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(n)) continue;
          params[p.key] = Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, n));
        } else {
          const s = String(v);
          if (p.options?.some((o) => o.value === s)) params[p.key] = s;
        }
      }
    }
    out.push(Object.keys(params).length > 0 ? { effect, params } : { effect });
  }
  return out;
}

/** One declarative effect applied to a block, with typed params. */
export interface BlockEffectConfig {
  effect:  string;                                  // EffectDefinition id
  params?: Readonly<Record<string, string | number>>;
}

/** A named, reusable set of effects (the managed library entry). */
export interface EffectSet {
  id:           string;
  key:          string;
  name:         string;
  description?: string;
  slots?:       readonly string[];
  effects:      readonly BlockEffectConfig[];
}

/**
 * How a block points at effects: a named set key and/or inline effects, with an
 * optional `disabled` kill-switch (turns effects off for this block regardless
 * of the tenant default / set).
 */
export interface BlockEffectRef {
  effectSet?: string;
  effects?:   readonly BlockEffectConfig[];
  disabled?:  boolean;
}

/**
 * Resolve the effective effect list for a block across the four tiers.
 *
 * Whole-tier precedence (highest wins, no per-effect merge, so behaviour is
 * predictable): instance inline effects → instance named set → block-type
 * default → tenant default. A `disabled: true` on the block ref (the instance
 * tier) turns everything off — it is the kill-switch and wins over every default.
 * Unknown effect ids are dropped.
 *
 * `blockTypeDefault` is the per-block-type default (design.blockTypeEffects,
 * keyed by block type), sitting between the instance ref and the tenant-wide
 * default. Pass null/undefined when a type has no default.
 */
export function resolveBlockEffects(
  ref: BlockEffectRef | null | undefined,
  sets: readonly EffectSet[] | null | undefined,
  blockTypeDefault?: readonly BlockEffectConfig[] | null,
  tenantDefault?: readonly BlockEffectConfig[] | null,
): BlockEffectConfig[] {
  if (ref?.disabled) return [];

  const inline = ref?.effects && ref.effects.length > 0 ? ref.effects : undefined;
  const named =
    ref?.effectSet && sets ? sets.find((s) => s.key === ref.effectSet)?.effects : undefined;
  const typeDefault = blockTypeDefault && blockTypeDefault.length > 0 ? blockTypeDefault : undefined;
  const chosen = inline ?? named ?? typeDefault ?? tenantDefault ?? [];

  // Drop unknown ids and de-duplicate by effect id (first occurrence wins).
  const seen = new Set<string>();
  const out: BlockEffectConfig[] = [];
  for (const c of chosen) {
    if (!c || typeof c.effect !== "string" || !isKnownEffect(c.effect)) continue;
    if (seen.has(c.effect)) continue;
    seen.add(c.effect);
    out.push(c);
  }
  return out;
}

/** True when a ref (with sets / block-type default / tenant default) resolves to at least one effect. */
export function hasEffects(
  ref: BlockEffectRef | null | undefined,
  sets: readonly EffectSet[] | null | undefined,
  blockTypeDefault?: readonly BlockEffectConfig[] | null,
  tenantDefault?: readonly BlockEffectConfig[] | null,
): boolean {
  return resolveBlockEffects(ref, sets, blockTypeDefault, tenantDefault).length > 0;
}

export interface EffectAttrs {
  className: string;
  style:     Record<string, string>;
  /** data-* attributes for the wrapper (runtime hooks). */
  data:      Record<string, string>;
}

function clampParam(def: EffectDefinition, key: string, raw: string | number): string | null {
  const p = def.params?.find((x) => x.key === key);
  if (!p) return null;
  if (p.type === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return null;
    const lo = p.min ?? -Infinity, hi = p.max ?? Infinity;
    const clamped = Math.min(hi, Math.max(lo, n));
    return `${clamped}${p.unit ?? ""}`;
  }
  // select
  const v = String(raw);
  return p.options?.some((o) => o.value === v) ? v : null;
}

/**
 * Turn a resolved effect list into the wrapper's className / style / data-*.
 *
 *  - className: `mc-fx` plus `mc-fx-<id>` per effect (the CSS hooks).
 *  - style: each param's CSS custom property (clamped to its declared range).
 *  - data: `data-mc-fx="1"` + `data-mc-fx-v=<version>` so the versioned runtime
 *    can find and play scroll/hover effects. `data-mc-fx-trigger` lists the
 *    triggers present so the runtime can skip observing hover-only blocks.
 */
export function effectsToAttrs(effects: readonly BlockEffectConfig[]): EffectAttrs | null {
  if (!effects || effects.length === 0) return null;

  const classes = ["mc-fx"];
  const style: Record<string, string> = {};
  const triggers = new Set<string>();

  for (const cfg of effects) {
    const def = effectDefinition(cfg.effect);
    if (!def) continue;
    classes.push(`mc-fx-${def.id}`);
    triggers.add(def.trigger);
    // Fill defaults first, then override with provided, valid params.
    for (const p of def.params ?? []) {
      if (p.cssVar) style[p.cssVar] = `${p.default}${p.type === "number" ? (p.unit ?? "") : ""}`;
    }
    for (const [k, raw] of Object.entries(cfg.params ?? {})) {
      const p = def.params?.find((x) => x.key === k);
      if (!p?.cssVar) continue;
      const val = clampParam(def, k, raw);
      if (val !== null) style[p.cssVar] = val;
    }
  }

  if (classes.length === 1) return null; // no known effects

  const ids = classes.slice(1).map((c) => c.replace(/^mc-fx-/, ""));

  return {
    className: classes.join(" "),
    style,
    data: {
      "data-mc-fx": "1",
      "data-mc-fx-v": String(EFFECT_SCHEMA_VERSION),
      "data-mc-fx-trigger": [...triggers].join(" "),
      // Space-separated effect ids, so the versioned runtime can branch per
      // effect (entrance reveal vs continuous parallax/sticky/Ken Burns).
      "data-mc-fx-ids": ids.join(" "),
    },
  };
}
