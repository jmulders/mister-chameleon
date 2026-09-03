/**
 * Statamic form_section form-link resolution: the CP `form` field (string /
 * array / augmented Link-Item object) must resolve to the form HANDLE that
 * getFormDefinition() matches on. Pure mapper test — no CMS.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { resolveFormHandle, mapStatamicPageBlocksToSections } from "../../cms/mappers/statamic/statamic-mappers.ts";

describe("resolveFormHandle", () => {
  it("plain handle string", () => {
    assert.equal(resolveFormHandle("locatie-test"), "locatie-test");
    assert.equal(resolveFormHandle("  locatie-test  "), "locatie-test");
  });
  it("array of handles (Statamic form fieldtype)", () => {
    assert.equal(resolveFormHandle(["locatie-test"]), "locatie-test");
  });
  it("augmented Link-Item object — handle / value / id / slug", () => {
    assert.equal(resolveFormHandle({ handle: "locatie-test", title: "Locatie-test" }), "locatie-test");
    assert.equal(resolveFormHandle({ value: "locatie-test", label: "Locatie-test" }), "locatie-test"); // relation/link shape
    assert.equal(resolveFormHandle([{ value: "locatie-test" }]), "locatie-test");
    assert.equal(resolveFormHandle({ id: "locatie-test" }), "locatie-test");
  });
  it("empty / unusable → empty string", () => {
    assert.equal(resolveFormHandle(null), "");
    assert.equal(resolveFormHandle([]), "");
    assert.equal(resolveFormHandle({ title: "no handle here" }), "");
  });
});

describe("form_section block → formKey", () => {
  const formKeyOf = (form: unknown, extra: Record<string, unknown> = {}): string | undefined => {
    const sections = mapStatamicPageBlocksToSections(
      [{ type: "form_section", variant: "form_inline", heading: "Locatie-test", form, ...extra } as Record<string, unknown>],
      undefined,
    );
    const s = sections.find((x) => (x as { _type?: string })._type === "formSection") as { formKey?: string } | undefined;
    return s?.formKey;
  };

  it("resolves a CP form-link (Link-Item object) to the handle", () => {
    assert.equal(formKeyOf({ value: "locatie-test", label: "Locatie-test" }), "locatie-test");
  });
  it("resolves the flat-file bare string and the array shape", () => {
    assert.equal(formKeyOf("locatie-test"), "locatie-test");
    assert.equal(formKeyOf(["locatie-test"]), "locatie-test");
  });
  it("falls back to the legacy form_key", () => {
    assert.equal(formKeyOf(undefined, { form_key: "locatie-test" }), "locatie-test");
  });
  it("drops the block when no form is chosen (no formKey → not rendered)", () => {
    assert.equal(formKeyOf(null), undefined);
  });
});
