/**
 * Two places outside the CMS slots where a page shows a block for the audience
 * the rules picked: the closing block of an article or a case, and the advice
 * above the plans on the price list (25 Nov 2026).
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withOwnClosingSlot } from "@/lib/page-owned-closing-slot";
import { adviceFrom }         from "@/lib/pricing-advice";
import type { PageConfig, PageItem, ContentBlock, ResolvedContextSlot } from "@/page-config";

const block = (blockType: string, id: string) => ({ blockType, id, data: {} }) as unknown as ContentBlock;
const page  = (blocks: ContentBlock[]): PageConfig => ({
  pageId: "p", slug: "blog/x", title: "x", templateKey: "article-page",
  pageItems: blocks.map((b): PageItem => ({ kind: "block", block: b })),
  contextSlots: [], contentBlocks: blocks, seo: {},
});
const slot: ResolvedContextSlot = { slotId: "cta", variantKey: "cta_page_blog", preferredVariantKey: "hero_customer_onboarding" };

describe("the closing block of an article for this visitor", () => {
  it("takes the place of the article's last call to action", () => {
    const text = block("textSection", "t"); const cta = block("ctaSection", "c");
    const out  = withOwnClosingSlot(page([text, cta]), slot);
    assert.deepEqual(out.pageItems, [{ kind: "block", block: text }, { kind: "slot", slot }]);
    assert.deepEqual(out.contentBlocks, [text]);
    assert.deepEqual(out.contextSlots, [slot]);
  });

  it("replaces only the last one when an article has two", () => {
    const first = block("ctaSection", "c1"); const text = block("textSection", "t"); const last = block("ctaSection", "c2");
    const out   = withOwnClosingSlot(page([first, text, last]), slot);
    assert.deepEqual(out.pageItems.map((i) => (i.kind === "slot" ? "slot" : i.block.id)), ["c1", "t", "slot"]);
    assert.deepEqual(out.contentBlocks.map((b) => b.id), ["c1", "t"]);
  });

  it("goes at the end of an article without a call to action", () => {
    const text = block("textSection", "t");
    const out  = withOwnClosingSlot(page([text]), slot);
    assert.deepEqual(out.pageItems.map((i) => i.kind), ["block", "slot"]);
    assert.deepEqual(out.contentBlocks, [text]);
  });

  it("leaves the page it was given untouched", () => {
    const cta = block("ctaSection", "c"); const before = page([cta]);
    withOwnClosingSlot(before, slot);
    assert.equal(before.pageItems.length, 1);
    assert.equal(before.contextSlots.length, 0);
  });

  it("is only asked for when the block has a variant for this visitor", () => {
    // The article keeps its own closing block unless the helper returns a variant.
    for (const [route, key] of [["blog", "cta_page_blog"], ["cases", "cta_page_case"]] as const) {
      const source = readFileSync(`app/(site)/${route}/[slug]/page.tsx`, "utf8");
      assert.match(source, new RegExp(`resolveOwnBlockVariant\\(\`${route}/\\$\\{slug\\}\`, "cta", "${key}"\\)`));
      assert.match(source, /own \? withOwnClosingSlot\(pageConfig, own\.slot\) : pageConfig/);
    }
    const helper = readFileSync("lib/page-owned-variant.ts", "utf8");
    // No block, or a block without variants: no decision is run at all.
    assert.match(helper, /if \(!block\?\.isActive \|\| !block\.adaptiveVariants\?\.length\) return null;/);
    assert.match(helper, /if \(match\.isDefault\) return null;/);
  });
});

describe("the advice above the plans", () => {
  const plans = ["starter", "growth", "pro"];
  const variant = (href?: string, cta?: string) => ({ title: "Ons advies voor een bureau", subtitle: "", items: [{ title: "x", body: "Dat zit in Pro.", cta, ctaHref: href }] });

  it("reads the title, the first card's text and its link", () => {
    assert.deepEqual(adviceFrom(variant("#pakket-pro", "Bekijk Pro"), plans), {
      title: "Ons advies voor een bureau", text: "Dat zit in Pro.", linkHref: "#pakket-pro", linkLabel: "Bekijk Pro", planId: "pro",
    });
  });

  it("lifts out no plan for a link that names none", () => {
    assert.equal(adviceFrom(variant("#pakketten", "Bekijk de pakketten"), plans)?.planId, undefined);
    assert.equal(adviceFrom(variant("/admin", "Naar je account"), plans)?.planId, undefined);
    assert.equal(adviceFrom(variant("#pakket-enterprise", "Bekijk"), plans)?.planId, undefined);
  });

  it("shows a link only when it has both words and an address", () => {
    assert.equal(adviceFrom(variant("#pakket-pro"), plans)?.linkHref, undefined);
    assert.equal(adviceFrom(variant(undefined, "Bekijk Pro"), plans)?.linkLabel, undefined);
    // The plan is still lifted out: the address alone says which one.
    assert.equal(adviceFrom(variant("#pakket-pro"), plans)?.planId, "pro");
  });

  it("is nothing without a title or without a text", () => {
    assert.equal(adviceFrom({ title: "", subtitle: "", items: [{ body: "tekst" }] }, plans), null);
    assert.equal(adviceFrom({ title: "Titel", subtitle: "", items: [] }, plans), null);
  });

  it("keeps Growth as the lifted plan when there is no advice", () => {
    const source = readFileSync("app/(site)/prijzen/page.tsx", "utf8");
    assert.match(source, /const popular = plan\.id === \(advised \?\? "growth"\);/);
    assert.match(source, /\{advised \? "Ons advies voor jou" : "Meest gekozen"\}/);
    assert.match(source, /id=\{`pakket-\$\{plan\.id\}`\}/);
  });
});
