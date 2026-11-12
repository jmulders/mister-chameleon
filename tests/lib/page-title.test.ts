import { test } from "node:test";
import assert from "node:assert/strict";
import { pageNeedsTitleHeading } from "../../lib/page-title";

test("a page without slots needs its title as heading", () => {
  assert.equal(pageNeedsTitleHeading([]), true);
});

test("a page with an active hero does not", () => {
  assert.equal(pageNeedsTitleHeading([{ slotId: "hero", variantKey: "hero_page_prijzen" }]), false);
});

test("a hero slot that is switched off does not count", () => {
  assert.equal(pageNeedsTitleHeading([{ slotId: "hero", variantKey: null }]), true);
});

test("other slots do not give the page a heading", () => {
  assert.equal(pageNeedsTitleHeading([{ slotId: "cta", variantKey: "cta_default" }]), true);
});

test("a block that prints the title itself counts as the heading", () => {
  assert.equal(pageNeedsTitleHeading([], [{ blockType: "articleMeta" }]), false);
  assert.equal(pageNeedsTitleHeading([], [{ blockType: "textSection" }]), true);
});
