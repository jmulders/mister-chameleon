/**
 * Pure colour maths for the preset colour explorer.
 *
 * hex -> sRGB -> linear -> XYZ (D65) -> CIELAB, the CIEDE2000 colour-difference
 * metric (deltaE2000), plus small helpers used to derive a complete look from a
 * few seed colours (mix / lighten / darken / readable text) and to facet presets
 * (relative luminance -> light/dark, hue family). No React or app imports.
 */

export interface Rgb { r: number; g: number; b: number } // 0..255
export interface Lab { L: number; a: number; b: number }

/** Parse #rgb / #rrggbb (with or without leading #). Returns null when invalid. */
export function hexToRgb(hex: string): Rgb | null {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Clamp 0..255 and format as #rrggbb. */
export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function srgbChannelToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance (WCAG), 0 (black) .. 1 (white). */
export function relativeLuminance(rgb: Rgb): number {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** sRGB -> CIELAB (D65 reference white). */
export function rgbToLab(rgb: Rgb): Lab {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  // linear sRGB -> XYZ (D65)
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  // normalise by D65 white
  const xn = x / 0.95047;
  const yn = y / 1.0;
  const zn = z / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(xn), fy = f(yn), fz = f(zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Convenience: parse a hex and return its Lab, or null when invalid. */
export function hexToLab(hex: string): Lab | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToLab(rgb) : null;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * CIEDE2000 colour difference between two Lab colours. Lower = more similar
 * (0 = identical). Implements the standard formulation (Sharma et al.).
 */
export function deltaE2000(a: Lab, b: Lab): number {
  const kL = 1, kC = 1, kH = 1;
  const C1 = Math.hypot(a.a, a.b);
  const C2 = Math.hypot(b.a, b.b);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
  const a1p = (1 + G) * a.a;
  const a2p = (1 + G) * b.a;
  const C1p = Math.hypot(a1p, a.b);
  const C2p = Math.hypot(a2p, b.b);
  const h1p = hueAngle(a.b, a1p);
  const h2p = hueAngle(b.b, a2p);

  const dLp = b.L - a.L;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * DEG2RAD);

  const Lbarp = (a.L + b.L) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2;
  } else {
    hbarp = (h1p + h2p - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((hbarp - 30) * DEG2RAD)
    + 0.24 * Math.cos((2 * hbarp) * DEG2RAD)
    + 0.32 * Math.cos((3 * hbarp + 6) * DEG2RAD)
    - 0.20 * Math.cos((4 * hbarp - 63) * DEG2RAD);

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin((2 * dTheta) * DEG2RAD) * Rc;

  return Math.sqrt(
    Math.pow(dLp / (kL * Sl), 2) +
    Math.pow(dCp / (kC * Sc), 2) +
    Math.pow(dHp / (kH * Sh), 2) +
    Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)),
  );
}

function hueAngle(b: number, ap: number): number {
  if (ap === 0 && b === 0) return 0;
  const deg = Math.atan2(b, ap) * RAD2DEG;
  return deg >= 0 ? deg : deg + 360;
}

/** deltaE2000 straight from two hex strings; returns Infinity for invalid input. */
export function deltaEHex(hexA: string, hexB: string): number {
  const la = hexToLab(hexA), lb = hexToLab(hexB);
  if (!la || !lb) return Infinity;
  return deltaE2000(la, lb);
}

// ── Palette-derivation helpers (custom preset from seed colours) ────────────────

/** Linear-ish mix of two colours in sRGB space; t=0 -> a, t=1 -> b. */
export function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  if (!a || !b) return hexA;
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  });
}

/** Mix toward black by amount (0..1). */
export function darken(hex: string, amount: number): string {
  return mix(hex, "#000000", amount);
}

/** Mix toward white by amount (0..1). */
export function lighten(hex: string, amount: number): string {
  return mix(hex, "#ffffff", amount);
}

/** Readable text colour (near-black or white) for a given background. */
export function readableText(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return "#111111";
  return relativeLuminance(rgb) > 0.5 ? "#111111" : "#ffffff";
}

/** True when the colour is a light surface (luminance above the midpoint). */
export function isLight(hex: string): boolean {
  const rgb = hexToRgb(hex);
  return rgb ? relativeLuminance(rgb) > 0.5 : false;
}

export type HueFamily =
  | "neutral" | "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "pink";

/**
 * Coarse hue family from a hex, or "neutral" when the Lab chroma is low (greige
 * / stone / near-white). Uses the perceptual Lab hue angle so faceting matches
 * how the colour reads, not raw HSL (which overstates saturation on pale tints).
 */
export function hueFamily(hex: string): HueFamily {
  const lab = hexToLab(hex);
  if (!lab) return "neutral";
  const chroma = Math.hypot(lab.a, lab.b);
  if (chroma < 14) return "neutral";
  let h = Math.atan2(lab.b, lab.a) * RAD2DEG;
  if (h < 0) h += 360;
  if (h < 20) return "pink";
  if (h < 50) return "red";
  if (h < 70) return "orange";
  if (h < 105) return "yellow";
  if (h < 165) return "green";
  if (h < 210) return "teal";
  if (h < 300) return "blue";
  if (h < 340) return "purple";
  return "pink";
}
