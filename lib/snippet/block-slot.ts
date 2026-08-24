/**
 * Server-side construction of a block-mode slot for POST /api/snippet/decide.
 *
 * A variant that opts into render mode "block" (see docs/design/snippet-render-modes.md)
 * carries authored `blockHtml` plus a block token ref. This turns that into the
 * BlockSlot wire value the browser snippet applies: it injects the HTML into a
 * `data-mc-block` container and sets the tokens via style.setProperty, so every
 * `var(--…)` inside the block HTML resolves to the tenant's design tokens.
 *
 * Only CSS custom properties (the `--*` keys) are forwarded. blockTokensToStyle
 * also emits a couple of camelCase React props (e.g. backgroundColor); those are
 * meaningless to setProperty and are dropped here.
 */

import {
  resolveBlockTokens,
  blockTokensToStyle,
}                          from "@/design-system/theme/block-token-set";
import type { BlockTokenRef } from "@/design-system/theme/block-token-set";
import type { BlockSlot }      from "@/lib/snippet/decide-response";
import {
  resolveBlockEffects, effectsToAttrs, type BlockEffectRef, type EffectSet, type BlockEffectConfig,
} from "@/design-system/effects/effect-ref";

/**
 * Resolve a block's token ref to the CSS custom properties it drives.
 * Returns `undefined` when the ref yields no usable variables.
 */
export function cssVarsFromTokenRef(
  ref: BlockTokenRef | null | undefined,
): Record<string, string> | undefined {
  const resolved = resolveBlockTokens(ref, undefined);
  if (!resolved) return undefined;

  const style = blockTokensToStyle(resolved) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    if (key.startsWith("--") && typeof value === "string" && value.trim()) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Build a block-mode slot value from authored HTML + a token ref.
 * `tokens` is omitted entirely when the ref produces none, keeping the payload
 * lean (and the snippet's token loop simply does nothing).
 */
export function toBlockSlot(
  html: string,
  ref?: BlockTokenRef | null,
  effectRef?: BlockEffectRef | null,
  effectSets?: readonly EffectSet[] | null,
  blockTypeDefault?: readonly BlockEffectConfig[] | null,
  defaultEffects?: readonly BlockEffectConfig[] | null,
): BlockSlot {
  const tokens = cssVarsFromTokenRef(ref);
  const slot: BlockSlot = { mode: "block", html };
  if (tokens) slot.tokens = tokens;

  const attrs = effectsToAttrs(resolveBlockEffects(effectRef, effectSets, blockTypeDefault, defaultEffects));
  if (attrs) {
    slot.fx = {
      className: attrs.className,
      ...(Object.keys(attrs.style).length > 0 ? { style: attrs.style } : {}),
      data: attrs.data,
    };
  }
  return slot;
}
