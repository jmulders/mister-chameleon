/**
 * Item 8 — ads inherit-host wiring.
 *
 * Ads can adopt the publisher/host page's style (like the snippet's inherit
 * mode) IN ADDITION to the existing advertiser-brand model. This test exercises
 * the exact serve-path helpers (resolveAdInherit + buildAdSlot) that serveAds
 * uses, so it verifies the real behaviour without touching the DB:
 *
 *   - inherit mode  → the block adopts the HOST style (INHERIT_HOST_STYLE_VARS
 *     wrapper: --text:currentColor, backgrounds transparent).
 *   - brand mode    → NO inherit wrapper; the advertiser's brand tokens are
 *     emitted on the slot and govern the block (unchanged behaviour).
 *   - per-creative `inheritHost` flag overrides the advertiser-level default,
 *     in both directions.
 */

import { describe, it } from "node:test";
import assert            from "node:assert/strict";
import { resolveAdInherit, buildAdSlot } from "../../lib/ads/serve-ads.ts";
import { INHERIT_HOST_STYLE_VARS } from "../../lib/snippet/render-block-html.ts";

const CREATIVE: Record<string, unknown> = {
  tag: "Sponsored",
  title: "Ship faster with Acme",
  subtitle: "The all-in-one toolkit for growing teams.",
  ctas: [{ label: "Try it free", href: "https://acme.test" }],
};

// A stand-in advertiser-brand token layer (as resolveThemeForTenant would emit).
const BRAND_TOKENS: Record<string, string> = {
  "--primary": "#e11d48",
  "--hero-bg": "#111827",
  "--hero-title-color": "#ffffff",
};

describe("ads inherit-host: effective-flag resolution", () => {
  it("uses the advertiser-level default when the creative has no flag", () => {
    assert.equal(resolveAdInherit(CREATIVE, true), true);
    assert.equal(resolveAdInherit(CREATIVE, false), false);
  });

  it("per-creative inheritHost overrides the default (both directions)", () => {
    assert.equal(resolveAdInherit({ ...CREATIVE, inheritHost: true }, false), true);
    assert.equal(resolveAdInherit({ ...CREATIVE, inheritHost: false }, true), false);
  });

  it("ignores non-boolean inheritHost and falls back to the default", () => {
    assert.equal(resolveAdInherit({ ...CREATIVE, inheritHost: "yes" }, false), false);
    assert.equal(resolveAdInherit(null, true), true);
  });
});

describe("ads inherit-host: rendered slot (host vs brand)", () => {
  it("inherit mode adopts the host style (inherit wrapper present)", () => {
    const slot = buildAdSlot("hero", CREATIVE, BRAND_TOKENS, /* inherit */ true);
    assert.ok(slot && slot.mode === "block");
    // The block content is wrapped so the host page's colours win.
    assert.ok(slot.html.includes(INHERIT_HOST_STYLE_VARS), "expected the inherit-host wrapper");
    assert.match(slot.html, /--text:currentColor/);
    assert.match(slot.html, /--hero-bg:transparent/);
  });

  it("brand mode keeps the advertiser style (no inherit wrapper, brand tokens emitted)", () => {
    const slot = buildAdSlot("hero", CREATIVE, BRAND_TOKENS, /* inherit */ false);
    assert.ok(slot && slot.mode === "block");
    assert.ok(!slot.html.includes(INHERIT_HOST_STYLE_VARS), "brand mode must not wrap in inherit vars");
    // Advertiser brand tokens are carried on the slot container.
    assert.deepEqual(slot.tokens, BRAND_TOKENS);
    // And the advertiser's own hero palette vars remain in the block markup.
    assert.match(slot.html, /var\(--hero-bg/);
  });

  it("inherit is an ADDITION: same creative, only the wrapper differs", () => {
    const host  = buildAdSlot("hero", CREATIVE, BRAND_TOKENS, true)!;
    const brand = buildAdSlot("hero", CREATIVE, BRAND_TOKENS, false)!;
    assert.notEqual(host.html, brand.html);
    // The headline copy is identical in both modes — inherit changes styling only.
    assert.ok(host.html.includes("Ship faster with Acme"));
    assert.ok(brand.html.includes("Ship faster with Acme"));
  });
});
