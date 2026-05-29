/**
 * PortableTextRenderer
 *
 * Lightweight inline renderer for Portable Text block arrays.
 * Handles the subset of block styles produced by the Sanity textSection body
 * field: paragraph (normal), h2, h3, h4, and blockquote.
 *
 * Install @portabletext/react for a full-featured renderer with custom
 * components, annotations, and custom block types if the content model grows.
 *
 * ─── Supported block styles ───────────────────────────────────────────────────
 *
 *   normal      → <p>
 *   h2          → <h2>
 *   h3          → <h3>
 *   h4          → <h4>
 *   blockquote  → <blockquote>
 *
 * ─── Supported span marks ────────────────────────────────────────────────────
 *
 *   strong  → <strong>
 *   em      → <em>
 *   code    → <code>
 *
 * Annotation marks (links, etc.) are rendered as plain text — extend
 * renderSpan() when link annotations are needed.
 */

import type { PortableTextBlock, PortableTextSpan } from "@/cms/types";

// ── Span renderer ─────────────────────────────────────────────────────────────

function renderSpan(span: PortableTextSpan, index: number): React.ReactNode {
  const { text, marks = [] } = span;

  let node: React.ReactNode = text;

  if (marks.includes("strong")) {
    node = <strong key={`${index}-strong`}>{node}</strong>;
  }
  if (marks.includes("em")) {
    node = <em key={`${index}-em`}>{node}</em>;
  }
  if (marks.includes("code")) {
    node = (
      <code
        key={`${index}-code`}
        className="rounded px-1 py-0.5 font-mono text-sm"
        style={{ background: "var(--bg-subtle)", color: "var(--text)" }}
      >
        {node}
      </code>
    );
  }

  return <span key={index}>{node}</span>;
}

// ── Block renderer ────────────────────────────────────────────────────────────

function renderBlock(block: PortableTextBlock, index: number): React.ReactNode {
  const children = (block.children ?? []).map(renderSpan);
  const key = block._key ?? index;

  switch (block.style) {
    case "h2":
      return (
        <h2
          key={key}
          className="mt-8 mb-3 text-2xl font-bold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          {children}
        </h2>
      );

    case "h3":
      return (
        <h3
          key={key}
          className="mt-6 mb-2 text-xl font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          {children}
        </h3>
      );

    case "h4":
      return (
        <h4
          key={key}
          className="mt-4 mb-2 text-lg font-semibold"
          style={{ color: "var(--text)" }}
        >
          {children}
        </h4>
      );

    case "blockquote":
      return (
        <blockquote
          key={key}
          className="my-4 border-l-4 pl-4 italic"
          style={{ borderColor: "var(--primary)", color: "var(--text-muted)" }}
        >
          {children}
        </blockquote>
      );

    default:
      // normal and any unrecognised style → <p>
      return (
        <p key={key} className="mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {children}
        </p>
      );
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PortableTextRendererProps {
  blocks: PortableTextBlock[];
  className?: string;
}

export function PortableTextRenderer({
  blocks,
  className,
}: PortableTextRendererProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className={className}>{blocks.map((block, i) => renderBlock(block, i))}</div>
  );
}
