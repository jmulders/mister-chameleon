/**
 * The engine debug page on a phone.
 *
 * The page and its panels are inline styles, which cannot follow the screen
 * width. On a 390px phone the fixed 4rem side padding left 262px, six table
 * columns printed their titles on top of each other and the last counter of
 * the billing row fell off the screen. These tests pin the few rules that
 * make the page follow the width, so a later edit does not drop them unseen.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

const page    = fs.readFileSync("app/(site)/engine-debug/page.tsx", "utf8");
const context = fs.readFileSync("components/blocks/ContextDebugPanel.tsx", "utf8");
const journey = fs.readFileSync("components/blocks/JourneyDebugPanel.tsx", "utf8");
const billing = fs.readFileSync("components/blocks/BillingDebugPanel.tsx", "utf8");

describe("engine debug page at phone width", () => {
  it("the side padding is a class with a phone value, not a fixed inline 4rem", () => {
    assert.match(page, /\.mc-debug-page \{ padding: 2rem 4rem; \}/);
    assert.match(page, /@media \(max-width: 640px\) \{\s*\.mc-debug-page \{ padding: 1rem 0\.75rem; \}/);
    assert.match(page, /<section className="mc-debug-page"/);
    assert.doesNotMatch(page, /<section style=\{\{ padding: "2rem 4rem"/);
  });

  it("a context variable becomes a stack: key and flags, value, label", () => {
    assert.match(context, /grid-template-areas: "key type rules ai" "value value value value" "label label label label";/);
    assert.match(context, /\.mc-ctx-table colgroup, \.mc-ctx-table thead \{ display: none; \}/);
    for (const cls of ["mc-ctx-table", "mc-ctx-key", "mc-ctx-value", "mc-ctx-type", "mc-ctx-rules", "mc-ctx-ai", "mc-ctx-label"]) {
      assert.match(context, new RegExp(`className="${cls}"`), `${cls} is on its element`);
    }
  });

  it("the hidden column titles are written in front of their ticks", () => {
    assert.match(context, /\.mc-ctx-rules::before \{ content: "rules "/);
    assert.match(context, /\.mc-ctx-ai::before\s+\{ content: "AI "/);
  });

  it("a value wraps instead of being cut off, and an empty one takes no line", () => {
    assert.match(context, /\.mc-ctx-value \.mc-ctx-text \{ white-space: normal !important; overflow-wrap: anywhere; \}/);
    assert.match(context, /\.mc-ctx-row-null \.mc-ctx-value \{ display: none; \}/);
    assert.equal(context.split('className="mc-ctx-text"').length - 1, 3, "raw, effective and plain value");
  });

  it("the source pills drop under the title instead of leaving the screen", () => {
    assert.match(context, /\.mc-ctx-head \{ flex-wrap: wrap;/);
    assert.match(context, /\.mc-ctx-pills \{ margin-left: 0 !important; width: 100%; \}/);
  });

  it("the journey columns stack and the billing counters go three by three", () => {
    assert.match(journey, /\.mc-journey-cols \{ grid-template-columns: minmax\(0, 1fr\) !important; \}/);
    assert.match(journey, /className="mc-journey-cols"/);
    assert.match(billing, /\.mc-billing-stats \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important; \}/);
    assert.match(billing, /className="mc-billing-stats"/);
  });

  it("every phone rule sits inside a width query, so desktop is untouched", () => {
    const css = /const CONTEXT_PANEL_CSS = `([^`]*)`;/.exec(context)?.[1] ?? "";
    assert.match(css, /^\n@media \(max-width: 640px\) \{/);
    assert.match(css, /\n\}\n$/);
    assert.equal(css.split("@media").length - 1, 1);
  });
});
