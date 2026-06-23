/**
 * URL → design-token extractor
 *
 * Given a public URL, fetches the page HTML + its stylesheets and distils a
 * best-effort design-token set (our grouped token-upload shape) from the CSS:
 *
 *   • CSS custom properties (`:root { --primary: … }`) — the highest-signal
 *     source. Modern stacks (Tailwind/shadcn, design systems) expose their
 *     tokens here. shadcn-style HSL channel triplets ("222 47% 11%") are wrapped
 *     in hsl().
 *   • font-family — from --font-* variables and from body / heading rules.
 *   • border-radius + box-shadow — from variables or representative values.
 *   • Colour-frequency fallback for background / foreground / primary when no
 *     variables are present.
 *
 * Heuristic by nature (no headless browser, no cascade resolution), so the
 * result is meant to be REVIEWED in the Builder before saving — not a guaranteed
 * pixel-perfect copy.
 */

import "server-only";

export interface UrlExtractResult {
  ok:      boolean;
  /** Grouped token-upload payload ({ theme, color, typography, radius, shadow }). */
  tokens?: Record<string, unknown>;
  /** Human-readable notes about what was found / guessed. */
  notes?:  string[];
  error?:  string;
}

// Block obviously-internal hosts (basic SSRF guard for an admin-only tool).
const PRIVATE_HOST = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|0\.0\.0\.0$)/i;

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (PRIVATE_HOST.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

async function fetchText(url: string, timeoutMs: number, maxBytes: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal:   ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "MisterChameleon-TokenExtractor/1.0 (+admin design tool)",
        "Accept":     "text/html,text/css,*/*",
      },
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function collectCss(html: string, base: URL): Promise<string> {
  let css = "";
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) css += "\n" + m[1];

  const hrefs: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) hrefs.push(href);
  }

  const sheets = await Promise.all(
    hrefs.slice(0, 8).map(async (h) => {
      const abs = safeUrl(new URL(h, base).toString());
      return abs ? fetchText(abs.toString(), 6000, 900_000) : "";
    }),
  );
  css += "\n" + sheets.join("\n");
  return css.length > 4_000_000 ? css.slice(0, 4_000_000) : css;
}

// ── Value coercion ─────────────────────────────────────────────────────────────

function asColor(raw: string): string | null {
  const s = raw.trim().replace(/!important$/i, "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab|color)\(/i.test(s)) return s;
  // shadcn HSL channel triplet: "222 47% 11%" (optionally "/ 50%")
  if (/^\d[\d.]*\s+\d[\d.]*%\s+\d[\d.]*%(\s*\/\s*[\d.]+%?)?$/.test(s)) return `hsl(${s})`;
  // Named colours we accept verbatim
  if (/^(white|black|transparent|currentcolor)$/i.test(s)) return s.toLowerCase();
  return null;
}

const customProps = (css: string): Map<string, string> => {
  const map = new Map<string, string>();
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;{}]+)[;}]/gi)) {
    const name = m[1].toLowerCase().trim();
    const val  = m[2].trim();
    if (val && !val.startsWith("var(")) map.set(name, val); // last declaration wins
  }
  return map;
};

const COLOR_VARS: [RegExp, string][] = [
  [/primary-?(hover|600|700|dark)/,                         "primaryHover"],
  [/(on-?primary|primary-?(foreground|contrast))/,          "onPrimary"],
  [/(muted-?foreground|text-?(muted|secondary|subtle))/,    "mutedForeground"],
  [/(card-?foreground|on-?card)/,                           "cardForeground"],
  [/^(color-)?(primary|brand)(-default)?$|^brand-primary$/, "primary"],
  [/^(color-)?secondary$/,                                  "secondary"],
  [/^(color-)?accent$/,                                     "accent"],
  [/^(color-)?(background|bg|surface|body-bg|canvas)$/,     "background"],
  [/^(color-)?(foreground|text|body-color|ink)$/,           "foreground"],
  [/^(muted|subtle)$/,                                      "muted"],
  [/^(color-)?(border|outline|divider)$/,                   "border"],
  [/^card(-bg)?$/,                                          "card"],
  [/^link$/,                                                "link"],
  [/^(success|positive)$/,                                  "success"],
  [/^(danger|error|destructive|negative)$/,                "danger"],
];

