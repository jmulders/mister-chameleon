/**
 * The "Cookie settings" pill in the bottom-left corner leaves once the visitor
 * has chosen, as long as the page itself links to the cookie page.
 */

import { describe, it, afterEach } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COOKIE_PAGE_LINK,
  CONSENT_UI_ATTRIBUTE,
  cookieLauncherShown,
  pageLinksToCookies,
  subscribePageLinks,
} from "@/tracking/cookie-launcher";

describe("the pill", () => {
  it("shows while the visitor has not chosen, link or no link", () => {
    assert.equal(cookieLauncherShown({ responded: false, pageLinksToCookies: true }),  true);
    assert.equal(cookieLauncherShown({ responded: false, pageLinksToCookies: false }), true);
  });

  it("leaves after the choice when the page links to the cookie page", () => {
    assert.equal(cookieLauncherShown({ responded: true, pageLinksToCookies: true }), false);
  });

  it("stays after the choice on a page without that link: it is the only way back", () => {
    assert.equal(cookieLauncherShown({ responded: true, pageLinksToCookies: false }), true);
  });
});

describe("the page's own link", () => {
  const scope = globalThis as { document?: unknown };
  afterEach(() => { delete scope.document; });

  /** A document with these links; `inConsentUi` says which sit in the banner or the window. */
  function documentWith(links: Array<{ inConsentUi: boolean }>) {
    let asked = "";
    scope.document = {
      querySelectorAll(selector: string) {
        asked = selector;
        return links.map((link) => ({
          closest: (within: string) => (link.inConsentUi && within === `[${CONSENT_UI_ATTRIBUTE}]` ? {} : null),
        }));
      },
    };
    return () => asked;
  }

  it("is not there on the server", () => {
    assert.equal(pageLinksToCookies(), false);
    assert.doesNotThrow(() => subscribePageLinks(() => {})());
  });

  it("counts a link in the page, such as the footer", () => {
    const asked = documentWith([{ inConsentUi: false }]);
    assert.equal(pageLinksToCookies(), true);
    assert.equal(asked(), COOKIE_PAGE_LINK);
  });

  it("does not count the link in the banner, which is gone after the choice", () => {
    documentWith([{ inConsentUi: true }]);
    assert.equal(pageLinksToCookies(), false);
  });

  it("finds /cookies with a locale prefix or a trailing slash, and nothing longer", () => {
    assert.equal(COOKIE_PAGE_LINK, 'a[href$="/cookies"], a[href$="/cookies/"]');
  });
});

describe("in the components", () => {
  const pill   = readFileSync("components/tracking/CookiePreferences.tsx", "utf8");
  const banner = readFileSync("components/tracking/ConsentBanner.tsx", "utf8");

  it("the pill is drawn only while it is shown", () => {
    assert.match(pill, /const shown\s+= cookieLauncherShown\(\{ responded: consent\.hasResponded, pageLinksToCookies: linked \}\)/);
    assert.match(pill, /\{shown && <button/);
  });

  it("the pill is not in the server's HTML, so it never flashes for a visitor who chose", () => {
    assert.match(pill, /hasResponded:\s+true/);
    assert.match(pill, /function getServerPageLink\(\): boolean \{ return true; \}/);
  });

  it("the settings window stays open when the pill leaves under it", () => {
    assert.match(pill, /\{open && \(/);
    assert.doesNotMatch(pill, /\{shown && open/);
  });

  it("the banner and the settings window carry the mark", () => {
    assert.equal(CONSENT_UI_ATTRIBUTE, "data-consent-ui");
    assert.match(banner, /data-consent-ui=""/);
    assert.match(pill,   /data-consent-ui=""/);
  });
});
