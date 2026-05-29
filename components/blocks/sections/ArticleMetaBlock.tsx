/**
 * ArticleMetaBlock
 *
 * Renders an `articleMeta` content block — the editorial header for a blog
 * post, guide, or any long-form article detail page.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ArticleMetaBlockData  { title?, publishedAt?, updatedAt?,
 *                                     author?, category?, tags?, readingTime?,
 *                                     coverImageUrl?, coverImageAlt?, summary? }
 *   variant   ArticleMetaVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   hero      — Full-bleed cover image with the title overlaid at the bottom.
 *               Meta row (author, date, reading time) below the image in the
 *               content column.  Best for editorial magazines and feature posts.
 *
 *   default   — Cover image (if present) at container width, then title, then
 *               summary, then the meta row.  Standard blog post header.
 *
 *   compact   — No title, no cover image.  Just the meta row (category, date,
 *               reading time, author).  Use when the page-level <h1> carries
 *               the title so the meta block supplements rather than repeats it.
 *
 * ─── Architecture note ───────────────────────────────────────────────────────
 *
 *   On a blog detail page, the block array is typically:
 *     [articleMeta (hero), articleBody, relatedContent?]
 *
 *   On a vacancy detail page the same template works with different blocks:
 *     [vacancyMeta, articleBody, applyPanel, relatedContent?]
 *
 *   Both use the article-page template (no context slots).  No new templates
 *   needed for blog vs vacancy detail — the block composition differs, not
 *   the template.
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --text / --text-muted
 *   --primary / --primary-subtle
 *   --bg / --bg-subtle
 *   --card-border
 *   --font-heading / --font-heading-weight
 *   --transition-base
 */

import { Container }              from "@/components/primitives/Container";
import { Section }                from "@/components/primitives/Section";
import { Stack }                  from "@/components/primitives/Stack";
import { Text }                   from "@/components/primitives/Text";
import { Breadcrumbs }            from "@/components/molecules";
import { resolveBlockVariant }    from "@/page-config/block-variants";
import type { ArticleMetaVariant } from "@/page-config/block-variants";
import type { ArticleMetaBlockData } from "@/page-config";

// ── Props ─────────────────────────────────────────────────────────────────────

interface ArticleMetaBlockProps {
  data:     ArticleMetaBlockData;
  variant?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Intl.DateTimeFormat("en", {
      day: "numeric", month: "long", year: "numeric",
    }).format(new Date(y, m - 1, d));
  } catch {
    return iso;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      style={{
        display:         "inline-block",
        fontSize:        "0.6875rem",
        fontWeight:      600,
        letterSpacing:   "0.05em",
        textTransform:   "uppercase",
        color:           "var(--text-muted)",
        backgroundColor: "var(--bg-subtle)",
        borderRadius:    "2rem",
        padding:         "0.1875rem 0.75rem",
      }}
    >
      {category}
    </span>
  );
}

interface MetaRowProps {
  author?:      ArticleMetaBlockData["author"];
  publishedAt?: string;
  updatedAt?:   string;
  readingTime?: number;
  tags?:        readonly string[];
}

