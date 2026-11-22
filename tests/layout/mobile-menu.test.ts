/**
 * What the menu on a phone shows besides the main navigation.
 *
 * Found on an iPhone on 22 Nov 2026: the menu held the main navigation only.
 * The pages of the top band, the search and the call to action could not be
 * reached from the header on a phone.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasMobileMenuExtras, mobileMenuLinks } from "@/components/layout/mobile-menu";

describe("mobileMenuLinks", () => {
  const tabs  = [{ label: "Over ons", href: "/over-ons" }, { label: "Team", href: "/team" }, { label: "Werken bij", href: "/werken-bij" }];
  const quick = [{ label: "Contact", href: "/contact" }];

  it("lists the section tabs first and the quick links after them", () => {
    assert.deepEqual(mobileMenuLinks(tabs, quick).map((l) => l.label), ["Over ons", "Team", "Werken bij", "Contact"]);
  });

  it("leaves out a link the main navigation already shows", () => {
    const main = [{ label: "Hoe het werkt", href: "/hoe-het-werkt" }, { label: "Contact", href: "/contact/" }];
    assert.deepEqual(mobileMenuLinks(tabs, quick, main).map((l) => l.label), ["Over ons", "Team", "Werken bij"]);
  });

  it("shows a link once when it is both a tab and a quick link", () => {
    assert.deepEqual(mobileMenuLinks(tabs, [{ label: "Het team", href: "/team" }, ...quick]).map((l) => l.label), ["Over ons", "Team", "Werken bij", "Contact"]);
  });

  it("leaves out a link without a label or an address", () => {
    const broken = [{ label: "", href: "/leeg" }, { label: "Geen adres", href: "" }, { label: null, href: null }];
    assert.deepEqual(mobileMenuLinks(broken, quick).map((l) => l.label), ["Contact"]);
  });

  it("keeps the new-tab mark and nothing else of a link", () => {
    const links = mobileMenuLinks([{ label: "Status", href: "https://status.example.com", openInNewTab: true, navHandle: "x" } as never], []);
    assert.deepEqual(links, [{ label: "Status", href: "https://status.example.com", openInNewTab: true }]);
  });

  it("gives an empty list when a site has no top band", () => {
    assert.deepEqual(mobileMenuLinks(null, undefined), []);
  });
});

describe("hasMobileMenuExtras", () => {
  it("is false when there is nothing besides the main navigation", () => {
    assert.equal(hasMobileMenuExtras(null), false);
    assert.equal(hasMobileMenuExtras({ links: [], cta: null }), false);
  });

  it("is true for a search, a link or a call to action", () => {
    assert.equal(hasMobileMenuExtras({ searchHref: "/search" }), true);
    assert.equal(hasMobileMenuExtras({ links: [{ label: "Contact", href: "/contact" }] }), true);
    assert.equal(hasMobileMenuExtras({ cta: { label: "Plan een demo", href: "/demo" } }), true);
  });
});

describe("the three-band header on a phone", () => {
  const header = readFileSync("components/layout/Header.tsx", "utf8");
  const navBar = readFileSync("components/layout/NavBar.tsx", "utf8");

  it("hands its menu the search, the top band's links and the call to action", () => {
    const extras = /const mobileExtras: MobileMenuExtras = \{([\s\S]*?)\};/.exec(header)![1]!;
    assert.match(extras, /searchHref/);
    assert.match(extras, /links:\s*mobileMenuLinks\(sectionTabs, quickLinks, mainNavigation\)/);
    assert.match(extras, /cta:\s*headerCta/);
    assert.match(header, /mode="mobile-only"\s+mobileExtras=\{mobileExtras\}/);
  });

  it("shows all three in the menu, and closes the menu when one is used", () => {
    for (const part of ["mobile-menu-search", "mobile-menu-links", "mobile-menu-cta"]) {
      assert.ok(navBar.includes(`data-part="${part}"`), `the menu has no ${part}`);
    }
    assert.match(navBar, /onSearch=\{\(\) => setMenuOpen\(false\)\}/);
  });

  it("keeps the menu on a phone when a site has no main navigation", () => {
    assert.match(navBar, /hasMobileMenuExtras\(mobileExtras\) \? <MobileNav items=\{\[\]\} extras=\{mobileExtras\} \/> : null/);
  });

  it("gives the search in the menu letters of 16 px, so iOS does not zoom in", () => {
    assert.match(readFileSync("components/layout/SearchBar.tsx", "utf8"), /fill \? "w-full flex-1 text-base"/);
  });
});
