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
 *   adaptive block may carry its own set of token overrides. Because the
 *   overrides are emitted as the SAME CSS custom properties — just on a wrapper
 *   element around one block instead of on `[data-site]` — CSS inheritance does
 *   all the work. No block component needs to change.
 *
 * ─── The two ingredients ─────────────────────────────────────────────────────
 *
 *   1. Reusable NAMED sets  (BlockTokenSet)  — defined once per tenant, in
 *      `design.blockTokenSets`, and referenced by many blocks by `key`.
 *   2. Inline PER-BLOCK tweaks (CuratedBlockTokens) — tokens set directly on one
 *      block, layered ON TOP of the named set it references.
 *
 * ─── Data-driven field metadata ──────────────────────────────────────────────
 *
 *   BLOCK_TOKEN_GROUPS is the single source of truth: it lists every settable
 *   field, its editor kind, and the concrete CSS variable(s) it drives. The
 *   resolver, the admin editor, the adaptive-block drawer and the server-side
 *   validator all derive from it, so adding a token is a one-line change.
 */

import type { CSSProperties } from "react";
import { type BlockSurface, resolveSurface } from "@/lib/surface";
import { contrastRatio, readableText } from "@/lib/color";

// ── Curated token surface ──────────────────────────────────────────────────────

/**
 * The design tokens that can be overridden at the block level. Every field is
 * optional — omitted fields inherit the site-wide value. Grouped conceptually by
 * BLOCK_TOKEN_GROUPS below.
 */
export interface CuratedBlockTokens {
  // Surface & background
  surface?:            BlockSurface;
  background?:         string;
  bgSubtle?:           string;

  // Text
  text?:               string;
  textMuted?:          string;
  textSubtle?:         string;
  textInverse?:        string;

  // Borders
  border?:             string;
  borderStrong?:       string;

  // Primary / accent
  primary?:            string;
  primaryHover?:       string;
  primaryActive?:      string;
  primarySubtle?:      string;
  primaryText?:        string;
  textBrand?:          string;
  ring?:               string;

  // Buttons
  btnBg?:              string;
  btnText?:            string;
  btnHoverBg?:         string;
  btnActiveBg?:        string;
  btnRadius?:          string;
  btnFontWeight?:      string;
  btnShadow?:          string;

  // Cards
  cardBg?:             string;
  cardBorder?:         string;
  cardRadius?:         string;
  cardShadow?:         string;
  cardQuote?:          string;

  // Radius
  radiusInteractive?:  string;
  radiusPopover?:      string;

  // Typography
  headingFont?:        string;
  headingWeight?:      string;
  subheadingWeight?:   string;
  fontSans?:           string;
  fontSerif?:          string;
  headingTracking?:    string;

  // Hero
  heroBg?:             string;
  heroTitleColor?:     string;
  heroSubtitleColor?:  string;
  heroGlowColor?:      string;
  heroGlowOpacity?:    string;

  // Proof / testimonials
  proofBg?:            string;
  proofCardBg?:        string;
  proofCardBorder?:    string;
  proofQuoteColor?:    string;

  // Feature grid
  featureGridBg?:         string;
  featureGridCardBg?:     string;
  featureGridCardBorder?: string;
  featureGridIconBg?:     string;

  // CTA section
  ctaBg?:              string;
  ctaBodyText?:        string;
  ctaButtonBg?:        string;
  ctaButtonText?:      string;

  // Dividers
  dividerColor?:       string;
  dividerWidth?:       string;

  // Motion
  transitionBase?:     string;
}

// ── Field metadata (single source of truth) ─────────────────────────────────────

export type BlockTokenFieldKind = "color" | "surface" | "text";

export interface BlockTokenFieldDef {
  key:          keyof CuratedBlockTokens;
  label:        string;
  kind:         BlockTokenFieldKind;
  /** CSS custom properties this field writes. */
  vars:         readonly string[];
  placeholder?: string;
  /** When true (background/surface), also paint the wrapper's backgroundColor. */
  paintBackground?: boolean;
}

export interface BlockTokenGroup {
  title:  string;
  fields: readonly BlockTokenFieldDef[];
}

