/**
 * Statamic `pricing_section` → PricingSectionData.
 *
 * The platform already had the whole downstream path — the CMS type, the
 * page-config mapper case and PricingSectionBlock — so this mapper is the only
 * thing between a CP grid row and a rendered pricing card. The field names it
 * emits are therefore a contract, not a convenience: page-config-mapper forwards
 * them one-to-one without re-checking anything.
 *
 * Pure mapper test — no CMS, no network.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { mapStatamicPageBlocksToSections } from "../../cms/mappers/statamic/statamic-mappers.ts";
import type { PricingSectionData, CmsPriceTier } from "../../cms/types.ts";

/** Map one pricing_section block and return the resulting section. */
function sectionOf(block: Record<string, unknown> = {}): PricingSectionData | undefined {
  const sections = mapStatamicPageBlocksToSections(
    [{ type: "pricing_section", id: "blk-1", ...block } as Record<string, unknown>],
    undefined,
  );
  return sections.find((s) => (s as { _type?: string })._type === "pricingSection") as PricingSectionData | undefined;
}

/** A grid row with everything CmsPriceTier requires. */
const validTier = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id:        "row-1",
  name:      "Start",
  price:     "€29",
  cta_label: "Kies Start",
  cta_href:  "/contact",
  ...over,
});

describe("pricing_section → section shell", () => {
  it("maps heading, subheading and footnote", () => {
    const s = sectionOf({
      heading:    "Een vaste prijs per maand",
      subheading: "Geen verrassingen achteraf.",
      footnote:   "Alle prijzen zijn exclusief btw.",
      variant:    "pricing_cards",
    });
    assert.equal(s?._type,      "pricingSection");
    assert.equal(s?._key,       "blk-1");
    assert.equal(s?.heading,    "Een vaste prijs per maand");
    assert.equal(s?.subheading, "Geen verrassingen achteraf.");
    assert.equal(s?.footnote,   "Alle prijzen zijn exclusief btw.");
    assert.equal(s?.variant,    "pricing_cards");
  });

  it("absent or empty copy fields become undefined, not empty strings", () => {
    // extractString, shared with every other block here, maps "" and absent to
    // undefined. It does NOT trim, so a whitespace-only value survives — a wart,
    // but one this block shares with cta_section and the rest rather than
    // diverging from.
    const s = sectionOf({ heading: "", subheading: undefined, footnote: "" });
    assert.equal(s?.heading,    undefined);
    assert.equal(s?.subheading, undefined);
    assert.equal(s?.footnote,   undefined);
  });

  it("renders with no tiers at all rather than crashing", () => {
    const s = sectionOf({ heading: "Prijzen" });
    assert.equal(s?._type, "pricingSection");
    assert.equal(s?.tiers, undefined);
  });
});

describe("pricing_section → tiers", () => {
  it("maps a full grid row onto CmsPriceTier", () => {
    const s = sectionOf({
      tiers: [validTier({
        period:      "/maand",
        description: "Voor wie net begint.",
        features:    "Eén website\nContactformulier\nHosting inbegrepen",
        highlighted: false,
        badge:       "",
      })],
    });
    const tier = s?.tiers?.[0] as CmsPriceTier;
    assert.deepEqual(tier, {
      _key:        "row-1",
      name:        "Start",
      price:       "€29",
      period:      "/maand",
      description: "Voor wie net begint.",
      features:    ["Eén website", "Contactformulier", "Hosting inbegrepen"],
      ctaLabel:    "Kies Start",
      ctaHref:     "/contact",
      highlighted: false,
      badge:       undefined,
    });
  });

  it("keeps the authored order", () => {
    const s = sectionOf({
      tiers: [
        validTier({ id: "a", name: "Start" }),
        validTier({ id: "b", name: "Groei" }),
        validTier({ id: "c", name: "Compleet" }),
      ],
    });
    assert.deepEqual(s?.tiers?.map((t) => t.name), ["Start", "Groei", "Compleet"]);
  });

  it("falls back to a positional key when the row has no id", () => {
    const s = sectionOf({ tiers: [validTier({ id: undefined }), validTier({ id: undefined, name: "Groei" })] });
    assert.deepEqual(s?.tiers?.map((t) => t._key), ["tier_0", "tier_1"]);
  });
});

