/**
 * A page keeps its heading and introduces itself for the visitor's audience.
 *
 * The hero of a CMS page is a block with a default and, optionally, variants
 * filed under the hero key the rule engine picks for an audience. The slot
 * names that key as preferred. This pins what the renderer relies on: a block
 * with such a variant gives it, a block without gives the default, and the
 * renderer asks for it.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { AdaptiveBlockData } from "@/cms/types";
import { resolveAdaptiveVariant } from "@/lib/tokens/resolve-adaptive-variant";

const block = (variants: AdaptiveBlockData["adaptiveVariants"]): AdaptiveBlockData => ({
  id:               "1",
  key:              "hero_page_functies",
  tenantId:         "statamic",
  isActive:         true,
  defaultVariant:   { title: "Wat je ermee kunt", subtitle: "Voor iedereen.", tag: "Functies" },
  adaptiveVariants: variants,
} as AdaptiveBlockData);

const forAgencies = {
  variantKey: "hero_role_bureau",
  content:    { title: "Wat je ermee kunt", subtitle: "Voor je klanten.", tag: "Voor bureaus" },
} as AdaptiveBlockData["adaptiveVariants"][number];

describe("the page banner for a demo role", () => {
  it("gives the variant filed under the hero the engine picked", () => {
    const picked = resolveAdaptiveVariant(block([forAgencies]), { variantKey: "hero_role_bureau" });
    assert.equal(picked.isDefault, false);
    assert.equal(picked.content.tag, "Voor bureaus");
    assert.equal(picked.content.title, "Wat je ermee kunt");
  });

  it("gives the default when the page has no variant for that hero", () => {
    for (const variants of [[], [forAgencies]]) {
      const picked = resolveAdaptiveVariant(block(variants), { variantKey: "hero_linkedin_vision" });
      assert.equal(picked.isDefault, true);
      assert.equal(picked.content.subtitle, "Voor iedereen.");
    }
  });

  it("is asked for by the renderer and handed over by the page decision", () => {
    const root     = join(import.meta.dirname, "../..");
    const renderer = readFileSync(join(root, "components/platform/TemplateRenderer.tsx"), "utf8");
    const decision = readFileSync(join(root, "lib/cms-page-decision.ts"), "utf8");
    assert.match(renderer, /loadHero\(key, slot\.preferredVariantKey\)/);
    assert.match(renderer, /resolveAdaptiveVariant\(own, \{ variantKey: preferredVariantKey \}\)/);
    assert.match(decision, /resolveHeroSlotKeys\(slot\.variantKey, resolvedBannerKey, plan\.heroKey\)/);
  });
});
