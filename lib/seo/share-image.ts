/**
 * lib/seo/share-image.ts
 *
 * The card a link to the site shows when it is shared: og:image.
 *
 * Until 26 Nov 2026 no page had one, so a link on LinkedIn, in Slack or in a
 * chat showed as bare text. The site now has one card for every page, drawn
 * from what the tenant already has: its name, its line of description, its
 * logo and the ground of its hero. A page whose editor filled in an Open Graph
 * image in the CMS keeps that.
 *
 * This file holds the parts that need no request: the address and size of the
 * card, and reading colours out of the theme. The drawing is in
 * app/share-image/route.tsx.
 */

/** Where the card is served, and its size: the 1.91:1 that Open Graph asks for. */
export const SHARE_IMAGE = { path: "/share-image", width: 1200, height: 630 } as const;

/** The card as an Open Graph image entry. Root-relative: `metadataBase` makes it absolute per host. */
export function shareImageEntry(): { url: string; width: number; height: number } {
  return { url: SHARE_IMAGE.path, width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
}

/**
 * The value of a CSS custom property from a flat map of theme variables, with
 * `var(--other)` and `var(--other, fallback)` followed. The renderer of the
 * card knows no custom properties, so it needs the end value.
 *
 * Returns `fallback` when the property is missing, when a reference leads
 * nowhere, or when references run in a circle.
 */
export function resolveCssVar(vars: Readonly<Record<string, string>>, name: string, fallback: string): string {
  let value = vars[name];
  for (let depth = 0; depth < 8; depth++) {
    if (typeof value !== "string" || value.trim() === "") return fallback;
    value = value.trim();
    const ref = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value);
    if (!ref) return /var\(/.test(value) ? fallback : value;
    const next = vars[ref[1]];
    value = typeof next === "string" && next.trim() !== "" ? next : ref[2];
  }
  return fallback;
}

/** A colour the card can draw: hex, rgb(), rgba(), hsl(), hsla() or a plain colour name. */
function isPlainColour(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgba?\([^()]+\)|hsla?\([^()]+\)|[a-z]+)$/i.test(value.trim());
}

/** A gradient the card can draw. */
function isLinearGradient(value: string): boolean {
  return /^linear-gradient\(/i.test(value.trim()) && !/var\(/.test(value);
}

export interface ShareCardColours {
  /** A colour or a linear gradient. */
  ground:   string;
  title:    string;
  subtitle: string;
}

/**
 * The colours of the card: the ground of the tenant's hero and the colours its
 * hero text has. Anything the card cannot draw falls back to a dark ground with
 * light text, which reads with every logo plate.
 */
export function shareCardColours(vars: Readonly<Record<string, string>>): ShareCardColours {
  // An empty fallback tells the hero's own ground from one that led nowhere:
  // the hero's text colours only go with the hero's own ground.
  const ground   = resolveCssVar(vars, "--hero-bg", "");
  const title    = resolveCssVar(vars, "--hero-title-color", "");
  const subtitle = resolveCssVar(vars, "--hero-subtitle-color", "");
  if (!isPlainColour(ground) && !isLinearGradient(ground)) {
    return { ground: "#0f172a", title: "#ffffff", subtitle: "#cbd5e1" };
  }
  return {
    ground,
    title:    isPlainColour(title) ? title : "#ffffff",
    subtitle: isPlainColour(subtitle) ? subtitle : "#cbd5e1",
  };
}

/**
 * The large line of the card: the homepage's title without the site's name,
 * which the logo already shows. "Website personalisatie voor B2B | Acme" gives
 * "Website personalisatie voor B2B". Falls back to the name when there is no
 * title, or when the title is the name and nothing else.
 */
export function shareHeadline(homeTitle: string | null | undefined, siteName: string): string {
  const title = (homeTitle ?? "").replace(/\s+/g, " ").trim();
  if (!title) return siteName;
  const escaped = siteName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const without = escaped
    ? title.replace(new RegExp(`\\s*[|·•:–—-]\\s*${escaped}\\s*$`, "i"), "").replace(new RegExp(`^${escaped}\\s*[|·•:–—-]\\s*`, "i"), "").trim()
    : title;
  return clampText(without || siteName, 70);
}

/** Text cut to a length the card has room for, on a word, with an ellipsis. */
export function clampText(text: string | null | undefined, max: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const onWord = cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : cut.length);
  return `${onWord.replace(/[\s,.;:]+$/, "")}…`;
}
