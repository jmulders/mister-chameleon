/**
 * Item 6 — contextual gallery block tokens.
 *
 * The block tokens injected for a contextually-selected gallery preset must
 * EQUAL the defaultTokens that applying that preset produces (buildCompleteLookDesign),
 * and must DIFFER from a different preset's tokens (so B is not masked by A).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DESIGN_PRESET_GALLERY } from "../../tenant/design-presets-gallery.ts";
import { blockTokensFromOverrides } from "../../design-system/theme/preset-to-block-tokens.ts";
import { buildCompleteLookDesign } from "../../lib/design/complete-look.ts";

const withOverrides = DESIGN_PRESET_GALLERY.filter(
  (c) => c.tokenOverrides && Object.keys(c.tokenOverrides).length > 0,
);
const A = withOverrides[0];
const B = withOverrides[1];
const baseDesign = { theme: "modern-saas" } as unknown as Parameters<typeof buildCompleteLookDesign>[0];

describe("contextual gallery block tokens", () => {
  it("injected tokens equal the applied preset's derived defaultTokens", () => {
    // Injected (what the helper returns): blockTokensFromOverrides(card.tokenOverrides).
    const injected = blockTokensFromOverrides(B.tokenOverrides);
    // Applied: what buildCompleteLookDesign stores as design.defaultTokens.
    const applied = buildCompleteLookDesign(baseDesign, B.tokenOverrides, B.baseTheme).defaultTokens;
    assert.deepEqual(injected, applied, "injected block tokens must match the applied preset's defaultTokens");
  });

  it("preset B's tokens differ from preset A's (B is not masked by A)", () => {
    const a = blockTokensFromOverrides(A.tokenOverrides);
    const b = blockTokensFromOverrides(B.tokenOverrides);
    assert.notDeepEqual(a, b, "two distinct presets should derive distinct block tokens");
  });
});