function fontFromVars(props: Map<string, string>, re: RegExp): string | null {
  for (const [name, val] of props) if (re.test(name)) { const v = val.trim(); if (v) return v; }
  return null;
}

function fontFromSelector(css: string, selectorRe: RegExp): string | null {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorRe.test(m[1])) continue;
    const ff = m[2].match(/font-family\s*:\s*([^;}]+)/i)?.[1];
    if (ff && !/var\(/.test(ff)) return ff.trim();
  }
  return null;
}

function representativeRadius(css: string): string | null {
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/border-radius\s*:\s*([0-9.]+(px|rem|em))/gi)) {
    const v = m[1]; counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null, bestN = 0;
  for (const [v, n] of counts) if (n > bestN && parseFloat(v) > 0) { best = v; bestN = n; }
  return best;
}

function firstShadow(css: string): string | null {
  const m = css.match(/box-shadow\s*:\s*((?:[^;{}]|\([^)]*\))*)[;}]/i);
  const v = m?.[1]?.trim();
  return v && v.toLowerCase() !== "none" ? v : null;
}

const GRADIENT_FN = /\b(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\(/i;

/**
 * Collect CSS gradients from stylesheet declarations, custom properties, AND
 * inline `style="…"` attributes in the HTML, ordered by preference (literal
 * gradients before var()-based ones, then by frequency). A `[^;{}]+` capture
 * keeps nested parens (rgba(), var()) intact.
 */
function extractGradients(css: string, html: string): string[] {
  const counts = new Map<string, number>();
  const add = (raw: string) => {
    const v = raw.trim().replace(/\s+/g, " ").replace(/!important$/i, "").trim();
    if (!v || !GRADIENT_FN.test(v) || /[;{}<>\\]/.test(v) || v.length > 400) return;
    // Drop gradients whose colour stops are CSS variables (e.g. Tailwind's
    // `var(--tw-gradient-stops)`): we can't supply those vars, so the gradient
    // would render empty. Keep only fully-literal gradients.
    if (/var\(/i.test(v)) return;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  };
  // Any declaration value (property: value;) that contains a gradient function.
  for (const m of css.matchAll(/:\s*([^;{}]+)/g)) if (GRADIENT_FN.test(m[1])) add(m[1]);
  // Inline element styles in the HTML.
  for (const m of html.matchAll(/style\s*=\s*"([^"]*)"/gi)) {
    for (const decl of m[1].split(";")) {
      if (GRADIENT_FN.test(decl)) add(decl.split(":").slice(1).join(":"));
    }
  }
  // Most frequent first (a repeated gradient is likely the main brand one).
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
}

// ── Main ────────────────────────────────────────────────────────────────────────

export async function extractTokensFromUrl(rawUrl: string): Promise<UrlExtractResult> {
  const url = safeUrl(rawUrl);
  if (!url) return { ok: false, error: "Ongeldige of niet-toegestane URL (alleen publieke http/https)." };

  const notes: string[] = [];
  let html: string;
  try {
    html = await fetchText(url.toString(), 8000, 1_500_000);
  } catch {
    html = "";
  }
  if (!html) return { ok: false, error: "Kon de pagina niet ophalen (timeout of geblokkeerd)." };

  const css = await collectCss(html, url);
  if (!css.trim()) return { ok: false, error: "Geen CSS gevonden op deze pagina." };

  const props = customProps(css);
  notes.push(props.size > 0 ? `${props.size} CSS-variabelen gevonden.` : "Geen CSS-variabelen — kleur-frequentie gebruikt als fallback.");

  // ── Colours ────────────────────────────────────────────────────────────────
  const color: Record<string, string> = {};
  for (const [name, val] of props) {
    const c = asColor(val);
    if (!c) continue;
    for (const [re, key] of COLOR_VARS) {
      if (re.test(name)) { if (!color[key]) color[key] = c; break; }
    }
  }

  // Colour-frequency enrichment — fills the palette from the page's hex usage so
  // the result is richer than just the few semantic CSS vars a site exposes
  // (especially Tailwind sites, which barely use semantic colour variables).
  {
    const counts = new Map<string, number>();
    for (const m of css.matchAll(/#[0-9a-f]{6}\b/gi)) {
      const hex = m[0].toLowerCase(); counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const rgb    = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const;
    const lum    = (hex: string) => { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    const chroma = (hex: string) => { const [r, g, b] = rgb(hex); return (Math.max(r, g, b) - Math.min(r, g, b)) / 255; };

    if (!color.background) { const c = sorted.find((h) => lum(h) > 0.9); if (c) { color.background = c; notes.push("Achtergrond geschat uit kleur-frequentie."); } }
    if (!color.foreground) { const c = sorted.find((h) => lum(h) < 0.28 && chroma(h) < 0.4); if (c) { color.foreground = c; notes.push("Tekstkleur geschat uit kleur-frequentie."); } }
    if (!color.primary)    { const c = sorted.find((h) => chroma(h) > 0.25 && lum(h) > 0.15 && lum(h) < 0.82); if (c) { color.primary = c; notes.push("Primair geschat uit kleur-frequentie."); } }
    if (!color.accent)     { const c = sorted.find((h) => chroma(h) > 0.3 && h !== color.primary); if (c) color.accent = c; }
    if (!color.secondary)  { const c = sorted.find((h) => chroma(h) > 0.2 && h !== color.primary && h !== color.accent); if (c) color.secondary = c; }
    if (!color.border)     { const c = sorted.find((h) => { const l = lum(h); return l > 0.78 && l < 0.96 && chroma(h) < 0.08; }); if (c) color.border = c; }
    if (!color.muted)      { const c = sorted.find((h) => lum(h) > 0.93 && chroma(h) < 0.06 && h !== color.background); if (c) color.muted = c; }
    if (!color.card && color.background) color.card = color.background;
  }

  // ── Gradients ──────────────────────────────────────────────────────────────
  const gradients = extractGradients(css, html);
  if (gradients[0]) {
    color.gradient = gradients[0];
    notes.push("Gradient gevonden (→ --gradient).");
    if (gradients[1] && gradients[1] !== gradients[0]) color.gradientHero = gradients[1];
  }

  // ── Typography ───────────────────────────────────────────────────────────────
  const typography: Record<string, string> = {};
  const heading = fontFromVars(props, /font-?(heading|display|title|serif)/) ?? fontFromSelector(css, /(^|\s|,)h1(\s|,|\.|:|$)/i);
  const body    = fontFromVars(props, /font-?(sans|body|base|text|family)?$/) ?? fontFromSelector(css, /(^|\s|,)(body|html)(\s|,|\.|:|$)/i);
  if (heading) typography.fontHeading = heading;
  if (body)    typography.fontBody    = body;
  // Fall back the heading font to the body font so headings aren't left unstyled
  // (many sites use one family for both).
  if (typography.fontBody && !typography.fontHeading) typography.fontHeading = typography.fontBody;

  // ── Radius + shadow ──────────────────────────────────────────────────────────
  const radius: Record<string, string> = {};
  const radiusVar = fontFromVars(props, /^(radius|rounded|border-radius)$/) ?? fontFromVars(props, /radius/);
  const radiusVal = (radiusVar && /[0-9]/.test(radiusVar) ? radiusVar.trim() : null) ?? representativeRadius(css);
  if (radiusVal) { radius.interactive = radiusVal; radius.card = radiusVal; }

  const shadow: Record<string, string> = {};
  const shadowVar = fontFromVars(props, /^(shadow|shadow-md|box-shadow|elevation)$/) ?? null;
  const shadowVal = (shadowVar && /\d/.test(shadowVar) ? shadowVar.trim() : null) ?? firstShadow(css);
  if (shadowVal) shadow.md = shadowVal;

  const mappedColors = Object.keys(color).length;
  if (mappedColors === 0 && !typography.fontHeading && !typography.fontBody && !radiusVal && !shadowVal) {
    return { ok: false, error: "Kon geen herkenbare design-tokens uit deze pagina distilleren." };
  }
  notes.unshift(`${mappedColors} kleuren, ${Object.keys(typography).length} fonts, ${radiusVal ? "radius" : "geen radius"}, ${shadowVal ? "schaduw" : "geen schaduw"} geëxtraheerd.`);

  const tokens: Record<string, unknown> = { theme: "custom" };
  if (Object.keys(color).length)      tokens.color      = color;
  if (Object.keys(typography).length) tokens.typography = typography;
  if (Object.keys(radius).length)     tokens.radius     = radius;
  if (Object.keys(shadow).length)     tokens.shadow     = shadow;

  return { ok: true, tokens, notes };
}
