/**
 * BlockEffectScope
 *
 * Wraps a single block in an element carrying its declarative effect classes,
 * param CSS custom properties, and the data-* hooks the versioned client runtime
 * reads. Mirrors BlockThemeScope (which does the same for design tokens).
 *
 * Server component: no hooks. Renders a plain wrapper only when the block
 * actually resolves to at least one effect, otherwise returns children untouched
 * so the DOM stays flat in the common case. The wrapper is display:contents-free
 * (a real box) because entrance transforms need a transformable element; that is
 * acceptable here because effects are opt-in per block.
 */

import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import {
  type BlockEffectRef,
  type EffectSet,
  type BlockEffectConfig,
  resolveBlockEffects,
  effectsToAttrs,
} from "@/design-system/effects/effect-ref";

interface BlockEffectScopeProps {
  effectRef?:        BlockEffectRef | null;
  sets?:             readonly EffectSet[] | null;
  /** Per-block-type default (design.blockTypeEffects), the tier below the instance ref. */
  blockTypeDefault?: readonly BlockEffectConfig[] | null;
  tenantDefault?:    readonly BlockEffectConfig[] | null;
  scopeId?:          string;
  children:          ReactNode;
}

export function BlockEffectScope({ effectRef, sets, blockTypeDefault, tenantDefault, scopeId, children }: BlockEffectScopeProps) {
  const effects = resolveBlockEffects(effectRef, sets, blockTypeDefault, tenantDefault);
  const attrs = effectsToAttrs(effects);
  if (!attrs) return <>{children}</>;
  return (
    <div className={attrs.className} style={attrs.style as CSSProperties} data-block-fx={scopeId ?? ""} {...attrs.data}>
      {children}
    </div>
  );
}
