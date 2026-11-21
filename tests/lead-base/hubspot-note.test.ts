/**
 * The visit note in HubSpot says how the visitor was recognised.
 *
 * It used to say "via personalized link" for every visit, also when nobody
 * had clicked such a link and only the company was recognised. Sales read
 * that as "our mail was opened".
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNoteBody } from "../../lib/lead-base/record-visitor-profile.ts";

const now = new Date("2026-11-21T10:30:00Z");
const company = { companyName: "Zorggroep Voorbeeld", funnelStage: "consideration", intentScore: 42 };

describe("buildNoteBody", () => {
  it("names the personal link when the visit came through one", () => {
    const note = buildNoteBody({ ...company, abmLeadId: "lead-1" },
      { firstName: "Anna", lastName: "de Vries", jobTitle: "Marketingmanager", email: null, linkedinUrl: null }, now);
    assert.match(note, /<strong>Website visit via personalized link<\/strong>/);
    assert.match(note, /Contact: Anna de Vries, Marketingmanager/);
    assert.match(note, /Account: Zorggroep Voorbeeld/);
  });

  it("does not claim a personal link for a company that was only recognised", () => {
    const note = buildNoteBody({ ...company, abmLeadId: null }, null, now);
    assert.doesNotMatch(note, /personalized link/);
    assert.match(note, /<strong>Website visit from a recognised company<\/strong>/);
    assert.match(note, /Contact: not identified\. The company was recognised from the visit\./);
    assert.match(note, /Account: Zorggroep Voorbeeld/);
    assert.match(note, /Funnel stage: consideration/);
    assert.match(note, /Intent score: 42/);
  });

  it("does not invent a contact for a recognised company, even when a person object is passed", () => {
    const note = buildNoteBody({ ...company, abmLeadId: undefined },
      { firstName: "Anna", lastName: null, jobTitle: null, email: null, linkedinUrl: null }, now);
    assert.doesNotMatch(note, /Anna/);
    assert.match(note, /Contact: not identified/);
  });

  it("says 'Known contact' for a personal link without a name", () => {
    const note = buildNoteBody({ ...company, abmLeadId: "lead-2" }, null, now);
    assert.match(note, /via personalized link/);
    assert.match(note, /Contact: Known contact/);
  });

  it("puts the moment of the visit in the first line, in Dutch time", () => {
    const first = buildNoteBody({ ...company, abmLeadId: null }, null, now).split("<br>")[0];
    assert.match(first, /21-11-2026/);
    assert.match(first, /11:30/);
  });
});