export const BLOCK_TOKEN_GROUPS: readonly BlockTokenGroup[] = [
  {
    title: "Surface & background",
    fields: [
      { key: "surface",    label: "Surface role", kind: "surface", vars: ["--bg"], paintBackground: true },
      { key: "background", label: "Background",   kind: "color",   vars: ["--bg"], paintBackground: true },
      { key: "bgSubtle",   label: "Subtle background", kind: "color", vars: ["--bg-subtle", "--section-subtle-bg"] },
    ],
  },
  {
    title: "Text",
    fields: [
      { key: "text",        label: "Text",        kind: "color", vars: ["--text", "--foreground", "--card-foreground", "--popover-foreground"] },
      { key: "textMuted",   label: "Muted text",  kind: "color", vars: ["--text-muted", "--muted-foreground"] },
      { key: "textSubtle",  label: "Subtle text", kind: "color", vars: ["--text-subtle"] },
      { key: "textInverse", label: "Inverse text", kind: "color", vars: ["--text-inverse"] },
    ],
  },
  {
    title: "Borders",
    fields: [
      { key: "border",       label: "Border",        kind: "color", vars: ["--border"] },
      { key: "borderStrong", label: "Strong border", kind: "color", vars: ["--border-strong"] },
    ],
  },
  {
    title: "Primary / accent",
    fields: [
      { key: "primary",       label: "Primary",        kind: "color", vars: ["--primary"] },
      { key: "primaryHover",  label: "Primary hover",  kind: "color", vars: ["--primary-hover"] },
      { key: "primaryActive", label: "Primary active", kind: "color", vars: ["--primary-active"] },
      { key: "primarySubtle", label: "Primary subtle", kind: "color", vars: ["--primary-subtle", "--badge-primary-bg", "--btn-secondary-bg"] },
      { key: "primaryText",   label: "On-primary text", kind: "color", vars: ["--primary-text"] },
      { key: "textBrand",     label: "Brand text",     kind: "color", vars: ["--text-brand", "--badge-primary-text", "--btn-secondary-text"] },
      { key: "ring",          label: "Focus ring",     kind: "color", vars: ["--ring"] },
    ],
  },
  {
    title: "Buttons",
    fields: [
      { key: "btnBg",         label: "Button bg",       kind: "color", vars: ["--btn-bg"] },
      { key: "btnText",       label: "Button text",     kind: "color", vars: ["--btn-text"] },
      { key: "btnHoverBg",    label: "Button hover bg", kind: "color", vars: ["--btn-hover-bg"] },
      { key: "btnActiveBg",   label: "Button active bg", kind: "color", vars: ["--btn-active-bg"] },
      { key: "btnRadius",     label: "Button radius",   kind: "text",  vars: ["--btn-radius"], placeholder: "8px" },
      { key: "btnFontWeight", label: "Button weight",   kind: "text",  vars: ["--btn-font-weight"], placeholder: "600" },
      { key: "btnShadow",     label: "Button shadow",   kind: "text",  vars: ["--btn-shadow"], placeholder: "0 1px 2px rgba(0,0,0,.05)" },
    ],
  },
  {
    title: "Cards",
    fields: [
      { key: "cardBg",     label: "Card bg",     kind: "color", vars: ["--card-bg"] },
      { key: "cardBorder", label: "Card border", kind: "color", vars: ["--card-border"] },
      { key: "cardRadius", label: "Card radius", kind: "text",  vars: ["--card-radius", "--radius-card"], placeholder: "12px" },
      { key: "cardShadow", label: "Card shadow", kind: "text",  vars: ["--card-shadow"], placeholder: "0 1px 2px rgba(0,0,0,.05)" },
      { key: "cardQuote",  label: "Quote accent", kind: "color", vars: ["--card-quote"] },
    ],
  },
  {
    title: "Radius",
    fields: [
      { key: "radiusInteractive", label: "Interactive radius", kind: "text", vars: ["--radius-interactive"], placeholder: "8px" },
      { key: "radiusPopover",     label: "Popover radius",     kind: "text", vars: ["--radius-popover"], placeholder: "12px" },
    ],
  },
  {
    title: "Typography",
    fields: [
      { key: "headingFont",      label: "Heading font",   kind: "text", vars: ["--font-heading"], placeholder: "'Poppins', sans-serif" },
      { key: "headingWeight",    label: "Heading weight", kind: "text", vars: ["--font-heading-weight"], placeholder: "700" },
      { key: "subheadingWeight", label: "Subheading weight", kind: "text", vars: ["--font-subheading-weight"], placeholder: "600" },
      { key: "headingTracking",  label: "Heading tracking", kind: "text", vars: ["--block-heading-tracking"], placeholder: "-0.01em" },
      { key: "fontSans",         label: "Body font",      kind: "text", vars: ["--font-sans"], placeholder: "'Inter', system-ui, sans-serif" },
      { key: "fontSerif",        label: "Serif font",     kind: "text", vars: ["--font-serif"], placeholder: "'Georgia', serif" },
    ],
  },
  {
    title: "Hero",
    fields: [
      { key: "heroBg",            label: "Hero bg",        kind: "color", vars: ["--hero-bg", "--section-hero-bg"] },
      { key: "heroTitleColor",    label: "Hero title",     kind: "color", vars: ["--hero-title-color"] },
      { key: "heroSubtitleColor", label: "Hero subtitle",  kind: "color", vars: ["--hero-subtitle-color"] },
      { key: "heroGlowColor",     label: "Hero glow",      kind: "color", vars: ["--hero-glow-color"] },
      { key: "heroGlowOpacity",   label: "Hero glow opacity", kind: "text", vars: ["--hero-glow-opacity"], placeholder: "0.2" },
    ],
  },
  {
    title: "Proof / testimonials",
    fields: [
      { key: "proofBg",         label: "Proof bg",         kind: "color", vars: ["--proof-bg"] },
      { key: "proofCardBg",     label: "Proof card bg",    kind: "color", vars: ["--proof-card-bg"] },
      { key: "proofCardBorder", label: "Proof card border", kind: "color", vars: ["--proof-card-border"] },
      { key: "proofQuoteColor", label: "Proof quote",      kind: "color", vars: ["--proof-quote-color"] },
    ],
  },
  {
    title: "Feature grid",
    fields: [
      { key: "featureGridBg",         label: "Feature bg",       kind: "color", vars: ["--feature-grid-bg"] },
      { key: "featureGridCardBg",     label: "Feature card bg",  kind: "color", vars: ["--feature-grid-card-bg"] },
      { key: "featureGridCardBorder", label: "Feature card border", kind: "color", vars: ["--feature-grid-card-border"] },
      { key: "featureGridIconBg",     label: "Feature icon bg",  kind: "color", vars: ["--feature-grid-icon-bg"] },
    ],
  },
  {
    title: "CTA section",
    fields: [
      { key: "ctaBg",         label: "CTA bg",          kind: "color", vars: ["--section-cta-bg"] },
      { key: "ctaBodyText",   label: "CTA text",        kind: "color", vars: ["--section-cta-body"] },
      { key: "ctaButtonBg",   label: "CTA button bg",   kind: "color", vars: ["--cta-button-bg"] },
      { key: "ctaButtonText", label: "CTA button text", kind: "color", vars: ["--cta-button-text"] },
    ],
  },
  {
    title: "Dividers & motion",
    fields: [
      { key: "dividerColor",   label: "Divider colour", kind: "color", vars: ["--block-divider-color"] },
      { key: "dividerWidth",   label: "Divider width",  kind: "text",  vars: ["--block-divider-width"], placeholder: "1px" },
      { key: "transitionBase", label: "Transition",     kind: "text",  vars: ["--transition-base"], placeholder: "150ms ease" },
    ],
  },
] as const;

