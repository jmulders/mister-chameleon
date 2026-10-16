/**
 * v1/slot consent parity with snippet decide.
 *
 * The CMS adapters never send a consent field. That absence must mean "no
 * signal, apply the tenant default", not the legacy-snippet full grant.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { slotConsentInput } from "@/lib/snippet/slot-consent";
import { consentFromSnippet } from "@/lib/consent/server-consent";

describe("slotConsentInput", () => {
  it("maps an omitted consent field to null", () => {
    assert.equal(slotConsentInput({ slot_type: "hero" }), null);
  });

  it("maps a non-object body to null", () => {
    assert.equal(slotConsentInput(null), null);
    assert.equal(slotConsentInput("x"), null);
  });

  it("passes an explicit value through", () => {
    assert.equal(slotConsentInput({ consent: true }), true);
    assert.equal(slotConsentInput({ consent: false }), false);
    assert.deepEqual(slotConsentInput({ consent: { personalization: true } }), { personalization: true });
  });

  it("gives an adapter call without consent no personalization on an 'auto' tenant", () => {
    const state = consentFromSnippet(slotConsentInput({}), "auto");
    assert.equal(state.personalization, false);
  });

  it("gives an adapter call without consent no personalization when consentSource is unset", () => {
    const state = consentFromSnippet(slotConsentInput({}), undefined);
    assert.equal(state.personalization, false);
  });

  it("keeps full consent for an 'always' tenant", () => {
    const state = consentFromSnippet(slotConsentInput({}), "always");
    assert.equal(state.personalization, true);
    assert.equal(state.enrichment, true);
  });
});
