/**
 * Curated named-colour library for palette presentation.
 *
 * A bundled list of recognisable colour names (the CSS / X11 keyword set,
 * title-cased and de-duplicated). nearestColorName() resolves any hex to the
 * closest entry by CIEDE2000 (reusing deltaE2000 from lib/color), for the
 * LAB-style palette cards. Pure data + one lookup; no React or app imports.
 */

import { hexToLab, deltaE2000, type Lab } from "@/lib/color";

export interface NamedColor { name: string; hex: string }

export const CURATED_COLOR_NAMES: readonly NamedColor[] = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#ffffff" },
  { name: "Red", hex: "#ff0000" },
  { name: "Lime", hex: "#00ff00" },
  { name: "Blue", hex: "#0000ff" },
  { name: "Yellow", hex: "#ffff00" },
  { name: "Cyan", hex: "#00ffff" },
  { name: "Magenta", hex: "#ff00ff" },
  { name: "Silver", hex: "#c0c0c0" },
  { name: "Gray", hex: "#808080" },
  { name: "Maroon", hex: "#800000" },
  { name: "Olive", hex: "#808000" },
  { name: "Green", hex: "#008000" },
  { name: "Purple", hex: "#800080" },
  { name: "Teal", hex: "#008080" },
  { name: "Navy", hex: "#000080" },
  { name: "Orange", hex: "#ffa500" },
  { name: "Gold", hex: "#ffd700" },
  { name: "Coral", hex: "#ff7f50" },
  { name: "Tomato", hex: "#ff6347" },
  { name: "Orange Red", hex: "#ff4500" },
  { name: "Dark Orange", hex: "#ff8c00" },
  { name: "Salmon", hex: "#fa8072" },
  { name: "Light Salmon", hex: "#ffa07a" },
  { name: "Crimson", hex: "#dc143c" },
  { name: "Fire Brick", hex: "#b22222" },
  { name: "Dark Red", hex: "#8b0000" },
  { name: "Indian Red", hex: "#cd5c5c" },
  { name: "Light Coral", hex: "#f08080" },
  { name: "Hot Pink", hex: "#ff69b4" },
  { name: "Deep Pink", hex: "#ff1493" },
  { name: "Pink", hex: "#ffc0cb" },
  { name: "Light Pink", hex: "#ffb6c1" },
  { name: "Pale Violet Red", hex: "#db7093" },
  { name: "Medium Violet Red", hex: "#c71585" },
  { name: "Orchid", hex: "#da70d6" },
  { name: "Violet", hex: "#ee82ee" },
  { name: "Plum", hex: "#dda0dd" },
  { name: "Thistle", hex: "#d8bfd8" },
  { name: "Dark Magenta", hex: "#8b008b" },
  { name: "Dark Violet", hex: "#9400d3" },
  { name: "Dark Orchid", hex: "#9932cc" },
  { name: "Blue Violet", hex: "#8a2be2" },
  { name: "Medium Orchid", hex: "#ba55d3" },
  { name: "Medium Purple", hex: "#9370db" },
  { name: "Rebecca Purple", hex: "#663399" },
  { name: "Indigo", hex: "#4b0082" },
  { name: "Slate Blue", hex: "#6a5acd" },
  { name: "Dark Slate Blue", hex: "#483d8b" },
  { name: "Medium Slate Blue", hex: "#7b68ee" },
  { name: "Lavender", hex: "#e6e6fa" },
  { name: "Ghost White", hex: "#f8f8ff" },
  { name: "Midnight Blue", hex: "#191970" },
  { name: "Royal Blue", hex: "#4169e1" },
  { name: "Cornflower Blue", hex: "#6495ed" },
  { name: "Dodger Blue", hex: "#1e90ff" },
  { name: "Deep Sky Blue", hex: "#00bfff" },
  { name: "Sky Blue", hex: "#87ceeb" },
  { name: "Light Sky Blue", hex: "#87cefa" },
  { name: "Steel Blue", hex: "#4682b4" },
  { name: "Light Steel Blue", hex: "#b0c4de" },
  { name: "Powder Blue", hex: "#b0e0e6" },
  { name: "Cadet Blue", hex: "#5f9ea0" },
  { name: "Dark Blue", hex: "#00008b" },
  { name: "Medium Blue", hex: "#0000cd" },
  { name: "Turquoise", hex: "#40e0d0" },
  { name: "Medium Turquoise", hex: "#48d1cc" },
  { name: "Dark Turquoise", hex: "#00ced1" },
  { name: "Light Sea Green", hex: "#20b2aa" },
  { name: "Dark Cyan", hex: "#008b8b" },
  { name: "Aquamarine", hex: "#7fffd4" },
  { name: "Medium Aquamarine", hex: "#66cdaa" },
  { name: "Sea Green", hex: "#2e8b57" },
  { name: "Medium Sea Green", hex: "#3cb371" },
  { name: "Dark Sea Green", hex: "#8fbc8f" },
  { name: "Spring Green", hex: "#00ff7f" },
  { name: "Medium Spring Green", hex: "#00fa9a" },
  { name: "Forest Green", hex: "#228b22" },
  { name: "Dark Green", hex: "#006400" },
  { name: "Lime Green", hex: "#32cd32" },
  { name: "Lawn Green", hex: "#7cfc00" },
  { name: "Chartreuse", hex: "#7fff00" },
  { name: "Green Yellow", hex: "#adff2f" },
  { name: "Yellow Green", hex: "#9acd32" },
  { name: "Olive Drab", hex: "#6b8e23" },
  { name: "Dark Olive Green", hex: "#556b2f" },
  { name: "Pale Green", hex: "#98fb98" },
  { name: "Light Green", hex: "#90ee90" },
  { name: "Khaki", hex: "#f0e68c" },
  { name: "Dark Khaki", hex: "#bdb76b" },
  { name: "Pale Goldenrod", hex: "#eee8aa" },
  { name: "Goldenrod", hex: "#daa520" },
  { name: "Dark Goldenrod", hex: "#b8860b" },
  { name: "Peru", hex: "#cd853f" },
  { name: "Chocolate", hex: "#d2691e" },
  { name: "Saddle Brown", hex: "#8b4513" },
  { name: "Sienna", hex: "#a0522d" },
  { name: "Brown", hex: "#a52a2a" },
  { name: "Dark Salmon", hex: "#e9967a" },
  { name: "Rosy Brown", hex: "#bc8f8f" },
  { name: "Sandy Brown", hex: "#f4a460" },
  { name: "Tan", hex: "#d2b48c" },
  { name: "Burly Wood", hex: "#deb887" },
  { name: "Wheat", hex: "#f5deb3" },
  { name: "Navajo White", hex: "#ffdead" },
  { name: "Bisque", hex: "#ffe4c4" },
  { name: "Blanched Almond", hex: "#ffebcd" },
  { name: "Cornsilk", hex: "#fff8dc" },
  { name: "Moccasin", hex: "#ffe4b5" },
  { name: "Peach Puff", hex: "#ffdab9" },
  { name: "Papaya Whip", hex: "#ffefd5" },
  { name: "Antique White", hex: "#faebd7" },
  { name: "Linen", hex: "#faf0e6" },
  { name: "Old Lace", hex: "#fdf5e6" },
  { name: "Seashell", hex: "#fff5ee" },
  { name: "Snow", hex: "#fffafa" },
  { name: "Ivory", hex: "#fffff0" },
  { name: "Floral White", hex: "#fffaf0" },
  { name: "Beige", hex: "#f5f5dc" },
  { name: "Light Yellow", hex: "#ffffe0" },
  { name: "Light Goldenrod Yellow", hex: "#fafad2" },
  { name: "Lemon Chiffon", hex: "#fffacd" },
  { name: "Honeydew", hex: "#f0fff0" },
  { name: "Mint Cream", hex: "#f5fffa" },
  { name: "Azure", hex: "#f0ffff" },
  { name: "Alice Blue", hex: "#f0f8ff" },
  { name: "Light Cyan", hex: "#e0ffff" },
  { name: "Pale Turquoise", hex: "#afeeee" },
  { name: "Lavender Blush", hex: "#fff0f5" },
  { name: "Misty Rose", hex: "#ffe4e1" },
  { name: "Gainsboro", hex: "#dcdcdc" },
  { name: "Light Gray", hex: "#d3d3d3" },
  { name: "Dark Gray", hex: "#a9a9a9" },
  { name: "Dim Gray", hex: "#696969" },
  { name: "Slate Gray", hex: "#708090" },
  { name: "Light Slate Gray", hex: "#778899" },
  { name: "Dark Slate Gray", hex: "#2f4f4f" },
  { name: "White Smoke", hex: "#f5f5f5" },
];

// Precompute Lab for each named colour once.
const NAMED_LAB: ReadonlyArray<{ name: string; hex: string; lab: Lab }> =
  CURATED_COLOR_NAMES.map((c) => ({ name: c.name, hex: c.hex, lab: hexToLab(c.hex)! }));

/**
 * Resolve a hex to the nearest curated colour name by CIEDE2000.
 * Returns the name, the matched swatch hex, and the distance; falls back to the
 * raw hex as the name when the input cannot be parsed.
 */
export function nearestColorName(hex: string): { name: string; hex: string; deltaE: number } {
  const lab = hexToLab(hex);
  if (!lab) return { name: hex, hex, deltaE: Infinity };
  let best = NAMED_LAB[0];
  let bestD = Infinity;
  for (const c of NAMED_LAB) {
    const d = deltaE2000(lab, c.lab);
    if (d < bestD) { bestD = d; best = c; }
  }
  return { name: best.name, hex: best.hex, deltaE: bestD };
}
