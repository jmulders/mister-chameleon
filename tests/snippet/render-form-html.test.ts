/**
 * Unit tests for renderForm — the self-contained <form> emitted for adaptive
 * form blocks embedded on external sites (snippet / WP / Statamic).
 *
 * Pure function, no infra — safe for the fast suite.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { renderForm }   from "../../lib/snippet/render-block-html.ts";
import type { ResolvedForm } from "../../forms/context/types.ts";

const base: ResolvedForm = {
  segment:      null,
  title:        "Contact us",
  intro:        "We'll get back to you.",
  submitLabel:  "Send",
  redirectPath: "/bedankt",
  fields: [
    { key: "name",    type: "text",     label: "Name",    validation: { required: true } },
    { key: "email",   type: "email",    label: "Email",   validation: { required: true } },
    { key: "topic",   type: "select",   label: "Topic",   options: [{ value: "sales", label: "Sales" }, { value: "support", label: "Support" }] },
    { key: "consent", type: "checkbox", label: "I agree", defaultValue: false },
    { key: "src",     type: "hidden",   label: "src",     defaultValue: "adaptive-block" },
  ],
};

describe("renderForm", () => {
  it("emits a form with the key, honeypot, submit label and redirect", () => {
    const html = renderForm(base, "contact");
    assert.match(html, /<form data-mc-form="contact"/);
    assert.match(html, /data-mc-redirect="\/bedankt"/);
    assert.match(html, /name="_hp"/);                       // honeypot present
    assert.match(html, />Send<\/button>/);                  // submit label
    assert.match(html, /data-mc-form-status/);              // status region for the snippet
  });

  it("renders each field type", () => {
    const html = renderForm(base, "contact");
    assert.match(html, /<input type="text" name="name" required/);
    assert.match(html, /<input type="email" name="email" required/);
    assert.match(html, /<select name="topic"/);
    assert.match(html, /<option value="sales">Sales<\/option>/);
    assert.match(html, /type="checkbox" name="consent"/);
    assert.match(html, /<input type="hidden" name="src" value="adaptive-block">/);
    assert.match(html, /data-mc-error="email"/);            // per-field error slot
  });

  it("HTML-escapes dynamic copy (no raw injection)", () => {
    const evil: ResolvedForm = {
      segment: null,
      title:   `<script>alert(1)</script>`,
      fields:  [{ key: "q", type: "text", label: `"><img src=x>` }],
    };
    const html = renderForm(evil, "contact");
    assert.ok(!html.includes("<script>alert(1)</script>"), "title must be escaped");
    assert.ok(!html.includes(`"><img src=x>`), "label must be escaped");
    assert.match(html, /&lt;script&gt;/);
  });
});