function MetaRow({ author, publishedAt, updatedAt, readingTime, tags }: MetaRowProps) {
  const displayDate = updatedAt ?? publishedAt;

  return (
    <>
    {/* Hover style — CSS-only, no JS event handlers needed */}
    <style>{`.article-author-link:hover{color:var(--primary)}`}</style>
    <div
      style={{
        display:    "flex",
        flexWrap:   "wrap",
        alignItems: "center",
        gap:        "0.75rem",
        fontSize:   "0.875rem",
        color:      "var(--text-muted)",
      }}
    >
      {/* Author */}
      {author && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {author.avatarUrl && (
            <img
              src={author.avatarUrl}
              alt={author.name}
              loading="lazy"
              style={{ width: "1.75rem", height: "1.75rem", borderRadius: "50%", objectFit: "cover" }}
            />
          )}
          <span>
            {author.href ? (
              <a
                href={author.href}
                className="article-author-link"
                style={{
                  color:          "var(--text)",
                  fontWeight:     500,
                  textDecoration: "none",
                  transition:     "color var(--transition-base)",
                }}
              >
                {author.name}
              </a>
            ) : (
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{author.name}</span>
            )}
            {author.role && (
              <span style={{ marginLeft: "0.25rem", opacity: 0.7 }}>· {author.role}</span>
            )}
          </span>
        </div>
      )}

      {/* Separator */}
      {author && displayDate && (
        <span aria-hidden style={{ opacity: 0.3 }}>·</span>
      )}

      {/* Date */}
      {displayDate && (
        <time dateTime={displayDate}>
          {updatedAt ? `Updated ${formatDate(updatedAt)}` : formatDate(publishedAt!)}
        </time>
      )}

      {/* Reading time */}
      {readingTime && (
        <>
          <span aria-hidden style={{ opacity: 0.3 }}>·</span>
          <span>{readingTime} min read</span>
        </>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {tags.filter((tag): tag is string => !!tag).slice(0, 5).map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              style={{
                fontSize:        "0.75rem",
                color:           "var(--text-muted)",
                backgroundColor: "var(--bg-subtle)",
                borderRadius:    "2rem",
                padding:         "0.125rem 0.5rem",
                border:          "1px solid var(--card-border)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ArticleMetaBlock({ data, variant: rawVariant }: ArticleMetaBlockProps) {
  const variant = resolveBlockVariant("articleMeta", rawVariant) as ArticleMetaVariant;

  // ── compact — meta row only, no title or cover image ──────────────────────
  if (variant === "compact") {
    return (
      <div style={{ paddingBlock: "1.5rem", borderBottom: "1px solid var(--card-border)" }}>
        <Container size="md">
          <Stack gap={2}>
            {data.breadcrumbs && data.breadcrumbs.length > 0 && (
              <Breadcrumbs items={data.breadcrumbs} />
            )}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
              {data.category && <CategoryBadge category={data.category} />}
              <MetaRow
                author={data.author}
                publishedAt={data.publishedAt}
                updatedAt={data.updatedAt}
                readingTime={data.readingTime}
              />
            </div>
          </Stack>
        </Container>
      </div>
    );
  }

  // ── hero — full-bleed cover image, title overlaid ─────────────────────────
  if (variant === "hero") {
    return (
      <header style={{ paddingTop: "2rem" }}>
        {/* Cover image — full viewport width, 50vh height */}
        {data.coverImageUrl && (
          <div
            style={{
              position:   "relative",
              width:      "100%",
              height:     "clamp(300px, 50vh, 600px)",
              overflow:   "hidden",
              background: "var(--bg-subtle)",
            }}
          >
            <img
              src={data.coverImageUrl}
              alt={data.coverImageAlt ?? data.title ?? "Article cover"}
              loading="eager"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {/* Gradient overlay for title legibility */}
            <div
              aria-hidden
              style={{
                position:   "absolute",
                inset:      0,
                background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6) 100%)",
              }}
            />

            {/* Title overlaid at the bottom of the image */}
            {data.title && (
              <div
                style={{
                  position: "absolute",
                  bottom:   0,
                  left:     0,
                  right:    0,
                  padding:  "2rem",
                }}
              >
                <Container size="md">
                  {data.category && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <CategoryBadge category={data.category} />
                    </div>
                  )}
                  <h1
                    style={{
                      margin:     0,
                      color:      "#fff",
                      fontSize:   "clamp(1.75rem, 4vw, 2.75rem)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: "var(--font-heading-weight)",
                      lineHeight: 1.2,
                    }}
                  >
                    {data.title}
                  </h1>
                </Container>
              </div>
            )}
          </div>
        )}

        {/* Below-image: meta row + summary */}
        <div
          style={{
            borderBottom:  "1px solid var(--card-border)",
            paddingBottom: "1.5rem",
            paddingTop:    "1.25rem",
          }}
        >
          <Container size="md">
            <Stack gap={3}>
              {data.breadcrumbs && data.breadcrumbs.length > 0 && (
                <Breadcrumbs items={data.breadcrumbs} />
              )}
              {/* Title when no cover image */}
              {data.title && !data.coverImageUrl && (
                <>
                  {data.category && <div><CategoryBadge category={data.category} /></div>}
                  <h1
                    style={{
                      margin:     0,
                      color:      "var(--text)",
                      fontSize:   "clamp(1.75rem, 4vw, 2.75rem)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: "var(--font-heading-weight)",
                      lineHeight: 1.2,
                    }}
                  >
                    {data.title}
                  </h1>
                </>
              )}
              {data.summary && (
                <p style={{
                  margin:     0,
                  fontSize:   "1.125rem",
                  color:      "var(--text-muted)",
                  lineHeight: 1.6,
                }}>
                  {data.summary}
                </p>
              )}
              <MetaRow
                author={data.author}
                publishedAt={data.publishedAt}
                updatedAt={data.updatedAt}
                readingTime={data.readingTime}
                tags={data.tags}
              />
            </Stack>
          </Container>
        </div>
      </header>
    );
  }

  // ── default — contained cover image, title, summary, meta row ─────────────
  return (
    <header style={{ borderBottom: "1px solid var(--card-border)", paddingTop: "2.5rem", paddingBottom: "2rem" }}>
      <Container size="md">
        <Stack gap={5}>
          {/* Cover image */}
          {data.coverImageUrl && (
            <div
              style={{
                aspectRatio:  "16 / 9",
                overflow:     "hidden",
                borderRadius: "var(--card-radius)",
                background:   "var(--bg-subtle)",
              }}
            >
              <img
                src={data.coverImageUrl}
                alt={data.coverImageAlt ?? data.title ?? "Article cover"}
                loading="eager"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          )}

          <Stack gap={3}>
            {data.breadcrumbs && data.breadcrumbs.length > 0 && (
              <Breadcrumbs items={data.breadcrumbs} />
            )}
            {data.category && <div><CategoryBadge category={data.category} /></div>}

            {data.title && (
              <h1
                style={{
                  margin:     0,
                  color:      "var(--text)",
                  fontSize:   "clamp(1.75rem, 4vw, 2.5rem)",
                  fontFamily: "var(--font-heading)",
                  fontWeight: "var(--font-heading-weight)",
                  lineHeight: 1.25,
                }}
              >
                {data.title}
              </h1>
            )}

            {data.summary && (
              <p style={{
                margin:     0,
                fontSize:   "1.125rem",
                color:      "var(--text-muted)",
                lineHeight: 1.6,
              }}>
                {data.summary}
              </p>
            )}

            <MetaRow
              author={data.author}
              publishedAt={data.publishedAt}
              updatedAt={data.updatedAt}
              readingTime={data.readingTime}
              tags={data.tags}
            />
          </Stack>
        </Stack>
      </Container>
    </header>
  );
}
