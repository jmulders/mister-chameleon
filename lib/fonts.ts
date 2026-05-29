/**
 * Font Registry — Centralized font loading for the platform.
 *
 * Single source of truth for ALL next/font instances used by the app.
 * app/layout.tsx must import from here; no other file should import
 * directly from "next/font/google" or "next/font/local".
 *
 * ─── Two font tiers ──────────────────────────────────────────────────────────
 *
 *   Tier 1 — Shell UI fonts (Geist, Geist Mono)
 *     Loaded via next/font/google (variable-weight — Turbopack-safe).
 *     Wired to --font-sans / --font-mono defaults in globals.css.
 *     Exported individually so layout.tsx can reference their CSS variables.
 *
 *   Tier 2 — Tenant palette fonts (variable-weight only)
 *     28 curated variable-weight Google Fonts loaded via next/font/google.
 *     ALL variable-weight fonts are Turbopack-safe (no weight[] array).
 *     Collected in ALL_FONT_VARIABLES; applied to <html> so every @font-face
 *     is registered for the browser to use when a tenant selects that font.
 *
 * ─── Why fixed-weight fonts are excluded ─────────────────────────────────────
 *
 *   next/font/google instances with explicit weight arrays (e.g.
 *   `weight: ["400", "500", "700"]`) trigger an unresolvable virtual CSS
 *   module reference in Next.js 16 + Turbopack:
 *
 *     Module not found: Can't resolve
 *     '@vercel/turbopack-next/internal/font/google/font'
 *
 *   These 15 fixed-weight fonts are instead loaded via a Google Fonts CDN
 *   <link rel="stylesheet"> tag injected in app/layout.tsx <head>.
 *   They are available to the browser via their literal CSS font-family name
 *   (e.g. font-family: 'Roboto'), but are intentionally absent from
 *   GOOGLE_FONT_MAP — resolveGoogleFontCss() returns null for them, leaving
 *   the --font-* var as the raw font-stack string, which the browser resolves
 *   using the CDN-loaded @font-face declarations.
 *
 *   Fixed-weight fonts served via CDN (not next/font):
 *     Sans:    Roboto, Poppins, Lato
 *     Serif:   Cormorant Garamond, Merriweather, Libre Baskerville,
 *              PT Serif, Crimson Text, Arvo
 *     Display: Barlow Condensed, Bebas Neue, Anton, Archivo Black,
 *              Abril Fatface
 *     Mono:    IBM Plex Mono
 *
 * ─── How this wires into the token system ────────────────────────────────────
 *
 *   The token system lets operators set typography values like:
 *     --font-sans:  'Inter', system-ui, sans-serif
 *     --font-serif: 'Playfair Display', serif
 *
 *   For Tier 2 fonts in GOOGLE_FONT_MAP, app/layout.tsx emits a Layer C
 *   <style> that overrides --font-sans to reference the loaded CSS variable:
 *     :root { --font-sans: var(--font-inter) }
 *
 *   For CDN-loaded fonts (not in GOOGLE_FONT_MAP), the raw font-stack string
 *   remains in --font-sans and the browser resolves it via the CDN @font-face.
 *
 * ─── Three-step wiring in app/layout.tsx ────────────────────────────────────
 *
 *   Step 1  Include ALL_FONT_VARIABLES in <html className>.
 *           This registers every Tier 2 font's CSS custom property on :root.
 *
 *   Step 2  Read the tenant's resolved --font-* values from the token system.
 *
 *   Step 3  For each --font-* value that matches a GOOGLE_FONT_MAP entry:
 *           call resolveGoogleFontCss() to produce a Layer C :root override
 *           and inject it as a <style> tag after the token override layer.
 *
 * ─── Adding a new font ───────────────────────────────────────────────────────
 *
 *   Variable-weight (preferred — Turbopack-safe):
 *     1. Import the font from "next/font/google" (underscore for spaces).
 *     2. Create a module-level instance — omit the `weight` field.
 *     3. Add the .variable string to ALL_FONT_VARIABLES.
 *     4. Add a lowercase entry to GOOGLE_FONT_MAP.
 *     5. Add the entry to lib/supported-fonts.ts.
 *
 *   Fixed-weight (CDN fallback — avoids Turbopack breakage):
 *     1. Do NOT import via next/font/google.
 *     2. Add the font family + weights to the CDN <link> href in layout.tsx.
 *     3. Add the entry to lib/supported-fonts.ts.
 *     4. Do NOT add to GOOGLE_FONT_MAP (leave --font-* as raw font-stack).
 */

