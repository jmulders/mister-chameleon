/**
 * Form presentation layouts (phase 1 of forms-as-adaptive-blocks) — snippet render.
 * Pure string rendering, no infra.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { renderForm }   from "../../lib/snippet/render-block-html.ts";
import type { ResolvedForm } from "../../forms/context/types.ts";

const base: ResolvedForm = {
  segment: null,
  title:   "Contact",
  fields:  [{ key: "email", type: "email", label: "Email", validation: { required: true } }],
};

describe("renderForm — layouts", () => {
  it("renders a single column by default (no split grid)", () => {
    const html = renderForm(base, "contact");
    assert.match(html, /<form data-mc-form="contact"/);
    assert.doesNotMatch(html, /grid-template-columns/);
  });

  it("renders split-left with the contact panel BEFORE the form", () => {
    const html = renderForm(
      { ...base, layout: { template: "split-left", contactPanel: { name: "Hans Eertink", email: "info@dsa.nl" } } },
      "contact",
    );
    assert.match(html, /grid-template-columns:repeat\(auto-fit/);
    assert.match(html, /Hans Eertink/);
    assert.match(html, /mailto:info@dsa.nl/);
    // Panel name appears before the <form>.
    assert.ok(html.indexOf("Hans Eertink") < html.indexOf("<form"), "panel before form");
  });

  it("renders split-right with the form BEFORE the contact panel", () => {
    const html = renderForm(
      { ...base, layout: { template: "split-right", contactPanel: { name: "Jane Doe" } } },
      "contact",
    );
    assert.match(html, /grid-template-columns:repeat\(auto-fit/);
    assert.ok(html.indexOf("<form") < html.indexOf("Jane Doe"), "form before panel");
  });

  it("falls back to single column when a split has no contact panel", () => {
    const html = renderForm({ ...base, layout: { template: "split-left" } }, "contact");
    assert.doesNotMatch(html, /grid-template-columns/);
  });
});
