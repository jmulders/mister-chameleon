/**
 * TestimonialSectionBlock
 *
 * Renders a `testimonialSection` page section — an optional heading followed
 * by a grid of testimonial cards, or a single prominent full-width quote.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      TestimonialSectionBlockData  { heading?, testimonials[] }
 *   variant   TestimonialVariant           see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default    — 3-col grid of bordered quote cards
 *   quote-card — full-width single-column centered quote layout;
 *                large quote mark, large attribution; best with 1 testimonial
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --proof-card-bg      Card background
 *   --proof-card-border  Card border colour
 *   --proof-card-radius  Card border-radius
 *   --proof-card-shadow  Card box-shadow
 *   --proof-quote-color  Pull-quote opening mark colour
 *   --proof-bg           Section background (quote-card variant)
 *   --proof-border       Section border colour (quote-card variant)
 *   --font-subheading-weight  Author name font weight
 */

import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Grid } from "@/components/primitives/Grid";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { TestimonialVariant } from "@/page-config/block-variants";
import type { TestimonialSectionBlockData } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface TestimonialSectionBlockProps {
  data:     TestimonialSectionBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Profile-driven helpers ─────────────────────────────────────────────────────

/** Applies block-style-profile heading tracking and transform to h2 / h3 elements. */
const HEADING_STYLE: React.CSSProperties = {
  letterSpacing: "var(--block-heading-tracking)",
  textTransform: "var(--block-heading-transform)" as React.CSSProperties["textTransform"],
};

const DIVIDER_SECTION_STYLE = {
  borderTopWidth:    "var(--block-divider-width)",
  borderBottomWidth: "var(--block-divider-width)",
  borderTopColor:    "var(--block-divider-color)",
  borderBottomColor: "var(--block-divider-color)",
  borderTopStyle:    "solid" as const,
  borderBottomStyle: "solid" as const,
};

// Proof card style with profile-driven padding
const proofCardStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding:         "var(--block-card-padding)",
  backgroundColor: "var(--proof-card-bg)",
  borderColor:     "var(--proof-card-border)",
  borderRadius:    "var(--proof-card-radius)",
  boxShadow:       "var(--proof-card-shadow)",
  ...extra,
});

