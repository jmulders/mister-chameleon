/**
 * ListingBlock
 *
 * Renders a `listing` content block — a static, CMS-driven overview of any
 * content type (blog posts, vacancies, case studies, news items).
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ListingBlockData    { heading?, items[], maxItems?, viewAllHref?,
 *                                   viewAllLabel? }
 *   variant   ListingVariant      see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default / grid  — 3-col card grid; standard overview layout.
 *                     Best for blog overview, case study index.
 *
 *   list            — Single-column horizontal row list.
 *                     Better scannable for vacancies and news items.
 *
 *   compact         — 2-col denser card grid; for sidebars and inlines.
 *                     Uses compact text-only ResultCard to maximise density.
 *
 * ─── Content type agnostic ───────────────────────────────────────────────────
 *
 *   The block renders any ListingItem regardless of content type.  Blog posts
 *   and vacancies both populate the same ListingItem shape; type-specific
 *   metadata (reading time, location) lives in ListingItem.meta pairs and is
 *   rendered uniformly by ResultCard.
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --text / --text-muted
 *   --primary
 *   --bg / --bg-subtle
 *   --font-heading / --font-heading-weight
 *   (card tokens delegated to ResultCard)
 */

import { Container }           from "@/components/primitives/Container";
import { Section }             from "@/components/primitives/Section";
import { Grid }                from "@/components/primitives/Grid";
import { Stack }               from "@/components/primitives/Stack";
import { Text }                from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { ListingVariant } from "@/page-config/block-variants";
import type { ListingBlockData } from "@/page-config";
import { ResultCard }    from "@/components/blocks/listing/ResultCard";
import { ViewAllLink }   from "@/components/blocks/listing/ViewAllLink";
import { MediaSlider }   from "@/components/blocks/listing/MediaSlider";

// ── Props ─────────────────────────────────────────────────────────────────────

interface ListingBlockProps {
  data:     ListingBlockData;
  variant?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ListingBlock({ data, variant: rawVariant }: ListingBlockProps) {
  const variant = resolveBlockVariant("listing", rawVariant) as ListingVariant;

  const { heading, intro, viewAllHref, viewAllLabel } = data;

  // ── listing_slider variant ──────────────────────────────────────────────────
  //
  // Horizontally scrolling CSS-snap media carousel.
  // Each slide is an image or a hosted/uploaded video authored in the CMS
  // via the `media_items` replicator field.
  //
  // NOTE: This variant uses `data.mediaItems`, NOT `data.items`.  The early
  // `items.length === 0` guard below must NOT apply here.

  if (variant === "listing_slider") {
    const slides = data.mediaItems ? [...data.mediaItems] : [];

    return (
      <Section spacing="lg">
        <Container size="lg">
          {slides.length > 0 ? (
            <MediaSlider slides={slides} heading={heading} />
          ) : (
            /* Empty state so the block is visible in the CP live preview */
            <Stack gap={8}>
              {heading && (
                <Text
                  variant="h2"
                  style={{
                    color:      "var(--text)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--font-heading-weight)",
                  }}
                >
                  {heading}
                </Text>
              )}
              {intro && (
                <div
                  className="text-base leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                  dangerouslySetInnerHTML={{ __html: intro }}
                />
              )}
              <div
                className="flex items-center justify-center rounded-xl border-2 border-dashed py-16"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <span className="text-sm opacity-60">Add slides in the CMS to see the slider</span>
              </div>
            </Stack>
          )}
        </Container>
      </Section>
    );
  }

  // ── All other variants — content listing items ─────────────────────────────
  //
  // Respect maxItems cap when set and bail when the list is empty.

  // Respect maxItems cap when set
  const items = data.maxItems
    ? data.items.slice(0, data.maxItems)
    : data.items;

  if (items.length === 0) return null;

  // ── compact variant ─────────────────────────────────────────────────────────
  //
  // Text-only list with a bottom border separator per item.
  // No section background — floats on the page surface.

  if (variant === "compact") {
    return (
      <Section spacing="md">
        <Container size="md">
          <Stack gap={6}>
            {heading && (
              <Text
                variant="h2"
                style={{
                  color:      "var(--text)",
                  fontFamily: "var(--font-heading)",
                  fontWeight: "var(--font-heading-weight)",
                }}
              >
                {heading}
              </Text>
            )}
            {intro && (
              <div
                className="text-base leading-relaxed"
                style={{ color: "var(--text-muted)" }}
                dangerouslySetInnerHTML={{ __html: intro }}
              />
            )}

            <div>
              {items.map((item, i) => (
                <ResultCard key={item.id ?? i} item={item} layout="compact" headingLevel={3} />
              ))}
            </div>

            {viewAllHref && (
              <ViewAllLink href={viewAllHref} label={viewAllLabel} />
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── list variant ────────────────────────────────────────────────────────────
  //
  // Single-column horizontal row cards.  Better for scan-heavy content
  // (vacancies, news) where title + location matters more than imagery.

  if (variant === "list") {
    return (
      <Section spacing="lg" style={{ background: "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={8}>
            {heading && (
              <Text
                variant="h2"
                style={{
                  color:      "var(--text)",
                  fontFamily: "var(--font-heading)",
                  fontWeight: "var(--font-heading-weight)",
                }}
              >
                {heading}
              </Text>
            )}
            {intro && (
              <div
                className="text-base leading-relaxed"
                style={{ color: "var(--text-muted)" }}
                dangerouslySetInnerHTML={{ __html: intro }}
              />
            )}

            <Stack gap={4}>
              {items.map((item, i) => (
                <ResultCard key={item.id ?? i} item={item} layout="row" headingLevel={3} />
              ))}
            </Stack>

            {viewAllHref && (
              <ViewAllLink href={viewAllHref} label={viewAllLabel} />
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default / grid variant ──────────────────────────────────────────────────
  //
  // 3-column card grid (default) with a subtle section background.
  // Falls through for both "default" and "grid" — they are synonymous here.

  return (
    <Section
      spacing="lg"
      style={{
        background:   "var(--bg-subtle)",
        borderTop:    "1px solid var(--card-border)",
        borderBottom: "1px solid var(--card-border)",
      }}
    >
      <Container size="xl">
        <Stack gap={10}>
          {(heading || intro) && (
            <Stack gap={3}>
              {heading && (
                <Text
                  variant="h2"
                  style={{
                    color:      "var(--text)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--font-heading-weight)",
                  }}
                >
                  {heading}
                </Text>
              )}
              {intro && (
                <div
                  className="text-base leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                  dangerouslySetInnerHTML={{ __html: intro }}
                />
              )}
            </Stack>
          )}

          <Grid cols={3} gap="lg">
            {items.map((item, i) => (
              <ResultCard key={item.id ?? i} item={item} layout="card" headingLevel={3} />
            ))}
          </Grid>

          {viewAllHref && (
            <ViewAllLink href={viewAllHref} label={viewAllLabel} />
          )}
        </Stack>
      </Container>
    </Section>
  );
}


