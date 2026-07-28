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
  it("adds form options to the context-slot fieldset dropdown", () => {
    const yaml = artifact("resources/fieldsets/mc_context_slot.yaml");
    assert.match(yaml, /'form:contact':\s*'Form — Contact'/);
    assert.match(yaml, /'form:application':\s*'Form — Application'/);
    assert.match(yaml, /'form:appointment':\s*'Form — Appointment'/);
    // Existing decision-engine slots still present.
    assert.match(yaml, /hero: Hero/);
  });

  it("renders a form block as a data-mc-block marker in the Antlers partial", () => {
    const tpl = artifact("resources/views/vendor/mister-chameleon/blocks/context_slot.antlers.html");
    assert.match(tpl, /\{\{ if slot_type == 'form:contact' \}\}<div data-mc-block="form:contact"><\/div>\{\{ \/if \}\}/);
    assert.match(tpl, /data-mc-block="form:appointment"/);
    // Existing slot rendering untouched.
    assert.match(tpl, /\{\{ if slot_type == 'hero' \}\}/);
  });
});
