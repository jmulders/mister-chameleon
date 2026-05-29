/**
 * Supported Google Fonts — client-safe metadata
 *
 * Pure data module: no next/font/google imports, safe for "use client" files.
 *
 * ─── Why this file exists ────────────────────────────────────────────────────
 *
 *   lib/fonts.ts handles actual font loading via next/font/google and is
 *   server-only (next/font instances must be created at module scope in a
 *   server context).  This companion file exports the same font metadata as
 *   plain JavaScript data so client components — such as DesignTokenEditor —
 *   can display the supported font list, render clickable font pickers, and
 *   populate font stack inputs, without pulling in next/font/google.
 *
 * ─── How the two files relate ────────────────────────────────────────────────
 *
 *   lib/fonts.ts          → server-only. Loads fonts via next/font/google,
 *                           exports ALL_FONT_VARIABLES and resolveGoogleFontCss().
 *                           Used by app/layout.tsx to inject Layer C overrides.
 *
 *   lib/supported-fonts.ts → this file. Client-safe metadata only.
 *                            Used by DesignTokenEditor and any other client
 *                            component that needs to know which fonts exist.
 *
 * ─── Curated vs advanced fonts ───────────────────────────────────────────────
 *
 *   Every font entry carries a `curated` boolean.
 *
 *   curated: true   18 hand-picked fonts that cover every common use-case and
 *                   aesthetic direction.  Shown by default in the admin picker
 *                   so normal users face a clear, high-quality selection.
 *
 *   curated: false  The remaining 25 fonts are fully supported and pre-loaded —
 *                   they are simply hidden behind an "More fonts" toggle in the
 *                   picker UI to avoid overwhelming less technical users.  Power
 *                   users can always reveal and select them.
 *
 *   Curated breakdown (18 total):
 *     Sans     8  — Inter, Plus Jakarta Sans, DM Sans, Figtree,
 *                   Open Sans, Work Sans, Manrope, Poppins
 *     Serif    4  — Playfair Display, Lora, Merriweather, Source Serif 4
 *     Display  3  — Oswald, Barlow Condensed, Bebas Neue
 *     Mono     3  — JetBrains Mono, Fira Code, Source Code Pro
 *
 * ─── Adding a new supported font ─────────────────────────────────────────────
 *
 *   1. Add a font instance in lib/fonts.ts (next/font/google import + instance).
 *   2. Add the .variable to ALL_FONT_VARIABLES in lib/fonts.ts.
 *   3. Add a lowercase entry to GOOGLE_FONT_MAP in lib/fonts.ts.
 *   4. Add the corresponding entry to SUPPORTED_GOOGLE_FONTS below.
 *      Set `curated: true` only for fonts that genuinely belong in the
 *      default, opinionated selection.
 *
 *   Keep the lowercase `name` key in sync with the GOOGLE_FONT_MAP key in
 *   lib/fonts.ts so resolveGoogleFontCss() resolves the same name at runtime.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Category determines which font roles a font is suitable for. */
export type FontCategory = "sans-serif" | "serif" | "display" | "monospace";

export interface SupportedGoogleFont {
  /** Display name as shown in the picker, e.g. "Inter". */
  name: string;
  /**
   * Recommended CSS font-family stack to write into the font token field.
   * Always starts with the Google Font name (quoted if it contains spaces),
   * followed by safe fallbacks appropriate for the font category.
   */
  stack: string;
  /** Font category — used to group fonts in the picker UI. */
  category: FontCategory;
  /** Brief editorial note shown on hover in the font picker. */
  description: string;
  /**
   * Whether this font is part of the hand-curated default selection.
   *
   * true  → shown immediately in the default picker view.
   * false → available in the "More fonts" advanced view; fully supported
   *         and pre-loaded, just not surfaced by default to avoid UI noise.
   */
  curated: boolean;
}

// ── Category display labels ───────────────────────────────────────────────────

