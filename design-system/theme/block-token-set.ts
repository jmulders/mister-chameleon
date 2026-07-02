/**
 * Block-level token sets — per-component design tokens.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 *   The tenant theme (tenant-theme.ts) emits ~100 CSS custom properties scoped
 *   to `[data-site]`, and every block consumes them through `var(--…)`. That is
 *   site-wide: one palette for the whole tenant.
 *
 *   This module adds a SECOND, narrower scope: an individual content block or
 *   adaptive block may carry its own small set of token overrides. Because the
 *   overrides are emitted as the SAME CSS custom properties — just on a wrapper
 *   element around one block instead of on `[data-site]` — CSS inheritance does
 *   all the work. No block component needs to change: a block that reads
 *   `var(--primary)` automatically picks up a block-scoped `--primary` when one
 *   is present, and falls back to the site value otherwise.
 *
 * ─── The two ingredients ─────────────────────────────────────────────────────
 *
 *   1. Reusable NAMED sets  (BlockTokenSet)  — defined once per tenant, in
 *      `design.blockTokenSets`, and referenced by many blocks by `key`.
 *   2. Inline PER-BLOCK tweaks (CuratedBlockTokens) — a handful of tokens set
 *      directly on one block, layered ON TOP of the named set it references.
 *
 *   A block carries a BlockTokenRef = { tokenSet?, tokens? }. Resolution merges
 *   the named set (if any) first, then the inline tweaks (which win).
 *
 * ─── Curated, not exhaustive ─────────────────────────────────────────────────
 *
 *   Only the meaningful, high-impact tokens are exposed per block (background /
 *   surface, text, primary/accent, card bg/border/radius, heading font/weight,
 *   section dividers). Each curated field fans out to one or more real CSS vars
 *   from tenant-theme.ts, keeping the editing surface small while still
 *   restyling everything inside the block coherently.
 */

import type { CSSProperties } from "react";
import { type BlockSurface, resolveSurface } from "@/lib/surface";

// ── Curated token surface ──────────────────────────────────────────────────────

/**
 * The subset of design tokens that can be overridden at the block level.
 * Every field is optional — omitted fields inherit the site-wide value.
 */
export interface CuratedBlockTokens {
  /**
   * Semantic background of the block. Choose one of the five surface roles
   * (maps to the site palette) rather than a raw colour, mirroring BlockSurface.
   * When set, it wins over `background`.
   */
  surface?: BlockSurface;
  /** Explicit background colour for the block. Sets --bg (+ wrapper background). */
  background?: string;
  /** Body text colour inside the block. Sets --text / --foreground. */
  text?: string;
  /** Muted / secondary text colour. Sets --text-muted / --muted-foreground. */
  textMuted?: string;
  /** Primary / accent colour. Sets --primary, --btn-bg, --text-brand. */
  primary?: string;
  /** Text on primary-coloured surfaces (buttons). Sets --primary-text / --btn-text. */
  primaryText?: string;
  /** Card / panel background inside the block. Sets --card-bg. */
  cardBg?: string;
  /** Card / panel border colour. Sets --card-border. */
  cardBorder?: string;
  /** Card / panel corner radius (any CSS length). Sets --card-radius / --radius-card. */
  cardRadius?: string;
  /** Heading font-family stack. Sets --font-heading. */
  headingFont?: string;
  /** Heading font-weight ("400"…"800"). Sets --font-heading-weight. */
  headingWeight?: string;
  /** Section divider colour. Sets --block-divider-color. */
  dividerColor?: string;
  /** Section divider width (e.g. "1px", "2px"). Sets --block-divider-width. */
  dividerWidth?: string;
}

/** The curated field keys, exposed for building editor UIs. */
export const CURATED_TOKEN_KEYS = [
  "surface",
  "background",
  "text",
  "textMuted",
  "primary",
  "primaryText",
  "cardBg",
  "cardBorder",
  "cardRadius",
  "headingFont",
  "headingWeight",
  "dividerColor",
  "dividerWidth",
] as const satisfies readonly (keyof CuratedBlockTokens)[];

// ── Named, reusable set ─────────────────────────────────────────────────────────

/**
 * A named, reusable bundle of curated token overrides, stored per tenant in
 * `design.blockTokenSets`. Blocks reference it by `key`.
 */
