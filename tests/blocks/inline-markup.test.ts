/**
 * Unit tests for the inline rich-copy compiler (lib/blocks/inline-markup.ts).
 * Pure functions, no infra — safe for the fast suite. Covers the allowlist,
 * the escape-first safety guarantee, conservative italic, link scheme validation,
 * paragraphs/breaks/lists, backward-compat plain text, and save normalisation.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { renderInlineMarkup, normalizeInlineMarkup } from "../../lib/blocks/inline-markup.ts";

describe("renderInlineMarkup — formatting", () => {
  it("bold and italic", () => {
    assert.equal(renderInlineMarkup("**bold**"), "<p><strong>bold</strong></p>");
    assert.equal(renderInlineMarkup("*italic*"), "<p><em>italic</em></p>");
    assert.equal(renderInlineMarkup("a **b** and *c*"), "<p>a <strong>b</strong> and <em>c</em></p>");
  });

  it("conservative italic — stray single asterisks stay literal", () => {
    assert.equal(renderInlineMarkup("3 * 4 = 12"), "<p>3 * 4 = 12</p>");
    assert.equal(renderInlineMarkup("a * b"), "<p>a * b</p>");
    assert.equal(renderInlineMarkup("* leading"), "<p>* leading</p>");
    // a real emphasis with non-space neighbours still works
    assert.equal(renderInlineMarkup("say *hi* now"), "<p>say <em>hi</em> now</p>");
  });

  it("paragraphs, hard breaks and lists", () => {
    assert.equal(renderInlineMarkup("one\n\ntwo"), "<p>one</p><p>two</p>");
    assert.equal(renderInlineMarkup("line1\nline2"), "<p>line1<br>line2</p>");
    assert.equal(renderInlineMarkup("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
    assert.equal(renderInlineMarkup("- **x**\n- y"), "<ul><li><strong>x</strong></li><li>y</li></ul>");
  });

  it("links: valid schemes get rel=noopener", () => {
    assert.equal(renderInlineMarkup("[docs](https://x.com/a)"), '<p><a href="https://x.com/a" rel="noopener">docs</a></p>');
    assert.equal(renderInlineMarkup("[home](/cases)"), '<p><a href="/cases" rel="noopener">home</a></p>');
    assert.equal(renderInlineMarkup("[mail](mailto:a@b.com)"), '<p><a href="mailto:a@b.com" rel="noopener">mail</a></p>');
  });
});

describe("renderInlineMarkup — safety", () => {
  it("escapes raw HTML in the source (no tags survive)", () => {
    assert.equal(renderInlineMarkup("<script>alert(1)</script>"), "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    assert.equal(renderInlineMarkup('a <b onclick="x">c'), "<p>a &lt;b onclick=&quot;x&quot;&gt;c</p>");
  });

  it("drops javascript:, data:, vbscript: and protocol-relative links to plain text", () => {
    assert.equal(renderInlineMarkup("[x](javascript:alert(1))"), "<p>x</p>");
    assert.equal(renderInlineMarkup("[x](data:text/html,evil)"), "<p>x</p>");
    assert.equal(renderInlineMarkup("[x](vbscript:msgbox)"), "<p>x</p>");
    assert.equal(renderInlineMarkup("[x](//evil.com)"), "<p>x</p>");
  });

  it("a quote inside a link URL cannot break out of the href attribute", () => {
    // The double quote is escaped before the link transform runs.
    assert.equal(renderInlineMarkup('[x](https://a.com/")'), '<p><a href="https://a.com/&quot;" rel="noopener">x</a></p>');
  });

  it("empty / whitespace / plain text", () => {
    assert.equal(renderInlineMarkup(""), "");
    assert.equal(renderInlineMarkup(null), "");
    assert.equal(renderInlineMarkup("   "), "");
    assert.equal(renderInlineMarkup("Gewoon platte tekst."), "<p>Gewoon platte tekst.</p>");
  });
});

describe("normalizeInlineMarkup — save pass", () => {
  it("strips invalid-scheme links to their text, keeps valid ones", () => {
    assert.equal(normalizeInlineMarkup("[x](javascript:alert(1))"), "x");
    assert.equal(normalizeInlineMarkup("[x](https://ok.com)"), "[x](https://ok.com)");
  });

  it("normalises line endings and collapses extra blank lines, trims", () => {
    assert.equal(normalizeInlineMarkup("a\r\n\r\n\r\n\r\nb\n  "), "a\n\nb");
    assert.equal(normalizeInlineMarkup(""), "");
  });
});
