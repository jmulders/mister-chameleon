/**
 * ArticleBodyBlock
 *
 * Renders an `articleBody` content block — the primary long-form reading body
 * for blog posts, vacancy descriptions, case studies, or documentation pages.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ArticleBodyBlockData  { body: PortableTextBlock[], footnotes? }
 *   variant   ArticleBodyVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default  — Narrow prose column (~70ch); optimised line-length for reading.
 *              Centred within the page with comfortable vertical rhythm.
 *
 *   wide     — Full content-column width.  For image-heavy long-form content,
 *              documentation, or technical writing that benefits from wider
 *              code blocks and side-by-side layouts.
 *
 * ─── Semantic distinction ────────────────────────────────────────────────────
 *
 *   articleBody is semantically different from richText (a general-purpose
 *   body drop-in):
 *     - articleBody carries semantic weight as "the main reading body"
 *     - articleBody strips the section padding richText carries, so it flows
 *       naturally after an articleMeta block without double spacing
 *     - articleBody may render with article-specific typography in the future
 *       (drop caps, pull quotes, etc.)
 *
 * ─── Footnotes ───────────────────────────────────────────────────────────────
 *
 *   When `footnotes` is present, an ordered list is rendered below the body
 *   separated by a hairline rule.  Footnote index is 1-based.
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --text / --text-muted
 *   --card-border
 *   --font-body (fallback: inherit)
 */

import { Container }              from "@/components/primitives/Container";
import { resolveBlockVariant }    from "@/page-config/block-variants";
import type { ArticleBodyVariant } from "@/page-config/block-variants";
import type { ArticleBodyBlockData } from "@/page-config";
import { PortableTextRenderer }   from "@/components/blocks/sections/PortableTextRenderer";

// ── Props ─────────────────────────────────────────────────────────────────────

interface ArticleBodyBlockProps {
  data:     ArticleBodyBlockData;
  variant?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ArticleBodyBlock({ data, variant: rawVariant }: ArticleBodyBlockProps) {
  const variant = resolveBlockVariant("articleBody", rawVariant) as ArticleBodyVariant;

  const containerSize = variant === "wide" ? "lg" : "md";

  return (
    <div style={{ paddingBlock: "3rem" }}>
      <Container size={containerSize}>
        <article
          style={{
            color:      "var(--text)",
            fontSize:   "1.0625rem",
            lineHeight: "1.8",
            fontFamily: "var(--font-body, inherit)",
          }}
        >
          <PortableTextRenderer blocks={[...data.body]} />

          {/* Footnotes */}
          {data.footnotes && data.footnotes.length > 0 && (
            <footer
              style={{
                marginTop:  "3rem",
                paddingTop: "1.5rem",
                borderTop:  "1px solid var(--card-border)",
              }}
            >
              <h2
                style={{
                  fontSize:   "0.875rem",
                  fontWeight: 600,
                  color:      "var(--text-muted)",
                  margin:     "0 0 0.75rem 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Notes
              </h2>
              <ol style={{ margin: 0, padding: "0 0 0 1.25rem" }}>
                {data.footnotes.map((note, i) => (
                  <li
                    key={i}
                    id={`footnote-${i + 1}`}
                    style={{
                      fontSize:     "0.875rem",
                      color:        "var(--text-muted)",
                      lineHeight:   "1.6",
                      marginBottom: "0.375rem",
                    }}
                  >
                    {note}
                  </li>
                ))}
              </ol>
            </footer>
          )}
        </article>
      </Container>
    </div>
  );
}
