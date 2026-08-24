/**
 * blockTokensFromOverrides — luminance-aware hero/CTA text.
 *
 * The bug this guards against: a preset that ships a LIGHT gradient (e.g. Trans
 * Pride's blue/pink/white bands) used to get hardcoded white hero/CTA text on the
 * assumption that gradients are dark, so the copy fell away. The derivation now
 * measures the gradient's average luminance and switches light gradients to the
 * preset's dark foreground (plus a solid brand CTA button).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blockTokensFromOverrides, liftDarkCardTokens,
} from "../../design-system/theme/preset-to-block-tokens.ts";
import { contrastRatio } from "../../lib/color/index.ts";
import type { TenantTokenOverrides } from "../../tenant/types.ts";

// Trans Pride: light CTA + hero gradient, dark foreground.
const lightGradient =
  "linear-gradient(180deg, #55cdfc 0%, #f7a8b8 25%, #ffffff 50%, #f7a8b8 75%, #55cdfc 100%)";
// Aurora Purple: dark gradient.
const darkGradient = "linear-gradient(135deg, #7c3aed 0%, #d946ef 100%)";
const darkHeroGradient = "linear-gradient(180deg, #1a0533 0%, #4c1d95 52%, #7c3aed 100%)";

function overrides(color: Record<string, string>): TenantTokenOverrides {
  return { color } as unknown as TenantTokenOverrides;
}

describe("blockTokensFromOverrides — light gradient", () => {
  const out = blockTokensFromOverrides(
    overrides({
      foreground:       "#1c2a33",
      mutedForeground:  "#3a4a54",
      primary:          "#5bcefa",
      onPrimary:        "#0b1418",
      secondary:        "#f5a9b8",
      gradient:         lightGradient,
      gradientHero:     lightGradient,
    }),
  ) as Record<string, string>;

  it("uses the dark foreground for hero title/subtitle", () => {
    assert.equal(out.heroBg, lightGradient);
    assert.equal(out.heroTitleColor, "#1c2a33");
    assert.equal(out.heroSubtitleColor, "#3a4a54");
    // Brand primary glow, not the washed-out light secondary.
    assert.equal(out.heroGlowColor, "#5bcefa");
  });

  it("uses dark CTA text + heading and a solid brand button", () => {
    assert.equal(out.ctaBg, lightGradient);
    assert.equal(out.ctaBodyText, "#3a4a54");
    assert.equal(out.textInverse, "#1c2a33");
    assert.equal(out.ctaButtonBg, "#5bcefa");
    assert.equal(out.ctaButtonText, "#0b1418");
  });
});

describe("blockTokensFromOverrides — dark gradient (unchanged behaviour)", () => {
  const out = blockTokensFromOverrides(
    overrides({
      foreground:   "#2e1065",
      primary:      "#7c3aed",
      secondary:    "#d946ef",
      gradient:     darkGradient,
      gradientHero: darkHeroGradient,
    }),
  ) as Record<string, string>;

  it("keeps white hero text and the secondary glow", () => {
    assert.equal(out.heroTitleColor, "#ffffff");
    assert.equal(out.heroSubtitleColor, "rgba(255,255,255,0.85)");
    assert.equal(out.heroGlowColor, "#d946ef");
  });

  it("keeps white CTA body and leaves the inverse/button tokens unset", () => {
    assert.equal(out.ctaBodyText, "rgba(255,255,255,0.88)");
    assert.equal(out.textInverse, undefined);
    assert.equal(out.ctaButtonBg, undefined);
    assert.equal(out.ctaButtonText, undefined);
  });
});

describe("liftDarkCardTokens — card-on-dark separation", () => {
  it("lifts a dark card that barely separates from a dark subtle section", () => {
    // Saved dark amber preset shape: card ~ muted, both dark, almost no contrast.
    const lift = liftDarkCardTokens("#231a12", "#1c140d", "#f5e9d8");
    assert.ok(lift, "expected a lift");
    const sep = contrastRatio(lift.cardBg, "#1c140d");
    assert.ok(sep !== null && sep >= 1.4, `card should clear the target, got ${sep}`);
    // Border is strengthened toward the text (not left equal to the raw border).
    assert.notEqual(lift.cardBorder, "#1c140d");
  });

  it("does not lift on a light subtle section", () => {
    assert.equal(liftDarkCardTokens("#ffffff", "#f4f4f5", "#111111"), null);
  });

  it("does not lift a card that already separates well (idempotent)", () => {
    // A card lifted once clears the target, so a second pass is a no-op.
    const first = liftDarkCardTokens("#231a12", "#1c140d", "#f5e9d8");
    assert.ok(first);
    assert.equal(liftDarkCardTokens(first.cardBg, "#1c140d", "#f5e9d8"), null);
  });

  it("returns null when card or subtle bg is missing or unparseable", () => {
    assert.equal(liftDarkCardTokens(undefined, "#1c140d", "#fff"), null);
    assert.equal(liftDarkCardTokens("#231a12", undefined, "#fff"), null);
    assert.equal(liftDarkCardTokens("transparent", "#1c140d", "#fff"), null);
  });

  it("applies the lift through blockTokensFromOverrides on a dark preset", () => {
    const out = blockTokensFromOverrides(
      overrides({ card: "#231a12", muted: "#1c140d", foreground: "#f5e9d8" }),
    ) as Record<string, string>;
    const sep = contrastRatio(out.cardBg, out.bgSubtle);
    assert.ok(sep !== null && sep >= 1.4, `derived card should clear the target, got ${sep}`);
  });

  it("leaves a light-preset card untouched through the derivation", () => {
    const out = blockTokensFromOverrides(
      overrides({ card: "#ffffff", muted: "#f4f4f5", foreground: "#111111", border: "#e5e7eb" }),
    ) as Record<string, string>;
    assert.equal(out.cardBg, "#ffffff");
    assert.equal(out.cardBorder, "#e5e7eb");
  });
});

describe("blockTokensFromOverrides — no gradient", () => {
  it("emits no hero/CTA background or text tokens", () => {
    const out = blockTokensFromOverrides(
      overrides({ primary: "#7c3aed", foreground: "#111111" }),
    ) as Record<string, string>;
    assert.equal(out.heroBg, undefined);
    assert.equal(out.ctaBg, undefined);
    assert.equal(out.ctaBodyText, undefined);
    assert.equal(out.textInverse, undefined);
  });
});
