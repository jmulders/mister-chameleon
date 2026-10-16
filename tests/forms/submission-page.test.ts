/**
 * resolveSubmissionPageUrl: the body-sent page path (`_mc_page`, from the
 * snippet) wins over the Referer, which cross-origin only carries the origin,
 * but only when it is a plain root-relative path.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { resolveSubmissionPageUrl } from "../../forms/submission-page.ts";

const REF = "https://klant.nl/";

describe("resolveSubmissionPageUrl", () => {
  it("prefers the body page path + query over an origin-only referer", () => {
    const url = resolveSubmissionPageUrl("/prijzen?utm_source=nieuwsbrief", REF);
    assert.equal(url?.pathname, "/prijzen");
    assert.equal(url?.searchParams.get("utm_source"), "nieuwsbrief");
  });

  it("falls back to the referer when no page is sent", () => {
    const url = resolveSubmissionPageUrl(undefined, "https://klant.nl/contact?x=1");
    assert.equal(url?.pathname, "/contact");
    assert.equal(url?.searchParams.get("x"), "1");
  });

  it("rejects a page with a protocol or host and uses the referer", () => {
    for (const bad of [
      "https://evil.example/x",
      "//evil.example/x",
      "/\\evil.example/x",
      "javascript:alert(1)",
      "prijzen",
      "",
    ]) {
      assert.equal(resolveSubmissionPageUrl(bad, REF)?.href, REF, bad);
    }
  });

  it("rejects a non-string or over-long page", () => {
    assert.equal(resolveSubmissionPageUrl(42, REF)?.href, REF);
    assert.equal(resolveSubmissionPageUrl("/" + "a".repeat(600), REF)?.href, REF);
  });

  it("returns null without a usable page or referer", () => {
    assert.equal(resolveSubmissionPageUrl(undefined, null), null);
    assert.equal(resolveSubmissionPageUrl(undefined, "not a url"), null);
  });
});
