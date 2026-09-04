/**
 * Consent-locale resolution.
 *
 * The layout resolves the cookie-banner locale as `mc_locale cookie ?? tenant
 * default language`, clamped to the ConsentLocale union with English as the last
 * resort (toConsentLocale). This proves the three cases from the fix: a fresh
 * visitor (no cookie) on a NL tenant gets Dutch; an explicit cookie is leading;
 * an unsupported tenant language falls back to English.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toConsentLocale, consentTexts } from "../../tracking/consent-i18n.ts";

// Mirrors the layout: cookie is leading, tenant default is the fallback source.
const resolve = (cookie: string | undefined, tenantDefault: string | undefined) =>
  toConsentLocale(cookie ?? tenantDefault);

describe("toConsentLocale", () => {
  it("clamps supported locales (accepts region suffixes)", () => {
    assert.equal(toConsentLocale("nl"), "nl");
    assert.equal(toConsentLocale("nl-NL"), "nl");
    assert.equal(toConsentLocale("en"), "en");
    assert.equal(toConsentLocale("en_GB"), "en");
  });
  it("falls back to English for unsupported / missing locales", () => {
    assert.equal(toConsentLocale("de"), "en");     // known tenant lang, no consent copy
    assert.equal(toConsentLocale("fr"), "en");
    assert.equal(toConsentLocale(""), "en");
    assert.equal(toConsentLocale(null), "en");
    assert.equal(toConsentLocale(undefined), "en");
  });
});

describe("consent-locale resolution (cookie ?? tenant default)", () => {
  it("no cookie + NL tenant → nl (the fresh-visitor fix)", () => {
    assert.equal(resolve(undefined, "nl"), "nl");
  });
  it("explicit cookie is leading, overriding the tenant default", () => {
    assert.equal(resolve("en", "nl"), "en");
    assert.equal(resolve("nl", "en"), "nl");
  });
  it("no cookie + unsupported/absent tenant language → en fallback", () => {
    assert.equal(resolve(undefined, "de"), "en");
    assert.equal(resolve(undefined, undefined), "en");
  });
  it("the resolved locale drives the banner copy", () => {
    assert.equal(consentTexts(resolve(undefined, "nl")).banner.title, consentTexts("nl").banner.title);
    assert.notEqual(consentTexts("nl").banner.title, consentTexts("en").banner.title);
  });
});
