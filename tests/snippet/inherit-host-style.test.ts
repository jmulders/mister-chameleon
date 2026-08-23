/**
 * Inherit-host-style mode for snippet block rendering.
 *
 * When opts.inherit is set, the block HTML is wrapped in a scope that overrides
 * the theme tokens to inherit/transparent/currentColor so the host page's own
 * colours win. Off the inherit path, output must be byte-identical to before
 * (the shadow vars stay unset), so ads/email/normal snippet are unaffected.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderBlockHtml,
  INHERIT_HOST_STYLE_VARS,
} from "../../lib/snippet/render-block-html.ts";

const cta = { title: "Ready?", text: "Start today.", cta: { label: "Start", href: "/start" } };
const hero = { title: "Welcome", subtitle: "Hi", ctas: [{ label: "Go", href: "/go" }] };

describe("renderBlockHtml inherit mode", () => {
  it("wraps output in the inherit-host-style scope when inherit is on", () => {
    const html = renderBlockHtml("cta", cta, { inherit: true })!;
    assert.ok(html.startsWith(`<div style="${INHERIT_HOST_STYLE_VARS}">`), "expected inherit wrapper");
    assert.ok(html.endsWith("</div>"));
    // The scope sets host-inheriting values (currentColor for text, transparent
    // for surfaces) — not the `inherit` keyword, which would resolve a custom
    // property to its ancestor's value instead of the element's colour.
    assert.ok(INHERIT_HOST_STYLE_VARS.includes("--text:currentColor"));
    assert.ok(!INHERIT_HOST_STYLE_VARS.includes("--text:inherit"));
    assert.ok(INHERIT_HOST_STYLE_VARS.includes("--hero-bg:transparent"));
    assert.ok(INHERIT_HOST_STYLE_VARS.includes("--btn-inherit-bg:transparent"));
  });

  it("does not wrap when inherit is off (default)", () => {
    const plain = renderBlockHtml("cta", cta)!;
    assert.ok(!plain.includes(INHERIT_HOST_STYLE_VARS));
    assert.ok(plain.startsWith("<section"));
    // Same as passing inherit:false explicitly.
    assert.equal(renderBlockHtml("cta", cta, { inherit: false }), plain);
  });

  it("buttons carry the shadow vars so they can be re-themed by the inherit scope", () => {
    const plain = renderBlockHtml("hero", hero)!;
    // Non-regressive: the button still renders its brand fallback inline.
    assert.ok(plain.includes("var(--btn-inherit-bg,var(--primary,#4f46e5))"));
    assert.ok(plain.includes("var(--btn-border,transparent)"));
  });

  it("drops inline typographic sizing in inherit mode so host CSS governs sizes", () => {
    const plain = renderBlockHtml("hero", hero)!;
    // Normal mode keeps the sizing inline.
    assert.match(plain, /font-size:/);
    assert.match(plain, /font-weight:/);
    assert.match(plain, /line-height:/);

    const inherited = renderBlockHtml("hero", hero, { inherit: true })!;
    assert.ok(!/font-size:/.test(inherited), "font-size should be stripped");
    assert.ok(!/font-weight:/.test(inherited), "font-weight should be stripped");
    assert.ok(!/line-height:/.test(inherited), "line-height should be stripped");
    assert.ok(!/letter-spacing:/.test(inherited), "letter-spacing should be stripped");
    assert.ok(!/text-transform:/.test(inherited), "text-transform should be stripped");
    // font-family:inherit is preserved so typography still flows from the host.
    assert.match(inherited, /font-family:inherit/);
  });
});
