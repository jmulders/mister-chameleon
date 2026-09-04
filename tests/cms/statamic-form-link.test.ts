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

describe("form_section block → submit behaviour", () => {
  const sectionOf = (extra: Record<string, unknown> = {}) => {
    const sections = mapStatamicPageBlocksToSections(
      [{ type: "form_section", variant: "form_inline", form: "locatie-test", ...extra } as Record<string, unknown>],
      undefined,
    );
    return sections.find((x) => (x as { _type?: string })._type === "formSection") as {
      submitLabel?:    string;
      successMessage?: string;
      postSubmit?:     string;
      redirectUrl?:    string;
    } | undefined;
  };

  it("maps submit_label and success_message", () => {
    const s = sectionOf({ submit_label: "Verstuur aanvraag", success_message: "Dank je wel!" });
    assert.equal(s?.submitLabel,    "Verstuur aanvraag");
    assert.equal(s?.successMessage, "Dank je wel!");
  });

  it("blank submit_label / success_message map to undefined", () => {
    const s = sectionOf({ submit_label: "", success_message: "   " });
    assert.equal(s?.submitLabel,    undefined);
    assert.equal(s?.successMessage, undefined);
  });

  it("defaults post_submit to \"message\" — including for blocks saved before the field existed", () => {
    assert.equal(sectionOf()?.postSubmit,                            "message");
    assert.equal(sectionOf({ post_submit: "message" })?.postSubmit,  "message");
    assert.equal(sectionOf({ post_submit: "onzin" })?.postSubmit,    "message");
  });

  it("post_submit \"redirect\" survives both the raw string and the augmented CP object", () => {
    assert.equal(sectionOf({ post_submit: "redirect" })?.postSubmit,                        "redirect");
    assert.equal(sectionOf({ post_submit: { value: "redirect", label: "Doorsturen" } })?.postSubmit, "redirect");
  });

  it("redirect_target as a raw string path", () => {
    assert.equal(sectionOf({ post_submit: "redirect", redirect_target: "/bedankt" })?.redirectUrl, "/bedankt");
  });

  it("redirect_target as an entry object — url preferred over permalink", () => {
    assert.equal(
      sectionOf({ post_submit: "redirect", redirect_target: { url: "/dank", permalink: "https://mc.nl/dank" } })?.redirectUrl,
      "/dank",
    );
    assert.equal(
      sectionOf({ post_submit: "redirect", redirect_target: { permalink: "https://mc.nl/dank" } })?.redirectUrl,
      "https://mc.nl/dank",
    );
  });

  it("an unsafe redirect_target is dropped rather than mapped", () => {
    assert.equal(sectionOf({ post_submit: "redirect", redirect_target: "javascript:alert(1)" })?.redirectUrl, undefined);
    assert.equal(sectionOf({ post_submit: "redirect", redirect_target: "//evil.example" })?.redirectUrl,      undefined);
  });

  it("no redirect_target → undefined", () => {
    assert.equal(sectionOf()?.redirectUrl, undefined);
  });
});