export function TestimonialSectionBlock({
  data,
  variant: rawVariant,
  surface,
}: TestimonialSectionBlockProps) {
  const resolved = resolveBlockVariant("testimonialSection", rawVariant) as TestimonialVariant;
  const { heading, testimonials } = data;
  const items = testimonials ?? [];

  // Normalise canonical spec names → implementation keys.
  // testimonial_grid      → default (3-col grid of bordered quote cards)
  // testimonial_single    → quote-card (full-width single centered quote)
  // testimonial_highlight → testimonial_highlight (featured card + grid)
  // testimonial_slider / testimonial_featured_image → pass through unchanged
  const variant: TestimonialVariant = (
    resolved === "testimonial_grid"   ? "default"    :
    resolved === "testimonial_single" ? "quote-card" :
    resolved
  ) as TestimonialVariant;

  // ── testimonial_slider variant ──────────────────────────────────────────────
  //
  // Horizontally scrolling CSS-snap carousel of quote cards.
  // Works without JavaScript — uses scroll-snap for native browser scrolling.
  // Cards are fixed-width (min-w-80) so partial next card peeks at the edge.

  if (variant === "testimonial_slider") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={8}>
            {heading && (
              <Text variant="h2" align="center" style={HEADING_STYLE}>{heading}</Text>
            )}
            <div
              className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
              style={{ scrollbarWidth: "none" }}
            >
              {items.map((testimonial, index) => (
                <div
                  key={`${testimonial.author}-${index}`}
                  className="min-w-80 flex-shrink-0 snap-start border"
                  style={proofCardStyle()}
                >
                  <Stack gap={4}>
                    <span
                      className="text-3xl leading-none select-none"
                      style={{ color: "var(--proof-quote-color)" }}
                      aria-hidden="true"
                    >
                      &ldquo;
                    </span>
                    <Text variant="body" color="muted" className="italic leading-relaxed">
                      {testimonial.quote}
                    </Text>
                    <Stack gap={0}>
                      <Text variant="body-sm" style={{ fontWeight: "var(--font-subheading-weight)" }}>
                        {testimonial.author}
                      </Text>
                      {testimonial.company && (
                        <Text variant="caption" color="subtle">{testimonial.company}</Text>
                      )}
                    </Stack>
                  </Stack>
                </div>
              ))}
            </div>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── testimonial_featured_image variant ──────────────────────────────────────
  //
  // Large featured quote from the first testimonial, with the author's
  // avatar displayed prominently alongside the text.

  if (variant === "testimonial_featured_image") {
    const [featured, ...rest] = items;
    return (
      <Section spacing="xl" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={10}>
            {heading && (
              <Text variant="h2" align="center" style={HEADING_STYLE}>{heading}</Text>
            )}
            {featured && (
              <div
                className="flex flex-col gap-8 border lg:flex-row lg:items-center lg:gap-12"
                style={proofCardStyle()}
              >
                {/* Author photo */}
                {featured.avatar && (
                  <div className="shrink-0">
                    <img
                      src={featured.avatar}
                      alt={featured.author}
                      className="h-24 w-24 rounded-full object-cover lg:h-32 lg:w-32"
                    />
                  </div>
                )}
                <Stack gap={5} className="flex-1">
                  <span
                    className="block text-5xl leading-none select-none"
                    style={{ color: "var(--proof-quote-color)" }}
                    aria-hidden="true"
                  >
                    &ldquo;
                  </span>
                  <Text variant="h3" balance color="default" className="italic" weight="normal">
                    {featured.quote}
                  </Text>
                  <Stack gap={0}>
                    <Text variant="body" style={{ fontWeight: "var(--font-subheading-weight)" }}>
                      {featured.author}
                    </Text>
                    {featured.company && (
                      <Text variant="body-sm" color="subtle">{featured.company}</Text>
                    )}
                  </Stack>
                </Stack>
              </div>
            )}
            {/* Supporting grid of remaining testimonials */}
            {rest.length > 0 && (
              <Grid cols={3} gap="lg">
                {rest.map((testimonial, index) => (
                  <Stack
                    key={`${testimonial.author}-${index}`}
                    gap={4}
                    className="border"
                    style={proofCardStyle()}
                  >
                    <span
                      className="text-3xl leading-none select-none"
                      style={{ color: "var(--proof-quote-color)" }}
                      aria-hidden="true"
                    >
                      &ldquo;
                    </span>
                    <Text variant="body" color="muted" className="flex-1 italic leading-relaxed">
                      {testimonial.quote}
                    </Text>
                    <Stack gap={0}>
                      <Text variant="body-sm" style={{ fontWeight: "var(--font-subheading-weight)" }}>
                        {testimonial.author}
                      </Text>
                      {testimonial.company && (
                        <Text variant="caption" color="subtle">{testimonial.company}</Text>
                      )}
                    </Stack>
                  </Stack>
                ))}
              </Grid>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── testimonial_highlight variant ───────────────────────────────────────────
  //
  // Featured large quote card on top, followed by a grid of smaller quote
  // cards below. Best when you have one standout testimonial + several supporting
  // ones. Uses the first item as the featured quote.

  if (variant === "testimonial_highlight") {
    const [featured, ...rest] = items;
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={10}>
            {heading && (
              <Text variant="h2" align="center" style={HEADING_STYLE}>
                {heading}
              </Text>
            )}

            {/* Featured card */}
            {featured && (
              <div
                className="border"
                style={proofCardStyle()}
              >
                <Stack gap={5}>
                  <span
                    className="block text-5xl leading-none select-none"
                    style={{ color: "var(--proof-quote-color)" }}
                    aria-hidden="true"
                  >
                    &ldquo;
                  </span>
                  <Text
                    variant="h3"
                    balance
                    color="default"
                    className="max-w-3xl italic"
                    weight="normal"
                  >
                    {featured.quote}
                  </Text>
                  <Stack gap={0}>
                    <Text
                      variant="body"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      {featured.author}
                    </Text>
                    {featured.company && (
                      <Text variant="body-sm" color="subtle">
                        {featured.company}
                      </Text>
                    )}
                  </Stack>
                </Stack>
              </div>
            )}

            {/* Supporting grid */}
            {rest.length > 0 && (
              <Grid cols={3} gap="lg">
                {rest.map((testimonial, index) => (
                  <Stack
                    key={`${testimonial.author}-${index}`}
                    gap={4}
                    className="border"
                    style={proofCardStyle()}
                  >
                    <span
                      className="text-3xl leading-none select-none"
                      style={{ color: "var(--proof-quote-color)" }}
                      aria-hidden="true"
                    >
                      &ldquo;
                    </span>
                    <Text
                      variant="body"
                      color="muted"
                      className="flex-1 italic leading-relaxed"
                    >
                      {testimonial.quote}
                    </Text>
                    <Stack gap={0}>
                      <Text
                        variant="body-sm"
                        style={{ fontWeight: "var(--font-subheading-weight)" }}
                      >
                        {testimonial.author}
                      </Text>
                      {testimonial.company && (
                        <Text variant="caption" color="subtle">
                          {testimonial.company}
                        </Text>
                      )}
                    </Stack>
                  </Stack>
                ))}
              </Grid>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── quote-card variant ──────────────────────────────────────────────────────
  //
  // Full-width centered single-column layout. Uses the first testimonial.
  // Large prominent quote mark and large attribution text.

  if (variant === "quote-card") {
    const featured = items[0];

    return (
      <Section
        spacing="xl"
        style={{
          background: resolveSurface(surface) ?? "var(--proof-bg)",
          ...DIVIDER_SECTION_STYLE,
        }}
      >
        <Container size="md">
          <Stack gap={8} align="center" className="text-center">
            {heading && (
              <Text variant="h2" align="center" style={HEADING_STYLE}>
                {heading}
              </Text>
            )}

            {featured && (
              <Stack gap={6} align="center">
                {/* Large opening quote mark */}
                <span
                  className="block text-7xl leading-none select-none"
                  style={{ color: "var(--proof-quote-color)" }}
                  aria-hidden="true"
                >
                  &ldquo;
                </span>

                <Text
                  variant="h3"
                  align="center"
                  balance
                  color="default"
                  className="max-w-2xl italic"
                  weight="normal"
                >
                  {featured.quote}
                </Text>

                <Stack gap={1} align="center">
                  <Text
                    variant="body"
                    align="center"
                    style={{ fontWeight: "var(--font-subheading-weight)" }}
                  >
                    {featured.author}
                  </Text>
                  {featured.company && (
                    <Text variant="body-sm" color="subtle" align="center">
                      {featured.company}
                    </Text>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default variant ─────────────────────────────────────────────────────────
  //
  // 3-col grid of bordered quote cards.

  return (
    <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
      <Container size="lg">
        <Stack gap={12}>
          {heading && (
            <Text variant="h2" align="center">
              {heading}
            </Text>
          )}

          {items.length > 0 && (
            <Grid cols={3} gap="lg">
              {items.map((testimonial, index) => (
                <Stack
                  key={`${testimonial.author}-${index}`}
                  gap={4}
                  className="border p-6"
                  style={{
                    backgroundColor: "var(--proof-card-bg)",
                    borderColor: "var(--proof-card-border)",
                    borderRadius: "var(--proof-card-radius)",
                    boxShadow: "var(--proof-card-shadow)",
                  }}
                >
                  {/* Opening quote mark */}
                  <span
                    className="text-3xl leading-none select-none"
                    style={{ color: "var(--proof-quote-color)" }}
                    aria-hidden="true"
                  >
                    &ldquo;
                  </span>

                  <Text
                    variant="body"
                    color="muted"
                    className="flex-1 italic leading-relaxed"
                  >
                    {testimonial.quote}
                  </Text>

                  {/* Attribution — avatar + name/role/company */}
                  <div className="flex items-center gap-3">
                    {testimonial.avatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={testimonial.avatar}
                        alt={testimonial.author}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    )}
                    <Stack gap={0}>
                      <Text
                        variant="body-sm"
                        style={{ fontWeight: "var(--font-subheading-weight)" }}
                      >
                        {testimonial.author}
                      </Text>
                      {(testimonial.role || testimonial.company) && (
                        <Text variant="caption" color="subtle">
                          {[testimonial.role, testimonial.company].filter(Boolean).join(" · ")}
                        </Text>
                      )}
                    </Stack>
                  </div>
                </Stack>
              ))}
            </Grid>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
