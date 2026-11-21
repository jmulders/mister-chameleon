/**
 * The themes of an article, for the card and for the filter above a listing.
 *
 * The owner asked for a filter on theme in the knowledge base (21 Nov 2026).
 * Statamic gives the "theme" field in two shapes: term objects from its REST
 * API, bare slugs from its file reader.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tagsWithThemes, themeTitles } from "@/cms/providers/listing-themes";

describe("themeTitles", () => {
  it("takes the title of a term object", () => {
    assert.deepEqual(themeTitles([{ id: "theme::campagnes", slug: "campagnes", title: "Campagnes" }]), ["Campagnes"]);
  });

  it("makes a title from a bare slug or a term id", () => {
    assert.deepEqual(themeTitles(["leads-en-sales"]), ["Leads en sales"]);
    assert.deepEqual(themeTitles(["theme::privacy-en-data"]), ["Privacy en data"]);
    assert.deepEqual(themeTitles([{ slug: "meten-en-ai" }]), ["Meten en ai"]);
  });

  it("takes one term as well as a list", () => {
    assert.deepEqual(themeTitles("campagnes"), ["Campagnes"]);
    assert.deepEqual(themeTitles({ title: "Campagnes" }), ["Campagnes"]);
  });

  it("keeps the editor's order and names a theme once", () => {
    assert.deepEqual(themeTitles([{ title: "Campagnes" }, "aan-de-slag", { title: "Campagnes" }]), ["Campagnes", "Aan de slag"]);
  });

  it("gives nothing for nothing", () => {
    assert.deepEqual(themeTitles(undefined), []);
    assert.deepEqual(themeTitles(null), []);
    assert.deepEqual(themeTitles([]), []);
    assert.deepEqual(themeTitles([42, {}, "", { title: "  " }]), []);
  });
});

describe("tagsWithThemes", () => {
  it("puts the themes before the free tags, each once", () => {
    assert.deepEqual(tagsWithThemes(["b2b", "Campagnes"], [{ title: "Campagnes" }]), ["Campagnes", "b2b"]);
  });

  it("answers undefined without any, as the card expects", () => {
    assert.equal(tagsWithThemes(undefined, []), undefined);
    assert.equal(tagsWithThemes([], undefined), undefined);
  });

  it("works with themes alone and with tags alone", () => {
    assert.deepEqual(tagsWithThemes(undefined, ["campagnes"]), ["Campagnes"]);
    assert.deepEqual(tagsWithThemes(["b2b", 7, " "], undefined), ["b2b"]);
  });
});

describe("the article listing carries the themes", () => {
  it("maps the theme field of an article to the tags of its card", () => {
    const provider = readFileSync("cms/providers/statamic-provider.ts", "utf8");
    assert.match(provider, /tags:\s+tagsWithThemes\(entry\.tags, entry\.theme\)/);
  });

  it("turns 'filter by theme' on a listing block into a filterable listing", () => {
    const mapper = readFileSync("cms/mappers/statamic/statamic-mappers.ts", "utf8");
    assert.match(mapper, /extractString\(block\.filter_by\) === "theme" \? \{ filterable: true \} : \{\}/);
    const config = readFileSync("cms/mappers/page-config-mapper.ts", "utf8");
    assert.match(config, /filterable:\s+section\.filterable/);
  });
});