export interface BlockTokenSet {
  /** Stable identifier (never shown; survives renames). */
  id: string;
  /** Slug used by blocks to reference this set (unique per tenant). */
  key: string;
  /** Human-readable name shown in the editor (e.g. "Dark section", "Highlight"). */
  name: string;
  /** Optional one-line description of when to use this set. */
  description?: string;
  /** The token overrides this set applies. */
  tokens: CuratedBlockTokens;
}

/**
 * How a single block points at block-level styling: an optional named set
 * (by key) plus optional inline tweaks that layer on top of it.
 */
export interface BlockTokenRef {
  /** Key of a named BlockTokenSet to apply (from design.blockTokenSets). */
  tokenSet?: string;
  /** Inline per-block overrides, applied ON TOP of the named set. */
  tokens?: CuratedBlockTokens;
}

// ── Resolution ──────────────────────────────────────────────────────────────────

/**
 * Merge a named set (looked up by key) with inline per-block tweaks.
 * Inline tweaks win. Returns the effective curated tokens, or `undefined`
 * when the ref contributes nothing.
 */
export function resolveBlockTokens(
  ref: BlockTokenRef | null | undefined,
  sets: readonly BlockTokenSet[] | null | undefined,
): CuratedBlockTokens | undefined {
  if (!ref) return undefined;

  const named =
    ref.tokenSet && sets
      ? sets.find((s) => s.key === ref.tokenSet)?.tokens
      : undefined;

  const merged: CuratedBlockTokens = { ...(named ?? {}), ...(ref.tokens ?? {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Map curated tokens to the concrete CSS custom properties they drive.
 * Returns a React style object whose keys are CSS variables — apply it to a
 * wrapper element and every `var(--…)` inside inherits the override.
 */
export function blockTokensToStyle(
  tokens: CuratedBlockTokens | null | undefined,
): CSSProperties {
  const style: Record<string, string> = {};
  if (!tokens) return style;

  // Background: surface role wins over an explicit colour.
  const surfaceBg = resolveSurface(tokens.surface);
  const bg = surfaceBg ?? tokens.background;
  if (bg) {
    style["--bg"] = bg;
    // Paint the wrapper itself so the block sits on the chosen surface even
    // if its root element doesn't reference var(--bg) directly.
    style["backgroundColor"] = bg;
  }

  if (tokens.text) {
    style["--text"] = tokens.text;
    style["--foreground"] = tokens.text;
    style["--card-foreground"] = tokens.text;
  }
  if (tokens.textMuted) {
    style["--text-muted"] = tokens.textMuted;
    style["--muted-foreground"] = tokens.textMuted;
  }
  if (tokens.primary) {
    style["--primary"] = tokens.primary;
    style["--btn-bg"] = tokens.primary;
    style["--text-brand"] = tokens.primary;
  }
  if (tokens.primaryText) {
    style["--primary-text"] = tokens.primaryText;
    style["--btn-text"] = tokens.primaryText;
  }
  if (tokens.cardBg) style["--card-bg"] = tokens.cardBg;
  if (tokens.cardBorder) style["--card-border"] = tokens.cardBorder;
  if (tokens.cardRadius) {
    style["--card-radius"] = tokens.cardRadius;
    style["--radius-card"] = tokens.cardRadius;
  }
  if (tokens.headingFont) style["--font-heading"] = tokens.headingFont;
  if (tokens.headingWeight) style["--font-heading-weight"] = tokens.headingWeight;
  if (tokens.dividerColor) style["--block-divider-color"] = tokens.dividerColor;
  if (tokens.dividerWidth) style["--block-divider-width"] = tokens.dividerWidth;

  return style as CSSProperties;
}

/**
 * One-shot: resolve a block's ref against the tenant's named sets and return
 * the CSS-var style object, or `undefined` when there is nothing to apply.
 */
export function resolveBlockTokenStyle(
  ref: BlockTokenRef | null | undefined,
  sets: readonly BlockTokenSet[] | null | undefined,
): React.CSSProperties | undefined {
  const tokens = resolveBlockTokens(ref, sets);
  if (!tokens) return undefined;
  const style = blockTokensToStyle(tokens);
  return Object.keys(style).length > 0 ? style : undefined;
}

/** True when a ref will actually produce a scoped style (has set or tweaks). */
export function hasBlockTokens(ref: BlockTokenRef | null | undefined): boolean {
  if (!ref) return false;
  return Boolean(ref.tokenSet) || Boolean(ref.tokens && Object.keys(ref.tokens).length > 0);
}
