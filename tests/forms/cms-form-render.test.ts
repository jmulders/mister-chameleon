/**
 * Unit tests for CMS-form rendering support in FormSectionBlock.
 *
 * Covers the two pure pieces that drive whether — and with which fields — a form
 * block renders:
 *   - selectFormRender: code-form precedence, CMS-form render, unknown → empty.
 *   - buildCmsResolvedForm: a CP-authored form becomes a renderable ResolvedForm
 *     whose (enrichment-relevant) field handles survive to render + submit.
 *
 * The server-side glue (resolveContextualForm) and the submit route already
 * share fetchCMSFormByName + toPlatformFields, so render and submit agree on the
 * same field set; these tests pin the pure decision + mapping.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { selectFormRender, buildCmsResolvedForm } from "../../forms/context/resolve.ts";
import type { FormField } from "../../forms/types.ts";

const codeFields: FormField[] = [
  { key: "name",  type: "text",  label: "Naam" },
  { key: "email", type: "email", label: "E-mail" },
];

// A form built entirely in the CP, with the field handles the enrichment
// pipeline keys on (postcode + huisnummer + woonplaats).
const cmsFields: FormField[] = [
  { key: "postcode",   type: "text", label: "Postcode",   validation: { required: true } },
  { key: "huisnummer", type: "text", label: "Huisnummer", validation: { required: true } },
  { key: "woonplaats", type: "text", label: "Woonplaats" },
];

describe("selectFormRender", () => {
  it("renders a code form from its definition (unknown overlay not yet loaded)", () => {
    const r = selectFormRender(codeFields, undefined);
    assert.equal(r.render, true);
    assert.deepEqual(r.fields, codeFields);
  });

  it("renders a CMS form once its overlay arrives (no code definition)", () => {
    const r = selectFormRender(undefined, cmsFields);
    assert.equal(r.render, true);
    assert.deepEqual(r.fields, cmsFields);
    assert.deepEqual(r.fields.map((f) => f.key), ["postcode", "huisnummer", "woonplaats"]);
  });

  it("renders a clean empty for an unknown formKey (neither source)", () => {
    const r = selectFormRender(undefined, undefined);
    assert.equal(r.render, false);
    assert.equal(r.fields.length, 0);

    // Empty arrays count as "no fields" too.
    const r2 = selectFormRender([], []);
    assert.equal(r2.render, false);
    assert.equal(r2.fields.length, 0);
  });

  it("lets a contextual overlay variant win over the base code fields", () => {
    const variant: FormField[] = [{ key: "email", type: "email", label: "Werk-e-mail" }];
    const r = selectFormRender(codeFields, variant);
    assert.equal(r.render, true);
    assert.deepEqual(r.fields, variant);
  });
});

describe("buildCmsResolvedForm", () => {
  it("maps a CP-authored form to a renderable ResolvedForm with its fields + copy", () => {
    const r = buildCmsResolvedForm({
      title:          "Locatie-check",
      successMessage: "Bedankt — we rekenen je locatie door.",
      redirectPath:   "/bedankt",
      fields:         cmsFields,
    });
    assert.equal(r.segment, null);
    assert.equal(r.title, "Locatie-check");
    assert.equal(r.successMessage, "Bedankt — we rekenen je locatie door.");
    assert.equal(r.redirectPath, "/bedankt");
    assert.deepEqual(r.fields.map((f) => f.key), ["postcode", "huisnummer", "woonplaats"]);
  });

  it("drops an unsafe redirect (open-redirect guard, shared with code forms)", () => {
    assert.equal(
      buildCmsResolvedForm({ redirectPath: "//evil.com", fields: cmsFields }).redirectPath,
      undefined,
    );
    assert.equal(
      buildCmsResolvedForm({ redirectPath: "https://evil.com", fields: cmsFields }).redirectPath,
      undefined,
    );
  });

  it("leaves copy undefined when the CMS form omits it (block falls back to its own defaults)", () => {
    const r = buildCmsResolvedForm({ fields: cmsFields });
    assert.equal(r.title, undefined);
    assert.equal(r.successMessage, undefined);
    assert.equal(r.redirectPath, undefined);
    assert.equal(r.fields.length, 3);
  });
});
