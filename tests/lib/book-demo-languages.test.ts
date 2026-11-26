/**
 * The hreflang links of the booking page name only versions that exist.
 *
 * Search Console reported on 26 Nov 2026 a page with a redirect on
 * misterchameleon.nl. The Dutch booking page /demo named /book-demo as its
 * English version, and on that site /book-demo redirects to /demo.
 *
 * The pages are .tsx files, which this test runner cannot import, so those
 * checks read the source.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DUTCH_ADDRESSES_HOST, bookDemoLanguages } from "@/lib/seo/book-demo-languages";

const ALL   = { nl: "/demo", en: "/book-demo", de: "/de/book-demo" };
const DUTCH = { nl: "/demo", de: "/de/book-demo" };

describe("bookDemoLanguages", () => {
  it("names all three versions on a site that has them", () => {
    assert.deepEqual(bookDemoLanguages("https://www.example.com"), ALL);
    assert.deepEqual(bookDemoLanguages("http://localhost:3000"), ALL);
  });

  it("leaves out the English one where its address redirects", () => {
    assert.deepEqual(bookDemoLanguages("https://www.misterchameleon.nl"), DUTCH);
    assert.deepEqual(bookDemoLanguages("https://misterchameleon.nl"), DUTCH);
    assert.deepEqual(bookDemoLanguages("www.misterchameleon.nl"), DUTCH);
    assert.deepEqual(bookDemoLanguages("https://WWW.MisterChameleon.nl:443/demo"), DUTCH);
  });

  it("never names a version that sends the visitor back to the page itself", () => {
    const languages = bookDemoLanguages("https://www.misterchameleon.nl");
    assert.equal(Object.values(languages).includes("/book-demo"), false);
    assert.equal(languages.nl, "/demo");
  });

  it("does not take another host for that site", () => {
    for (const host of ["app.misterchameleon.nl", "misterchameleon.nl.example.com", "notmisterchameleon.nl", "misterchameleon.com", "wwwxmisterchameleon.nl"]) {
      assert.deepEqual(bookDemoLanguages(`https://${host}`), ALL, host);
    }
  });

  it("names all three when the host is not known", () => {
    assert.deepEqual(bookDemoLanguages(null), ALL);
    assert.deepEqual(bookDemoLanguages(undefined), ALL);
    assert.deepEqual(bookDemoLanguages(""), ALL);
  });

  it("gives a fresh object each time", () => {
    const first = bookDemoLanguages(null);
    first.en = "/elsewhere";
    assert.deepEqual(bookDemoLanguages(null), ALL);
  });
});

describe("the redirect it follows", () => {
  const config = readFileSync("next.config.mjs", "utf8");

  it("is still there: /book-demo goes to /demo on the marketing site", () => {
    // Take this redirect away and the English page is back on that site.
    // Then bookDemoLanguages must name it again.
    assert.match(config, /\["\/book-demo",\s*"\/demo"\]/);
  });

  it("is tied to the same host", () => {
    const value = /const marketingHost = \[\{ type: "host", value: "([^"]+)" \}\];/.exec(config)?.[1];
    assert.ok(value, "marketingHost is gone from next.config.mjs");
    // The config holds the pattern in a string, with its backslashes doubled.
    assert.equal(value!.replace(/\\\\/g, "\\"), DUTCH_ADDRESSES_HOST);
  });
});

describe("the three booking pages", () => {
  const pages: Record<string, string> = {
    "app/(site)/demo/page.tsx":         "/demo",
    "app/(site)/book-demo/page.tsx":    "/book-demo",
    "app/(site)/de/book-demo/page.tsx": "/de/book-demo",
  };

  for (const [file, canonical] of Object.entries(pages)) {
    it(`${file} asks which versions this site has`, () => {
      const source = readFileSync(file, "utf8");
      assert.match(source, /languages: bookDemoLanguages\(requestOrigin\(await headers\(\)\)\),/);
      assert.ok(source.includes(`canonical: "${canonical}",`), "the canonical address changed");
      // No list of its own left behind.
      assert.doesNotMatch(source, /"en":\s*"\/book-demo"/);
      assert.doesNotMatch(source, /export const metadata/);
    });
  }
});
