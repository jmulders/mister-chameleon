/**
 * CtaSectionBlock
 *
 * Renders a `ctaSection` content block — a call-to-action section with a
 * title, description, and up to two buttons (primaryCta + secondaryCta).
 * Supports full-section structural variants and compact banner variants.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      CtaSectionBlockData  { title?, description?, primaryCta?,
 *                                    secondaryCta?, background? }
 *   variant   CtaSectionVariant    see below
 *
 * ─── Full-section variants ────────────────────────────────────────────────────
 *
 *   cta_banner — full-width brand-coloured centred section (default)
 *   cta_split  — heading/description left, CTA button group right
 *   cta_card   — CTA content inside an elevated card on a neutral section
 *
 * ─── Compact banner variants ─────────────────────────────────────────────────
 *
 *   cta_banner_default — compact horizontal bar on a neutral subtle background;
 *                        title + description on the left, 1–2 CTAs on the right.
 *                        Good for in-page informational / soft-promo use.
 *
 *   cta_banner_compact — notification-bar style on a brand background;
 *                        title (inline description) left, inverted CTA(s) right.
 *                        Maximum vertical compactness for alert-style banners.
 *
 * ─── Premium / specialty variants ────────────────────────────────────────────
 *
 *   cta_glow       — near-black section with a soft brand-coloured radial glow
 *                   behind the headline; vivid primary CTA cuts through the dark.
 *                   Dark AI family signature variant.
 *   cta_soft       — very light neutral section (subtle bg); primary CTA +
 *                   optional ghost secondary; no dramatic background.
 *                   Clean Corporate family signature variant.
 *   cta_newsletter — inline email capture; heading + description on the left,
 *                   email input + submit button on the right. Content Blog family.
 *
 * ─── Legacy aliases (kept for backward compat) ────────────────────────────────
 *
 *   default → cta_banner
 *   brand   → cta_banner (colour alias; same layout)
 *   dark    → cta_banner with dark neutral background (token-driven)
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *  Full-section variants:
 *   --section-cta-bg        Section background (banner / split variants)
 *   --section-cta-body      Body text on CTA background
 *   --primary               Glow decoration at low opacity
 *   --card-bg               Inverted button bg / card background
 *   --card-border           Card border (card variant)
 *   --card-radius           Card border-radius (card variant)
 *   --card-shadow           Card shadow (card variant)
 *   --primary-active        Inverted button text colour
 *   --radius-interactive    Button border-radius
 *   --font-heading          Heading font family
 *   --font-heading-weight   Heading font weight
 *   --section-subtle-bg     Neutral section background (card / soft variants)
 *   --section-subtle-border Section border colour (card / soft variants)
 *
 *  Compact banner variants (additional tokens):
 *   --section-cta-body      Supporting text on brand background (compact)
 *   --font-subheading-weight Title font weight (banner_default)
 *
 *  Dark glow / newsletter variants (additional tokens):
 *   --cta-dark-bg           Near-black section bg for cta_glow (default: #0a0a0f)
 */

import type React from "react";
import { Container }  from "@/components/primitives/Container";
import { Section }    from "@/components/primitives/Section";
import { Stack }      from "@/components/primitives/Stack";
import { Text }       from "@/components/primitives/Text";
import { CTAGroup }   from "@/components/molecules";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { CtaSectionVariant } from "@/page-config/block-variants";
import type { CtaSectionBlockData, BlockCTA } from "@/page-config";
import { NewsletterForm } from "./_NewsletterForm";

/** Applies block-style-profile heading tracking and transform to headings. */
const HEADING_STYLE: React.CSSProperties = {
  letterSpacing: "var(--block-heading-tracking)",
  textTransform: "var(--block-heading-transform)" as React.CSSProperties["textTransform"],
};

interface CtaSectionBlockProps {
  data:     CtaSectionBlockData;
  variant?: string;
}

/** Build a BlockCTA[] from the primaryCta / secondaryCta pair. */
function buildCtas(
  primaryCta?:   BlockCTA | null,
  secondaryCta?: BlockCTA | null,
): BlockCTA[] {
  const list: BlockCTA[] = [];
  if (primaryCta?.label && primaryCta?.href)   list.push(primaryCta);
  if (secondaryCta?.label && secondaryCta?.href) list.push(secondaryCta);
  return list;
}

