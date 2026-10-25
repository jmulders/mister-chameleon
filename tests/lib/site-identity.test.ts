/**
 * Homepage site identity for search engines: the <title> and the WebSite
 * structured data Google uses for the site name above a result.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { homeTitle, requestOrigin, websiteJsonLd } from "@/lib/seo/site-identity";

const hdrs = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

describe("homeTitle", () => {
  it("uses the editor's SEO title", () => {
    assert.equal(homeTitle("Adaptieve websites | Mister Chameleon", "Mister Chameleon"), "Adaptieve websites | Mister Chameleon");
  });

  it("falls back to the tenant name, never the CMS label", () => {
    assert.equal(homeTitle(undefined, "Mister Chameleon"), "Mister Chameleon");
    assert.equal(homeTitle(null, "Mister Chameleon"), "Mister Chameleon");
    assert.equal(homeTitle("   ", "Mister Chameleon"), "Mister Chameleon");
  });
});

describe("requestOrigin", () => {
  it("prefers the forwarded host and protocol", () => {
    assert.equal(requestOrigin(hdrs({ "x-forwarded-host": "misterchameleon.nl", "x-forwarded-proto": "https", host: "internal:3000" })), "https://misterchameleon.nl");
  });

  it("uses the host header and defaults to https", () => {
    assert.equal(requestOrigin(hdrs({ host: "www.example.nl" })), "https://www.example.nl");
  });

  it("uses http for localhost", () => {
    assert.equal(requestOrigin(hdrs({ host: "localhost:3000" })), "http://localhost:3000");
  });

  it("takes the first value of a list", () => {
    assert.equal(requestOrigin(hdrs({ "x-forwarded-host": "a.nl, b.nl", "x-forwarded-proto": "https, http" })), "https://a.nl");
  });

  it("rejects a missing or malformed host", () => {
    assert.equal(requestOrigin(hdrs({})), null);
    assert.equal(requestOrigin(hdrs({ host: "evil.nl/<script>" })), null);
  });
});

describe("websiteJsonLd", () => {
  it("describes the site with its name and homepage URL", () => {
    assert.deepEqual(JSON.parse(websiteJsonLd("Mister Chameleon", "https://misterchameleon.nl")), {
      "@context": "https://schema.org",
      "@type":    "WebSite",
      name:       "Mister Chameleon",
      url:        "https://misterchameleon.nl/",
    });
  });

  it("cannot close the script element", () => {
    const out = websiteJsonLd("</script><script>alert(1)</script>", "https://x.nl");
    assert.ok(!out.includes("<"));
    assert.equal(JSON.parse(out).name, "</script><script>alert(1)</script>");
  });
});
