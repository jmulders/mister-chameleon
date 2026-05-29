/**
 * SearchResultCard
 *
 * Reusable card for rendering a single SearchResult (from @/search).
 *
 * Distinct from ResultCard (which renders a ListingItem): SearchResultCard
 * understands the SearchResult contract — in particular `highlights` for
 * matched-text display and `type` as the content-type discriminator.
 *
 * ─── Layouts ──────────────────────────────────────────────────────────────────
 *
 *   card     — vertical card with cover image, type badge, title, excerpt, meta
 *   row      — horizontal thumbnail + text; space-efficient for dense result lists
 *   compact  — text-only with a left border accent; no image
 *
 * ─── Highlight rendering ──────────────────────────────────────────────────────
 *
 *   When the provider returns highlights, the first excerpt-field highlight is
 *   rendered in place of (or in addition to) the plain `excerpt`.  Snippets are
 *   rendered with dangerouslySetInnerHTML inside a sandboxed span; providers
 *   are responsible for escaping content and wrapping matches in <mark> tags.
 *
 * ─── Styling ──────────────────────────────────────────────────────────────────
 *
 *   All colours and sizing use CSS custom properties (design tokens).
 *   No hardcoded values.
 */

import type { CSSProperties } from "react";
import type { SearchResult, SearchResultMeta } from "@/search";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SearchResultCardLayout = "card" | "row" | "compact";

