/**
 * A tenant adds a postcode and a house number to one of its forms.
 *
 * The built-in forms are the same for every tenant. The per-form setting
 * `addressFields` adds the two fields for one tenant only. They carry the keys
 * the address lookup looks for, so the form fills in and checks the address.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAddressFieldsMode, withAddressFields } from "../../forms/address-fields.ts";
import { addressFieldKeys } from "../../lib/forms/address-lookup.ts";
import { resolvePresentedFields } from "../../forms/context/variant.ts";
import type { FormField } from "../../forms/types.ts";

const CONTACT: FormField[] = [
  { key: "name", type: "text", label: "Name", validation: { required: true } },
  { key: "email", type: "email", label: "Email", validation: { required: true, email: true } },
  { key: "message", type: "textarea", label: "Message", validation: { required: true } },
] as FormField[];
const keys = (fields: readonly FormField[]) => fields.map((f) => f.key);

describe("parseAddressFieldsMode", () => {
  it("knows the two modes and treats everything else as off", () => {
    assert.equal(parseAddressFieldsMode("optional"), "optional");
    assert.equal(parseAddressFieldsMode("required"), "required");
    for (const raw of [undefined, null, "", "off", "yes", true, 1, {}]) assert.equal(parseAddressFieldsMode(raw), undefined);
  });
});

describe("withAddressFields", () => {
  it("leaves the form alone when the setting is off", () => {
    assert.equal(withAddressFields(CONTACT, undefined), CONTACT);
  });

  it("puts postcode and house number in front of the message", () => {
    assert.deepEqual(keys(withAddressFields(CONTACT, "optional")), ["name", "email", "postcode", "huisnummer", "message"]);
  });

  it("puts them at the end of a form without a message field", () => {
    const short = CONTACT.slice(0, 2);
    assert.deepEqual(keys(withAddressFields(short, "optional")), ["name", "email", "postcode", "huisnummer"]);
  });

  it("makes them required only when the tenant asked for that", () => {
    const required = (mode: "optional" | "required") =>
      withAddressFields(CONTACT, mode).filter((f) => f.key === "postcode" || f.key === "huisnummer").map((f) => f.validation?.required);
    assert.deepEqual(required("optional"), [false, false]);
    assert.deepEqual(required("required"), [true, true]);
  });

  it("labels them in the language of the site", () => {
    const label = (locale: "en" | "nl") => withAddressFields(CONTACT, "optional", locale).find((f) => f.key === "huisnummer")?.label;
    assert.equal(label("nl"), "Huisnummer");
    assert.equal(label("en"), "House number");
  });

  it("uses the keys the address lookup looks for", () => {
    assert.deepEqual(addressFieldKeys(keys(withAddressFields(CONTACT, "optional"))), { postcode: "postcode", houseNumber: "huisnummer" });
  });

  it("does not add them twice to a form that has them", () => {
    const has = [...CONTACT, { key: "postal_code", type: "text", label: "Postcode" }, { key: "house_number", type: "text", label: "No." }] as FormField[];
    assert.equal(withAddressFields(has, "required"), has);
    const once = withAddressFields(CONTACT, "optional");
    assert.equal(withAddressFields(once, "optional"), once);
  });

  it("does not change the form it was given", () => {
    const before = JSON.stringify(CONTACT);
    withAddressFields(CONTACT, "required");
    assert.equal(JSON.stringify(CONTACT), before);
  });
});

describe("a form variant on top", () => {
  const base = withAddressFields(CONTACT, "required");

  it("keeps required address fields, also when the variant does not list them", () => {
    const shown = resolvePresentedFields(base, [{ key: "email", type: "email", label: "Work email" }] as FormField[]);
    assert.deepEqual(keys(shown).sort(), ["email", "huisnummer", "message", "name", "postcode"]);
  });

  it("lets a variant show optional address fields by naming them", () => {
    const optional = withAddressFields(CONTACT, "optional");
    const shown = resolvePresentedFields(optional, [
      { key: "name", type: "text", label: "Name" }, { key: "postcode", type: "text", label: "Postcode" }, { key: "huisnummer", type: "text", label: "Nr" },
    ] as FormField[]);
    assert.deepEqual(keys(shown), ["name", "postcode", "huisnummer", "email", "message"]);
  });
});

describe("the wiring", () => {
  const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

  it("adds the fields where render and submit both get their fields", () => {
    const load = read("forms/context/load.ts");
    assert.match(load, /addressFields = override\.addressFields/);
    assert.match(load, /withAddressFields\(formDef\.fields, addressFields, locale\)/);
    // The submit route validates against what resolveContextualForm returns.
    const route = read("app/api/forms/[formKey]/route.ts");
    assert.match(route, /effectiveFields\s+= resolved\.fields/);
  });

  it("reads and saves the setting, whatever the master toggle says", () => {
    assert.match(read("forms/load-tenant-form-overrides.ts"), /addressFields: parseAddressFieldsMode\(raw\.addressFields\)/);
    assert.match(read("app/admin/tenants/[tenantId]/content/forms/[formKey]/actions.ts"), /addressFields: parseAddressFieldsMode\(overrides\.addressFields\)/);
    const load = read("forms/context/load.ts");
    assert.doesNotMatch(load, /overrideEnabled/);
  });

  it("gives a variant on an external site the same base fields", () => {
    assert.match(read("app/api/snippet/decide/route.ts"), /resolvePresentedFields\(baseForm\.fields, variant\.fields\)/);
  });
});
