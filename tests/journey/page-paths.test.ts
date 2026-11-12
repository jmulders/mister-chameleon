import { test } from "node:test";
import assert from "node:assert/strict";
import { isAboutPath, isPricingPath } from "../../lib/journey/derive-behavior-state";

test("the Dutch pricing page counts as a pricing visit", () => {
  for (const path of ["/prijzen", "/prijzen/", "/pricing", "/Pricing/annual", "/tarieven"]) {
    assert.equal(isPricingPath(path), true, path);
  }
});

test("a path that only starts with the same letters does not count", () => {
  for (const path of ["/prijzenslag", "/blog/pricing", "/", null]) {
    assert.equal(isPricingPath(path), false, String(path));
  }
});

test("the about page counts in both languages", () => {
  assert.equal(isAboutPath("/over-ons"), true);
  assert.equal(isAboutPath("/about/team"), true);
  assert.equal(isAboutPath("/over-onszelf"), false);
});
