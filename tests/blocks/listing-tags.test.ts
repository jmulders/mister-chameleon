/**
 * The filter above a listing: which tags it offers and how the choice is
 * written in the address.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { distinctTags, tagFromParam, tagSlug, TAG_PARAM } from "@/components/blocks/listing/listing-tags";

describe("tagSlug", () => {
  it("writes a tag as it stands in an address", () => {
    assert.equal(tagSlug("Leads en sales"), "leads-en-sales");
    assert.equal(tagSlug("Privacy & data"), "privacy-data");
    assert.equal(tagSlug("  Meten en AI "), "meten-en-ai");
    assert.equal(tagSlug("Één regel code"), "een-regel-code");
  });
});

describe("distinctTags", () => {
  it("names every tag once, in the order of first appearance", () => {
    const items = [{ tags: ["Campagnes"] }, { tags: ["Aan de slag", "Campagnes"] }, {}, { tags: ["Meten en AI"] }];
    assert.deepEqual(distinctTags(items), ["Campagnes", "Aan de slag", "Meten en AI"]);
  });

  it("gives an empty list for items without tags", () => {
    assert.deepEqual(distinctTags([{}, { tags: [] }]), []);
  });
});

describe("tagFromParam", () => {
  const tags = ["Campagnes", "Leads en sales"];

  it("finds the tag a value from the address stands for", () => {
    assert.equal(tagFromParam(tags, "leads-en-sales"), "Leads en sales");
  });

  it("answers null for no value and for a value that is no tag here", () => {
    assert.equal(tagFromParam(tags, ""), null);
    assert.equal(tagFromParam(tags, null), null);
    assert.equal(tagFromParam(tags, "bestaat-niet"), null);
    assert.equal(tagFromParam(tags, "<script>"), null);
  });
});

describe("the listing shows the filter", () => {
  const block = readFileSync("components/blocks/sections/ListingBlock.tsx", "utf8");
  const filter = readFileSync("components/blocks/listing/ListingTagFilter.tsx", "utf8");

  it("only when the block asks for it and there are at least two tags to choose from", () => {
    assert.match(block, /const filterTags = data\.filterable \? distinctTags\(items\) : \[\];/);
    assert.match(block, /\{filterTags\.length >= 2 \? \(/);
  });

  it("renders every card on the server and hands it to the filter", () => {
    assert.match(block, /node: <ResultCard item=\{item\} layout="card" headingLevel=\{3\} \/>/);
  });

  it("keeps the choice in the address, so it can be shared and the server renders every card", () => {
    assert.equal(TAG_PARAM, "thema");
    assert.match(filter, /useSyncExternalStore\(subscribe, readParam, readOnServer\)/);
    assert.match(filter, /const readOnServer = \(\) => "";/);
    assert.match(filter, /url\.searchParams\.set\(TAG_PARAM, tagSlug\(tag\)\)/);
    assert.doesNotMatch(filter, /useState|useEffect/);
  });

  it("is a group of buttons that say which one is chosen", () => {
    assert.match(filter, /role="group" aria-label=\{label\}/);
    assert.match(filter, /aria-pressed=\{pressed\}/);
    assert.match(filter, /type="button"/);
  });

  it("has its fixed words in both languages", () => {
    const texts = readFileSync("lib/site-texts/blocks.ts", "utf8");
    assert.match(texts, /filterByTheme:\s+"Filter op thema"/);
    assert.match(texts, /filterAll:\s+"Alle"/);
    assert.match(texts, /filterByTheme:\s+"Filter by theme"/);
    assert.match(texts, /filterAll:\s+"All"/);
  });
});
