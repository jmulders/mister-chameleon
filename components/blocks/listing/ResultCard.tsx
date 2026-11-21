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
import { formatContentDate } from "@/lib/content-date";
import { BLOCK_TEXTS } from "@/lib/site-texts/blocks";
import type { SiteLocale } from "@/lib/site-texts/locale";
import { useSiteLocale } from "@/components/site/SiteLocale";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResultCardLayout = "card" | "row" | "compact";

interface ResultCardProps {
  item:          ListingItem;
  layout?:       ResultCardLayout;
  /** Semantic heading level for the item title */
  headingLevel?: 2 | 3 | 4;
  /**
   * Language the date is written in. A block that knows the site language
   * passes it down; without it the card reads the site language itself.
   */
  locale?:       SiteLocale;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * The item date, written out in the site language ("23 juli 2026") inside a
 * <time> element that keeps the machine-readable value.
 *
 * The CMS delivers dates in more than one shape — "2024-09-01",
 * "2026-08-01 00:00", "2026-07-23T09:00:00.000000Z" — and formatContentDate
 * reads them all. A value it does not recognise as a date (a free-text label)
 * is shown as written, without a <time> element.
 */
function CardDate({ date, locale }: { date: string; locale: SiteLocale }) {
  const style     = { fontSize: "0.75rem", color: "var(--text-muted)" };
  const formatted = formatContentDate(date, BLOCK_TEXTS[locale].dateLocale);

  if (!formatted) return <span style={style}>{date}</span>;
  return <time dateTime={formatted.dateTime} style={style}>{formatted.label}</time>;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

interface MetaRowProps {
  date?:   string;
  meta?:   readonly { readonly label: string; readonly value: string }[];
  tags?:   readonly string[];
  locale:  SiteLocale;
}

function MetaRow({ date, meta, tags, locale }: MetaRowProps) {
  const hasDate = Boolean(date);
  const hasMeta = meta && meta.length > 0;
  const hasTags = tags && tags.length > 0;

  if (!hasDate && !hasMeta && !hasTags) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>

      {/* Date */}
      {hasDate && <CardDate date={date!} locale={locale} />}

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
  locale:     SiteLocale;
}

function GridCard({ item, HeadingTag, locale }: InnerCardProps) {
  const hasHoverImage = Boolean(item.imageUrl && item.hoverImageUrl);

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
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "var(--card-shadow)";
        el.style.transform = "translateY(-2px)";
        if (hasHoverImage) {
          // Cross-fade to hover image when both imageUrl and hoverImageUrl are set
          const defaultImg = el.querySelector<HTMLImageElement>(".card-img-default");
          const hoverImg   = el.querySelector<HTMLImageElement>(".card-img-hover");
          if (defaultImg) defaultImg.style.opacity = "0";
          if (hoverImg)   hoverImg.style.opacity   = "1";
        } else if (item.imageUrl) {
          // Fallback zoom effect when no hover image is provided
          const container = el.querySelector<HTMLDivElement>(".card-img-container");
          if (container) container.style.transform = "scale(1.05)";
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
        if (hasHoverImage) {
          const defaultImg = el.querySelector<HTMLImageElement>(".card-img-default");
          const hoverImg   = el.querySelector<HTMLImageElement>(".card-img-hover");
          if (defaultImg) defaultImg.style.opacity = "1";
          if (hoverImg)   hoverImg.style.opacity   = "0";
        } else if (item.imageUrl) {
          const container = el.querySelector<HTMLDivElement>(".card-img-container");
          if (container) container.style.transform = "scale(1)";
        }
      }}
    >
      {/* Cover image — supports optional hover swap (hoverImageUrl) or zoom fallback */}
      {item.imageUrl && (
        <div
          className="card-img-container"
          style={{
            position:    "relative",
            aspectRatio: "16 / 9",
            overflow:    "hidden",
            flexShrink:  0,
            transition:  "transform 0.4s ease",
          }}
        >
          {/* Default image */}
          <img
            className="card-img-default"
            src={item.imageUrl}
            alt={item.imageAlt ?? item.title}
            loading="lazy"
            style={{
              position:   "absolute",
              inset:       0,
              width:       "100%",
              height:      "100%",
              objectFit:   "cover",
              display:     "block",
              opacity:     1,
              transition:  `opacity 0.25s ease`,
            }}
          />
          {/* Hover image — only rendered when hoverImageUrl is present */}
          {item.hoverImageUrl && (
            <img
              className="card-img-hover"
              src={item.hoverImageUrl}
              alt=""
              aria-hidden
              loading="lazy"
              style={{
                position:   "absolute",
                inset:       0,
                width:       "100%",
                height:      "100%",
                objectFit:   "cover",
                display:     "block",
                opacity:     0,
                transition:  `opacity 0.25s ease`,
              }}
            />
          )}
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
        <MetaRow date={item.showDate !== false ? item.date : undefined} meta={item.meta} tags={item.tags} locale={locale} />
      </div>
    </article>
  );
}

// ── Row layout (horizontal) ───────────────────────────────────────────────────

function RowCard({ item, HeadingTag, locale }: InnerCardProps) {
  const hasHoverImage = Boolean(item.imageUrl && item.hoverImageUrl);

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
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "var(--card-shadow)";
        if (hasHoverImage) {
          const defaultImg = el.querySelector<HTMLImageElement>(".card-img-default");
          const hoverImg   = el.querySelector<HTMLImageElement>(".card-img-hover");
          if (defaultImg) defaultImg.style.opacity = "0";
          if (hoverImg)   hoverImg.style.opacity   = "1";
        } else if (item.imageUrl) {
          const container = el.querySelector<HTMLDivElement>(".card-img-container");
          if (container) container.style.transform = "scale(1.08)";
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "none";
        if (hasHoverImage) {
          const defaultImg = el.querySelector<HTMLImageElement>(".card-img-default");
          const hoverImg   = el.querySelector<HTMLImageElement>(".card-img-hover");
          if (defaultImg) defaultImg.style.opacity = "1";
          if (hoverImg)   hoverImg.style.opacity   = "0";
        } else if (item.imageUrl) {
          const container = el.querySelector<HTMLDivElement>(".card-img-container");
          if (container) container.style.transform = "scale(1)";
        }
      }}
    >
      {/* Thumbnail (fixed width) — supports optional hover swap (hoverImageUrl) or zoom fallback */}
      {item.imageUrl && (
        <div
          className="card-img-container"
          style={{
            position:     "relative",
            flexShrink:   0,
            width:        "7rem",
            aspectRatio:  "4 / 3",
            borderRadius: "calc(var(--card-radius) * 0.6)",
            overflow:     "hidden",
            transition:   "transform 0.4s ease",
          }}
        >
          <img
            className="card-img-default"
            src={item.imageUrl}
            alt={item.imageAlt ?? item.title}
            loading="lazy"
            style={{
              position:   "absolute",
              inset:       0,
              width:       "100%",
              height:      "100%",
              objectFit:   "cover",
              display:     "block",
              opacity:     1,
              transition:  `opacity 0.25s ease`,
            }}
          />
          {item.hoverImageUrl && (
            <img
              className="card-img-hover"
              src={item.hoverImageUrl}
              alt=""
              aria-hidden
              loading="lazy"
              style={{
                position:   "absolute",
                inset:       0,
                width:       "100%",
                height:      "100%",
                objectFit:   "cover",
                display:     "block",
                opacity:     0,
                transition:  `opacity 0.25s ease`,
              }}
            />
          )}
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
        <MetaRow date={item.showDate !== false ? item.date : undefined} meta={item.meta} locale={locale} />
      </div>
    </article>
  );
}

// ── Compact layout (text-only) ────────────────────────────────────────────────

function CompactCard({ item, HeadingTag, locale }: InnerCardProps) {
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
        {item.showDate !== false && item.date && <CardDate date={item.date} locale={locale} />}
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
 * @param locale        — Language of the date (default: the site language).
 */
export function ResultCard({ item, layout = "card", headingLevel = 3, locale: localeProp }: ResultCardProps) {
  const HeadingTag = `h${headingLevel}` as "h2" | "h3" | "h4";
  // The hook runs unconditionally; an explicit prop from the block wins.
  const siteLocale = useSiteLocale();
  const locale     = localeProp ?? siteLocale;

  if (layout === "compact") return <CompactCard item={item} HeadingTag={HeadingTag} locale={locale} />;
  if (layout === "row")     return <RowCard     item={item} HeadingTag={HeadingTag} locale={locale} />;
  return                           <GridCard    item={item} HeadingTag={HeadingTag} locale={locale} />;
}
