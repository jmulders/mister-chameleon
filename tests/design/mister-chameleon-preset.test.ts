/**
 * "Mister Chameleon" gallery preset: the platform's own house style.
 *
 * Locks that the preset can be chosen in the admin, that its tokens are valid,
 * and that it stays within what docs/website/huisstijl.md allows: the colours
 * of the logo manual, flat surfaces, headings in bold capitals.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getDesignPreset } from "../../tenant/design-presets-gallery.ts";
import { validateDesignTokenUpload } from "../../tenant/design-token-validator.ts";
import { blockTokensFromOverrides } from "../../design-system/theme/preset-to-block-tokens.ts";
import { SUPPORTED_GOOGLE_FONTS } from "../../lib/supported-fonts.ts";
import { resolveThemeForTenant } from "../../tenant/resolve-theme.ts";
import { buildCompleteLookDesign } from "../../lib/design/complete-look.ts";
import type { TenantSettings } from "../../tenant/types.ts";

/** The 18 colours of the logo's gradient plus the manual's black. */
const MANUAL = [
  "#e64415", "#e2001a", "#cb005a", "#a1057d", "#672180", "#00519e", "#006ab3", "#008fd3", "#009ee0",
  "#00989c", "#00957a", "#009036", "#41a62a", "#92bd11", "#bdcd00", "#d2d600", "#e5de00", "#ede100",
  "#1a171b",
];

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
/** A grey: the three channels within a few steps of each other. */
function isNeutral(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(...rgb) - Math.min(...rgb) <= 8;
}

