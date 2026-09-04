/**
 * readLocaleCookie: the browser-side half of locale resolution, used by
 * useActiveLocale to pick default form-button copy. `document` is faked here —
 * the suite runs in plain Node, with no DOM.
 */

import { describe, it, afterEach } from "node:test";
import assert                      from "node:assert/strict";

import { readLocaleCookie } from "../../lib/locale-shared.ts";

const g = globalThis as { document?: { cookie: string } };

function withCookie(cookie: string): void {
  g.document = { cookie };
}

afterEach(() => { delete g.document; });

describe("readLocaleCookie", () => {
  it("reads a supported locale", () => {
    withCookie("locale=en");
    assert.equal(readLocaleCookie(), "en");
    withCookie("locale=nl");
    assert.equal(readLocaleCookie(), "nl");
    withCookie("locale=de");
    assert.equal(readLocaleCookie(), "de");
  });

  it("finds the cookie among others, in any position", () => {
    withCookie("mc_vid=abc; locale=en; consent=all");
    assert.equal(readLocaleCookie(), "en");
    withCookie("mc_vid=abc; consent=all; locale=de");
    assert.equal(readLocaleCookie(), "de");
  });

  it("does not match a cookie whose name merely ends in \"locale\"", () => {
    withCookie("preferred_locale=en");
    assert.equal(readLocaleCookie(), undefined);
  });

  it("unsupported / empty values → undefined, so the caller's fallback applies", () => {
    withCookie("locale=fr");
    assert.equal(readLocaleCookie(), undefined);
    withCookie("locale=");
    assert.equal(readLocaleCookie(), undefined);
    withCookie("");
    assert.equal(readLocaleCookie(), undefined);
  });

  it("no document (SSR / tests) → undefined rather than a throw", () => {
    delete g.document;
    assert.equal(readLocaleCookie(), undefined);
  });
});
