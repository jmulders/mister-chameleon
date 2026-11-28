/**
 * A theme that changes on an open page changes in one step.
 *
 * Measured on production on 26 Nov 2026: after a click on "Kerst" in Scenario
 * Control the hero was in the Christmas theme, and the header and its "Plan
 * een demo" button still had the colours of the theme before. The new tokens
 * were in <head>; the header (250 ms) and the button (150 ms) were fading to
 * them, and a fade only moves when the browser draws frames. Rebuilt locally
 * with the animation clock stopped: 27 transitions running, none arriving.
 *
 * The fix turns transitions off for the one commit that brings the new theme.
 * The runner cannot import .tsx, so the component and the layout are read as
 * source; the logic they call is tested directly.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  THEME_SWAP_ATTRIBUTE,
  themeSignature,
  holdTransitions,
  releaseTransitions,
} from "../../lib/theme/theme-swap.ts";
import { getDesignPreset } from "../../tenant/design-presets-gallery.ts";

/** An element that remembers what was done to it, in order. */
function fakeRoot() {
  const attributes = new Map<string, string>();
  const calls: string[] = [];
  return {
    attributes,
    calls,
    setAttribute(name: string, value: string) { attributes.set(name, value); calls.push(`set ${name}`); },
    removeAttribute(name: string) { attributes.delete(name); calls.push(`remove ${name}`); },
  };
}

describe("themeSignature", () => {
  it("is the same for the same theme", () => {
    assert.equal(themeSignature("[data-site]{--primary:#b3122a}", "", null), themeSignature("[data-site]{--primary:#b3122a}", "", null));
  });

  it("differs between the moments of the live site", () => {
    // What the root layout's token layer starts with for each of them.
    const signatures = ["teamnl-oranje", "valentine-romance", "spring-bloom", "halloween", "christmas"].map((id) => {
      const card = getDesignPreset(id);
      assert.ok(card, `preset ${id} exists`);
      return themeSignature("[data-site]{}", JSON.stringify(card!.tokenOverrides));
    });
    assert.equal(new Set(signatures).size, signatures.length);
  });

  it("changes when any one part changes", () => {
    const base = themeSignature("a", "b", "c", "d", "brand");
    assert.notEqual(themeSignature("A", "b", "c", "d", "brand"), base);
    assert.notEqual(themeSignature("a", "B", "c", "d", "brand"), base);
    assert.notEqual(themeSignature("a", "b", "C", "d", "brand"), base);
    assert.notEqual(themeSignature("a", "b", "c", "D", "brand"), base);
    assert.notEqual(themeSignature("a", "b", "c", "d", undefined), base);
  });

  it("keeps the parts apart", () => {
    assert.notEqual(themeSignature("ab", "c"), themeSignature("a", "bc"));
    assert.notEqual(themeSignature("ab", ""), themeSignature("", "ab"));
  });
});

describe("holding transitions during a theme swap", () => {
  it("has the attribute on while the browser works out the styles, and off after", () => {
    const root = fakeRoot();
    holdTransitions(root);
    assert.equal(root.attributes.has(THEME_SWAP_ATTRIBUTE), true);

    let heldWhileSettling: boolean | null = null;
    releaseTransitions(root, () => { heldWhileSettling = root.attributes.has(THEME_SWAP_ATTRIBUTE); });

    assert.equal(heldWhileSettling, true, "styles are worked out with transitions still off");
    assert.equal(root.attributes.has(THEME_SWAP_ATTRIBUTE), false);
    assert.deepEqual(root.calls, [`set ${THEME_SWAP_ATTRIBUTE}`, `remove ${THEME_SWAP_ATTRIBUTE}`]);
  });

  it("never leaves the attribute behind", () => {
    // Left on <html> it would turn off every transition on the page for good.
    const root = fakeRoot();
    holdTransitions(root);
    assert.throws(() => releaseTransitions(root, () => { throw new Error("no layout"); }));
    assert.equal(root.attributes.has(THEME_SWAP_ATTRIBUTE), false);
  });
});

describe("the page uses it", () => {
  const css    = readFileSync("app/globals.css", "utf8");
  const layout = readFileSync("app/layout.tsx", "utf8");
  const guard  = readFileSync("components/themes/ThemeSwapGuard.tsx", "utf8");

  it("turns every transition off while the attribute is on <html>", () => {
    const rule = css.match(/html\[data-theme-swap\] \*,\s*html\[data-theme-swap\] \*::before,\s*html\[data-theme-swap\] \*::after\s*\{([^}]*)\}/);
    assert.ok(rule, "the rule is in app/globals.css, for elements and their pseudo-elements");
    // !important: the header and the buttons set their transition with a utility class.
    assert.match(rule![1], /transition:\s*none\s*!important/);
    assert.equal(THEME_SWAP_ATTRIBUTE, "data-theme-swap");
  });

  it("signs every layer the root layout paints the theme with", () => {
    const call = layout.match(/themeSignature\(([^)]*)\)/);
    assert.ok(call, "the root layout makes a signature");
    for (const layer of ["cssVarBlock", "tokenOverrideCSS", "fontRedirectCSS", "navTypoCSS", "brandLayer"]) {
      assert.ok(call![1].includes(layer), `${layer} is part of the signature`);
    }
    // Each of those layers is still written to <head>: a layer that is painted
    // but not signed would change without the guard noticing.
    for (const layer of ["cssVarBlock", "tokenOverrideCSS", "fontRedirectCSS", "navTypoCSS"]) {
      assert.ok(layout.includes(`dangerouslySetInnerHTML={{ __html: ${layer} }}`), `${layer} is written to <head>`);
    }
  });

  it("mounts the guard in the root layout, with that signature", () => {
    const signed = layout.match(/const (\w+)\s*=\s*themeSignature\(/);
    assert.ok(signed);
    assert.ok(layout.includes(`<ThemeSwapGuard signature={${signed![1]}} />`));
  });

  it("holds before any layout effect runs and releases in the same commit", () => {
    // An insertion effect runs while React writes the DOM. A layout effect of
    // another component could otherwise measure first and start the fades.
    assert.match(guard, /useInsertionEffect\(\(\) => \{[^}]*holdTransitions\(document\.documentElement\)/);
    assert.match(guard, /useLayoutEffect\(\(\) => \{[\s\S]*?releaseTransitions\(document\.documentElement,/);
    // No timer and no animation frame: those are what stand still in a tab
    // that draws nothing.
    assert.doesNotMatch(guard, /setTimeout|requestAnimationFrame/);
    // The first render is the theme the server sent: nothing to swap.
    assert.match(guard, /useRef\(signature\)/);
  });
});
