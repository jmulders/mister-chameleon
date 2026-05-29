/**
 * ContentSectionBlock
 *
 * A flexible editorial content section: optional eyebrow + headline + intro
 * paragraph + Portable Text body + 0–2 CTA buttons.  The go-to block for
 * standalone prose sections that do not need a more specialised layout.
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   content_default — single left-aligned or centred column (default)
 *   content_split   — eyebrow/heading left, body/CTAs right (two-column)
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ContentSectionBlockData  see page-config/types.ts
 *   variant   ContentSectionVariant    see above
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --text-brand        Eyebrow label colour
 *   --font-heading      Heading font family
 *   --card-border       Divider between left/right columns (split variant)
 */

import { Container }            from "@/components/primitives/Container";
import { Section }              from "@/components/primitives/Section";
import { Stack }                from "@/components/primitives/Stack";
import { Text }                 from "@/components/primitives/Text";
import { PortableTextRenderer } from "@/components/blocks/sections/PortableTextRenderer";
import { resolveBlockVariant }  from "@/page-config/block-variants";
import type { ContentSectionVariant } from "@/page-config/block-variants";
import type { ContentSectionBlockData, BlockCTA } from "@/page-config";
import type { PortableTextBlock } from "@/cms/types";

interface ContentSectionBlockProps {
  data:     ContentSectionBlockData;
  variant?: string;
}

// ── CTA row ───────────────────────────────────────────────────────────────────

function ContentCTARow({ ctas, align }: { ctas?: readonly BlockCTA[]; align?: "left" | "center" }) {
  const visible = (ctas ?? []).slice(0, 2);
  if (visible.length === 0) return null;

  const justify = align === "center" ? "justify-center" : "justify-start";

  return (
    <div className={`flex flex-wrap items-center gap-3 ${justify}`}>
      {visible.map((cta, i) => {
        const v = cta.variant ?? (i === 0 ? "primary" : "secondary");
        const isPrimary = v === "primary";
        return (
          <a
            key={cta.href}
            href={cta.href}
            className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={
              isPrimary
                ? { background: "var(--btn-bg)", color: "var(--btn-text)" }
                : { background: "var(--bg-subtle)", color: "var(--text)" }
            }
          >
            {cta.label}
          </a>
        );
      })}
    </div>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function ContentSectionBlock({ data, variant: rawVariant }: ContentSectionBlockProps) {
  const variant = resolveBlockVariant("contentSection", rawVariant) as ContentSectionVariant;
  const { eyebrow, heading, intro, body, ctas, maxWidth = "default", align = "left" } = data;

  // ── content_split variant ──────────────────────────────────────────────────
  //
  // Eyebrow + heading on the left, intro + body + CTAs on the right.
  // Good for "Our approach" or "Why us" sections where the heading stands alone.

  if (variant === "content_split") {
    return (
      <Section spacing="lg">
        <Container size="lg">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">

            {/* Left column — labels */}
            <div className="lg:w-2/5 xl:w-1/3">
              <Stack gap={4}>
                {eyebrow && (
                  <Text
                    variant="body-sm"
                    weight="semibold"
                    className="uppercase tracking-wide"
                    style={{ color: "var(--text-brand)" }}
                  >
                    {eyebrow}
                  </Text>
                )}
                {heading && (
                  <Text
                    variant="h2"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {heading}
                  </Text>
                )}
              </Stack>
            </div>

            {/* Right column — content */}
            <div className="flex-1">
              <Stack gap={6}>
                {intro && (
                  <Text variant="body" className="text-lg" color="muted">
                    {intro}
                  </Text>
                )}
                {body && body.length > 0 && (
                  <PortableTextRenderer blocks={body as PortableTextBlock[]} />
                )}
                <ContentCTARow ctas={ctas} align="left" />
              </Stack>
            </div>

          </div>
        </Container>
      </Section>
    );
  }

  // ── content_default variant ────────────────────────────────────────────────
  //
  // Single column; centred or left-aligned depending on the `align` field.

  const containerSize = maxWidth === "narrow" ? "sm" : maxWidth === "wide" ? "lg" : "md";
  const textAlign = align === "center" ? "center" : "left";

  return (
    <Section spacing="lg">
      <Container size={containerSize}>
        <Stack gap={6}>
          {eyebrow && (
            <Text
              variant="body-sm"
              weight="semibold"
              className="uppercase tracking-wide"
              align={textAlign}
              style={{ color: "var(--text-brand)" }}
            >
              {eyebrow}
            </Text>
          )}

          {heading && (
            <Text
              variant="h2"
              align={textAlign}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {heading}
            </Text>
          )}

          {intro && (
            <Text variant="body" className="text-lg" color="muted" align={textAlign}>
              {intro}
            </Text>
          )}

          {body && body.length > 0 && (
            <PortableTextRenderer blocks={body as PortableTextBlock[]} />
          )}

          <ContentCTARow ctas={ctas} align={align} />
        </Stack>
      </Container>
    </Section>
  );
}
