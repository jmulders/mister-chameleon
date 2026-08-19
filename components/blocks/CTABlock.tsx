import type React from "react";
import { Container } from "@/components/primitives/Container";
import { InlineRichText } from "@/components/blocks/InlineRichText";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { TrackedCTAButton } from "@/components/tracking/TrackedCTAButton";
import { resolveContextBlockVariant } from "@/page-config/block-variants";
import type { CtaLayoutVariant } from "@/page-config/block-variants";

/**
 * CTABlock
 *
 * Bottom-of-page conversion section.
 *
 * ─── Layout variants ─────────────────────────────────────────────────────────
 *
 *   cta_banner  — full-width brand-coloured centred section (default)
 *   cta_split   — headline/body left, CTA button group pinned right
 *   cta_card    — contained card on a neutral section background
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   title          Required  Large display headline
 *   text           Required  Supporting paragraph beneath the headline
 *   cta            Required  Primary call-to-action button { label, href }
 *   layoutVariant  Optional  Structural layout key (default: "cta_banner")
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-cta-bg        Section background (banner/split variants)
 *   --section-cta-body      Body text colour on CTA background
 *   --primary               Glow decoration at low opacity
 *   --card-bg               Inverted button bg / card background
 *   --card-border           Card border (card variant)
 *   --card-radius           Card border-radius (card variant)
 *   --card-shadow           Card shadow (card variant)
 *   --primary-active        CTA button text colour
 *   --font-heading          Heading font family
 *   --font-heading-weight   Heading font weight
 *   --section-subtle-bg     Neutral section background (card variant)
 *   --section-subtle-border Section border colour (card variant)
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
  /**
   * Structural layout variant for this CTA block.
   * Defaults to "cta_banner" when absent or unrecognised.
   */
  layoutVariant?: string;
}

export function CTABlock({ title, text, cta, ctaKey, layoutVariant: rawLayout }: CTABlockProps) {
  const layout = resolveContextBlockVariant("cta", rawLayout) as CtaLayoutVariant;

  // ── cta_split ───────────────────────────────────────────────────────────────
  //
  // Headline and body text on the left; CTA button group pinned to the right.
  // Section uses the same --section-cta-bg as the banner variant so it adapts
  // to tenant presets consistently.

  if (layout === "cta_split") {
    return (
      <Section
        spacing="lg"
        style={{ background: "var(--section-cta-bg)" }}
        className="relative overflow-hidden"
      >
        <Container size="lg" className="relative z-10">
          {/* Mobile: stacked column (text then button, full-width).
               lg+: side-by-side row with text left, button right. */}
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">

            {/* Text column — full-width on mobile, flex-1 in row */}
            <div className="flex-1 min-w-0">
              <Stack gap={3}>
                <Text
                  variant="h2"
                  color="inverse"
                  balance
                  className="max-w-xl"
                  style={{
                    fontFamily:    "var(--font-heading)",
                    fontWeight:    "var(--font-heading-weight)",
                    letterSpacing: "var(--block-heading-tracking)",
                    textTransform: "var(--block-heading-transform)" as React.CSSProperties["textTransform"],
                  }}
                >
                  {title}
                </Text>
                <Text
                  variant="body"
                  className="max-w-xl text-lg"
                  style={{ color: "var(--section-cta-body)" }}
                >
                  <InlineRichText source={text} />
                </Text>
              </Stack>
            </div>

            {/* CTA column — full-width on mobile, shrink-0 in row */}
            <div className="shrink-0">
              <TrackedCTAButton
                href={cta.href}
                label={cta.label}
                ctaKey={ctaKey}
                position="cta_block"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--primary-active)",
                }}
                className="w-full sm:w-auto shadow-lg"
              />
            </div>

          </div>
        </Container>
      </Section>
    );
  }

  // ── cta_card ─────────────────────────────────────────────────────────────────
  //
  // CTA content inside an elevated card on a neutral section background.
  // Good for in-page CTAs that should not dominate the full viewport width.

  if (layout === "cta_card") {
    return (
      <Section
        spacing="xl"
        style={{
          background:        "var(--section-subtle-bg)",
          borderTopColor:    "var(--section-subtle-border)",
          borderBottomColor: "var(--section-subtle-border)",
        }}
        className="border-y"
      >
        <Container size="md">
          {/* Elevated card */}
          <div
            className="border p-8 sm:p-12 text-center"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor:     "var(--card-border)",
              borderRadius:    "var(--card-radius)",
              boxShadow:       "var(--card-shadow)",
            }}
          >
            <Stack gap={6} align="center">
              <Text
                variant="h2"
                align="center"
                balance
                className="max-w-xl"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: "var(--font-heading-weight)",
                }}
              >
                {title}
              </Text>
              <Text
                variant="body"
                color="muted"
                align="center"
                className="max-w-lg"
              >
                <InlineRichText source={text} />
              </Text>
              <TrackedCTAButton
                href={cta.href}
                label={cta.label}
                ctaKey={ctaKey}
                position="cta_block"
                variant="primary"
                className="shadow-sm"
              />
            </Stack>
          </div>
        </Container>
      </Section>
    );
  }

  // ── cta_banner (default) ─────────────────────────────────────────────────────
  //
  // Full-width brand-coloured centred section. High-contrast background makes
  // it impossible to miss.

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
            <InlineRichText source={text} />
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
