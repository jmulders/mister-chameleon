/**
 * Unit tests for adaptiveVariantToContextEntry — the block-preview adapter that
 * maps an AdaptiveVariantContent (as edited in the drawer) into the one-slot
 * ContextSlotData the real page renderer consumes.
 *
 * Pure function, no infra — safe for the fast suite.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { adaptiveVariantToContextEntry } from "../../lib/tokens/adaptive-variant-to-context.ts";
import type { AdaptiveVariantContent } from "../../cms/types.ts";

describe("adaptiveVariantToContextEntry", () => {
  it("maps a hero variant with layout, media and tokens (full fidelity)", () => {
    const content: AdaptiveVariantContent = {
      title:        "Hi {name}",
      subtitle:     "Sub",
      tag:          "Eyebrow",
      layoutVariant: "hero_background",
      contentAlign:  "center",
      media:        { kind: "image", url: "https://x/y.jpg", alt: "y" },
      ctas:         [{ label: "Demo", href: "/demo", variant: "primary" }],
      tokenSet:     "brand-dark",
      tokens:       { primary: "#123456" },
    };
    const out = adaptiveVariantToContextEntry("hero", content, "hero_default");
    assert.ok(out?.hero, "hero entry present");
    assert.equal(out!.hero!.id, "hero_default");
    assert.equal(out!.hero!.title, "Hi {name}");
    assert.equal(out!.hero!.layoutVariant, "hero_background");
    assert.equal(out!.hero!.contentAlign, "center");
    assert.deepEqual(out!.hero!.media, { kind: "image", url: "https://x/y.jpg", alt: "y" });
    // per-block override carried through so the preview restyles like production
    assert.deepEqual(out!.hero!.tokenRef, { tokenSet: "brand-dark", tokens: { primary: "#123456" } });
  });

  it("maps a proof variant's items to {title,text}", () => {
    const content: AdaptiveVariantContent = {
      title:    "Proof",
      subtitle: "",
      items:    [{ title: "3.2×", text: "more leads", imageUrl: "", cta: "", ctaHref: "" }],
      layoutVariant: "proof_stats",
    };
    const out = adaptiveVariantToContextEntry("proof", content, "proof_default");
    assert.ok(out?.proof);
    assert.equal(out!.proof!.title, "Proof");
    assert.deepEqual(out!.proof!.items, [{ title: "3.2×", text: "more leads" }]);
    assert.equal(out!.proof!.layoutVariant, "proof_stats");
    assert.equal(out!.proof!.tokenRef, undefined); // no tokens → no ref
  });

  it("maps a cta variant (subtitle→text, first cta→primary)", () => {
    const content: AdaptiveVariantContent = {
      title:    "Ready?",
      subtitle: "Start today",
      ctas:     [{ label: "Go", href: "/signup", variant: "primary" }],
    };
    const out = adaptiveVariantToContextEntry("cta", content, "cta_default");
    assert.ok(out?.cta);
    assert.equal(out!.cta!.text, "Start today");
    assert.deepEqual(out!.cta!.cta, { label: "Go", href: "/signup" });
  });

  it("maps a feature variant's items to {title,body,icon}", () => {
    const content: AdaptiveVariantContent = {
      title:    "Features",
      subtitle: "",
      items:    [{ title: "Fast", text: "Edge-native", imageUrl: "bolt", cta: "", ctaHref: "" }],
    };
    const out = adaptiveVariantToContextEntry("feature", content, "feature_default");
    assert.ok(out?.feature);
    assert.deepEqual(out!.feature!.items, [{ title: "Fast", body: "Edge-native", icon: "bolt" }]);
  });

  it("returns null for slot types without a live preview path", () => {
    const content: AdaptiveVariantContent = { title: "x", subtitle: "" };
    assert.equal(adaptiveVariantToContextEntry("conversion", content, "conversion_default"), null);
    assert.equal(adaptiveVariantToContextEntry("notification", content, "notification_default"), null);
  });
});
