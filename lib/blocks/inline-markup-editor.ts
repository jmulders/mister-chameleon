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

const BLOCK_TAGS = new Set(["div", "p", "ul", "ol", "li"]);

/** True when a node contains block-level children (so we must recurse, not inline). */
function hasBlockChild(node: Node): boolean {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 1 && BLOCK_TAGS.has((child as HTMLElement).nodeName.toLowerCase())) return true;
  }
  return false;
}

/** Collect Markdown blocks from a node's children (recursive over block structure). */
function collectBlocks(node: Node): string[] {
  const blocks: string[] = [];
  let loose = "";
  const flush = () => {
    if (loose.trim() !== "") blocks.push(loose);
    loose = "";
  };

  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === 3 /* text */) {
      loose += child.textContent ?? "";
      return;
    }
    if (child.nodeType !== 1) return;

    const el = child as HTMLElement;
    const tag = el.nodeName.toLowerCase();

    if (tag === "ul" || tag === "ol") {
      flush();
      const items: string[] = [];
      Array.from(el.childNodes).forEach((li) => {
        if (li.nodeName.toLowerCase() === "li") items.push(`- ${serializeInline(li).trim()}`);
      });
      if (items.length) blocks.push(items.join("\n"));
    } else if (tag === "div" || tag === "p") {
      flush();
      // A block wrapper may itself contain a list or nested blocks (execCommand
      // often nests <ul> inside the current <div>), so recurse when needed.
      if (hasBlockChild(el)) blocks.push(...collectBlocks(el));
      else blocks.push(serializeInline(el));
    } else if (tag === "br") {
      loose += "\n";
    } else {
      // Inline element sitting at the block level.
      loose += serializeInline(el);
    }
  });
  flush();
  return blocks;
}

/**
 * contentEditable DOM -> Markdown subset. Block elements (<div>, <p>) become
 * paragraphs; <ul>/<ol> become "- " lines (detected at any depth); loose
 * inline/text nodes are treated as one paragraph.
 */
export function editorNodeToMarkdown(root: Node): string {
  return collectBlocks(root)
    .map((b) => b.replace(/\n{2,}/g, "\n"))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
