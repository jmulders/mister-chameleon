/**
 * RelatedContentBlock
 *
 * Renders a `relatedContent` content block — a curated set of related articles,
 * vacancies, or case studies placed at the end of a detail page to encourage
 * further exploration.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      RelatedContentBlockData  { heading?, items[], maxItems? }
 *   variant   RelatedContentVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default / grid  — 3-col card grid; matches the listing/default layout.
 *   list            — Single-column horizontal row list.
 *   carousel        — Horizontally scrolling card strip; best on mobile.
 *
 * ─── RelatedItem → ResultCard adapter ────────────────────────────────────────
 *
 *   `RelatedItem` is structurally a subset of `ListingItem` (it lacks `tags`
 *   and `meta`).  Items are adapted to the `ListingItem` shape so the shared
 *   `ResultCard` component can render them without branching.
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --text / --text-muted
 *   --bg-subtle / --card-border
 *   --font-heading / --font-heading-weight
 *   (card tokens delegated to ResultCard)
 */

import { Container }                from "@/components/primitives/Container";
import { Section }                  from "@/components/primitives/Section";
import { Grid }                     from "@/components/primitives/Grid";
import { Stack }                    from "@/components/primitives/Stack";
import { Text }                     from "@/components/primitives/Text";
import { resolveBlockVariant }      from "@/page-config/block-variants";
import type { RelatedContentVariant } from "@/page-config/block-variants";
import type { RelatedContentBlockData, RelatedItem, ListingItem } from "@/page-config";
import { ResultCard }               from "@/components/blocks/listing/ResultCard";

// ── Props ─────────────────────────────────────────────────────────────────────

interface RelatedContentBlockProps {
  data:     RelatedContentBlockData;
  variant?: string;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Maps a RelatedItem to the ListingItem shape expected by ResultCard.
 * RelatedItem is a structural subset of ListingItem — only `tags` and `meta`
 * are absent, so the adapter simply adds them as empty/undefined.
 */
function toListingItem(item: RelatedItem): ListingItem {
  return {
    id:       item.id,
    title:    item.title,
    href:     item.href,
    excerpt:  item.excerpt,
    imageUrl: item.imageUrl,
    imageAlt: item.imageAlt,
    category: item.category,
    date:     item.date,
    // tags and meta are not present on RelatedItem
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RelatedContentBlock({ data, variant: rawVariant }: RelatedContentBlockProps) {
  const variant = resolveBlockVariant("relatedContent", rawVariant) as RelatedContentVariant;

  const items = data.maxItems
    ? data.items.slice(0, data.maxItems)
    : data.items;

  if (items.length === 0) return null;

  const heading = data.heading ?? "Related content";

  // ── carousel ───────────────────────────────────────────────────────────────
  //
  // Horizontally scrolling strip; snaps to each card.
  // Falls back to a visible grid on wider viewports via the card's max-width.

  if (variant === "carousel") {
    return (
      <Section
        spacing="lg"
        style={{ borderTop: "1px solid var(--card-border)", background: "var(--bg)" }}
      >
        <Container size="xl">
          <Stack gap={6}>
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

            {/* Scrollable strip */}
            <div
              style={{
                display:              "grid",
                gridAutoFlow:         "column",
                gridAutoColumns:      "clamp(260px, 75vw, 320px)",
                gap:                  "1.5rem",
                overflowX:            "auto",
                scrollSnapType:       "x mandatory",
                scrollbarWidth:       "none",
                paddingBottom:        "0.5rem",
                // Negative margin trick for full-bleed scroll on mobile
                marginInline:         "calc(var(--container-padding, 1rem) * -1)",
                paddingInline:        "var(--container-padding, 1rem)",
              }}
            >
              {items.map((item) => (
                <div key={item.id} style={{ scrollSnapAlign: "start" }}>
                  <ResultCard item={toListingItem(item)} layout="card" headingLevel={3} />
                </div>
              ))}
            </div>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── list ───────────────────────────────────────────────────────────────────

  if (variant === "list") {
    return (
      <Section
        spacing="lg"
        style={{ borderTop: "1px solid var(--card-border)", background: "var(--bg)" }}
      >
        <Container size="lg">
          <Stack gap={6}>
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

            <Stack gap={4}>
              {items.map((item) => (
                <ResultCard key={item.id} item={toListingItem(item)} layout="row" headingLevel={3} />
              ))}
            </Stack>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default / grid ─────────────────────────────────────────────────────────

  return (
    <Section
      spacing="lg"
      style={{
        borderTop:  "1px solid var(--card-border)",
        background: "var(--bg-subtle)",
      }}
    >
      <Container size="xl">
        <Stack gap={8}>
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

          <Grid cols={3} gap="lg">
            {items.map((item) => (
              <ResultCard key={item.id} item={toListingItem(item)} layout="card" headingLevel={3} />
            ))}
          </Grid>
        </Stack>
      </Container>
    </Section>
  );
}
