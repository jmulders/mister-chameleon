/**
 * BlockThemeScope
 *
 * Wraps a single block in an element that carries block-level design tokens as
 * scoped CSS custom properties. Because those properties are the SAME variables
 * the site theme emits on `[data-site]`, CSS inheritance means every `var(--…)`
 * inside the wrapped block resolves to the block-scoped value first, falling
 * back to the site value when the block doesn't override it.
 *
 * This is a server component (no hooks, no client state) — it renders a plain
 * wrapper `<div>` only when the block actually contributes a style, and returns
 * the children untouched otherwise so the DOM stays flat in the common case.
 *
 * The `data-block-scope` attribute is emitted purely as a debugging/inspection
 * aid — it has no styling effect.
 */

import type { ReactNode } from "react";
import {
  type BlockTokenRef,
  type BlockTokenSet,
  resolveBlockTokenStyle,
} from "@/design-system/theme/block-token-set";

interface BlockThemeScopeProps {
  /** The block's token reference (named set key and/or inline overrides). */
  tokenRef?: BlockTokenRef | null;
  /** The tenant's named token sets, used to resolve `tokenRef.tokenSet`. */
  sets?: readonly BlockTokenSet[] | null;
  /** Optional id echoed onto the wrapper for inspection. */
  scopeId?: string;
  children: ReactNode;
}

export function BlockThemeScope({ tokenRef, sets, scopeId, children }: BlockThemeScopeProps) {
  const style = resolveBlockTokenStyle(tokenRef, sets);
  if (!style) return <>{children}</>;
  return (
    <div data-block-scope={scopeId ?? ""} style={style}>
      {children}
    </div>
  );
}
