/**
 * Advertising / marketing consent category.
 *
 * Locks the wire format (mc_consent `ad` field), the privacy-first default,
 * backward compatibility with pre-advertising cookies, and the tenant ceiling
 * that together gate CAPI click-id forwarding. See
 * docs/design/advertising-consent-capi.md.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseConsentCookieValue,
  serializeConsentState,
  FULL_CONSENT,
  DEFAULT_CONSENT,
} from "../../tracking/consent-types.ts";
import { resolveConsent, consentFromSnippet } from "../../lib/consent/server-consent.ts";
import type { TenantPrivacySettings } from "../../tenant/types.ts";

describe("advertising consent — cookie wire format", () => {
  it("parses the ad field to advertising", () => {
    const raw = encodeURIComponent(JSON.stringify({ v: 1, a: true, p: false, e: false, ad: true }));
    assert.equal(parseConsentCookieValue(raw).advertising, true);
  });

  it("defaults advertising to false when the ad field is absent (backward compat)", () => {
    // A v1 cookie written before the advertising category existed.
    const raw = encodeURIComponent(JSON.stringify({ v: 1, a: true, p: true, e: true }));
    const parsed = parseConsentCookieValue(raw);
    assert.equal(parsed.advertising, false);
    // The visitor's other choices are preserved, not reset.
    assert.equal(parsed.analytics, true);
    assert.equal(parsed.personalization, true);
  });

  it("round-trips advertising through serialize -> parse", () => {
    const cookie = serializeConsentState(FULL_CONSENT);
    assert.equal(parseConsentCookieValue(encodeURIComponent(cookie)).advertising, true);
    const denied = serializeConsentState(DEFAULT_CONSENT);
    assert.equal(parseConsentCookieValue(encodeURIComponent(denied)).advertising, false);
  });

  it("the default (no cookie) denies advertising", () => {
    assert.equal(parseConsentCookieValue(null).advertising, false);
  });
});

describe("advertising consent — the CAPI gate resolution", () => {
  const adCookie = (on: boolean) =>
    `mc_consent=${encodeURIComponent(JSON.stringify({ v: 1, a: true, p: true, e: true, ad: on }))}`;

  it("resolveConsent surfaces advertising from the cookie header", () => {
    assert.equal(resolveConsent(adCookie(true)).advertising, true);
    assert.equal(resolveConsent(adCookie(false)).advertising, false);
    assert.equal(resolveConsent(null).advertising, false); // no cookie
  });

  it("the tenant ceiling can disable advertising platform-wide", () => {
    const privacy = { allowAdvertising: false } as unknown as TenantPrivacySettings;
    assert.equal(resolveConsent(adCookie(true), privacy).advertising, false);
    // Other categories are unaffected by the advertising ceiling.
    assert.equal(resolveConsent(adCookie(true), privacy).analytics, true);
  });

  it("consentFromSnippet maps advertising and FULL grants it", () => {
    assert.equal(consentFromSnippet({ advertising: true, hasResponded: true }, "auto").advertising, true);
    assert.equal(consentFromSnippet({ analytics: true, hasResponded: true }, "auto").advertising, false);
    assert.equal(consentFromSnippet(true, "auto").advertising, true);
  });
});
