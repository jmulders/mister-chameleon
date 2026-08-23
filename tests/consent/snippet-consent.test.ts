/**
 * consentFromSnippet — turning the snippet's forwarded consent into a
 * ConsentState, with the tenant no-signal default and the tenant ceiling.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { consentFromSnippet, computeEffectiveConsent } from "../../lib/consent/server-consent.ts";
import type { TenantPrivacySettings } from "../../tenant/types.ts";

describe("consentFromSnippet", () => {
  it("maps a category object to booleans", () => {
    const c = consentFromSnippet({ analytics: true, personalization: false, enrichment: true, hasResponded: true }, "auto");
    assert.deepEqual(c, { hasResponded: true, analytics: true, personalization: false, enrichment: true });
  });

  it("maps legacy booleans", () => {
    assert.deepEqual(consentFromSnippet(true, "auto"), { hasResponded: true, analytics: true, personalization: true, enrichment: true });
    assert.deepEqual(consentFromSnippet(false, "always"), { hasResponded: true, analytics: false, personalization: false, enrichment: false });
  });

  it("null (no host signal) denies under auto", () => {
    const c = consentFromSnippet(null, "auto");
    assert.deepEqual(c, { hasResponded: false, analytics: false, personalization: false, enrichment: false });
  });

  it("null (no host signal) grants under always", () => {
    const c = consentFromSnippet(null, "always");
    assert.equal(c.analytics && c.personalization && c.enrichment, true);
  });

  it("null defaults to deny when consentSource is unset (auto)", () => {
    assert.equal(consentFromSnippet(null, undefined).personalization, false);
  });

  it("an omitted field (legacy snippet) is granted for backward compatibility", () => {
    assert.equal(consentFromSnippet(undefined, "auto").enrichment, true);
  });
});

describe("consentFromSnippet + tenant ceiling", () => {
  it("the tenant privacy policy can only further restrict", () => {
    const privacy = { allowEnrichment: false } as unknown as TenantPrivacySettings;
    const eff = computeEffectiveConsent(consentFromSnippet(true, "auto"), privacy);
    assert.equal(eff.analytics, true);
    assert.equal(eff.personalization, true);
    assert.equal(eff.enrichment, false); // capped by the tenant
  });
});