import {
  // ── Shell UI (Geist) ───────────────────────────────────────────────────────
  Geist,
  Geist_Mono,
  // ── Sans-serif: humanist & geometric ──────────────────────────────────────
  Inter,
  DM_Sans,
  Outfit,
  Manrope,
  Space_Grotesk,
  Plus_Jakarta_Sans,
  Figtree,
  Urbanist,
  Sora,
  // ── Sans-serif: workhorse & neutral ───────────────────────────────────────
  // Roboto → CDN (fixed-weight)
  Open_Sans,
  Noto_Sans,
  Source_Sans_3,
  Work_Sans,
  Cabin,
  // ── Sans-serif: personality & display-ready ───────────────────────────────
  // Poppins → CDN (fixed-weight)
  Montserrat,
  Raleway,
  Rubik,
  Nunito,
  Mulish,
  // Lato → CDN (fixed-weight)
  // ── Serif ─────────────────────────────────────────────────────────────────
  Playfair_Display,
  Lora,
  Source_Serif_4,
  // Cormorant_Garamond → CDN (fixed-weight)
  EB_Garamond,
  // Merriweather      → CDN (fixed-weight)
  // Libre_Baskerville → CDN (fixed-weight)
  // PT_Serif          → CDN (fixed-weight)
  // Crimson_Text      → CDN (fixed-weight)
  // Arvo              → CDN (fixed-weight)
  // ── Display ───────────────────────────────────────────────────────────────
  Oswald,
  // Barlow_Condensed → CDN (fixed-weight)
  // Bebas_Neue       → CDN (fixed-weight)
  // Anton            → CDN (fixed-weight)
  // Archivo_Black    → CDN (fixed-weight)
  // Abril_Fatface    → CDN (fixed-weight)
  // ── Monospace ─────────────────────────────────────────────────────────────
  JetBrains_Mono,
  Fira_Code,
  Source_Code_Pro,
  // IBM_Plex_Mono → CDN (fixed-weight)
  Roboto_Mono,
} from "next/font/google";

// ── Font instances ────────────────────────────────────────────────────────────
//
// Must be module-level constants — next/font/google requires this.
// Each font gets a unique CSS variable that next/font injects as a @font-face
// rule and scoped custom property once the .variable class is applied.
//
// ONLY variable fonts are loaded here (no `weight` field).
// Fixed-weight fonts are loaded via CDN <link> in app/layout.tsx.

// ── Shell UI: Geist ──────────────────────────────────────────────────────────

/** Geist — Vercel's geometric sans; used for the admin/shell UI. */
export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets:  ["latin"],
  display:  "swap",
});

/** Geist Mono — companion monospace for the shell UI. */
export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets:  ["latin"],
  display:  "swap",
});

// ── Sans-serif: humanist & geometric ─────────────────────────────────────────

/** Inter — variable-weight geometric humanist. */
const inter = Inter({
  subsets:  ["latin"],
  variable: "--font-inter",
  display:  "swap",
});

/** DM Sans — variable-weight low-contrast geometric. */
const dmSans = DM_Sans({
  subsets:  ["latin"],
  variable: "--font-dm-sans",
  display:  "swap",
});

/** Outfit — variable-weight rounded geometric. */
const outfit = Outfit({
  subsets:  ["latin"],
  variable: "--font-outfit",
  display:  "swap",
});

/** Manrope — variable-weight elegant geometric. */
const manrope = Manrope({
  subsets:  ["latin"],
  variable: "--font-manrope",
  display:  "swap",
});

/** Space Grotesk — variable-weight fixed-width geometric. */
const spaceGrotesk = Space_Grotesk({
  subsets:  ["latin"],
  variable: "--font-space-grotesk",
  display:  "swap",
});

/** Plus Jakarta Sans — variable-weight modern geometric humanist. */
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets:  ["latin"],
  variable: "--font-plus-jakarta-sans",
  display:  "swap",
});

/** Figtree — variable-weight clean rounded sans. */
const figtree = Figtree({
  subsets:  ["latin"],
  variable: "--font-figtree",
  display:  "swap",
});

/** Urbanist — variable-weight low-contrast geometric. */
const urbanist = Urbanist({
  subsets:  ["latin"],
  variable: "--font-urbanist",
  display:  "swap",
});

