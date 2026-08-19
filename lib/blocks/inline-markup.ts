/**
 * Inline rich-copy: a deliberately tiny Markdown subset for the descriptive copy
 * fields (hero subtitle, proof text, feature body, cta text).
 *
 * Supported: **bold**, *italic* (conservative — see below), [text](url) links,
 * blank-line paragraphs, single-newline hard breaks, and "- " unordered lists.
 * Nothing else: no headings, images, colours, or font sizes, so authored copy
 * cannot fight the block typography.
 *
 * Output is INLINE-SAFE: only <strong>, <em>, <a>, and <br> tags are emitted.
 * Paragraphs are separated by a double <br> and list items by a bullet glyph, so
 * the result drops straight into any existing text element (a <p>, heading, or
 * span) at every block layout without invalid block-in-inline nesting.
 *
 * SECURITY — safe by construction:
 *   renderInlineMarkup ESCAPES all text first, then emits ONLY our own known
 *   tags. Raw HTML in the source can never survive as markup, so there is no
 *   HTML-parsing sanitiser to get wrong. Links are scheme-validated (http(s),
 *   mailto, tel, root-relative, #) and always carry rel="noopener"; javascript:,
 *   data:, vbscript: and protocol-relative (//) URLs are dropped to plain text.
 *
 * Two independent passes (defense in depth):
 *   - normalizeInlineMarkup(src): run on SAVE. Canonicalises and strips
 *     invalid-scheme links (keeping their text) so stored copy is already clean.
 *   - renderInlineMarkup(src): run on RENDER (platform blocks + snippet HTML).
 *
 * Backward-compatible: existing plain-text copy contains no markup, so it renders
 * as escaped inline text exactly as before.
 *
 * Isomorphic + dependency-free: pure string -> string, so the SAME function runs
 * on the server (snippet HTML, SSR) and in client components (the spotlight
 * sliders) with no bundle cost.
 */

/** Escape the five HTML-significant characters. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Allow only safe link schemes: http(s), mailto, tel, fragment, or a
 * root-relative path — but NOT protocol-relative (//host). `url` is expected in
 * its HTML-escaped form (schemes contain no escapable characters, so the test is
 * unaffected).
 */
function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(url.trim());
}

/**
 * A Markdown link: [text](url). The URL allows one level of balanced parens so
 * URLs like `javascript:alert(1)` are captured whole (then rejected), not left
 * half-parsed.
 */
const LINK_RE = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

/** Apply the inline transforms (bold, italic, links) to one already-line-split run. */
function renderInline(raw: string): string {
  let s = escapeHtml(raw);

  // Bold: **text** (no inner *, must open on a non-space).
  s = s.replace(/\*\*(?=\S)([^*]+?)\*\*/g, "<strong>$1</strong>");

  // Italic: *text* — conservative. Both neighbours of the content must be
  // non-space and it may not be part of a ** run, so stray single asterisks in
  // legacy copy ("3 * 4", "a * b") never turn into emphasis.
  s = s.replace(/(^|[^*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\*)/g, "$1<em>$2</em>");

  // Links: [text](url). Drop the link syntax (keep the text) when the URL scheme
  // is not allowlisted; otherwise emit a rel="noopener" anchor. The URL pattern
  // allows one level of balanced parens (e.g. javascript:alert(1) captured whole,
  // then dropped) so no stray characters leak.
  s = s.replace(LINK_RE, (_m, label: string, url: string) =>
    isSafeUrl(url) ? `<a href="${url}" rel="noopener">${label}</a>` : label,
  );

  return s;
}

/** Bullet prefix for list items (glyph + non-breaking space). */
const BULLET = "\u2022\u00a0"; // bullet + non-breaking space

/**
 * Compile the inline-Markdown subset to safe INLINE HTML (only strong/em/a/br).
 * Returns "" for empty input. Never returns unescaped author text or any tag
 * outside the allowlist. See the module header for the paragraph/list encoding.
 */
export function renderInlineMarkup(src: string | null | undefined): string {
  if (!src) return "";
  const text = String(src).replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  // Paragraphs are separated by a blank line, joined back with a double break.
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      const isList = lines.length > 0 && lines.every((l) => /^\s*-\s+/.test(l));

      if (isList) {
        // Bulleted lines — inline-safe, one hard break between items.
        return lines
          .map((l) => BULLET + renderInline(l.replace(/^\s*-\s+/, "")))
          .join("<br>");
      }

      // A paragraph: single newlines become hard breaks.
      return lines.map((l) => renderInline(l)).join("<br>");
    })
    .join("<br><br>");
}

/**
 * Save-time normalisation: canonicalise line endings, collapse extra blank
 * lines, and strip invalid-scheme links down to their text so the STORED copy is
 * already safe. Rendering re-validates regardless (defense in depth).
 */
export function normalizeInlineMarkup(src: string | null | undefined): string {
  if (!src) return "";
  let s = String(src).replace(/\r\n?/g, "\n");

  s = s.replace(LINK_RE, (m, label: string, url: string) =>
    isSafeUrl(escapeHtml(url)) ? m : label,
  );

  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
