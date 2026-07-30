/**
 * assembleResolvedForm — merge a form variant onto the base definition (phase 2).
 * Pure, no infra.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { assembleResolvedForm, resolvePresentedFields } from "../../forms/context/variant.ts";
import type { FormDefinition, FormField } from "../../forms/types.ts";

const def: FormDefinition = {
  key:   "contact",
  title: "Contact Us",
  description: "Send us a message.",
  fields: [
    { key: "name",    type: "text",     label: "Your name", validation: { required: true } },
    { key: "email",   type: "email",    label: "Email",     validation: { required: true, email: true } },
    { key: "message", type: "textarea", label: "Message",   validation: { required: false } },
  ],
  action: { storeSubmissions: true, notifyBackoffice: true, sendConfirmation: true, successMessage: "Thanks" },
  emailRouting: { backoffice: { subject: "s" }, confirmation: { emailField: "email", subject: "c", body: "b" } },
} as unknown as FormDefinition;

describe("assembleResolvedForm", () => {
  it("returns the definition copy + all fields when no variant is given", () => {
    const r = assembleResolvedForm(def, null);
    assert.equal(r.title, "Contact Us");
    assert.equal(r.intro, "Send us a message.");
    assert.equal(r.fields.length, 3);
  });

  it("applies variant copy + layout, keeping definition fallbacks", () => {
    const r = assembleResolvedForm(
      def,
      { title: "Werken bij ons?", submitLabel: "Verstuur", layout: { template: "split-left" } },
      { turnstile: { siteKey: "0xKEY" } },
    );
    assert.equal(r.title, "Werken bij ons?");
    assert.equal(r.intro, "Send us a message."); // fell back to definition
    assert.equal(r.submitLabel, "Verstuur");
    assert.equal(r.layout?.template, "split-left");
    assert.equal(r.turnstile?.siteKey, "0xKEY");
  });
});

describe("resolvePresentedFields", () => {
  it("relabels + reorders by key, preserving definition type/validation", () => {
    const variant: FormField[] = [
      { key: "email", type: "text",     label: "Zakelijk e-mailadres", validation: { required: false } }, // tries to change type/validation
      { key: "name",  type: "text",     label: "Naam" },
    ];
    const fields = resolvePresentedFields(def.fields, variant);
    // Order follows the variant (email first, name second) …
    assert.equal(fields[0].key, "email");
    assert.equal(fields[1].key, "name");
    // … but the definition's type + validation are preserved (not the variant's).
    assert.equal(fields[0].type, "email");
    assert.equal(fields[0].validation?.required, true);
    // Variant label is applied.
    assert.equal(fields[0].label, "Zakelijk e-mailadres");
  });

  it("re-appends a required field the variant dropped (submit stays valid)", () => {
    const variant: FormField[] = [
      { key: "email", type: "email", label: "Email" }, // dropped name (required) + message (optional)
    ];
    const fields = resolvePresentedFields(def.fields, variant);
    const keys = fields.map((f) => f.key);
    assert.ok(keys.includes("email"));
    assert.ok(keys.includes("name"), "required 'name' re-appended");
    assert.ok(!keys.includes("message"), "optional 'message' stays dropped");
  });

  it("ignores unknown keys", () => {
    const fields = resolvePresentedFields(def.fields, [
      { key: "ssn", type: "text", label: "SSN" } as FormField,
      { key: "email", type: "email", label: "Email" },
    ]);
    assert.ok(!fields.some((f) => f.key === "ssn"));
  });
});
