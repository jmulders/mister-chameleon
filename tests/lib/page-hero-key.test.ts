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
