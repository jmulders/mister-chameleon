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

interface TestimonialSectionBlockProps {
  data:     TestimonialSectionBlockData;
  variant?: string;
}

export function TestimonialSectionBlock({
  data,
  variant: rawVariant,
}: TestimonialSectionBlockProps) {
  const variant = resolveBlockVariant("testimonialSection", rawVariant) as TestimonialVariant;
  const { heading, testimonials } = data;
  const items = testimonials ?? [];

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
          background: "var(--proof-bg)",
          borderTopColor: "var(--proof-border)",
          borderBottomColor: "var(--proof-border)",
        }}
        className="border-y"
      >
        <Container size="md">
          <Stack gap={8} align="center" className="text-center">
            {heading && (
              <Text variant="h2" align="center">
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
    <Section spacing="lg">
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

                  {/* Attribution */}
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