/** Flat list of every settable field definition. */
export const BLOCK_TOKEN_FIELDS: readonly BlockTokenFieldDef[] =
  BLOCK_TOKEN_GROUPS.flatMap((g) => g.fields);

/** Every curated field key (used by the server-side validator to strip unknowns). */
export const CURATED_TOKEN_KEYS: readonly (keyof CuratedBlockTokens)[] =
  BLOCK_TOKEN_FIELDS.map((f) => f.key);

export const VALID_SURFACE_ROLES: readonly BlockSurface[] =
  ["default", "subtle", "emphasis", "strong", "inverse"];

// ── Named, reusable set ─────────────────────────────────────────────────────────

/** A named, reusable bundle of curated token overrides (design.blockTokenSets). */
/** Adaptive slot types a block token set can be scoped to. */
export const BLOCK_TOKEN_SET_SLOTS = ["hero", "proof", "cta", "feature", "conversion", "notification"] as const;
export type BlockTokenSetSlot = (typeof BLOCK_TOKEN_SET_SLOTS)[number];

export interface BlockTokenSet {
  id:           string;
  key:          string;
  name:         string;
  description?: string;
  /**
   * Optional block-type scope. When set, this token set is only offered in the
   * block editor for these slot types (e.g. ["hero"]). When absent or empty, the
   * set applies to any block type.
   */
  slots?:       readonly string[];
  tokens:       CuratedBlockTokens;
}

