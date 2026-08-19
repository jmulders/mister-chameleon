/**
 * Tests for the RichCopyEditor conversions (lib/blocks/inline-markup-editor.ts).
 * markdownToEditorHtml is a pure string function; editorNodeToMarkdown walks a DOM
 * node, so we feed it minimal node stubs (nodeType / nodeName / childNodes /
 * textContent / getAttribute) to exercise the tolerant serialiser without jsdom.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { markdownToEditorHtml, editorNodeToMarkdown } from "../../lib/blocks/inline-markup-editor.ts";

// ── Minimal DOM node stubs ────────────────────────────────────────────────────
type Stub = { nodeType: number; nodeName: string; childNodes: Stub[]; textContent: string | null; getAttribute: (k: string) => string | null };
const text = (s: string): Stub => ({ nodeType: 3, nodeName: "#text", childNodes: [], textContent: s, getAttribute: () => null });
const el = (tag: string, children: Stub[] = [], attrs: Record<string, string> = {}): Stub => ({
  nodeType: 1, nodeName: tag.toUpperCase(), childNodes: children, textContent: null,
  getAttribute: (k) => attrs[k] ?? null,
});
const root = (children: Stub[]): Stub => el("body", children);

describe("markdownToEditorHtml", () => {
  it("wraps paragraphs in <div> and applies inline marks", () => {
    assert.equal(markdownToEditorHtml("**b**"), "<div><strong>b</strong></div>");
    assert.equal(markdownToEditorHtml("p1\n\np2"), "<div>p1</div><div>p2</div>");
    assert.equal(markdownToEditorHtml("line1\nline2"), "<div>line1<br>line2</div>");
  });

  it("builds real <ul><li> lists", () => {
    assert.equal(markdownToEditorHtml("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
  });

  it("empty input yields empty string", () => {
    assert.equal(markdownToEditorHtml(""), "");
    assert.equal(markdownToEditorHtml(null), "");
  });
});

describe("editorNodeToMarkdown", () => {
  it("serialises bold / italic / link inside a paragraph", () => {
    const node = root([el("div", [text("hello "), el("strong", [text("bold")])])]);
    assert.equal(editorNodeToMarkdown(node as unknown as Node), "hello **bold**");
  });

  it("separates block divs with a blank line", () => {
    const node = root([el("div", [text("a")]), el("div", [text("b")])]);
    assert.equal(editorNodeToMarkdown(node as unknown as Node), "a\n\nb");
  });

  it("serialises lists to '- ' lines", () => {
    const node = root([el("ul", [el("li", [text("x")]), el("li", [el("em", [text("y")])])])]);
    assert.equal(editorNodeToMarkdown(node as unknown as Node), "- x\n- *y*");
  });

  it("detects a <ul> nested inside a block <div> (execCommand shape)", () => {
    const node = root([el("div", [el("ul", [el("li", [text("first")]), el("li", [text("second")])])])]);
    assert.equal(editorNodeToMarkdown(node as unknown as Node), "- first\n- second");
  });

  it("serialises links and hard breaks; unwraps unsupported spans", () => {
    const node = root([el("div", [el("a", [text("link")], { href: "https://x" })])]);
    assert.equal(editorNodeToMarkdown(node as unknown as Node), "[link](https://x)");

    const br = root([el("div", [text("line1"), el("br"), text("line2")])]);
    assert.equal(editorNodeToMarkdown(br as unknown as Node), "line1\nline2");

    const span = root([el("div", [el("span", [text("plain ")]), el("strong", [text("bold")])])]);
    assert.equal(editorNodeToMarkdown(span as unknown as Node), "plain **bold**");
  });
});
