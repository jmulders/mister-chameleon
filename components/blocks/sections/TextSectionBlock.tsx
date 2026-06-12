/**
 * TextSectionBlock
 *
 * Renders a `textSection` page section — an optional heading followed by
 * Portable Text body copy. Suitable for "About" paragraphs, policy text,
 * long-form editorial content, and any rich text block on a CMS page.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      TextSectionBlockData  { heading?, body? }
 *   variant   TextSectionVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   text_single — left-aligned single column (default)
 *   text_split  — heading in a narrow left column, body in a wider right column
 *   text_lead   — centred, extra-large lead paragraph treatment
 *
 *   Legacy aliases:
 *   default  → text_single
 *   centered → text_lead
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   (none — uses default section/text tokens inherited from the layout)
 */

import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { TextSectionVariant } from "@/page-config/block-variants";
import type { TextSectionBlockData } from "@/page-config";
import { PortableTextRenderer } from "./PortableTextRenderer";
import type { PortableTextBlock } from "@/cms/types";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface TextSectionBlockProps {
  data:     TextSectionBlockData;
  variant?: string;
  surface?: BlockSurface;
}

export function TextSectionBlock({ data, variant: rawVariant, surface }: TextSectionBlockProps) {
  const resolved = resolveBlockVariant("textSection", rawVariant) as TextSectionVariant;
  const { heading, body, htmlBody } = data;

  // Normalise canonical spec names → implementation identifiers.
  // text_single → default | text_lead → centered
  const variant: TextSectionVariant = (
    resolved === "text_single" ? "default"  :
    resolved === "text_lead"   ? "centered" :
    resolved
  ) as TextSectionVariant;

  // ── text_split variant ──────────────────────────────────────────────────────
  //
  // Two-column layout: narrow heading column on the left, body copy on the
  // right. Good for editorial sections where the heading acts as a section
  // label alongside longer body text.

  if (variant === "text_split") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-16">

            {/* Heading column — narrow label */}
            {heading && (
              <div className="lg:w-1/3 lg:shrink-0">
                <Text
                  variant="h2"
                  style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}
                >
                  {heading}
                </Text>
              </div>
            )}

            {/* Body column — wider */}
            {htmlBody ? (
              <div
                className="flex-1 min-w-0 prose prose-neutral max-w-none"
                dangerouslySetInnerHTML={{ __html: htmlBody }}
              />
            ) : body && body.length > 0 ? (
              <div className="flex-1 min-w-0">
                <PortableTextRenderer
                  blocks={body as PortableTextBlock[]}
                  className="prose-neutral max-w-none"
                />
              </div>
            ) : null}
          </div>
        </Container>
      </Section>
    );
  }

  // ── centered / text_lead variant and default ─────────────────────────────────
  //
  // "centered" → heading and body centre-aligned, narrower max-width.
  // "default"  → left-aligned, standard container width.

  const isCentered = variant === "centered";

  return (
    <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
      <Container size="md">
        <Stack gap={6}>
          {heading && (
            <Text
              variant="h2"
              align={isCentered ? "center" : undefined}
              balance={isCentered}
            >
              {heading}
            </Text>
          )}

          {htmlBody ? (
            <div
              className={`prose prose-neutral max-w-none${isCentered ? " text-center" : ""}`}
              dangerouslySetInnerHTML={{ __html: htmlBody }}
            />
          ) : body && body.length > 0 ? (
            <div className={isCentered ? "text-center" : undefined}>
              <PortableTextRenderer
                // Cast: readonly PortableTextBlock[] → PortableTextBlock[]
                // Safe — PortableTextRenderer only reads the array.
                blocks={body as PortableTextBlock[]}
                className={isCentered ? "prose-neutral mx-auto" : "prose-neutral max-w-none"}
              />
            </div>
          ) : null}
        </Stack>
      </Container>
    </Section>
  );
}
