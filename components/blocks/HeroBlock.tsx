import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { Badge } from "@/components/ui/Badge";
import { TrackedCTAButton } from "@/components/tracking/TrackedCTAButton";

/**
 * HeroBlock
 *
 * The primary above-the-fold section. Sets the visitor's first impression
 * and drives the top-of-funnel CTA. Fully driven by CMS content — no
 * business logic or defaults live here.
 *
 * Prop names align with CMS field names (HeroBlockData) so that experience
 * data can be spread directly onto this component without a mapper step:
 *
 *   <HeroBlock {...experience.hero} />
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   title      Required  Primary display headline
 *   subtitle   Required  Supporting paragraph beneath the headline
 *   cta        Required  Primary call-to-action button { label, href }
 *   tag        Optional  Small eyebrow label / badge above the headline
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --hero-bg               Section background (default: neutral-950)
 *                           Per-preset: neutral-800 (enterprise), brand-900 (bold)
 *   --hero-glow-color       Glow decoration colour (default: brand primary)
 *   --hero-glow-opacity     Glow decoration opacity (default: 0.2)
 *   --hero-title-color      Headline text colour (default: neutral-0 / white)
 *   --hero-subtitle-color   Subheadline and micro-copy text colour (default: neutral-400)
 *   --font-heading          Heading font family (tenant-overrideable)
 *   --font-heading-weight   Heading font weight (tenant-overrideable; default: 700)
 */

export interface HeroBlockProps {
  /** Primary display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  subtitle: string;
  /** Primary call-to-action button */
  cta: { label: string; href: string };
  /** Optional eyebrow badge rendered above the headline */
  tag?: string;
  /**
   * Variant key from the decision layer (e.g. "cta_meeting").
   * Forwarded to TrackedCTAButton for attribution in click events.
   */
  ctaKey?: string;
}

export function HeroBlock({ title, subtitle, cta, tag, ctaKey }: HeroBlockProps) {
  return (
    /*
     * --hero-bg drives the section background.
     * Defaults to neutral-950 in theme.css; overridden per tenant/preset via
     * layout.tsx inline <style> — zero className changes needed here.
     */
    <Section
      spacing="xl"
      style={{ background: "var(--hero-bg)" }}
      className="relative overflow-hidden"
    >
      {/* Radial glow — colour and opacity independently token-driven */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          className="h-[600px] w-[600px] rounded-full blur-3xl"
          style={{
            background: "var(--hero-glow-color)",
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore — CSS custom property value; valid at runtime
            opacity: "var(--hero-glow-opacity)",
          }}
        />
      </div>

      <Container size="lg" className="relative z-10">
        <Stack gap={8} align="center" className="text-center">
          {/* Eyebrow badge */}
          {tag && (
            <Badge variant="primary" size="md">
              {tag}
            </Badge>
          )}

          {/* Headline — font family/weight driven by --font-heading / --font-heading-weight */}
          <Text
            variant="display"
            align="center"
            balance
            className="max-w-4xl whitespace-pre-line"
            style={{
              color:      "var(--hero-title-color)",
              fontFamily: "var(--font-heading)",
              fontWeight: "var(--font-heading-weight)",
            }}
          >
            {title}
          </Text>

          {/* Subheadline — --hero-subtitle-color is intentionally muted against dark backgrounds */}
          <Text
            variant="body"
            align="center"
            className="max-w-2xl text-lg"
            style={{ color: "var(--hero-subtitle-color)" }}
          >
            {subtitle}
          </Text>

          {/* Primary CTA */}
          <Stack direction="row" gap={4} align="center" wrap>
            <TrackedCTAButton
              href={cta.href}
              label={cta.label}
              ctaKey={ctaKey}
              position="hero"
              variant="primary"
            />
          </Stack>

          {/* Social proof micro-copy */}
          <Text
            variant="caption"
            style={{ color: "var(--hero-subtitle-color)" }}
          >
            No credit card required · Setup in &lt; 5 minutes
          </Text>
        </Stack>
      </Container>
    </Section>
  );
}
