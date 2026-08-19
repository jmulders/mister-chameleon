/**
 * Conversions between the stored Markdown subset and the contentEditable DOM used
 * by RichCopyEditor. Kept separate from the render compiler (inline-markup.ts)
 * because the editor wants REAL block/list elements (<div>, <ul><li>) for caret
 * behaviour, whereas the render compiler emits inline-safe output.
 *
 * The DOM -> Markdown direction is deliberately TOLERANT: it reads only the marks
 * we support (strong/b, em/i, a, ul/li, block boundaries) and unwraps everything
 * else. Whatever messy HTML execCommand produces, the worst case is that an
 * unsupported format is dropped, never that copy is corrupted. Combined with
 * re-initialising the editor from the serialised Markdown, the editor self-heals.
 */

import { renderInlineRun } from "./inline-markup";

/** Markdown subset -> editable HTML (real <div> paragraphs and <ul><li> lists). */
export function markdownToEditorHtml(md: string | null | undefined): string {
  if (!md) return "";
  const text = String(md).replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      const isList = lines.length > 0 && lines.every((l) => /^\s*-\s+/.test(l));
      if (isList) {
        return `<ul>${lines
          .map((l) => `<li>${renderInlineRun(l.replace(/^\s*-\s+/, "")) || "<br>"}</li>`)
          .join("")}</ul>`;
      }
      return `<div>${lines.map((l) => renderInlineRun(l)).join("<br>") || "<br>"}</div>`;
    })
    .join("");
}

const INLINE_MARK: Record<string, "strong" | "em"> = {
  strong: "strong",
  b: "strong",
  em: "em",
  i: "em",
};

/** Serialise the inline content of a node to Markdown (recursive, tolerant). */
function serializeInline(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3 /* text */) {
      out += child.textContent ?? "";
      return;
    }
    if (child.nodeType !== 1 /* element */) return;

    const el = child as HTMLElement;
    const tag = el.nodeName.toLowerCase();

    if (tag === "br") {
      out += "\n";
    } else if (INLINE_MARK[tag] === "strong") {
      const inner = serializeInline(el).trim();
      out += inner ? `**${inner}**` : "";
    } else if (INLINE_MARK[tag] === "em") {
      const inner = serializeInline(el).trim();
      out += inner ? `*${inner}*` : "";
    } else if (tag === "a") {
      const inner = serializeInline(el).trim();
      const href = (el.getAttribute("href") ?? "").trim();
      out += href && inner ? `[${inner}](${href})` : inner;
    } else {
      // span / font / unsupported element -> unwrap.
      out += serializeInline(el);
    }
  });
  return out;
}

/**
 * contentEditable DOM -> Markdown subset. Top-level block elements (<div>, <p>)
 * become paragraphs; <ul>/<ol> become "- " lines; loose inline/text nodes are
 * treated as one paragraph.
 */
export function editorNodeToMarkdown(root: Node): string {
  const blocks: string[] = [];
  let looseInline = "";

  const flushLoose = () => {
    if (looseInline.trim() !== "") blocks.push(looseInline);
    looseInline = "";
  };

  root.childNodes.forEach((node) => {
    if (node.nodeType === 3 /* text */) {
      looseInline += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== 1) return;

    const el = node as HTMLElement;
    const tag = el.nodeName.toLowerCase();

    if (tag === "ul" || tag === "ol") {
      flushLoose();
      const items: string[] = [];
      el.childNodes.forEach((li) => {
        if (li.nodeName.toLowerCase() === "li") items.push(`- ${serializeInline(li).trim()}`);
      });
      if (items.length) blocks.push(items.join("\n"));
    } else if (tag === "div" || tag === "p") {
      flushLoose();
      blocks.push(serializeInline(el));
    } else if (tag === "br") {
      looseInline += "\n";
    } else {
      // Inline element sitting at the top level.
      looseInline += serializeInline(el);
    }
  });
  flushLoose();

  // Each block is a paragraph; join with a blank line and collapse extra breaks.
  return blocks
    .map((b) => b.replace(/\n{2,}/g, "\n"))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