/** Sora — variable-weight modern geometric. */
const sora = Sora({
  subsets:  ["latin"],
  variable: "--font-sora",
  display:  "swap",
});

// ── Sans-serif: workhorse & neutral ──────────────────────────────────────────
// NOTE: Roboto is excluded (fixed-weight → CDN).

/** Open Sans — humanist sans-serif; variable weight. */
const openSans = Open_Sans({
  subsets:  ["latin"],
  variable: "--font-open-sans",
  display:  "swap",
});

/** Noto Sans — universal humanist; variable weight. */
const notoSans = Noto_Sans({
  subsets:  ["latin"],
  variable: "--font-noto-sans",
  display:  "swap",
});

/** Source Sans 3 — Adobe's screen-optimised humanist; variable weight. */
const sourceSans3 = Source_Sans_3({
  subsets:  ["latin"],
  variable: "--font-source-sans-3",
  display:  "swap",
});

/** Work Sans — screen-optimised sans; variable weight. */
const workSans = Work_Sans({
  subsets:  ["latin"],
  variable: "--font-work-sans",
  display:  "swap",
});

/** Cabin — humanist sans; variable weight. */
const cabin = Cabin({
  subsets:  ["latin"],
  variable: "--font-cabin",
  display:  "swap",
});

// ── Sans-serif: personality & display-ready ───────────────────────────────────
// NOTE: Poppins and Lato are excluded (fixed-weight → CDN).

/** Montserrat — geometric sans with strong personality; variable weight. */
const montserrat = Montserrat({
  subsets:  ["latin"],
  variable: "--font-montserrat",
  display:  "swap",
});

/** Raleway — elegant thin-to-heavy range; variable weight. */
const raleway = Raleway({
  subsets:  ["latin"],
  variable: "--font-raleway",
  display:  "swap",
});

/** Rubik — slightly rounded humanist; variable weight. */
const rubik = Rubik({
  subsets:  ["latin"],
  variable: "--font-rubik",
  display:  "swap",
});

/** Nunito — rounded terminals; variable weight. */
const nunito = Nunito({
  subsets:  ["latin"],
  variable: "--font-nunito",
  display:  "swap",
});

/** Mulish — minimalist geometric; variable weight. */
const mulish = Mulish({
  subsets:  ["latin"],
  variable: "--font-mulish",
  display:  "swap",
});

// ── Serif ─────────────────────────────────────────────────────────────────────
// NOTE: Cormorant Garamond, Merriweather, Libre Baskerville, PT Serif,
//       Crimson Text, and Arvo are excluded (fixed-weight → CDN).

/** Playfair Display — high-contrast editorial serif; variable weight. */
const playfairDisplay = Playfair_Display({
  subsets:  ["latin"],
  variable: "--font-playfair-display",
  display:  "swap",
});

/** Lora — calligraphic serif; variable weight. */
const lora = Lora({
  subsets:  ["latin"],
  variable: "--font-lora",
  display:  "swap",
});

/** Source Serif 4 — Adobe's screen-optimised text serif; variable weight. */
const sourceSerif4 = Source_Serif_4({
  subsets:  ["latin"],
  variable: "--font-source-serif-4",
  display:  "swap",
});

/** EB Garamond — classic Garamond revival; variable weight. */
const ebGaramond = EB_Garamond({
  subsets:  ["latin"],
  variable: "--font-eb-garamond",
  display:  "swap",
});

// ── Display ───────────────────────────────────────────────────────────────────
// NOTE: Barlow Condensed, Bebas Neue, Anton, Archivo Black, Abril Fatface
//       are excluded (fixed-weight → CDN).

/** Oswald — condensed sans; variable weight. */
const oswald = Oswald({
  subsets:  ["latin"],
  variable: "--font-oswald",
  display:  "swap",
});

// ── Monospace ─────────────────────────────────────────────────────────────────
// NOTE: IBM Plex Mono is excluded (fixed-weight → CDN).

/** JetBrains Mono — developer-optimised; variable weight. */
const jetbrainsMono = JetBrains_Mono({
  subsets:  ["latin"],
  variable: "--font-jetbrains-mono",
  display:  "swap",
});

/** Fira Code — ligature-rich programming font; variable weight. */
const firaCode = Fira_Code({
  subsets:  ["latin"],
  variable: "--font-fira-code",
  display:  "swap",
});

