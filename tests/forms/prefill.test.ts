/**
 * Form-prefill (Fase 2): consent gate, low-sensitivity field selection (sensitive
 * fields never returned), and field-key matching. Pure — no DB, no network.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  buildPrefillFromLead, prefillConsentGranted, prefillValuesForFieldKeys,
} from "../../lib/forms/prefill.ts";
import type { AbmLead } from "../../lib/abm/abm-store.ts";
import type { ConsentState } from "../../tracking/consent-types.ts";

const consent = (over: Partial<ConsentState> = {}): ConsentState =>
  ({ hasResponded: true, analytics: false, personalization: false, enrichment: false, advertising: false, ...over });

// A lead whose profile carries BOTH low-sensitivity and sensitive fields.
const lead = (profile: Record<string, string> = {}): AbmLead =>
  ({ id: "l1", tenantId: "t1", profile: {
      firstName: "Jan", name: "Jan Jansen", company: "Acme BV", industry: "Logistics",
      email: "jan@acme.example", role: "Head of Ops", companySize: "51-200", ...profile,
    } } as unknown as AbmLead);

describe("prefillConsentGranted", () => {
  it("true under personalization OR enrichment, false otherwise", () => {
    assert.equal(prefillConsentGranted(consent({ personalization: true })), true);
    assert.equal(prefillConsentGranted(consent({ enrichment: true })), true);
    assert.equal(prefillConsentGranted(consent()), false);
    assert.equal(prefillConsentGranted(consent({ analytics: true, advertising: true })), false);
    assert.equal(prefillConsentGranted(null), false);
  });
});

describe("buildPrefillFromLead", () => {
  it("returns only the low-sensitivity fields under consent", () => {
    const out = buildPrefillFromLead(lead(), consent({ personalization: true }));
    assert.deepEqual(out, { firstName: "Jan", name: "Jan Jansen", company: "Acme BV", industry: "Logistics" });
  });
  it("NEVER returns sensitive fields (email / role / companySize)", () => {
    const out = buildPrefillFromLead(lead(), consent({ enrichment: true })) as Record<string, unknown>;
    assert.equal("email" in out, false);
    assert.equal("role" in out, false);
    assert.equal("companySize" in out, false);
  });
  it("empty without a lead", () => {
    assert.deepEqual(buildPrefillFromLead(null, consent({ personalization: true })), {});
    assert.deepEqual(buildPrefillFromLead(undefined, consent({ enrichment: true })), {});
  });
  it("empty without consent (even with a lead)", () => {
    assert.deepEqual(buildPrefillFromLead(lead(), consent()), {});
    assert.deepEqual(buildPrefillFromLead(lead(), null), {});
  });
  it("omits absent low-sensitivity fields", () => {
    const out = buildPrefillFromLead(lead({ firstName: "", name: "", industry: "" }), consent({ personalization: true }));
    assert.deepEqual(out, { company: "Acme BV" });
  });
});

describe("prefillValuesForFieldKeys", () => {
  it("maps only matching field keys, ignores unknown + email", () => {
    const prefill = { firstName: "Jan", name: "Jan Jansen", company: "Acme BV", industry: "Logistics" };
    // A form with company + email + message fields: only `company` prefills.
    assert.deepEqual(prefillValuesForFieldKeys(["company", "email", "message"], prefill), { company: "Acme BV" });
    // name + firstName present.
    assert.deepEqual(prefillValuesForFieldKeys(["name", "firstName", "phone"], prefill), { name: "Jan Jansen", firstName: "Jan" });
    assert.deepEqual(prefillValuesForFieldKeys([], prefill), {});
  });
});
