/**
 * lib/theme/scheme.ts
 *
 * Whether the page a visitor gets is dark or light.
 *
 * A tenant's look can change per request: a rule picks another preset by time
 * of day or audience. CSS cannot ask "is my background dark?", so the layout
 * works it out once and writes it on <html data-scheme>. A stylesheet can then
 * give something that only works on a light ground (black ink on a transparent
 * image, say) a light surface to stand on when the page is dark.
 */

import { hexToRgb, relativeLuminance } from "@/lib/color";

export type Scheme = "light" | "dark";

/**
 * Below this luminance, white text contrasts better with the ground than
 * black text does. It is the crossover of the two WCAG contrast ratios.
 */
const DARK_BELOW = 0.179;

/**
 * The scheme for a page background. The first candidate that is a hex colour
 * decides; with none, the page counts as light, which is what every theme was
 * before this existed.
 */
export function schemeFor(...backgrounds: Array<string | null | undefined>): Scheme {
  for (const candidate of backgrounds) {
    const rgb = candidate ? hexToRgb(candidate.trim()) : null;
    if (rgb) return relativeLuminance(rgb) < DARK_BELOW ? "dark" : "light";
  }
  return "light";
}
