/**
 * CtaSectionBlock
 *
 * Renders a `ctaSection` page section — a full-width call-to-action banner
 * with a title, description, and a single button. Supports three background
 * treatments via the `variant` prop.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      CtaSectionBlockData  { title?, description?, primaryCta? }
 *   variant   CtaSectionVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default — uses var(--section-cta-bg); standard brand-coloured background
 *   brand   — explicit brand accent (alias for default; useful for CMS clarity)
 *   dark    — dark neutral background; pairs well with lighter page sections
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-cta-bg        Section background (default / brand variants)
 *   --section-cta-body      Body text on CTA background
 *   --primary               Glow decoration at low opacity
 *   --card-bg               Inverted button background (white/surface)
 *   --primary-active        Inverted button text colour
 *   --radius-interactive    Button border-radius (from radius personality)
 *   --font-heading          Heading font family
 *   --font-heading-weight   Heading font weight
 */

import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { CtaSectionVariant } from "@/page-config/block-variants";
import type { CtaSectionBlockData } from "@/page-config";

interface CtaSectionBlockProps {
  data:     CtaSectionBlockData;
  variant?: string;
}

export function CtaSectionBlock({ data, variant: rawVariant }: CtaSectionBlockProps) {
  const variant    = resolveBlockVariant("ctaSection", rawVariant) as CtaSectionVariant;
  const { title, description, primaryCta } = data;
  const showButton = primaryCta?.label && primaryCta?.href;

  // Resolve background: dark variant uses a neutral dark colour; default and brand
  // both delegate to var(--section-cta-bg) so all brand-coloured CTAs stay in sync
  // across tenant presets with a single token change.
  const sectionBg  = variant === "dark" ? "var(--neutral-900, #111827)" : "var(--section-cta-bg)";
  const glowColour = variant === "dark" ? "transparent" : "var(--primary)";

  return (
    <Section
      spacing="xl"
      style={{ background: sectionBg }}
      className="relative overflow-hidden"
    >
      {/* Subtle radial glow — only visible on brand / default variants */}
      {variant !== "dark" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="h-[500px] w-[500px] rounded-full blur-3xl opacity-30"
            style={{ background: glowColour }}
          />
        </div>
      )}

      <Container size="md" className="relative z-10">
        <Stack gap={6} align="center" className="text-center">
          {title && (
            <Text
              variant="h2"
              color="inverse"
              align="center"
              balance
              className="max-w-2xl"
              style={{
                fontFamily:  "var(--font-heading)",
                fontWeight:  "var(--font-heading-weight)",
              }}
            >
              {title}
            </Text>
          )}

          {description && (
            <Text
              variant="body"
              align="center"
              className="max-w-xl"
              style={{ color: "var(--section-cta-body)" }}
            >
              {description}
            </Text>
          )}

          {/*
           * Inverted button: white/surface background, primary-active text.
           * --radius-interactive drives border-radius so it follows the
           * tenant's chosen radius personality (sharp / balanced / soft).
           */}
          {showButton && (
            <a
              href={primaryCta.href}
              className="mt-2 inline-flex items-center justify-center px-6 py-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                backgroundColor: "var(--card-bg)",
                color:           "var(--primary-active)",
                borderRadius:    "var(--radius-interactive)",
                // Ring offset matches the section background
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore — CSS custom property; valid at runtime
                "--tw-ring-offset-color": sectionBg,
              } as React.CSSProperties}
            >
              {primaryCta.label}
            </a>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
