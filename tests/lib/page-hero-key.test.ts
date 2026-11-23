import { test } from "node:test";
import assert from "node:assert/strict";
import { isPageOwnedHeroKey, resolveHeroSlotKeys } from "../../lib/page-hero-key";

test("a key that names a page is page-owned", () => {
  assert.equal(isPageOwnedHeroKey("hero_page_prijzen"), true);
  assert.equal(isPageOwnedHeroKey("hero_page_hoe_het_werkt"), true);
});

test("generic keys and banners are not page-owned", () => {
  for (const key of ["hero_default", "hero_features", "hero_page_banner_awareness", "hero_page_banner", "", null, undefined]) {
    assert.equal(isPageOwnedHeroKey(key), false, String(key));
  }
});

test("a page-owned hero wins and keeps the banner as fallback", () => {
  assert.deepEqual(
    resolveHeroSlotKeys("hero_page_prijzen", "hero_page_banner_returning"),
    { variantKey: "hero_page_prijzen", fallbackVariantKey: "hero_page_banner_returning" },
  );
});

test("a page-owned hero without a banner stands alone", () => {
  assert.deepEqual(resolveHeroSlotKeys("hero_page_prijzen", undefined), { variantKey: "hero_page_prijzen" });
});

test("a generic page key still gives way to the banner", () => {
  assert.deepEqual(
    resolveHeroSlotKeys("hero_default", "hero_page_banner_awareness"),
    { variantKey: "hero_page_banner_awareness" },
  );
});

test("a generic page key stays when the engine picked no banner", () => {
  assert.deepEqual(resolveHeroSlotKeys("hero_default", undefined), { variantKey: "hero_default" });
});

test("a page-owned hero carries the hero the engine picked as its preferred variant", () => {
  assert.deepEqual(
    resolveHeroSlotKeys("hero_page_functies", "hero_page_banner_consideration", "hero_role_bureau"),
    {
      variantKey:          "hero_page_functies",
      fallbackVariantKey:  "hero_page_banner_consideration",
      preferredVariantKey: "hero_role_bureau",
    },
  );
});

test("a page-owned hero never becomes the engine's hero, it only prefers a variant of its own", () => {
  const keys = resolveHeroSlotKeys("hero_page_functies", undefined, "hero_role_bureau");
  assert.equal(keys.variantKey, "hero_page_functies");
  assert.equal(keys.preferredVariantKey, "hero_role_bureau");
});

test("no preferred variant without a hero from the engine", () => {
  for (const planHeroKey of [undefined, null, "", "hero_page_functies"]) {
    assert.equal(
      "preferredVariantKey" in resolveHeroSlotKeys("hero_page_functies", undefined, planHeroKey),
      false,
      String(planHeroKey),
    );
  }
});

test("a generic page key has no preferred variant: the banner replaces it as before", () => {
  assert.deepEqual(
    resolveHeroSlotKeys("hero_default", "hero_page_banner_awareness", "hero_role_bureau"),
    { variantKey: "hero_page_banner_awareness" },
  );
});
