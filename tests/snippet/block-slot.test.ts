/**
 * block-slot — turning a block variant's tokens into a snippet BlockSlot.
 *
 * ─── Wat dit bewaakt ─────────────────────────────────────────────────────────
 *
 *   De snippet zet block-tokens met style.setProperty op de container. Dat werkt
 *   alléén voor echte CSS-custom-properties (--foo). blockTokensToStyle geeft
 *   naast de --vars ook een paar camelCase React-props terug (backgroundColor);
 *   die mogen NOOIT als token naar de snippet lekken, anders roept hij
 *   setProperty("backgroundColor", …) aan — een no-op die de belofte breekt.
 *   Deze test pint dat alleen --vars doorgaan en dat een lege ref geen tokens
 *   oplevert (dan blijft het block gewoon HTML zonder styling-injectie).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { toBlockSlot, cssVarsFromTokenRef } from "@/lib/snippet/block-slot";

describe("cssVarsFromTokenRef", () => {
  it("keeps CSS custom properties and drops camelCase style props", () => {
    // background drives style["--bg"] AND style["backgroundColor"] — only --bg
    // is a real custom property the snippet can set.
    const vars = cssVarsFromTokenRef({ tokens: { background: "#0B5533" } });
    assert.equal(vars?.["--bg"], "#0B5533");
    assert.equal("backgroundColor" in (vars ?? {}), false);
  });

  it("returns undefined for an empty or missing ref", () => {
    assert.equal(cssVarsFromTokenRef(undefined), undefined);
    assert.equal(cssVarsFromTokenRef(null), undefined);
    assert.equal(cssVarsFromTokenRef({}), undefined);
    assert.equal(cssVarsFromTokenRef({ tokens: {} }), undefined);
  });
});

describe("toBlockSlot", () => {
  it("wraps HTML as a block value with resolved tokens", () => {
    const slot = toBlockSlot("<div class=\"mc-hero\">Hi</div>", { tokens: { background: "#111" } });
    assert.equal(slot.mode, "block");
    assert.equal(slot.html, "<div class=\"mc-hero\">Hi</div>");
    assert.equal(slot.tokens?.["--bg"], "#111");
  });

  it("omits tokens entirely when the ref yields none", () => {
    const slot = toBlockSlot("<div>Hi</div>");
    assert.equal(slot.mode, "block");
    assert.equal(slot.html, "<div>Hi</div>");
    assert.equal("tokens" in slot, false);
  });
});