describe("pricing_section → features", () => {
  const featuresOf = (features: unknown) =>
    sectionOf({ tiers: [validTier({ features })] })?.tiers?.[0]?.features;

  it("splits a textarea on newlines", () => {
    assert.deepEqual(featuresOf("Eén website\nContactformulier"), ["Eén website", "Contactformulier"]);
  });

  it("handles Windows line endings", () => {
    assert.deepEqual(featuresOf("Eén website\r\nContactformulier"), ["Eén website", "Contactformulier"]);
  });

  it("drops blank lines and trims — a trailing newline is not an empty bullet", () => {
    assert.deepEqual(featuresOf("  Eén website  \n\n\nContactformulier\n"), ["Eén website", "Contactformulier"]);
  });

  it("accepts a list fieldtype's array just as happily", () => {
    assert.deepEqual(featuresOf(["Eén website", "  Contactformulier  ", ""]), ["Eén website", "Contactformulier"]);
  });

  it("omits features entirely when there are none", () => {
    assert.equal(featuresOf(undefined), undefined);
    assert.equal(featuresOf(""), undefined);
    assert.equal(featuresOf("\n \n"), undefined);
    assert.equal(featuresOf([]), undefined);
  });
});

describe("pricing_section → cta_href (link fieldtype)", () => {
  const hrefOf = (cta_href: unknown) =>
    sectionOf({ tiers: [validTier({ cta_href })] })?.tiers?.[0]?.ctaHref;

  it("takes a raw string path or URL", () => {
    assert.equal(hrefOf("/contact"), "/contact");
    assert.equal(hrefOf("https://example.com/prijzen"), "https://example.com/prijzen");
    assert.equal(hrefOf("#offerte"), "#offerte");
  });

  it("resolves an augmented entry object, preferring url over permalink", () => {
    assert.equal(hrefOf({ url: "/contact", permalink: "https://acme.nl/contact" }), "/contact");
    assert.equal(hrefOf({ permalink: "https://acme.nl/contact" }), "https://acme.nl/contact");
  });
});

describe("pricing_section → rows that cannot render a card", () => {
  // ctaLabel/ctaHref/name/price are non-optional on CmsPriceTier, and the
  // page-config mapper forwards them without checking. A half-built row would
  // reach the component as undefined, so it is dropped here instead.
  for (const [what, over] of [
    ["no name",       { name: undefined }],
    ["blank name",    { name: "" }],
    ["no price",      { price: undefined }],
    ["no cta label",  { cta_label: "" }],
    ["no cta href",   { cta_href: undefined }],
    ["unusable href", { cta_href: {} }],
  ] as [string, Record<string, unknown>][]) {
    it(`drops a row with ${what}`, () => {
      const s = sectionOf({ tiers: [validTier(over), validTier({ id: "ok", name: "Groei" })] });
      assert.deepEqual(s?.tiers?.map((t) => t.name), ["Groei"]);
    });
  }

  it("drops the tiers key entirely when no row survives", () => {
    assert.equal(sectionOf({ tiers: [validTier({ name: "" })] })?.tiers, undefined);
  });

  it("ignores a tiers value that is not an array", () => {
    assert.equal(sectionOf({ tiers: "nope" })?.tiers, undefined);
    assert.equal(sectionOf({ tiers: {} })?.tiers,     undefined);
  });
});

describe("pricing_section → highlighted", () => {
  it("is a real boolean, whatever the CP sends", () => {
    const highlightOf = (highlighted: unknown) =>
      sectionOf({ tiers: [validTier({ highlighted })] })?.tiers?.[0]?.highlighted;
    assert.equal(highlightOf(true),      true);
    assert.equal(highlightOf(false),     false);
    assert.equal(highlightOf(undefined), false);
    // A toggle that arrives as a string must not read as truthy.
    assert.equal(highlightOf("false"),   false);
    assert.equal(highlightOf("true"),    false);
  });
});
