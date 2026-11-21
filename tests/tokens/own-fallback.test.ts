/**
 * What stands in for a token whose value is unknown.
 *
 * The fixed stand-ins were in the u-form ("uw organisatie") and one was
 * English ("your device"), on a platform whose own site addresses the reader
 * with je. They are in the je-form now, and a writer can name the stand-in
 * for a sentence: {{company_name|uw organisatie}}.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTokens } from "../../lib/tokens/parse-tokens.ts";

describe("{{token}} without a value", () => {
  it("uses a stand-in in the je-form, in Dutch", () => {
    assert.equal(parseTokens("Speciaal voor {{company_name}}", {}), "Speciaal voor je organisatie");
    assert.equal(parseTokens("Klanten in {{location}} kiezen voor ons.", {}), "Klanten in je regio kiezen voor ons.");
    assert.equal(parseTokens("{{city}} en {{region}}", {}), "je stad en je regio");
    assert.equal(parseTokens("Voor {{industry}}", {}), "Voor je sector");
    assert.equal(parseTokens("Op {{device}}", {}), "Op je apparaat");
  });

  it("has no stand-in left in the u-form or in English", () => {
    const all = parseTokens("{{company_name}} {{company_short}} {{company}} {{location}} {{city}} {{region}} {{industry}} {{device}}", {});
    assert.doesNotMatch(all, /\buw\b|your/i);
  });

  it("keeps the silent ones silent", () => {
    assert.equal(parseTokens("Welkom{{first_name}}", {}), "Welkom");
    assert.equal(parseTokens("via {{source}}", {}), "via ");
  });
});

describe("{{token|own stand-in}}", () => {
  it("uses the writer's stand-in when the value is unknown", () => {
    assert.equal(parseTokens("Speciaal voor {{company_name|uw organisatie}}", {}), "Speciaal voor uw organisatie");
    assert.equal(parseTokens("Hallo {{first_name|daar}}", {}), "Hallo daar");
    assert.equal(parseTokens("For {{company_name|your team}}", {}), "For your team");
  });

  it("uses the value when there is one", () => {
    assert.equal(parseTokens("Speciaal voor {{company_name|uw organisatie}}", { companyName: "Zorggroep Voorbeeld" }), "Speciaal voor Zorggroep Voorbeeld");
  });

  it("takes an empty stand-in as 'nothing here'", () => {
    assert.equal(parseTokens("Welkom {{company_name|}}terug", {}), "Welkom terug");
  });

  it("allows spaces around the name and keeps the stand-in as written", () => {
    assert.equal(parseTokens("In {{ city | de buurt }}.", {}), "In  de buurt .");
    assert.equal(parseTokens("In {{city|de buurt}}.", {}), "In de buurt.");
  });

  it("still escapes a value that comes from outside, and not the writer's own text", () => {
    assert.equal(parseTokens("{{company_name|R&D}}", { companyName: "<b>Acme</b>" }), "&lt;b&gt;Acme&lt;/b&gt;");
    assert.equal(parseTokens("{{company_name|R&D}}", {}), "R&D");
  });

  it("leaves an unknown token as typed, stand-in included, so a typo stays visible", () => {
    assert.equal(parseTokens("{{compny_name}}", {}), "{{compny_name}}");
    assert.equal(parseTokens("{{compny_name|uw organisatie}}", {}), "{{compny_name|uw organisatie}}");
  });

  it("is case-insensitive in the name, as before", () => {
    assert.equal(parseTokens("{{Company_Name|iets}}", { companyName: "Acme" }), "Acme");
  });
});