/** How a block points at block-level styling: a named set + optional inline tweaks. */
export interface BlockTokenRef {
  tokenSet?: string;
  tokens?:   CuratedBlockTokens;
}

// ── Resolution ──────────────────────────────────────────────────────────────────

/**
 * Merge a named set (looked up by key) with inline per-block tweaks. Inline
 * wins. Returns the effective curated tokens, or undefined when empty.
 */
export function resolveBlockTokens(
  ref: BlockTokenRef | null | undefined,
  sets: readonly BlockTokenSet[] | null | undefined,
): CuratedBlockTokens | undefined {
  if (!ref) return undefined;
  const named =
    ref.tokenSet && sets ? sets.find((s) => s.key === ref.tokenSet)?.tokens : undefined;
  const merged: CuratedBlockTokens = { ...(named ?? {}), ...(ref.tokens ?? {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Map curated tokens to the concrete CSS custom properties they drive, using
 * BLOCK_TOKEN_FIELDS metadata. Returns a React style object whose keys are CSS
 * variables — apply it to a wrapper and every var(--…) inside inherits.
 */
export function blockTokensToStyle(
  tokens: CuratedBlockTokens | null | undefined,
): CSSProperties {
  const style: Record<string, string> = {};
  if (!tokens) return style;

  // Background: surface role wins over an explicit colour, and both paint the
  // wrapper element so the block sits on the chosen surface.
  const surfaceBg = resolveSurface(tokens.surface);
  const bg = surfaceBg ?? tokens.background;
  if (bg) {
    style["--bg"] = bg;
    style["backgroundColor"] = bg;
  }

  for (const field of BLOCK_TOKEN_FIELDS) {
    if (field.key === "surface" || field.key === "background") continue; // handled above
    const value = tokens[field.key];
    if (typeof value !== "string" || !value.trim()) continue;
    for (const cssVar of field.vars) style[cssVar] = value;
  }

  // Secondary-button readability: when this scope sets both the secondary tint
  // (--btn-secondary-bg, from primarySubtle) and its brand text
  // (--btn-secondary-text, from textBrand), keep the brand text only while it
  // stays legible on the tint (>= 4.5:1), else flip to a readable colour. This
  // mirrors the theme-path derivation at the block-token layer, so the more-
  // specific site-default block scope does not re-introduce a light-on-light
  // button on top of the theme-var fix. Only acts on measurable hex values.
  const secBg = style["--btn-secondary-bg"];
  const secText = style["--btn-secondary-text"];
  if (typeof secBg === "string" && typeof secText === "string") {
    const ratio = contrastRatio(secText, secBg);
    if (ratio !== null && ratio < 4.5) style["--btn-secondary-text"] = readableText(secBg);
  }

  return style as CSSProperties;
}

/** One-shot: resolve a block's ref against named sets and return the style, or undefined. */
export function resolveBlockTokenStyle(
  ref: BlockTokenRef | null | undefined,
  sets: readonly BlockTokenSet[] | null | undefined,
): CSSProperties | undefined {
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