export function CtaSectionBlock({ data, variant: rawVariant }: CtaSectionBlockProps) {
  const resolved = resolveBlockVariant("ctaSection", rawVariant) as CtaSectionVariant;
  const { title, description, primaryCta, secondaryCta } = data;
  const ctas = buildCtas(primaryCta, secondaryCta);

  // Normalise canonical spec names → implementation keys.
  // cta_banner → default (full-width centred brand section)
  const variant: CtaSectionVariant = (
    resolved === "cta_banner" ? "default" :
    resolved
  ) as CtaSectionVariant;

  // ── cta_banner_default ───────────────────────────────────────────────────────
  //
  // Compact horizontal bar on a neutral subtle-bg surface. Title + optional
  // description on the left; 1–2 CTA buttons on the right. Minimal vertical
  // footprint — ideal for in-page promotional or informational banners.

  if (variant === "cta_banner_default") {
    return (
      <Section
        spacing="none"
        className="border-y py-4 sm:py-5"
        style={{
          background:        "var(--section-subtle-bg)",
          borderTopColor:    "var(--section-subtle-border)",
          borderBottomColor: "var(--section-subtle-border)",
        }}
      >
        <Container size="lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">

            {/* Text */}
            <div className="flex-1 min-w-0">
              {title && (
                <Text
                  variant="h4"
                  as="p"
                  style={{ fontWeight: "var(--font-subheading-weight)" }}
                >
                  {title}
                </Text>
              )}
              {description && (
                <Text variant="body-sm" color="muted" className="mt-0.5">
                  {description}
                </Text>
              )}
            </div>

            {/* CTAs */}
            {ctas.length > 0 && (
              <div className="shrink-0">
                <CTAGroup ctas={ctas} size="sm" />
              </div>
            )}

          </div>
        </Container>
      </Section>
    );
  }

  // ── cta_banner_compact ───────────────────────────────────────────────────────
  //
  // Notification-bar style on a brand background. Maximum vertical compactness
  // (py-3). Title on the left with an optional inline description; inverted
  // CTA button(s) on the right. Use for high-visibility alert or promo banners.

  if (variant === "cta_banner_compact") {
    return (
      <Section
        spacing="none"
        className="py-3"
        style={{ background: "var(--section-cta-bg)" }}
      >
        <Container size="lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">

            {/* Text — title + inline description */}
            {title && (
              <p className="flex-1 min-w-0 text-sm font-semibold text-white">
                {title}
                {description && (
                  <span
                    className="ml-2 font-normal text-sm"
                    style={{ color: "var(--section-cta-body)" }}
                  >
                    {description}
                  </span>
                )}
              </p>
            )}

            {/* CTAs — inverted colors for brand background */}
            {ctas.length > 0 && (
              <div className="shrink-0">
                <CTAGroup ctas={ctas} size="sm" inverted />
              </div>
            )}

          </div>
        </Container>
      </Section>
    );
  }

  // ── cta_split variant ───────────────────────────────────────────────────────
  //
  // Heading and description left, CTA button group (primary + optional secondary)
  // pinned to the right. Uses the brand CTA background.

  if (variant === "cta_split") {
    const sectionBg = "var(--section-cta-bg)";
    return (
      <Section
        spacing="lg"
        style={{ background: sectionBg }}
        className="relative overflow-hidden"
      >
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">

            {/* Text column */}
            <div className="flex-1">
              <Stack gap={3}>
                {title && (
                  <Text
                    variant="h2"
                    color="inverse"
                    balance
                    className="max-w-xl"
                    style={{
                      fontFamily:    "var(--font-heading)",
                      fontWeight:    "var(--font-heading-weight)",
                      ...HEADING_STYLE,
                    }}
                  >
                    {title}
                  </Text>
                )}
                {description && (
                  <Text
                    variant="body"
                    className="max-w-xl"
                    style={{ color: "var(--section-cta-body)" }}
                  >
                    {description}
                  </Text>
                )}
              </Stack>
            </div>

            {/* CTA column */}
            {ctas.length > 0 && (
              <div className="shrink-0">
                <CTAGroup ctas={ctas} size="md" inverted />
              </div>
            )}
          </div>
        </Container>
      </Section>
    );
  }

  // ── cta_card variant ────────────────────────────────────────────────────────
  //
  // CTA content inside an elevated card on a neutral section background.

  if (variant === "cta_card") {
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
              {title && (
                <Text
                  variant="h2"
                  align="center"
                  balance
                  className="max-w-xl"
                  style={{
                    fontFamily:    "var(--font-heading)",
                    fontWeight:    "var(--font-heading-weight)",
                    ...HEADING_STYLE,
                  }}
                >
                  {title}
                </Text>
              )}
              {description && (
                <Text
                  variant="body"
                  color="muted"
                  align="center"
                  className="max-w-lg"
                >
                  {description}
                </Text>
              )}
              {ctas.length > 0 && (
                <CTAGroup ctas={ctas} size="md" align="center" />
              )}
            </Stack>
          </div>
        </Container>
      </Section>
    );
  }

  // ── cta_media_first variant ──────────────────────────────────────────────────
  //
  // Full-section CTA with a background image. The image fills the section;
  // a dark overlay ensures the text and button remain readable. Suitable for
  // conversion sections on landing pages where a visual impact is desired.

  if (variant === "cta_media_first") {
    const { imageUrl, imageAlt } = data;
    return (
      <Section
        spacing="xl"
        className="relative overflow-hidden"
        style={{ background: "var(--neutral-900, #111827)" }}
      >
        {/* Background image */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={imageAlt ?? ""}
            aria-hidden={!imageAlt || undefined}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
          />
        )}

        {/* Dark overlay gradient for text legibility */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)" }}
          aria-hidden="true"
        />

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
                  fontFamily:    "var(--font-heading)",
                  fontWeight:    "var(--font-heading-weight)",
                  ...HEADING_STYLE,
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
            {ctas.length > 0 && (
              <CTAGroup ctas={ctas} size="md" inverted align="center" />
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── cta_glow ─────────────────────────────────────────────────────────────────
  //
  // Near-black section with a vivid brand-coloured radial glow centred behind
  // the headline. No decorative panel — the glow IS the visual. Vivid primary
  // CTA button. Dark AI family signature variant.

  if (variant === "cta_glow") {
    return (
      <Section
        spacing="xl"
        style={{ background: "var(--cta-dark-bg, #0a0a0f)" }}
        className="relative overflow-hidden"
      >
        {/* Wide radial glow — brand colour at medium opacity */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="h-[500px] w-[500px] rounded-full blur-3xl"
            style={{
              background: "var(--primary)",
              opacity:    0.18,
            }}
          />
        </div>
        {/* Narrow bright core */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="h-32 w-32 rounded-full blur-2xl"
            style={{
              background: "var(--primary)",
              opacity:    0.35,
            }}
          />
        </div>

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
                  ...HEADING_STYLE,
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
                style={{ color: "var(--section-cta-body, rgba(255,255,255,0.7))" }}
              >
                {description}
              </Text>
            )}
            {ctas.length > 0 && (
              <CTAGroup ctas={ctas} size="md" inverted align="center" />
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── cta_soft ─────────────────────────────────────────────────────────────────
  //
  // Very light neutral section — lets the copy carry the weight.
  // Primary CTA button with optional ghost secondary. No dramatic background.
  // Clean Corporate family signature variant.

  if (variant === "cta_soft") {
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
        <Container size="md" className="relative z-10">
          <Stack gap={6} align="center" className="text-center">
            {title && (
              <Text
                variant="h2"
                align="center"
                balance
                className="max-w-2xl"
                style={{
                  fontFamily:  "var(--font-heading)",
                  fontWeight:  "var(--font-heading-weight)",
                  color:       "var(--text)",
                  ...HEADING_STYLE,
                }}
              >
                {title}
              </Text>
            )}
            {description && (
              <Text
                variant="body"
                color="muted"
                align="center"
                className="max-w-xl"
              >
                {description}
              </Text>
            )}
            {ctas.length > 0 && (
              <CTAGroup ctas={ctas} size="md" align="center" />
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── cta_newsletter ────────────────────────────────────────────────────────────
  //
  // Inline email capture section. Heading + description on the left;
  // email input + submit button on the right. No href-based CTAs.
  // Content Blog family variant.
  //
  // Note: The submit button is a visual affordance only — wire the `action`
  // attribute or a form handler in the wrapping page to process submissions.

  if (variant === "cta_newsletter") {
    return (
      <Section
        spacing="lg"
        style={{
          background:        "var(--section-subtle-bg)",
          borderTopColor:    "var(--section-subtle-border)",
          borderBottomColor: "var(--section-subtle-border)",
        }}
        className="border-y"
      >
        <Container size="lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">

            {/* Text column */}
            <div className="flex-1 min-w-0">
              {title && (
                <Text
                  variant="h3"
                  balance
                  className="max-w-md"
                  style={{
                    color:      "var(--text)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--font-heading-weight)",
                  }}
                >
                  {title}
                </Text>
              )}
              {description && (
                <Text variant="body" color="muted" className="mt-2 max-w-sm">
                  {description}
                </Text>
              )}
            </div>

            {/* Email capture form — client component (owns the onSubmit handler) */}
            <NewsletterForm />

          </div>
        </Container>
      </Section>
    );
  }

  // ── default / brand / dark / cta_banner (centred full-section banner) ────────
  //
  // Full-width brand-coloured centred section with optional glow decoration.
  // "dark" overrides --section-cta-bg with a dark neutral colour.

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

          {ctas.length > 0 && (
            <CTAGroup ctas={ctas} size="md" inverted align="center" />
          )}
        </Stack>
      </Container>
    </Section>
  );
}
