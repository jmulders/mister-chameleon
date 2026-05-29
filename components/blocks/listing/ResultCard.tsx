"use client";

/**
 * ResultCard
 *
 * Reusable result card / row for a single ListingItem.
 *
 * Used by:
 *   - ListingBlock        — static overview (homepage recent posts, etc.)
 *   - SearchResultsBlock  — filtered / paginated listing page
 *   - RelatedContentBlock — related items at foot of detail pages (Ld3+)
 *
 * ─── Layouts ──────────────────────────────────────────────────────────────────
 *
 *   card    — Vertical: image top, content below.
 *             Used in grid variants (3-col default, 2-col compact).
 *
 *   row     — Horizontal: image left, content right.
 *             Used in list variant (single-column rows).
 *
 *   compact — Text-only; no image, tighter padding.
 *             Used in compact / dense listing contexts.
 *
 * ─── Article vs vacancy ───────────────────────────────────────────────────────
 *
 *   Both content types use the same ListingItem shape.  Type-specific signals
 *   (reading time, location, contract type) live in ListingItem.meta as
 *   label/value pairs.  The renderer formats all meta pairs uniformly — there
 *   is no content-type branching inside this component.
 *
 *   Article item:
 *     category: "Engineering"
 *     meta: [{ label: "Reading time", value: "4 min" }]
 *
 *   Vacancy item:
 *     category: "Engineering"
 *     meta: [{ label: "Location", value: "Amsterdam" }, { label: "Type", value: "Full-time" }]
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --card-bg / --card-border / --card-radius / --card-shadow
 *   --text / --text-muted
 *   --primary / --primary-subtle
 *   --bg-subtle
 *   --transition-base
 */

import type { ListingItem } from "@/page-config";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResultCardLayout = "card" | "row" | "compact";

