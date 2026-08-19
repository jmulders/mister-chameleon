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
  it("bold and italic (inline-safe, no block tags)", () => {
    assert.equal(renderInlineMarkup("**bold**"), "<strong>bold</strong>");
    assert.equal(renderInlineMarkup("*italic*"), "<em>italic</em>");
    assert.equal(renderInlineMarkup("a **b** and *c*"), "a <strong>b</strong> and <em>c</em>");
  });

  it("conservative italic — stray single asterisks stay literal", () => {
    assert.equal(renderInlineMarkup("3 * 4 = 12"), "3 * 4 = 12");
    assert.equal(renderInlineMarkup("a * b"), "a * b");
    assert.equal(renderInlineMarkup("* leading"), "* leading");
    // a real emphasis with non-space neighbours still works
    assert.equal(renderInlineMarkup("say *hi* now"), "say <em>hi</em> now");
  });

  it("paragraphs (double break), hard breaks and bulleted lists", () => {
    assert.equal(renderInlineMarkup("one\n\ntwo"), "one<br><br>two");
    assert.equal(renderInlineMarkup("line1\nline2"), "line1<br>line2");
    assert.equal(renderInlineMarkup("- a\n- b"), "\u2022\u00a0a<br>\u2022\u00a0b");
    assert.equal(renderInlineMarkup("- **x**\n- y"), "\u2022\u00a0<strong>x</strong><br>\u2022\u00a0y");
  });

  it("links: valid schemes get rel=noopener", () => {
    assert.equal(renderInlineMarkup("[docs](https://x.com/a)"), '<a href="https://x.com/a" rel="noopener">docs</a>');
    assert.equal(renderInlineMarkup("[home](/cases)"), '<a href="/cases" rel="noopener">home</a>');
    assert.equal(renderInlineMarkup("[mail](mailto:a@b.com)"), '<a href="mailto:a@b.com" rel="noopener">mail</a>');
  });
});

describe("renderInlineMarkup — safety", () => {
  it("escapes raw HTML in the source (no tags survive)", () => {
    assert.equal(renderInlineMarkup("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
    assert.equal(renderInlineMarkup('a <b onclick="x">c'), "a &lt;b onclick=&quot;x&quot;&gt;c");
  });

  it("drops javascript:, data:, vbscript: and protocol-relative links to plain text", () => {
    assert.equal(renderInlineMarkup("[x](javascript:alert(1))"), "x");
    assert.equal(renderInlineMarkup("[x](data:text/html,evil)"), "x");
    assert.equal(renderInlineMarkup("[x](vbscript:msgbox)"), "x");
    assert.equal(renderInlineMarkup("[x](//evil.com)"), "x");
  });

  it("a quote inside a link URL cannot break out of the href attribute", () => {
    // The double quote is escaped before the link transform runs.
    assert.equal(renderInlineMarkup('[x](https://a.com/")'), '<a href="https://a.com/&quot;" rel="noopener">x</a>');
  });

  it("empty / whitespace / plain text", () => {
    assert.equal(renderInlineMarkup(""), "");
    assert.equal(renderInlineMarkup(null), "");
    assert.equal(renderInlineMarkup("   "), "");
    assert.equal(renderInlineMarkup("Gewoon platte tekst."), "Gewoon platte tekst.");
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