export interface SearchResultCardProps {
  result:       SearchResult;
  layout?:      SearchResultCardLayout;
  /** Heading level for the result title; defaults to 3 */
  headingLevel?: 2 | 3 | 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type badge
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  page:     "Page",
  post:     "Post",
  vacancy:  "Vacancy",
};

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type;
  return (
    <span style={{
      display:         "inline-block",
      padding:         "2px 8px",
      borderRadius:    "var(--radius-full, 9999px)",
      fontSize:        "0.6875rem",
      fontWeight:      600,
      letterSpacing:   "0.04em",
      textTransform:   "uppercase",
      background:      "var(--bg-subtle)",
      color:           "var(--text-muted)",
      whiteSpace:      "nowrap",
    }}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta row
// ─────────────────────────────────────────────────────────────────────────────

function MetaRow({ meta }: { meta: readonly SearchResultMeta[] }) {
  if (!meta.length) return null;
  return (
    <div style={{
      display:    "flex",
      flexWrap:   "wrap",
      gap:        "0.5rem",
      fontSize:   "0.75rem",
      color:      "var(--text-muted, #6b7280)",
      marginTop:  "0.375rem",
    }}>
      {meta.map((m) => (
        <span key={m.label}>
          <span style={{ fontWeight: 500 }}>{m.label}:</span>{" "}
          {m.value}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlight excerpt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the best available excerpt text:
 *   1. The first "excerpt" or "body" highlight snippet (contains <mark> tags).
 *   2. Fallback to plain excerpt string.
 *
 * dangerouslySetInnerHTML is intentional — providers sanitise the snippet
 * and wrap matches in <mark> tags.  Never render arbitrary HTML here.
 */
function Excerpt({
  result,
  clampLines,
}: {
  result:     SearchResult;
  clampLines: number;
}) {
  const highlight = result.highlights?.find(
    (h) => h.field === "excerpt" || h.field === "body",
  );

  const clampStyle: CSSProperties = {
    display:           "-webkit-box",
    WebkitBoxOrient:   "vertical",
    WebkitLineClamp:   clampLines,
    overflow:          "hidden",
    fontSize:          "0.875rem",
    color:             "var(--text-muted, #6b7280)",
    lineHeight:        "1.5",
    marginTop:         "0.375rem",
  };

  if (highlight) {
    return (
      <p
        style={clampStyle}
        dangerouslySetInnerHTML={{ __html: highlight.snippet }}
      />
    );
  }

  if (result.excerpt) {
    return <p style={clampStyle}>{result.excerpt}</p>;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card layout (vertical)
// ─────────────────────────────────────────────────────────────────────────────

function CardLayout({
  result,
  headingLevel,
}: {
  result:       SearchResult;
  headingLevel: 2 | 3 | 4;
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <>
    {/* Hover style — CSS-only, no JS event handlers needed */}
    <style>{`.src-result-card:hover{box-shadow:var(--card-shadow-hover,0 4px 16px rgba(0,0,0,0.12));transform:translateY(-2px)}`}</style>
    <a
      href={result.slug}
      className="src-result-card"
      style={{
        display:        "flex",
        flexDirection:  "column",
        borderRadius:   "var(--card-radius, 0.75rem)",
        border:         "1px solid var(--card-border, #e5e7eb)",
        background:     "var(--card-bg, #ffffff)",
        overflow:       "hidden",
        textDecoration: "none",
        color:          "inherit",
        transition:     "box-shadow 0.15s ease, transform 0.15s ease",
        boxShadow:      "var(--card-shadow, 0 1px 3px rgba(0,0,0,0.07))",
      }}
    >
      {result.image && (
        <div style={{ aspectRatio: "16/9", overflow: "hidden" }}>
          <img
            src={result.image.src}
            alt={result.image.alt ?? result.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
        <TypeBadge type={result.type} />
        <H style={{
          margin:     0,
          fontSize:   "1rem",
          fontWeight: 600,
          fontFamily: "var(--font-heading, inherit)",
          color:      "var(--text, #111827)",
          marginTop:  "0.375rem",
          display:    "-webkit-box",
          WebkitBoxOrient:  "vertical",
          WebkitLineClamp:  2,
          overflow:   "hidden",
        }}>
          {result.title}
        </H>
        <Excerpt result={result} clampLines={3} />
        {result.meta && <MetaRow meta={result.meta} />}
      </div>
    </a>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row layout (horizontal)
// ─────────────────────────────────────────────────────────────────────────────

function RowLayout({
  result,
  headingLevel,
}: {
  result:       SearchResult;
  headingLevel: 2 | 3 | 4;
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <a
      href={result.slug}
      style={{
        display:        "flex",
        gap:            "1rem",
        padding:        "0.875rem 0",
        borderBottom:   "1px solid var(--card-border, #e5e7eb)",
        textDecoration: "none",
        color:          "inherit",
        alignItems:     "flex-start",
      }}
    >
      {result.image && (
        <div style={{ flexShrink: 0, width: 72, height: 72, borderRadius: "var(--radius-sm, 0.375rem)", overflow: "hidden" }}>
          <img
            src={result.image.src}
            alt={result.image.alt ?? result.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <TypeBadge type={result.type} />
        </div>
        <H style={{
          margin:     0,
          fontSize:   "0.9375rem",
          fontWeight: 600,
          color:      "var(--text, #111827)",
          display:    "-webkit-box",
          WebkitBoxOrient:  "vertical",
          WebkitLineClamp:  2,
          overflow:   "hidden",
          fontFamily: "var(--font-heading, inherit)",
        }}>
          {result.title}
        </H>
        <Excerpt result={result} clampLines={2} />
        {result.meta && <MetaRow meta={result.meta} />}
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact layout (text-only with left border accent)
// ─────────────────────────────────────────────────────────────────────────────

function CompactLayout({
  result,
  headingLevel,
}: {
  result:       SearchResult;
  headingLevel: 2 | 3 | 4;
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <a
      href={result.slug}
      style={{
        display:        "block",
        padding:        "0.625rem 0.875rem",
        borderLeft:     "3px solid var(--primary)",
        marginBottom:   "0.5rem",
        textDecoration: "none",
        color:          "inherit",
        background:     "var(--card-bg, #ffffff)",
        borderRadius:   "0 var(--radius-sm, 0.375rem) var(--radius-sm, 0.375rem) 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.125rem" }}>
        <TypeBadge type={result.type} />
      </div>
      <H style={{
        margin:     0,
        fontSize:   "0.9375rem",
        fontWeight: 600,
        color:      "var(--text, #111827)",
        display:    "-webkit-box",
        WebkitBoxOrient:  "vertical",
        WebkitLineClamp:  1,
        overflow:   "hidden",
        fontFamily: "var(--font-heading, inherit)",
      }}>
        {result.title}
      </H>
      <Excerpt result={result} clampLines={1} />
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export
// ─────────────────────────────────────────────────────────────────────────────

export function SearchResultCard({
  result,
  layout = "row",
  headingLevel = 3,
}: SearchResultCardProps) {
  switch (layout) {
    case "card":
      return <CardLayout result={result} headingLevel={headingLevel} />;
    case "compact":
      return <CompactLayout result={result} headingLevel={headingLevel} />;
    case "row":
    default:
      return <RowLayout result={result} headingLevel={headingLevel} />;
  }
}