/** Source Code Pro — Adobe's clean mono; variable weight. */
const sourceCodePro = Source_Code_Pro({
  subsets:  ["latin"],
  variable: "--font-source-code-pro",
  display:  "swap",
});

/** Roboto Mono — neutral mono companion to Roboto; variable weight. */
const robotoMono = Roboto_Mono({
  subsets:  ["latin"],
  variable: "--font-roboto-mono",
  display:  "swap",
});

// ── GOOGLE_FONT_MAP ───────────────────────────────────────────────────────────
//
// Maps the lowercase display name of each variable-weight Google Font to the
// CSS custom property registered by its next/font instance.
//
// Keys are lowercase so font name comparison is case-insensitive:
//   "Inter" → lookup key "inter" → cssVar "--font-inter"
//
// IMPORTANT: Fixed-weight fonts served via the Google Fonts CDN are NOT
// listed here. resolveGoogleFontCss() returns null for them, which is correct —
// --font-* stays as the raw font-stack string (e.g. "'Roboto', sans-serif")
// and the browser resolves it using the CDN-loaded @font-face declaration.

export interface GoogleFontEntry {
  /** CSS custom property registered by next/font, e.g. "--font-inter". */
  cssVar: string;
}

/**
 * Supported variable-weight Google Font display names (lowercase) → CSS variable mapping.
 *
 * Look up a font name here to determine whether it is a next/font-loaded
 * variable font and which CSS variable to use in the Layer C override.
 *
 * Fonts missing from this map are either CDN-loaded (fixed-weight) or
 * system fonts — both are handled by falling back to the raw font-stack.
 */
export const GOOGLE_FONT_MAP: Readonly<Record<string, GoogleFontEntry>> = {
  // sans-serif: humanist & geometric (all variable-weight)
  "inter":                { cssVar: "--font-inter"             },
  "dm sans":              { cssVar: "--font-dm-sans"           },
  "outfit":               { cssVar: "--font-outfit"            },
  "manrope":              { cssVar: "--font-manrope"           },
  "space grotesk":        { cssVar: "--font-space-grotesk"     },
  "plus jakarta sans":    { cssVar: "--font-plus-jakarta-sans" },
  "figtree":              { cssVar: "--font-figtree"           },
  "urbanist":             { cssVar: "--font-urbanist"          },
  "sora":                 { cssVar: "--font-sora"              },
  // sans-serif: workhorse & neutral (variable-weight only; Roboto is CDN)
  "open sans":            { cssVar: "--font-open-sans"         },
  "noto sans":            { cssVar: "--font-noto-sans"         },
  "source sans 3":        { cssVar: "--font-source-sans-3"     },
  "work sans":            { cssVar: "--font-work-sans"         },
  "cabin":                { cssVar: "--font-cabin"             },
  // sans-serif: personality (variable-weight only; Poppins + Lato are CDN)
  "montserrat":           { cssVar: "--font-montserrat"        },
  "raleway":              { cssVar: "--font-raleway"           },
  "rubik":                { cssVar: "--font-rubik"             },
  "nunito":               { cssVar: "--font-nunito"            },
  "mulish":               { cssVar: "--font-mulish"            },
  // serif (variable-weight only; Cormorant Garamond, Merriweather,
  //   Libre Baskerville, PT Serif, Crimson Text, Arvo are CDN)
  "playfair display":     { cssVar: "--font-playfair-display"  },
  "lora":                 { cssVar: "--font-lora"              },
  "source serif 4":       { cssVar: "--font-source-serif-4"    },
  "eb garamond":          { cssVar: "--font-eb-garamond"       },
  // display (variable-weight only; Barlow Condensed, Bebas Neue, Anton,
  //   Archivo Black, Abril Fatface are CDN)
  "oswald":               { cssVar: "--font-oswald"            },
  // monospace (variable-weight only; IBM Plex Mono is CDN)
  "jetbrains mono":       { cssVar: "--font-jetbrains-mono"    },
  "fira code":            { cssVar: "--font-fira-code"         },
  "source code pro":      { cssVar: "--font-source-code-pro"   },
  "roboto mono":          { cssVar: "--font-roboto-mono"       },
} as const;