interface ResultCardProps {
  item:          ListingItem;
  layout?:       ResultCardLayout;
  /** Semantic heading level for the item title */
  headingLevel?: 2 | 3 | 4;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formats an ISO 8601 date string (e.g. "2024-09-01") as a human-readable
 * short date ("1 Sep 2024").  Parses as a local date (year/month/day split)
 * to avoid timezone-driven day shifts from UTC midnight parsing.
 */
function formatDate(iso: string): string {
  try {
    const parts = iso.split("-").map(Number);
    const year  = parts[0];
    const month = parts[1];
    const day   = parts[2];
    if (!year || !month || !day) return iso;
    return new Intl.DateTimeFormat("en", {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(year, month - 1, day));
  } catch {
    return iso;
  }
}

// ── Shared sub-components ─────────────────────────────────────────────────────

interface MetaRowProps {
  date?:   string;
  meta?:   readonly { readonly label: string; readonly value: string }[];
  tags?:   readonly string[];
}

function MetaRow({ date, meta, tags }: MetaRowProps) {
  const hasDate = Boolean(date);
  const hasMeta = meta && meta.length > 0;
  const hasTags = tags && tags.length > 0;

  if (!hasDate && !hasMeta && !hasTags) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>

      {/* Date */}
      {hasDate && (
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {formatDate(date!)}
        </span>
      )}

      {/* Separator between date and meta */}
      {hasDate && hasMeta && (
        <span aria-hidden style={{ fontSize: "0.75rem", color: "var(--text-muted)", opacity: 0.4 }}>·</span>
      )}

      {/* Meta pairs (location, reading time, contract type, etc.) */}
      {hasMeta && meta!.map((m) => (
        <span
          key={m.label}
          style={{
            fontSize:        "0.75rem",
            color:           "var(--text-muted)",
            display:         "inline-flex",
            alignItems:      "center",
            gap:             "0.25rem",
          }}
        >
          <span style={{ opacity: 0.6 }}>{m.label}:</span>
          <span>{m.value}</span>
        </span>
      ))}

      {/* Tags */}
      {hasTags && tags!.slice(0, 3).map((tag) => (
        <span
          key={tag}
          style={{
            fontSize:        "0.6875rem",
            fontWeight:      500,
            color:           "var(--text-muted)",
            backgroundColor: "var(--bg-subtle)",
            borderRadius:    "2rem",
            padding:         "0.125rem 0.5rem",
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      style={{
        display:         "inline-block",
        fontSize:        "0.6875rem",
        fontWeight:      600,
        letterSpacing:   "0.03em",
        textTransform:   "uppercase",
        color:           "var(--text-muted)",
        backgroundColor: "var(--bg-subtle)",
        borderRadius:    "2rem",
        padding:         "0.1875rem 0.625rem",
      }}
    >
      {category}
    </span>
  );
}

// ── Card layout (vertical) ────────────────────────────────────────────────────

interface InnerCardProps {
  item:       ListingItem;
  HeadingTag: "h2" | "h3" | "h4";
}

function GridCard({ item, HeadingTag }: InnerCardProps) {
  return (
    <article
      style={{
        display:         "flex",
        flexDirection:   "column",
        backgroundColor: "var(--card-bg)",
        border:          "1px solid var(--card-border)",
        borderRadius:    "var(--card-radius)",
        overflow:        "hidden",
        alignSelf:       "start",
        transition:      `box-shadow var(--transition-base), transform var(--transition-base)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--card-shadow)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Cover image */}
      {item.imageUrl && (
        <div
          style={{
            aspectRatio: "16 / 9",
            overflow:    "hidden",
            flexShrink:  0,
          }}
        >
          <img
            src={item.imageUrl}
            alt={item.imageAlt ?? item.title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", flexGrow: 1 }}>

        {/* Category */}
        {item.category && <div><CategoryBadge category={item.category} /></div>}

        {/* Title */}
        <HeadingTag style={{ margin: 0, fontSize: "1rem", fontWeight: 600, lineHeight: 1.4 }}>
          <a
            href={item.href}
            style={{
              color:          "var(--text)",
              textDecoration: "none",
              transition:     `color var(--transition-base)`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
          >
            {item.title}
          </a>
        </HeadingTag>

        {/* Excerpt */}
        {item.excerpt && (
          <p style={{
            margin:     0,
            fontSize:   "0.875rem",
            color:      "var(--text-muted)",
            lineHeight: 1.6,
            // Clamp to 3 lines
            display:            "-webkit-box",
            WebkitBoxOrient:    "vertical",
            WebkitLineClamp:    3,
            overflow:           "hidden",
          }}>
            {item.excerpt}
          </p>
        )}

        {/* Date / meta / tags */}
        <MetaRow date={item.date} meta={item.meta} tags={item.tags} />
      </div>
    </article>
  );
}

// ── Row layout (horizontal) ───────────────────────────────────────────────────

function RowCard({ item, HeadingTag }: InnerCardProps) {
  return (
    <article
      style={{
        display:         "flex",
        gap:             "1.25rem",
        backgroundColor: "var(--card-bg)",
        border:          "1px solid var(--card-border)",
        borderRadius:    "var(--card-radius)",
        overflow:        "hidden",
        padding:         "1rem",
        transition:      `box-shadow var(--transition-base)`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--card-shadow)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      {/* Thumbnail (fixed width) */}
      {item.imageUrl && (
        <div
          style={{
            flexShrink:   0,
            width:        "7rem",
            aspectRatio:  "4 / 3",
            borderRadius: "calc(var(--card-radius) * 0.6)",
            overflow:     "hidden",
          }}
        >
          <img
            src={item.imageUrl}
            alt={item.imageAlt ?? item.title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: 0, flexGrow: 1 }}>

        {/* Category */}
        {item.category && <div><CategoryBadge category={item.category} /></div>}

        {/* Title */}
        <HeadingTag style={{ margin: 0, fontSize: "1rem", fontWeight: 600, lineHeight: 1.4 }}>
          <a
            href={item.href}
            style={{
              color:          "var(--text)",
              textDecoration: "none",
              transition:     `color var(--transition-base)`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
          >
            {item.title}
          </a>
        </HeadingTag>

        {/* Excerpt — 2 lines */}
        {item.excerpt && (
          <p style={{
            margin:             0,
            fontSize:           "0.875rem",
            color:              "var(--text-muted)",
            lineHeight:         1.5,
            display:            "-webkit-box",
            WebkitBoxOrient:    "vertical",
            WebkitLineClamp:    2,
            overflow:           "hidden",
          }}>
            {item.excerpt}
          </p>
        )}

        {/* Date / meta */}
        <MetaRow date={item.date} meta={item.meta} />
      </div>
    </article>
  );
}

// ── Compact layout (text-only) ────────────────────────────────────────────────

function CompactCard({ item, HeadingTag }: InnerCardProps) {
  return (
    <article
      style={{
        display:       "flex",
        flexDirection: "column",
        gap:           "0.25rem",
        padding:       "0.75rem 0",
        borderBottom:  "1px solid var(--card-border)",
      }}
    >
      {/* Top row: category + date */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        {item.category && <CategoryBadge category={item.category} />}
        {item.date && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {formatDate(item.date)}
          </span>
        )}
        {item.meta && item.meta.map((m) => (
          <span key={m.label} style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {m.value}
          </span>
        ))}
      </div>

      {/* Title */}
      <HeadingTag style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.35 }}>
        <a
          href={item.href}
          style={{
            color:          "var(--text)",
            textDecoration: "none",
            transition:     `color var(--transition-base)`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
        >
          {item.title}
        </a>
      </HeadingTag>

      {/* Excerpt — 1 line */}
      {item.excerpt && (
        <p style={{
          margin:             0,
          fontSize:           "0.8125rem",
          color:              "var(--text-muted)",
          lineHeight:         1.5,
          display:            "-webkit-box",
          WebkitBoxOrient:    "vertical",
          WebkitLineClamp:    1,
          overflow:           "hidden",
        }}>
          {item.excerpt}
        </p>
      )}
    </article>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

/**
 * Renders a single ListingItem in the requested layout.
 *
 * @param item          — The content item to render.
 * @param layout        — Visual layout: "card" (default), "row", or "compact".
 * @param headingLevel  — Semantic heading level for the title (default: 3).
 */
export function ResultCard({ item, layout = "card", headingLevel = 3 }: ResultCardProps) {
  const HeadingTag = `h${headingLevel}` as "h2" | "h3" | "h4";

  if (layout === "compact") return <CompactCard item={item} HeadingTag={HeadingTag} />;
  if (layout === "row")     return <RowCard     item={item} HeadingTag={HeadingTag} />;
  return                           <GridCard    item={item} HeadingTag={HeadingTag} />;
}
