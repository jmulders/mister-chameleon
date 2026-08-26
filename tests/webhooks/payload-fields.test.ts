/**
 * Configurable rule-webhook payload — selection + consent gating.
 *
 * Locks that selected fields appear in the payload, and that consent-gated fields
 * (firmographic/scoring/person) are dropped without the required consent.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractSelectedPayload,
  extractBaseContext,
  isPayloadFieldConsented,
  PAYLOAD_FIELD_KEYS,
  PAYLOAD_FIELD_CATALOG,
  BASE_CONTEXT_KEYS,
  type PayloadSourceContext,
} from "../../lib/webhooks/payload-fields.ts";
import type { ConsentState } from "../../tracking/consent-types.ts";

const consent = (p: Partial<ConsentState> = {}): ConsentState =>
  ({ hasResponded: true, analytics: false, personalization: false, enrichment: false, advertising: false, ...p });

const CTX: PayloadSourceContext = {
  source: "google",
  clientContext: { deviceType: "mobile" },
  audienceSegmentIds: "enterprise,returning",
  enrichment: { companyName: "Acme BV", companyDomain: "acme.example", companyIndustry: "SaaS", companySize: "51-200", countryCode: "NL", region: "Noord-Holland" },
  derived: { funnelStage: "high_intent" },
  history: { journey: { intentScore: 82, hasVisitedPricing: true } },
  knownLead: { name: "Pieter de Vries", firstName: "Pieter", role: "Procurement Lead", company: "Nakatomi BV" },
};

const ALL = [...PAYLOAD_FIELD_KEYS];

describe("extractBaseContext (always-sent non-PII slice)", () => {
  it("includes every present gate=null field, no consent needed", () => {
    const out = extractBaseContext(CTX);
    assert.equal(out.source, "google");
    assert.equal(out.device, "mobile");
    assert.equal(out.audienceSegments, "enterprise,returning");
  });
  it("never leaks consent-gated (firmographic/scoring/person) fields", () => {
    const out = extractBaseContext(CTX);
    assert.equal(out.companyName, undefined);
    assert.equal(out.intentScore, undefined);
    assert.equal(out.personName, undefined);
  });
  it("BASE_CONTEXT_KEYS are exactly the gate=null catalog keys", () => {
    const gateNull = PAYLOAD_FIELD_CATALOG.filter((f) => f.gate === null).map((f) => f.key).sort();
    assert.deepEqual([...BASE_CONTEXT_KEYS].sort(), gateNull);
  });
  it("omits absent fields", () => {
    assert.deepEqual(extractBaseContext({ source: "direct" }), { source: "direct" });
  });
});

describe("isPayloadFieldConsented", () => {
  it("context (null gate) is always allowed", () => {
    assert.equal(isPayloadFieldConsented(null, undefined), true);
    assert.equal(isPayloadFieldConsented(null, consent()), true);
  });
  it("firmographic needs enrichment", () => {
    assert.equal(isPayloadFieldConsented("enrichment", consent()), false);
    assert.equal(isPayloadFieldConsented("enrichment", consent({ enrichment: true })), true);
  });
  it("scoring needs personalization", () => {
    assert.equal(isPayloadFieldConsented("personalization", consent({ enrichment: true })), false);
    assert.equal(isPayloadFieldConsented("personalization", consent({ personalization: true })), true);
  });
  it("person needs BOTH personalization and enrichment (strictest)", () => {
    assert.equal(isPayloadFieldConsented("person", consent({ personalization: true })), false);
    assert.equal(isPayloadFieldConsented("person", consent({ enrichment: true })), false);
    assert.equal(isPayloadFieldConsented("person", consent({ personalization: true, enrichment: true })), true);
  });
});

describe("extractSelectedPayload", () => {
  it("includes selected context fields with no consent", () => {
    const out = extractSelectedPayload(CTX, ["source", "device", "audienceSegments"], consent());
    assert.deepEqual(out, { source: "google", device: "mobile", audienceSegments: "enterprise,returning" });
  });

  it("drops firmographic without enrichment, keeps it with", () => {
    assert.deepEqual(extractSelectedPayload(CTX, ["companyName", "geoCountry"], consent()), {});
    assert.deepEqual(
      extractSelectedPayload(CTX, ["companyName", "geoCountry"], consent({ enrichment: true })),
      { companyName: "Acme BV", geoCountry: "NL" },
    );
  });

  it("drops scoring without personalization, keeps it with", () => {
    assert.deepEqual(extractSelectedPayload(CTX, ["intentScore", "funnelStage"], consent({ enrichment: true })), {});
    assert.deepEqual(
      extractSelectedPayload(CTX, ["intentScore", "funnelStage", "visitedPricing"], consent({ personalization: true })),
      { intentScore: 82, funnelStage: "high_intent", visitedPricing: true },
    );
  });

  it("drops person fields unless BOTH personalization and enrichment are granted", () => {
    assert.deepEqual(extractSelectedPayload(CTX, ["personName"], consent({ personalization: true })), {});
    assert.deepEqual(extractSelectedPayload(CTX, ["personName"], consent({ enrichment: true })), {});
    assert.deepEqual(
      extractSelectedPayload(CTX, ["personName", "personRole"], consent({ personalization: true, enrichment: true })),
      { personName: "Pieter de Vries", personRole: "Procurement Lead" },
    );
  });

  it("full consent yields firmographic+scoring+person; no consent yields only context", () => {
    const full = extractSelectedPayload(CTX, ALL, consent({ analytics: true, personalization: true, enrichment: true }));
    assert.equal(full.companyName, "Acme BV");
    assert.equal(full.intentScore, 82);
    assert.equal(full.personName, "Pieter de Vries");

    const none = extractSelectedPayload(CTX, ALL, consent());
    assert.equal(none.companyName, undefined);
    assert.equal(none.intentScore, undefined);
    assert.equal(none.personName, undefined);
    assert.equal(none.source, "google"); // context still present
  });

  it("empty selection yields an empty object", () => {
    assert.deepEqual(extractSelectedPayload(CTX, [], consent({ enrichment: true })), {});
    assert.deepEqual(extractSelectedPayload(CTX, undefined, consent({ enrichment: true })), {});
  });
});