/** Human-readable label for each font category, used in UI tabs. */
export const CATEGORY_LABEL: Readonly<Record<FontCategory, string>> = {
  "sans-serif": "Sans",
  "serif":      "Serif",
  "display":    "Display",
  "monospace":  "Mono",
};

// ── Supported font list ───────────────────────────────────────────────────────
//
// Must stay in sync with GOOGLE_FONT_MAP in lib/fonts.ts.
// Order controls display order in the DesignTokenEditor font picker.
//
// Within each category, curated fonts appear first so they occupy the
// top rows of the grid in both curated and advanced views.

export const SUPPORTED_GOOGLE_FONTS: readonly SupportedGoogleFont[] = [

  // ── Sans-serif: curated (shown by default) ────────────────────────────────
  //
  // 8 fonts covering the main humanist, geometric, workhorse, and personality
  // sub-groups — the best single pick for each common use-case.

  {
    name:        "Inter",
    stack:       "'Inter', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Geometric humanist — readable at all sizes. Platform default.",
    curated:     true,
  },
  {
    name:        "Plus Jakarta Sans",
    stack:       "'Plus Jakarta Sans', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Modern geometric humanist — versatile and professional.",
    curated:     true,
  },
  {
    name:        "DM Sans",
    stack:       "'DM Sans', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Low-contrast geometric — clean and modern, great for UI.",
    curated:     true,
  },
  {
    name:        "Figtree",
    stack:       "'Figtree', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Clean rounded sans — friendly and highly legible.",
    curated:     true,
  },
  {
    name:        "Open Sans",
    stack:       "'Open Sans', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Humanist sans — highly legible for body text and UI.",
    curated:     true,
  },
  {
    name:        "Work Sans",
    stack:       "'Work Sans', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Optimised for screen — clean, legible, business-appropriate.",
    curated:     true,
  },
  {
    name:        "Manrope",
    stack:       "'Manrope', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Elegant geometric — wide tracking, excellent for headings.",
    curated:     true,
  },
  {
    name:        "Poppins",
    stack:       "'Poppins', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Geometric with circular forms — modern and energetic.",
    curated:     true,
  },

  // ── Sans-serif: advanced (behind "More fonts") ────────────────────────────

  {
    name:        "Outfit",
    stack:       "'Outfit', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Rounded geometric — fresh, friendly, and modern.",
    curated:     false,
  },
  {
    name:        "Space Grotesk",
    stack:       "'Space Grotesk', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Fixed-width geometric — distinct character, tech-forward.",
    curated:     false,
  },
  {
    name:        "Urbanist",
    stack:       "'Urbanist', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Low-contrast geometric — minimal and contemporary.",
    curated:     false,
  },
  {
    name:        "Sora",
    stack:       "'Sora', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Geometric with subtle character — modern and expressive.",
    curated:     false,
  },
  {
    name:        "Roboto",
    stack:       "'Roboto', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Google's workhorse sans — familiar, neutral, professional.",
    curated:     false,
  },
  {
    name:        "Noto Sans",
    stack:       "'Noto Sans', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Universal humanist — excellent language coverage.",
    curated:     false,
  },
  {
    name:        "Source Sans 3",
    stack:       "'Source Sans 3', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Adobe's screen-optimised humanist — clean and neutral.",
    curated:     false,
  },
  {
    name:        "Cabin",
    stack:       "'Cabin', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Humanist sans — warm, approachable, and readable.",
    curated:     false,
  },
  {
    name:        "Montserrat",
    stack:       "'Montserrat', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Strong geometric personality — great for display headings.",
    curated:     false,
  },
  {
    name:        "Raleway",
    stack:       "'Raleway', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Elegant thin-to-heavy range — stylish for headers.",
    curated:     false,
  },
  {
    name:        "Rubik",
    stack:       "'Rubik', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Slightly rounded humanist — warm yet assertive.",
    curated:     false,
  },
  {
    name:        "Nunito",
    stack:       "'Nunito', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Rounded terminals — friendly, approachable, and legible.",
    curated:     false,
  },
  {
    name:        "Mulish",
    stack:       "'Mulish', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Minimalist geometric — clean and contemporary.",
    curated:     false,
  },
  {
    name:        "Lato",
    stack:       "'Lato', system-ui, sans-serif",
    category:    "sans-serif",
    description: "Semi-rounded humanist — warm yet professional.",
    curated:     false,
  },

  // ── Serif: curated ────────────────────────────────────────────────────────

  {
    name:        "Playfair Display",
    stack:       "'Playfair Display', Georgia, serif",
    category:    "serif",
    description: "High-contrast editorial — elegant and authoritative.",
    curated:     true,
  },
  {
    name:        "Lora",
    stack:       "'Lora', Georgia, serif",
    category:    "serif",
    description: "Calligraphic serif — contemporary with classic structure.",
    curated:     true,
  },
  {
    name:        "Merriweather",
    stack:       "'Merriweather', Georgia, serif",
    category:    "serif",
    description: "Screen-optimised text serif — comfortable for long-form reading.",
    curated:     true,
  },
  {
    name:        "Source Serif 4",
    stack:       "'Source Serif 4', Georgia, serif",
    category:    "serif",
    description: "Adobe's screen-optimised text serif — versatile and readable.",
    curated:     true,
  },

  // ── Serif: advanced ───────────────────────────────────────────────────────

  {
    name:        "Cormorant Garamond",
    stack:       "'Cormorant Garamond', Georgia, serif",
    category:    "serif",
    description: "Elegant display serif — ultra-refined for luxury brands.",
    curated:     false,
  },
  {
    name:        "EB Garamond",
    stack:       "'EB Garamond', Georgia, serif",
    category:    "serif",
    description: "Classic Garamond revival — timeless and literary.",
    curated:     false,
  },
  {
    name:        "Libre Baskerville",
    stack:       "'Libre Baskerville', Georgia, serif",
    category:    "serif",
    description: "Baskerville revival — traditional and highly legible.",
    curated:     false,
  },
  {
    name:        "PT Serif",
    stack:       "'PT Serif', Georgia, serif",
    category:    "serif",
    description: "Humanist text serif — designed for screen and print harmony.",
    curated:     false,
  },
  {
    name:        "Crimson Text",
    stack:       "'Crimson Text', Georgia, serif",
    category:    "serif",
    description: "Garalde old-style serif — compact and literary.",
    curated:     false,
  },
  {
    name:        "Arvo",
    stack:       "'Arvo', Georgia, serif",
    category:    "serif",
    description: "Geometric slab serif — sturdy and characterful.",
    curated:     false,
  },

  // ── Display: curated ──────────────────────────────────────────────────────

  {
    name:        "Oswald",
    stack:       "'Oswald', system-ui, sans-serif",
    category:    "display",
    description: "Condensed sans — bold and impactful for headlines.",
    curated:     true,
  },
  {
    name:        "Barlow Condensed",
    stack:       "'Barlow Condensed', system-ui, sans-serif",
    category:    "display",
    description: "Condensed grotesque — versatile and strong for display use.",
    curated:     true,
  },
  {
    name:        "Bebas Neue",
    stack:       "'Bebas Neue', system-ui, sans-serif",
    category:    "display",
    description: "All-caps condensed — maximally bold and graphic.",
    curated:     true,
  },

  // ── Display: advanced ─────────────────────────────────────────────────────

  {
    name:        "Archivo Black",
    stack:       "'Archivo Black', system-ui, sans-serif",
    category:    "display",
    description: "Black grotesque — strong and legible at large sizes.",
    curated:     false,
  },
  {
    name:        "Anton",
    stack:       "'Anton', system-ui, sans-serif",
    category:    "display",
    description: "Ultra-bold condensed — punchy poster-style headlines.",
    curated:     false,
  },
  {
    name:        "Abril Fatface",
    stack:       "'Abril Fatface', Georgia, serif",
    category:    "display",
    description: "Titling serif — ornate, dramatic, and high-impact.",
    curated:     false,
  },

  // ── Monospace: curated ────────────────────────────────────────────────────

  {
    name:        "JetBrains Mono",
    stack:       "'JetBrains Mono', 'Fira Code', monospace",
    category:    "monospace",
    description: "Developer-optimised — excellent ligatures and readability.",
    curated:     true,
  },
  {
    name:        "Fira Code",
    stack:       "'Fira Code', 'JetBrains Mono', monospace",
    category:    "monospace",
    description: "Popular programming font with ligature support.",
    curated:     true,
  },
  {
    name:        "Source Code Pro",
    stack:       "'Source Code Pro', monospace",
    category:    "monospace",
    description: "Adobe's monospace — clean and highly legible.",
    curated:     true,
  },

  // ── Monospace: advanced ───────────────────────────────────────────────────

  {
    name:        "IBM Plex Mono",
    stack:       "'IBM Plex Mono', monospace",
    category:    "monospace",
    description: "IBM's engineering mono — distinctive and readable.",
    curated:     false,
  },
  {
    name:        "Roboto Mono",
    stack:       "'Roboto Mono', monospace",
    category:    "monospace",
    description: "Monospace companion to Roboto — neutral and familiar.",
    curated:     false,
  },

] as const;

