/**
 * Verifies the Statamic provisioning manifest exposes adaptive FORM blocks in
 * the CMS context-slot picker: a dropdown option per form, plus a render branch
 * that emits the data-mc-block marker the snippet fills.
 *
 * Pure generator, no infra — safe for the fast suite.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { generateStatamicManifest } from "../../provisioning/generators/statamic.ts";
import { mapStatamicPageBlocksToSections } from "../../cms/mappers/statamic/statamic-mappers.ts";

function artifact(path: string): string {
  const m = generateStatamicManifest();
  const a = m.artifacts.find((x) => x.path === path);
  assert.ok(a, `artifact ${path} present`);
  return a!.contents;
}

describe("statamic manifest — form slots", () => {
  it("adds a single Form slot type with a conditional form_type sub-field", () => {
    const yaml = artifact("resources/fieldsets/mc_context_slot.yaml");
    // One 'form' slot-type option (not one option per form).
    assert.match(yaml, /form: 'Form'/);
    // Conditional form_type select, shown only for the Form slot type.
    assert.match(yaml, /handle: form_type/);
    assert.match(yaml, /contact: 'Contact'/);
    assert.match(yaml, /application: 'Application'/);
    assert.match(yaml, /appointment: 'Appointment'/);
    assert.match(yaml, /slot_type: 'equals form'/);
    // Existing decision-engine slots still present.
    assert.match(yaml, /hero: Hero/);
  });

  it("renders a form block as a data-mc-block marker in the Antlers partial", () => {
    const tpl = artifact("resources/views/vendor/mister-chameleon/blocks/context_slot.antlers.html");
    assert.match(tpl, /\{\{ if slot_type == 'form' \}\}<div data-mc-block="form:\{\{ form_type \}\}"><\/div>\{\{ \/if \}\}/);
    // Existing slot rendering untouched.
    assert.match(tpl, /\{\{ if slot_type == 'hero' \}\}/);
  });
});

describe("statamic page mapper — form context slot", () => {
  it("maps a slot_type=form block to a server-side formSection with formKey=form_type", () => {
    const sections = mapStatamicPageBlocksToSections([
      { type: "context_slot", id: "blk1", slot_type: "form", form_type: "contact", is_active: true },
    ]);
    assert.equal(sections.length, 1);
    assert.equal(sections[0]._type, "formSection");
    assert.equal((sections[0] as { formKey?: string }).formKey, "contact");
  });

  it("normalises an augmented form_type object ({ value })", () => {
    const sections = mapStatamicPageBlocksToSections([
      { type: "context_slot", id: "blk2", slot_type: "form", form_type: { value: "appointment", label: "Appointment" }, is_active: true },
    ]);
    assert.equal((sections[0] as { formKey?: string }).formKey, "appointment");
  });

  it("skips a form slot with no form_type chosen", () => {
    const sections = mapStatamicPageBlocksToSections([
      { type: "context_slot", id: "blk3", slot_type: "form", is_active: true },
    ]);
    assert.equal(sections.length, 0);
  });

  it("still maps a decision-engine slot to a contextSlot", () => {
    const sections = mapStatamicPageBlocksToSections([
      { type: "context_slot", id: "blk4", slot_type: "hero", is_active: true },
    ]);
    assert.equal(sections[0]._type, "contextSlot");
  });
});
