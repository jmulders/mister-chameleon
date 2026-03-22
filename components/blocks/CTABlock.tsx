import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { TrackedCTAButton } from "@/components/tracking/TrackedCTAButton";

/**
 * CTABlock
 *
 * Bottom-of-page conversion section. High-contrast background makes
 * it impossible to miss. This block is the closing argument — its copy
 * acknowledges the visitor's journey and removes final friction.
 *
 * Prop names align with CMS field names (CTABlockData) so that experience
 * data can be spread directly onto this component without a mapper step:
 *
 *   <CTABlock {...experience.cta} />
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   title    Required  Large display headline
 *   text     Required  Supporting paragraph beneath the headline
 *   cta      Required  Primary call-to-action button { label, href }
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-cta-bg        Section background (default: --primary / brand-600)
 *                           Per-preset: brand-600 (marketing), neutral-800 (enterprise)
 *   --section-cta-body      Body text colour on CTA background (default: --primary-subtle)
 *   --primary               Glow decoration at low opacity
 *   --card-bg               Inverted CTA button background (white/surface)
 *   --primary-active        CTA button text colour (readable on card-bg)
 *   --font-heading          Heading font family
 *   --font-heading-weight   Heading font weight
 */

export interface CTABlockProps {
  /** Large display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  text: string;
  /** Primary call-to-action button */
  cta: { label: string; href: string };
  /**
   * Variant key from the decision layer (e.g. "cta_meeting").
   * Forwarded to TrackedCTAButton for attribution in click events.
   */
  ctaKey?: string;
}

export function CTABlock({ title, text, cta, ctaKey }: CTABlockProps) {
  return (
    /*
     * --section-cta-bg replaces hardcoded bg-brand-600.
     * Defaults to --primary in theme.css.  enterprise-clean sets it to
     * neutral-800; bold-brand keeps it brand-600.
     */
    <Section
      spacing="xl"
      style={{ background: "var(--section-cta-bg)" }}
      className="relative overflow-hidden"
    >
      {/* Background decoration — uses --primary at low opacity */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full blur-3xl opacity-40"
          style={{ background: "var(--primary)" }}
        />
        <div
          className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full blur-3xl opacity-40"
          style={{ background: "var(--primary-active)" }}
        />
      </div>

      <Container size="md" className="relative z-10">
        <Stack gap={8} align="center" className="text-center">
          <Text
            variant="h2"
            color="inverse"
            align="center"
            balance
            className="max-w-2xl"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight)",
            }}
          >
            {title}
          </Text>

          {/* --section-cta-body replaces hardcoded text-brand-100 */}
          <Text
            variant="body"
            align="center"
            className="max-w-lg text-lg"
            style={{ color: "var(--section-cta-body)" }}
          >
            {text}
          </Text>

          {/*
           * Inverted button: uses --card-bg as background (white by default),
           * with --primary-active as text — readable on white, adapts to presets.
           */}
          <TrackedCTAButton
            href={cta.href}
            label={cta.label}
            ctaKey={ctaKey}
            position="cta_block"
            style={{
              backgroundColor: "var(--card-bg)",
              color: "var(--primary-active)",
            }}
            className="shadow-lg"
          />
        </Stack>
      </Container>
    </Section>
  );
}