// ── ALL_FONT_VARIABLES ────────────────────────────────────────────────────────
//
// Space-joined className string containing the .variable class for every
// next/font instance in this registry (Geist + all variable-weight tenant fonts).
// Apply to <html> so that all CSS custom properties are registered on :root
// regardless of which font the current tenant has selected.
//
// Next.js generates a unique scoped class name for each font; the .variable
// class applies that font's @font-face declaration and CSS custom property to
// the element and its descendants.
//
// Browsers only download font files for fonts actually referenced in computed
// styles — unused @font-face declarations incur no network cost.

export const ALL_FONT_VARIABLES: string = [
  // shell UI
  geistSans.variable,
  geistMono.variable,
  // sans-serif: humanist & geometric
  inter.variable,
  dmSans.variable,
  outfit.variable,
  manrope.variable,
  spaceGrotesk.variable,
  plusJakartaSans.variable,
  figtree.variable,
  urbanist.variable,
  sora.variable,
  // sans-serif: workhorse & neutral
  openSans.variable,
  notoSans.variable,
  sourceSans3.variable,
  workSans.variable,
  cabin.variable,
  // sans-serif: personality & display-ready
  montserrat.variable,
  raleway.variable,
  rubik.variable,
  nunito.variable,
  mulish.variable,
  // serif
  playfairDisplay.variable,
  lora.variable,
  sourceSerif4.variable,
  ebGaramond.variable,
  // display
  oswald.variable,
  // monospace
  jetbrainsMono.variable,
  firaCode.variable,
  sourceCodePro.variable,
  robotoMono.variable,
].join(" ");

// ── Font stack parser ─────────────────────────────────────────────────────────

/**
 * Extract the primary (first) font family name from a CSS font-family stack.
 *
 * Handles quoted and unquoted font names consistently:
 *
 *   "'Inter', system-ui, sans-serif" → "Inter"
 *   "Roboto, sans-serif"             → "Roboto"
 *   "'Playfair Display', serif"      → "Playfair Display"
 *   "system-ui, -apple-system"       → "system-ui"
 *   ""                               → null
 *
 * @param fontStack  Raw CSS font-family value string.
 * @returns          The first font name with quotes stripped, or null for blank.
 */
export function parsePrimaryFontName(fontStack: string): string | null {
  const trimmed = fontStack.trim();
  if (!trimmed) return null;

  // Take everything before the first comma
  const firstToken = trimmed.split(",")[0]?.trim();
  if (!firstToken) return null;

  // Strip surrounding single or double quotes
  const stripped = firstToken.replace(/^['"]|['"]$/g, "").trim();
  return stripped || null;
}

// ── resolveGoogleFontCss ──────────────────────────────────────────────────────

/**
 * Given a CSS font-family stack and a target CSS custom property name, returns
 * a `:root {}` override string that maps the property to the Next.js-loaded
 * font's CSS variable — or null when the primary font is not a variable-weight
 * next/font-loaded font.
 *
 * Returns null for CDN-loaded fixed-weight fonts (not in GOOGLE_FONT_MAP).
 * In that case the --font-* var retains its raw font-stack string from Layer B,
 * and the browser resolves it via the CDN @font-face declarations in layout.tsx.
 *
 * @param fontStack   The raw CSS font-family value, e.g. `"'Inter', system-ui"`.
 * @param cssVarName  The CSS custom property to override, e.g. `"--font-sans"`.
 * @returns           A CSS string like `":root{--font-sans:var(--font-inter)}"`,
 *                    or null when the font is not a variable-weight next/font font.
 *
 * @example
 * resolveGoogleFontCss("'Inter', system-ui, sans-serif", "--font-sans")
 * // → ":root{--font-sans:var(--font-inter)}"
 *
 * resolveGoogleFontCss("'Roboto', sans-serif", "--font-sans")
 * // → null  (Roboto is CDN-loaded; browser resolves via @font-face)
 *
 * resolveGoogleFontCss("system-ui, sans-serif", "--font-sans")
 * // → null  (system-ui is not a Google Font → no override → Layer B stack used)
 *
 * resolveGoogleFontCss("'Playfair Display', serif", "--font-heading")
 * // → ":root{--font-heading:var(--font-playfair-display)}"
 */
export function resolveGoogleFontCss(
  fontStack:  string,
  cssVarName: string,
): string | null {
  const primaryName = parsePrimaryFontName(fontStack);
  if (!primaryName) return null;

  const entry = GOOGLE_FONT_MAP[primaryName.toLowerCase()];
  if (!entry) return null;

  return `:root{${cssVarName}:var(${entry.cssVar})}`;
}
