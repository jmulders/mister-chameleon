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
