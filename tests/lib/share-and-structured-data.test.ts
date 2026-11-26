/**
 * The share card and the structured data of a site.
 *
 * The owner asked for both on 26 Nov 2026. No page had an og:image, so a
 * shared link showed as bare text, and only the homepage said anything in
 * structured data (WebSite).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHARE_IMAGE, SHARE_TEXT_STRENGTH, shareImageEntry, resolveCssVar, shareCardColours, shareHeadline, clampText } from "@/lib/seo/share-image";
import { organizationJsonLd, articleJsonLd, personJsonLd, absoluteUrl } from "@/lib/seo/structured-data";

const ORIGIN = "https://www.example.org";

describe("share card: reading the theme", () => {
  it("follows a reference to another custom property", () => {
    const vars = { "--hero-bg": "var(--foreground)", "--foreground": "#1a171b" };
    assert.equal(resolveCssVar(vars, "--hero-bg", "#000"), "#1a171b");
  });

  it("takes the fallback inside var() when the reference leads nowhere", () => {
    assert.equal(resolveCssVar({ "--hero-bg": "var(--missing, #223344)" }, "--hero-bg", "#000"), "#223344");
  });

  it("gives the fallback for a missing property, an empty one and a circle", () => {
    assert.equal(resolveCssVar({}, "--hero-bg", "#000"), "#000");
    assert.equal(resolveCssVar({ "--hero-bg": "  " }, "--hero-bg", "#000"), "#000");
    assert.equal(resolveCssVar({ "--a": "var(--b)", "--b": "var(--a)" }, "--a", "#000"), "#000");
  });

  it("keeps a gradient as the ground", () => {
    const gradient = "linear-gradient(rgb(46, 26, 42) 0%, rgb(255, 92, 138) 100%)";
    assert.equal(shareCardColours({ "--hero-bg": gradient }).ground, gradient);
  });

  it("falls back to a dark ground with light text for what it cannot draw", () => {
    for (const ground of ["url(/hero.jpg)", "linear-gradient(var(--a), var(--b))", "radial-gradient(#000, #fff)"]) {
      assert.deepEqual(shareCardColours({ "--hero-bg": ground, "--hero-title-color": "#111111" }), { ground: "#0f172a", text: "#ffffff" });
    }
  });

  it("uses the hero's title colour on the hero's own ground", () => {
    assert.deepEqual(shareCardColours({ "--hero-bg": "#2e1a2a", "--hero-title-color": "#fff8f0" }), { ground: "#2e1a2a", text: "#fff8f0" });
  });

  it("does not take the hero's subtitle colour: it came out grey on the live card", () => {
    const colours = shareCardColours({ "--hero-bg": "#2e1a2a", "--hero-title-color": "#ffffff", "--hero-subtitle-color": "#8a8296" });
    assert.deepEqual(colours, { ground: "#2e1a2a", text: "#ffffff" });
  });

  it("draws the smaller lines as a light shade of the title's colour", () => {
    const route = readFileSync("app/share-image/route.tsx", "utf8");
    assert.match(route, /color: colours\.text, opacity: SHARE_TEXT_STRENGTH\.line/);
    assert.match(route, /color: colours\.text, opacity: SHARE_TEXT_STRENGTH\.host/);
    assert.ok(SHARE_TEXT_STRENGTH.line >= 0.85 && SHARE_TEXT_STRENGTH.host >= 0.7, "light enough to read");
    assert.ok(SHARE_TEXT_STRENGTH.line > SHARE_TEXT_STRENGTH.host);
  });
});

describe("share card: its texts", () => {
  it("shows the homepage title without the site's name, which the logo carries", () => {
    assert.equal(shareHeadline("Website personalisatie voor B2B | Mister Chameleon", "Mister Chameleon"), "Website personalisatie voor B2B");
    assert.equal(shareHeadline("Mister Chameleon - Website personalisatie", "Mister Chameleon"), "Website personalisatie");
    assert.equal(shareHeadline("Acme (R&D) | A.C.M.E.", "A.C.M.E."), "Acme (R&D)");
  });

  it("falls back to the name without a title, or when the title is only the name", () => {
    assert.equal(shareHeadline(null, "Mister Chameleon"), "Mister Chameleon");
    assert.equal(shareHeadline("  ", "Mister Chameleon"), "Mister Chameleon");
    assert.equal(shareHeadline("Mister Chameleon", "Mister Chameleon"), "Mister Chameleon");
  });

  it("cuts a long text on a word, with an ellipsis", () => {
    const cut = clampText("Laat elke bezoeker de boodschap zien die bij hem past. Op je bestaande site, zonder developer.", 60);
    assert.ok(cut.length <= 60, cut);
    assert.ok(cut.endsWith("…"));
    assert.doesNotMatch(cut, /\s…$/);
    assert.equal(clampText("Kort.", 60), "Kort.");
    assert.equal(clampText(null, 60), "");
  });

  it("is served at one address, 1200 by 630", () => {
    assert.deepEqual(shareImageEntry(), { url: "/share-image", width: 1200, height: 630 });
    assert.equal(SHARE_IMAGE.width / SHARE_IMAGE.height > 1.9, true);
  });
});

describe("share card: the route", () => {
  const route = readFileSync("app/share-image/route.tsx", "utf8");

  it("shows the tenant's logo as a file, on a plate unless it was made for a dark ground", () => {
    assert.match(route, /<img src=\{logoUrl\}/);
    assert.match(route, /logoBare \? \{\} : \{ backgroundColor: "#ffffff"/);
  });

  it("does not fetch the logo itself: the image library refuses internal addresses", () => {
    assert.doesNotMatch(route, /fetch\(/);
  });

  it("still gives a card when the logo cannot be drawn", () => {
    assert.match(route, /catch \(error\) \{[\s\S]*logoUrl: null/);
  });

  it("uses the tenant's own theme, never one a rule picked for a visitor", () => {
    assert.match(route, /resolveThemeForTenant\(tenantSettings, null\)/);
    assert.doesNotMatch(route, /getRequestThemeDecision/);
  });
});

describe("structured data", () => {
  it("names the organisation, with its logo made absolute", () => {
    assert.deepEqual(JSON.parse(organizationJsonLd("Acme", ORIGIN, "/logo.svg")), {
      "@context": "https://schema.org", "@type": "Organization", name: "Acme", url: `${ORIGIN}/`, logo: `${ORIGIN}/logo.svg`,
    });
    assert.equal(JSON.parse(organizationJsonLd("Acme", ORIGIN, "https://cdn.example.net/l.svg")).logo, "https://cdn.example.net/l.svg");
    assert.equal("logo" in JSON.parse(organizationJsonLd("Acme", ORIGIN, null)), false);
  });

  it("describes an article with what the page shows, the organisation as author", () => {
    const data = JSON.parse(articleJsonLd({
      type: "BlogPosting", headline: "A/B-testen", description: "Zo werkt een test.", path: "/blog/ab-testen",
      publishedAt: "2026-11-25", modifiedAt: "2026-11-26", siteName: "Acme", logoUrl: "/logo.svg",
    }, ORIGIN));
    assert.equal(data["@type"], "BlogPosting");
    assert.equal(data.headline, "A/B-testen");
    assert.equal(data.datePublished, "2026-11-25");
    assert.equal(data.dateModified, "2026-11-26");
    assert.equal(data.url, `${ORIGIN}/blog/ab-testen`);
    assert.deepEqual(data.mainEntityOfPage, { "@type": "WebPage", "@id": `${ORIGIN}/blog/ab-testen` });
    assert.equal(data.author["@type"], "Organization");
    assert.equal(data.publisher.name, "Acme");
  });

  it("invents no date and no description", () => {
    const data = JSON.parse(articleJsonLd({ type: "NewsArticle", headline: "Nieuws", path: "/news/x", siteName: "Acme" }, ORIGIN));
    for (const key of ["datePublished", "dateModified", "description", "image"]) assert.equal(key in data, false, key);
  });

  it("describes a person by name, job title and employer, without a portrait", () => {
    const data = JSON.parse(personJsonLd({ name: "Anna de Vries", role: "Developer", path: "/team/anna", sameAs: "https://www.linkedin.com/in/anna", siteName: "Acme" }, ORIGIN));
    assert.deepEqual(data, {
      "@context": "https://schema.org", "@type": "Person", name: "Anna de Vries", jobTitle: "Developer",
      url: `${ORIGIN}/team/anna`, sameAs: ["https://www.linkedin.com/in/anna"],
      worksFor: { "@type": "Organization", name: "Acme", url: `${ORIGIN}/` },
    });
    assert.equal("image" in data, false);
  });

  it("leaves out a profile that is not a web address", () => {
    const data = JSON.parse(personJsonLd({ name: "Anna", path: "/team/anna", sameAs: "javascript:alert(1)", siteName: "Acme" }, ORIGIN));
    assert.equal("sameAs" in data, false);
    assert.equal("jobTitle" in data, false);
  });

  it("cannot be closed by a value: < is escaped in every builder", () => {
    const evil = '</script><script>alert(1)</script>';
    for (const json of [
      organizationJsonLd(evil, ORIGIN, null),
      articleJsonLd({ type: "BlogPosting", headline: evil, description: evil, path: "/blog/x", siteName: evil }, ORIGIN),
      personJsonLd({ name: evil, role: evil, path: "/team/x", siteName: evil }, ORIGIN),
    ]) {
      assert.doesNotMatch(json, /</);
      assert.equal(typeof JSON.parse(json), "object");
    }
  });

  it("makes a root-relative address absolute and leaves a full one alone", () => {
    assert.equal(absoluteUrl("/a.svg", ORIGIN), `${ORIGIN}/a.svg`);
    assert.equal(absoluteUrl("a.svg", ORIGIN), `${ORIGIN}/a.svg`);
    assert.equal(absoluteUrl("https://x.test/a.svg", ORIGIN), "https://x.test/a.svg");
  });
});

describe("structured data: where it stands", () => {
  it("homepage: the site and the organisation", () => {
    const home = readFileSync("app/(site)/page.tsx", "utf8");
    assert.match(home, /websiteJsonLd\(siteName, origin\)/);
    assert.match(home, /organizationJsonLd\(siteName, origin, logoUrl\)/);
  });

  it("team page: the person, only when the CMS names one", () => {
    const team = readFileSync("app/(site)/team/[slug]/page.tsx", "utf8");
    assert.match(team, /\{origin && page\.person && \(/);
    assert.match(team, /personJsonLd\(\{/);
  });
});
