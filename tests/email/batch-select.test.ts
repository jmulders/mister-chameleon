/**
 * Unit tests for the pure batch-audience selection logic.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  selectBatchRecipients, collectFilterOptions,
} from "../../lib/email/batch-select.ts";
import type { AbmLead } from "../../lib/abm/abm-store.ts";

const NOW = Date.parse("2026-07-24T12:00:00.000Z");

function makeLead(over: Partial<AbmLead> & { profile?: Partial<AbmLead["profile"]> } = {}): AbmLead {
  return {
    id:          over.id ?? "l1",
    tenantId:    "t1",
    identifier:  "id1",
    vanityPath:  null,
    targetPath:  "/",
    profile:     { email: "a@b.com", ...(over.profile ?? {}) },
    segmentHint: null,
    status:      over.status ?? "active",
    expiresAt:   over.expiresAt ?? null,
    firstSeenAt: null,
    lastSeenAt:  null,
    visitCount:  0,
    ...over,
  };
}

describe("selectBatchRecipients", () => {
  it("keeps only leads with a valid email", () => {
    const leads = [
      makeLead({ id: "1", profile: { email: "ok@x.com" } }),
      makeLead({ id: "2", profile: { email: "not-an-email" } }),
      makeLead({ id: "3", profile: { email: undefined } }),
    ];
    const out = selectBatchRecipients(leads, {}, NOW);
    assert.deepEqual(out.map((r) => r.leadId), ["1"]);
  });

  it("de-duplicates by lowercased email, first wins", () => {
    const leads = [
      makeLead({ id: "1", profile: { email: "Dup@X.com", company: "First" } }),
      makeLead({ id: "2", profile: { email: "dup@x.com", company: "Second" } }),
    ];
    const out = selectBatchRecipients(leads, {}, NOW);
    assert.equal(out.length, 1);
    assert.equal(out[0].leadId, "1");
    assert.equal(out[0].email, "dup@x.com");
  });

  it("drops paused and expired leads by default", () => {
    const leads = [
      makeLead({ id: "1", status: "active" }),
      makeLead({ id: "2", status: "paused" }),
      makeLead({ id: "3", status: "active", expiresAt: new Date(NOW - 1000).toISOString() }),
    ];
    const out = selectBatchRecipients(leads, {}, NOW);
    assert.deepEqual(out.map((r) => r.leadId), ["1"]);
  });

  it("includes non-live leads when activeOnly is false", () => {
    const leads = [makeLead({ id: "2", status: "paused", profile: { email: "p@x.com" } })];
    const out = selectBatchRecipients(leads, { activeOnly: false }, NOW);
    assert.equal(out.length, 1);
  });

  it("filters by industry and companySize case-insensitively", () => {
    const leads = [
      makeLead({ id: "1", profile: { email: "1@x.com", industry: "SaaS",   companySize: "11-50" } }),
      makeLead({ id: "2", profile: { email: "2@x.com", industry: "Retail", companySize: "11-50" } }),
      makeLead({ id: "3", profile: { email: "3@x.com", industry: "saas",   companySize: "1000+" } }),
    ];
    assert.deepEqual(
      selectBatchRecipients(leads, { industry: "saas" }, NOW).map((r) => r.leadId),
      ["1", "3"],
    );
    assert.deepEqual(
      selectBatchRecipients(leads, { industry: "SaaS", companySize: "11-50" }, NOW).map((r) => r.leadId),
      ["1"],
    );
  });

  it("prefers firstName, falls back to name, then null", () => {
    const leads = [
      makeLead({ id: "1", profile: { email: "1@x.com", firstName: "Jo", name: "Jo Full" } }),
      makeLead({ id: "2", profile: { email: "2@x.com", name: "Only Full" } }),
      makeLead({ id: "3", profile: { email: "3@x.com" } }),
    ];
    const out = selectBatchRecipients(leads, {}, NOW);
    assert.deepEqual(out.map((r) => r.name), ["Jo", "Only Full", null]);
  });
});

describe("collectFilterOptions", () => {
  it("returns distinct sorted non-empty values", () => {
    const leads = [
      makeLead({ id: "1", profile: { email: "1@x.com", industry: "Retail" } }),
      makeLead({ id: "2", profile: { email: "2@x.com", industry: "SaaS" } }),
      makeLead({ id: "3", profile: { email: "3@x.com", industry: "Retail" } }),
      makeLead({ id: "4", profile: { email: "4@x.com", industry: "  " } }),
    ];
    assert.deepEqual(collectFilterOptions(leads, "industry"), ["Retail", "SaaS"]);
  });
});
