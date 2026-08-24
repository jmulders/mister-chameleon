/**
 * readStatamicBlockEffectRef — the CMS per-block motion field -> BlockEffectRef,
 * the parallel of the token_set field. Precedence: disable > named set > single
 * inline effect. Handles Statamic's augmented select/toggle value shapes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  readStatamicBlockEffectRef, mapStatamicPageBlocksToSections,
} from "../../cms/mappers/statamic/statamic-mappers.ts";
import type { PageSectionBase } from "../../cms/types.ts";

const effectsOf = (s: unknown) => (s as PageSectionBase | undefined)?.effects;

describe("readStatamicBlockEffectRef", () => {
  it("returns undefined when no motion field is authored", () => {
    assert.equal(readStatamicBlockEffectRef({}), undefined);
    assert.equal(readStatamicBlockEffectRef({ effect_set: "", effect: "  " }), undefined);
  });

  it("maps a named effect set", () => {
    assert.deepEqual(readStatamicBlockEffectRef({ effect_set: "reveal-soft" }), { effectSet: "reveal-soft" });
  });

  it("maps a single inline effect id", () => {
    assert.deepEqual(readStatamicBlockEffectRef({ effect: "reveal" }), { effects: [{ effect: "reveal" }] });
  });

  it("prefers the named set over a single inline effect", () => {
    assert.deepEqual(
      readStatamicBlockEffectRef({ effect_set: "reveal-soft", effect: "reveal" }),
      { effectSet: "reveal-soft" },
    );
  });

  it("disable wins over everything", () => {
    assert.deepEqual(
      readStatamicBlockEffectRef({ effect_disabled: true, effect_set: "reveal-soft", effect: "reveal" }),
      { disabled: true },
    );
  });

  it("accepts Statamic's augmented select object ({ value })", () => {
    assert.deepEqual(readStatamicBlockEffectRef({ effect_set: { value: "reveal-soft", label: "Reveal soft" } }), { effectSet: "reveal-soft" });
  });

  it("accepts a stringy/boolean toggle for disable", () => {
    assert.deepEqual(readStatamicBlockEffectRef({ effect_disabled: "true" }), { disabled: true });
    assert.deepEqual(readStatamicBlockEffectRef({ effect_disabled: { value: true } }), { disabled: true });
    assert.equal(readStatamicBlockEffectRef({ effect_disabled: false }), undefined);
  });
});

describe("mapStatamicPageBlocksToSections — motion field forwarded onto the section", () => {
  it("forwards a named effect set as section.effects", () => {
    const sections = mapStatamicPageBlocksToSections([
      { type: "text_section", _key: "b1", heading: "Hi", effect_set: "reveal-soft" },
    ]);
    assert.deepEqual(effectsOf(sections[0]), { effectSet: "reveal-soft" });
  });

  it("forwards a disable toggle as section.effects", () => {
    const sections = mapStatamicPageBlocksToSections([
      { type: "text_section", _key: "b2", heading: "Hi", effect_disabled: true },
    ]);
    assert.deepEqual(effectsOf(sections[0]), { disabled: true });
  });

  it("leaves section.effects unset when no motion is authored", () => {
    const sections = mapStatamicPageBlocksToSections([
      { type: "text_section", _key: "b3", heading: "Hi" },
    ]);
    assert.equal(effectsOf(sections[0]), undefined);
  });
});