// ── Convenience exports ────────────────────────────────────────────────────────

/** Just the display names, e.g. ["Inter", "DM Sans", …]. */
export const SUPPORTED_FONT_NAMES: readonly string[] =
  SUPPORTED_GOOGLE_FONTS.map((f) => f.name);

/** All curated fonts — the default selection shown in the admin picker. */
export const CURATED_FONTS: readonly SupportedGoogleFont[] =
  SUPPORTED_GOOGLE_FONTS.filter((f) => f.curated);

/** Sans-serif fonts only (curated + advanced). */
export const SANS_SERIF_FONTS = SUPPORTED_GOOGLE_FONTS.filter(
  (f) => f.category === "sans-serif",
);

/** Serif fonts only (curated + advanced). */
export const SERIF_FONTS = SUPPORTED_GOOGLE_FONTS.filter(
  (f) => f.category === "serif",
);

/** Display fonts only (curated + advanced). */
export const DISPLAY_FONTS = SUPPORTED_GOOGLE_FONTS.filter(
  (f) => f.category === "display",
);

/** Monospace fonts only (curated + advanced). */
export const MONOSPACE_FONTS = SUPPORTED_GOOGLE_FONTS.filter(
  (f) => f.category === "monospace",
);

/** All fonts suitable for a sans/body role. */
export const BODY_FONTS = SANS_SERIF_FONTS;

/** All fonts suitable for a serif/editorial role. */
export const EDITORIAL_FONTS = SERIF_FONTS;

/** All fonts suitable for a mono role. */
export const CODE_FONTS = MONOSPACE_FONTS;

/**
 * Look up a SupportedGoogleFont by name (case-insensitive).
 * Returns undefined when the name is not in the supported list.
 */
export function findSupportedFont(name: string): SupportedGoogleFont | undefined {
  const lower = name.toLowerCase();
  return SUPPORTED_GOOGLE_FONTS.find((f) => f.name.toLowerCase() === lower);
}

/**
 * Determine whether a CSS font-family stack starts with a supported Google Font.
 * Returns the matched font entry, or undefined if no match.
 */
export function matchFontStack(stack: string): SupportedGoogleFont | undefined {
  const trimmed = stack.trim();
  if (!trimmed) return undefined;
  const first = trimmed.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "").trim();
  if (!first) return undefined;
  return findSupportedFont(first);
}
