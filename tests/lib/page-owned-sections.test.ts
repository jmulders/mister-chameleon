/**
 * A section a page owns, written per audience.
 *
 * Besides its heading a CMS page can hold sections in its own blocks
 * (`feature_page_<slug>`, `proof_page_<slug>`, `cta_page_<slug>`). The rule
 * engine does not swap them for the block it picked for that slot. It does say
 * who is reading: the block shows its variant for the hero the engine picked,
 * and a block whose default is empty is a section for some audiences only.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { AdaptiveBlockData, AdaptiveVariantContent } from "@/cms/types";
import { isPageOwnedSlotKey, resolvePageOwnedSlotKeys } from "@/lib/page-hero-key";
import { isEmptySection } from "@/lib/blocks/empty-section";
import { resolveAdaptiveVariant } from "@/lib/tokens/resolve-adaptive-variant";
import { adaptiveVariantToContextEntry } from "@/lib/tokens/adaptive-variant-to-context";

describe("which keys a page owns", () => {
  it("knows a page-owned key in every slot", () => {
    assert.equal(isPageOwnedSlotKey("feature", "feature_page_functies"), true);
    assert.equal(isPageOwnedSlotKey("proof", "proof_page_integraties"), true);
    assert.equal(isPageOwnedSlotKey("cta", "cta_page_cases"), true);
    assert.equal(isPageOwnedSlotKey("hero", "hero_page_functies"), true);
  });

  it("leaves the shared keys and the banners to the rule engine", () => {
    for (const [slot, key] of [
      ["feature", "feature_highlights"], ["proof", "proof_default"], ["cta", "cta_default"],
      ["hero", "hero_page_banner_awareness"], ["proof", "feature_page_functies"], ["cta", null], ["", "_page_x"],
    ] as const) {
      assert.equal(isPageOwnedSlotKey(slot, key), false, `${slot} ${key}`);
    }
  });

  it("keeps the page's block and prefers the variant of the audience", () => {
    assert.deepEqual(
      resolvePageOwnedSlotKeys("feature_page_functies", "hero_role_bureau"),
      { variantKey: "feature_page_functies", preferredVariantKey: "hero_role_bureau" },
    );
    assert.deepEqual(resolvePageOwnedSlotKeys("feature_page_functies", undefined), { variantKey: "feature_page_functies" });
    assert.deepEqual(resolvePageOwnedSlotKeys("feature_page_functies", null), { variantKey: "feature_page_functies" });
  });
});

describe("a section for some audiences only", () => {
  const forAgencies: AdaptiveVariantContent = {
    title:    "Dit gebruik je als bureau",
    subtitle: "Drie functies om mee te beginnen.",
    items:    [{ title: "Voor bureaus", body: "Alle klantsites in één omgeving.", icon: "users", cta: "Lees meer", ctaHref: "/cases/klantsites-in-een-omgeving" }],
  } as AdaptiveVariantContent;

  const block: AdaptiveBlockData = {
    id: "1", key: "feature_page_functies", tenantId: "statamic", isActive: true,
    defaultVariant:   { title: "" } as AdaptiveVariantContent,
    adaptiveVariants: [{ variantKey: "hero_role_bureau", content: forAgencies }],
  };

  it("is empty without a title, an intro or an item with text", () => {
    for (const content of [null, undefined, {}, { title: "  " }, { title: "", items: [] }, { items: [{ title: "", body: " " }] }]) {
      assert.equal(isEmptySection(content as AdaptiveVariantContent), true, JSON.stringify(content));
    }
    for (const content of [{ title: "x" }, { subtitle: "x" }, { items: [{ title: "x" }] }, { items: [{ text: "x" }] }, forAgencies]) {
      assert.equal(isEmptySection(content as AdaptiveVariantContent), false, JSON.stringify(content));
    }
  });

  it("is there for the audience it has a variant for and absent for everyone else", () => {
    const agency  = resolveAdaptiveVariant(block, { variantKey: "hero_role_bureau" }).content;
    const someone = resolveAdaptiveVariant(block, { variantKey: "hero_linkedin_vision" }).content;
    const nobody  = resolveAdaptiveVariant(block, {}).content;
    assert.equal(isEmptySection(agency), false);
    assert.equal(isEmptySection(someone), true);
    assert.equal(isEmptySection(nobody), true);
  });

  it("carries the intro, the icon and the link of a card to the page", () => {
    const entry = adaptiveVariantToContextEntry("feature", forAgencies, block.key);
    assert.equal(entry?.feature?.title, "Dit gebruik je als bureau");
    assert.equal(entry?.feature?.subtitle, "Drie functies om mee te beginnen.");
    const card = entry?.feature?.items[0];
    assert.equal(card?.icon, "users");
    assert.equal(card?.ctaHref, "/cases/klantsites-in-een-omgeving");
    assert.equal(card?.ctaLabel, "Lees meer");
  });
});

describe("the page decision and the renderer", () => {
  const root     = join(import.meta.dirname, "../..");
  const decision = readFileSync(join(root, "lib/cms-page-decision.ts"), "utf8");
  const renderer = readFileSync(join(root, "components/platform/TemplateRenderer.tsx"), "utf8");

  it("does not hand a page-owned section to the engine's pick for that slot", () => {
    const own    = decision.indexOf("isPageOwnedSlotKey(slot.slotId, slot.variantKey)");
    const engine = decision.indexOf("const engineKey = planKeyForSlot(plan, slot.slotId)");
    assert.ok(own > 0 && engine > own, "the page-owned check must come before the engine key is applied");
    assert.match(decision, /resolvePageOwnedSlotKeys\(slot\.variantKey, plan\.heroKey\)/);
  });

  it("asks the page's own block first, for proof, cta and feature", () => {
    assert.equal((renderer.match(/const own = await loadOwnSection\(slot\);/g) ?? []).length, 3);
    assert.match(renderer, /if \(isEmptySection\(content\)\) return \{\};/);
  });

  it("draws a card's link under the card, and only a safe one", () => {
    assert.match(renderer, /linksUnderCard && featureLinkHref\(item\.ctaHref\)/);
  });
});