describe("Mister Chameleon gallery preset", () => {
  const card   = getDesignPreset("mister-chameleon");
  const color  = (card?.tokenOverrides.color  ?? {}) as Record<string, string>;
  const layout = (card?.tokenOverrides.layout ?? {}) as Record<string, string>;
  const type   = (card?.tokenOverrides.typography ?? {}) as Record<string, string>;

  it("is registered in the gallery under its own category", () => {
    assert.ok(card, "expected getDesignPreset('mister-chameleon') to resolve");
    assert.equal(card!.name, "Mister Chameleon");
    assert.equal(card!.category, "House style");
    assert.equal(card!.baseTheme, "custom");
  });

  it("is listed first in the admin gallery", () => {
    const gallery = readFileSync("app/admin/tenants/[tenantId]/design/_components/PresetGallery.tsx", "utf8");
    assert.match(gallery, /CATEGORY_ORDER = \[\s*"House style"/);
  });

  it("brings the circles with it", () => {
    assert.equal(card!.brandLayer, "mister-chameleon");
  });

  it("passes the same validator an uploaded token file goes through", () => {
    const res = validateDesignTokenUpload(card!.tokenOverrides);
    assert.equal(res.ok, true, res.ok ? "" : `errors: ${JSON.stringify((res as { errors: unknown }).errors)}`);
  });

  it("uses only colours of the logo manual, white and neutral greys", () => {
    const values = [...Object.values(color), ...Object.values(layout), card!.tokenOverrides.focus?.ringColor ?? ""];
    const hexes  = values.flatMap((v) => [...v.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()));
    assert.ok(hexes.length > 20);
    // The hover step of the purple is the one colour the manual does not give.
    const allowed = new Set([...MANUAL, "#ffffff", color["primaryHover"]!]);
    for (const hex of hexes) {
      assert.ok(allowed.has(hex) || isNeutral(hex), `${hex} is not in the logo manual`);
    }
    assert.equal(color["primary"], "#672180");
    assert.equal(color["foreground"], "#1a171b");
    assert.equal(color["background"], "#ffffff");
  });

  it("is flat: hero and CTA are one solid colour each", () => {
    for (const key of ["gradient", "gradientHero"]) {
      const stops = [...color[key]!.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
      assert.equal(new Set(stops).size, 1, `${key} mixes colours`);
    }
  });

  it("sets headings in bold capitals", () => {
    assert.equal(type["headingTransform"], "uppercase");
    assert.ok(Number(type["headingWeight"]) >= 700);
  });

  it("uses a typeface the platform can serve", () => {
    const stacks = SUPPORTED_GOOGLE_FONTS.map((f) => f.stack);
    for (const key of ["fontHeading", "fontBody", "fontSans", "fontUI"]) {
      assert.ok(stacks.includes(type[key]!), `${key}: ${type[key]} is not a supported font`);
    }
  });

  it("keeps text readable (WCAG AA)", () => {
    const pairs: Array<[string, string, string]> = [
      ["text on the page",          color["foreground"]!,      color["background"]!],
      ["muted text on the page",    color["mutedForeground"]!, color["background"]!],
      ["muted text on a subtle bg", color["mutedForeground"]!, color["muted"]!],
      ["button text",               color["onPrimary"]!,       color["primary"]!],
      ["button text on hover",      color["onPrimary"]!,       color["primaryHover"]!],
      ["link on the page",          color["link"]!,            color["background"]!],
      ["heading in the brand colour", color["primary"]!,       color["background"]!],
      ["error text",                color["danger"]!,          color["background"]!],
      ["header",                    layout["headerFg"]!,       layout["headerBg"]!],
      ["footer",                    layout["footerFg"]!,       layout["footerBg"]!],
    ];
    for (const [label, fg, bg] of pairs) {
      assert.ok(contrast(fg, bg) >= 4.5, `${label}: ${fg} on ${bg} is ${contrast(fg, bg).toFixed(2)}`);
    }
  });

  it("derives a dark hero and a dark CTA with white text for the blocks", () => {
    const tokens = blockTokensFromOverrides(card!.tokenOverrides) as Record<string, string>;
    assert.equal(tokens["heroTitleColor"], "#ffffff");
    // No glow on the flat black hero: it takes the colour of the surface.
    assert.equal(tokens["heroGlowColor"], "#1a171b");
    assert.equal(tokens["ctaBodyText"], "rgba(255,255,255,0.88)");
    assert.equal(tokens["btnBg"], "#672180");
    assert.equal(tokens["headingFont"], "'Montserrat', system-ui, sans-serif");
  });

  it("puts every block heading in capitals, not only the plain ones", () => {
    const design = buildCompleteLookDesign({ theme: "custom" }, card!.tokenOverrides, card!.baseTheme);
    const { vars } = resolveThemeForTenant({ design } as unknown as TenantSettings);
    assert.equal(vars["--heading-transform"], "uppercase");
    assert.equal(vars["--block-heading-transform"], "uppercase");
  });
});

describe("heading capitals and a flat hero for every preset", () => {
  it("leaves the block headings alone when a preset says none", () => {
    const aurora = getDesignPreset("aurora-purple-gold")!;
    const design = buildCompleteLookDesign({ theme: "custom" }, aurora.tokenOverrides, aurora.baseTheme);
    const { vars } = resolveThemeForTenant({ design } as unknown as TenantSettings);
    assert.equal(vars["--block-heading-transform"], undefined);
  });

  it("leaves the block headings alone while typography overrides are off", () => {
    const design = { ...buildCompleteLookDesign({ theme: "custom" }, card().tokenOverrides, "custom" as const), typographyOverrideEnabled: false };
    const { vars } = resolveThemeForTenant({ design } as unknown as TenantSettings);
    assert.equal(vars["--block-heading-transform"], undefined);
  });

  it("keeps the glow on a hero that really is a gradient", () => {
    const aurora = getDesignPreset("aurora-purple-gold")!;
    const tokens = blockTokensFromOverrides(aurora.tokenOverrides) as Record<string, string>;
    assert.equal(tokens["heroGlowColor"], (aurora.tokenOverrides.color as Record<string, string>)["secondary"]);
  });

  function card() { return getDesignPreset("mister-chameleon")!; }
});
